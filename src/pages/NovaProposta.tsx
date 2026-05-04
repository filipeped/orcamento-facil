import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useProposals, ProposalItem, ServiceType, SERVICE_TYPES } from "@/contexts/ProposalsContext";
import { useCatalog, CatalogItem } from "@/contexts/CatalogContext";
import { useAuth } from "@/contexts/AuthContext";
import { getSupabase } from "@/lib/supabase";
import {
  ArrowLeft,
  Plus,
  Trash2,
  Send,
  Check,
  User,
  Phone,
  Search,
  X,
  Minus,
  AlertTriangle,
  Crown,
  Camera,
  Image,
  Loader2,
  FileStack,
  Sparkles,
  ShoppingCart,
  Leaf,
  CheckCircle2,
  Scissors,
  Palette,
  ClipboardList,
  Sprout,
  Wrench,
  Pencil,
} from "lucide-react";

// Mapa de ícones para tipos de serviço
const SERVICE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  scissors: Scissors,
  palette: Palette,
  "clipboard-list": ClipboardList,
};

interface ProposalTemplate {
  id: string;
  name: string;
  description: string | null;
  service_type: ServiceType;
  items: Array<{
    name: string;
    description: string;
    quantity: number;
    unit_price: number;
  }>;
  notes: string | null;
}
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function NovaProposta() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { createProposal, markAsSent, monthlyProposalsCount, monthlyLimit, canCreateProposal } = useProposals();
  const { items: catalogItems, getPrice, updateItem: updateCatalogItem } = useCatalog();
  const remainingProposals = monthlyLimit - monthlyProposalsCount;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingItemId, setUploadingItemId] = useState<string | null>(null);

  const [proposal, setProposal] = useState({
    clientName: "",
    clientPhone: "",
    serviceType: null as ServiceType | null,
    customServiceType: "", // Campo para especificar "Outro"
    items: [] as ProposalItem[],
    notes: "",
  });

  const [showCatalog, setShowCatalog] = useState(false);
  const [catalogSearch, setCatalogSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [catalogFilter, setCatalogFilter] = useState<"Plantas" | "Serviços">("Plantas");
  const [catalogPrices, setCatalogPrices] = useState<Record<string, number>>({});
  const [editingCatalogPrice, setEditingCatalogPrice] = useState<string | null>(null);
  const [editingCatalogQty, setEditingCatalogQty] = useState<string | null>(null);
  const [editingCatalogUnit, setEditingCatalogUnit] = useState<string | null>(null);
  const [editingCatalogObs, setEditingCatalogObs] = useState<string | null>(null);
  const [catalogUnits, setCatalogUnits] = useState<Record<string, string>>({});
  const [catalogObs, setCatalogObs] = useState<Record<string, string>>({});
  const [editingItemPrice, setEditingItemPrice] = useState<string | null>(null);
  const [editingItemDesc, setEditingItemDesc] = useState<string | null>(null);
  const [visibleItems, setVisibleItems] = useState(30);

  // Opções de unidades de medida
  const UNIT_OPTIONS = [
    { value: "un", label: "Unidade" },
    { value: "m", label: "Metro (m)" },
    { value: "m²", label: "Metro² (m²)" },
    { value: "m³", label: "Metro³ (m³)" },
    { value: "kg", label: "Quilo (kg)" },
    { value: "saco", label: "Saco" },
    { value: "diária", label: "Diária" },
    { value: "hora", label: "Hora" },
  ];

  // Debounce da busca (200ms)
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(catalogSearch), 200);
    return () => clearTimeout(timer);
  }, [catalogSearch]);

  // Reset itens visíveis quando muda filtro/busca
  useEffect(() => {
    setVisibleItems(30);
  }, [debouncedSearch, catalogFilter]);
  const [showPhotoGallery, setShowPhotoGallery] = useState<number | null>(null);
  const [templates, setTemplates] = useState<ProposalTemplate[]>([]);
  const [showTemplates, setShowTemplates] = useState(false);

  // Wizard step state
  const [currentStep, setCurrentStep] = useState(1);
  const totalSteps = 3;

  // Receber itens do catálogo (se vier do carrinho)
  useEffect(() => {
    const state = location.state as { items?: ProposalItem[] } | null;
    if (state?.items && state.items.length > 0) {
      setProposal(prev => ({
        ...prev,
        items: state.items!,
      }));
      // Começa no passo 1 para preencher o cliente primeiro
      // Os itens já estarão preenchidos quando chegar no passo 2
      setCurrentStep(1);
      // Limpar o state para evitar re-adicionar ao navegar
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  // Buscar templates do banco de dados
  useEffect(() => {
    const fetchTemplates = async () => {
      if (!user) return;

      try {
        const { data, error } = await getSupabase()
          .from("proposal_templates")
          .select("*")
          .or(`user_id.eq.${user.id},is_default.eq.true`)
          .order("is_default", { ascending: false });

        if (error) throw error;
        setTemplates(data || []);
      } catch (error) {
        console.error("Error fetching templates:", error);
      }
    };

    fetchTemplates();
  }, [user]);

  // Aplicar template
  const applyTemplate = (template: ProposalTemplate) => {
    const newItems: ProposalItem[] = template.items.map((item, index) => ({
      id: String(Date.now() + index),
      name: item.name || "",
      description: item.description || "",
      quantity: item.quantity || 1,
      unitPrice: Number(item.unit_price) || 0,
      photos: [],
    }));

    setProposal({
      ...proposal,
      serviceType: template.service_type,
      items: newItems,
      notes: template.notes || "",
    });

    setShowTemplates(false);
    toast.success(`Template "${template.name}" aplicado!`);
  };

  // Filter and sort catalog items (memoizado para performance)
  const filteredCatalogItems = useMemo(() => {
    const searchLower = debouncedSearch.toLowerCase();
    return catalogItems
      .filter((item) => {
        const matchesSearch = item.name.toLowerCase().includes(searchLower);
        const isService = item.category === "Serviços";
        const matchesCategory =
          (catalogFilter === "Serviços" && isService) ||
          (catalogFilter === "Plantas" && !isService);
        return matchesSearch && matchesCategory;
      })
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  }, [catalogItems, debouncedSearch, catalogFilter]);

  // Itens visíveis (limita renderização)
  const displayedItems = useMemo(() => {
    return filteredCatalogItems.slice(0, visibleItems);
  }, [filteredCatalogItems, visibleItems]);

  const hasMoreItems = filteredCatalogItems.length > visibleItems;

  // Obter preço do catálogo (editado ou original)
  const getCatalogPrice = (itemId: number | string) => {
    const key = String(itemId);
    if (catalogPrices[key] !== undefined) {
      return catalogPrices[key];
    }
    return getPrice(itemId);
  };

  // Obter unidade do catálogo (editada ou original)
  const getCatalogUnit = (item: CatalogItem) => {
    const key = String(item.id);
    if (catalogUnits[key] !== undefined) {
      return catalogUnits[key];
    }
    return item.unit || "un";
  };

  // Formatar exibição da unidade
  const formatUnit = (unit: string) => {
    const option = UNIT_OPTIONS.find(u => u.value === unit);
    return option ? `/${option.value}` : `/${unit}`;
  };

  // Obter observação do catálogo
  const getCatalogObs = (itemId: number | string) => {
    const key = String(itemId);
    return catalogObs[key] || "";
  };

  // Salvar preços e unidades editados no banco de dados
  const saveCatalogChanges = async () => {
    const priceUpdates = Object.entries(catalogPrices);
    const unitUpdates = Object.entries(catalogUnits);

    if (priceUpdates.length === 0 && unitUpdates.length === 0) return;

    // Combinar updates de preço e unidade
    const allUpdates = new Map<string, { price?: number; unit?: string }>();

    for (const [itemId, price] of priceUpdates) {
      allUpdates.set(itemId, { ...allUpdates.get(itemId), price });
    }

    for (const [itemId, unit] of unitUpdates) {
      allUpdates.set(itemId, { ...allUpdates.get(itemId), unit });
    }

    for (const [itemId, data] of allUpdates) {
      try {
        await updateCatalogItem(itemId, data);
      } catch (error) {
        console.error("Erro ao salvar alterações:", error);
      }
    }
    // Limpar dados temporários após salvar
    setCatalogPrices({});
    setCatalogUnits({});
  };

  const addItemFromCatalog = (catalogItem: CatalogItem) => {
    const existingIndex = proposal.items.findIndex(i => i.name === catalogItem.name);
    const price = getCatalogPrice(catalogItem.id);
    const obs = getCatalogObs(catalogItem.id);
    const unit = getCatalogUnit(catalogItem);

    if (existingIndex >= 0) {
      // Increment quantity and update price if item exists
      const updatedItems = [...proposal.items];
      updatedItems[existingIndex].quantity += 1;
      // Atualiza o preço se foi editado no catálogo
      if (price > 0) {
        updatedItems[existingIndex].unitPrice = price;
      }
      // Atualiza a descrição e unidade
      updatedItems[existingIndex].description = obs || "";
      updatedItems[existingIndex].unit = unit || "un";
      setProposal({ ...proposal, items: updatedItems });
    } else {
      // Add new item
      const newItem: ProposalItem = {
        id: String(Date.now()),
        name: catalogItem.name,
        description: obs || "",
        quantity: 1,
        unitPrice: price,
        imageUrl: catalogItem.imageUrl,
        photos: [],
        unit: unit || "un",
        nomeCientifico: catalogItem.nomeCientifico,
      };
      setProposal({ ...proposal, items: [...proposal.items, newItem] });
    }
    toast.success(`${catalogItem.name} adicionado!`, { duration: 1000 });
  };

  const getItemQuantityInProposal = (name: string) => {
    const item = proposal.items.find(i => i.name === name);
    return item?.quantity || 0;
  };

  // Diminuir quantidade de item do catálogo na proposta
  const decreaseItemFromCatalog = (catalogItem: CatalogItem) => {
    const existingIndex = proposal.items.findIndex(i => i.name === catalogItem.name);
    if (existingIndex >= 0) {
      const updatedItems = [...proposal.items];
      if (updatedItems[existingIndex].quantity > 1) {
        updatedItems[existingIndex].quantity -= 1;
        setProposal({ ...proposal, items: updatedItems });
      } else {
        // Remove item if quantity is 1
        updatedItems.splice(existingIndex, 1);
        setProposal({ ...proposal, items: updatedItems });
      }
    }
  };

  // Definir quantidade específica de item do catálogo
  const setItemQuantityFromCatalog = (catalogItem: CatalogItem, qty: number) => {
    const existingIndex = proposal.items.findIndex(i => i.name === catalogItem.name);
    if (qty <= 0) {
      // Remove item
      if (existingIndex >= 0) {
        const updatedItems = [...proposal.items];
        updatedItems.splice(existingIndex, 1);
        setProposal({ ...proposal, items: updatedItems });
      }
      return;
    }
    if (existingIndex >= 0) {
      const updatedItems = [...proposal.items];
      updatedItems[existingIndex].quantity = qty;
      setProposal({ ...proposal, items: updatedItems });
    }
  };

  const addManualItem = () => {
    const newItem: ProposalItem = {
      id: String(Date.now()),
      name: "",
      description: "",
      quantity: 1,
      unitPrice: 0,
      photos: [],
    };
    setProposal({ ...proposal, items: [...proposal.items, newItem] });
  };

  // Atualizar quantidade do item
  const updateItemQuantity = (itemId: string, delta: number) => {
    setProposal(prev => ({
      ...prev,
      items: prev.items.map(item =>
        item.id === itemId
          ? { ...item, quantity: Math.max(1, item.quantity + delta) }
          : item
      ),
    }));
  };

  // Atualizar preço unitário do item
  const updateItemPrice = (itemId: string, price: number) => {
    setProposal(prev => ({
      ...prev,
      items: prev.items.map(item =>
        item.id === itemId
          ? { ...item, unitPrice: price }
          : item
      ),
    }));
  };

  // Atualizar descrição/observação do item
  const updateItemDescription = (itemId: string, description: string) => {
    setProposal(prev => ({
      ...prev,
      items: prev.items.map(item =>
        item.id === itemId
          ? { ...item, description }
          : item
      ),
    }));
  };

  // Upload de foto para o item
  const handlePhotoUpload = async (itemId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    // Validar tipo de arquivo
    if (!file.type.startsWith("image/")) {
      toast.error("Selecione uma imagem válida");
      return;
    }

    // Validar tamanho (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Imagem muito grande. Máximo 5MB");
      return;
    }

    setUploadingItemId(itemId);

    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await getSupabase().storage
        .from("proposal-photos")
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = getSupabase().storage
        .from("proposal-photos")
        .getPublicUrl(fileName);

      // Adicionar foto ao item
      setProposal((prev) => ({
        ...prev,
        items: prev.items.map((item) =>
          item.id === itemId
            ? { ...item, photos: [...(item.photos || []), publicUrl] }
            : item
        ),
      }));

      toast.success("Foto adicionada!");
    } catch (error) {
      console.error("Erro ao fazer upload:", error);
      toast.error("Erro ao fazer upload da foto");
    } finally {
      setUploadingItemId(null);
      // Limpar o input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  // Remover foto do item
  const removePhoto = (itemId: string, photoUrl: string) => {
    setProposal((prev) => ({
      ...prev,
      items: prev.items.map((item) =>
        item.id === itemId
          ? { ...item, photos: (item.photos || []).filter((p) => p !== photoUrl) }
          : item
      ),
    }));
    toast.success("Foto removida");
  };

  const updateItem = (id: string, field: keyof ProposalItem, value: string | number) => {
    setProposal({
      ...proposal,
      items: proposal.items.map((item) =>
        item.id === id ? { ...item, [field]: value } : item
      ),
    });
  };

  const removeItem = (id: string) => {
    setProposal({
      ...proposal,
      items: proposal.items.filter((item) => item.id !== id),
    });
  };

  const calculateTotal = () => {
    return proposal.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const [isSending, setIsSending] = useState(false);

  const handleSend = async () => {
    if (proposal.items.length === 0) {
      toast.error("Adicione pelo menos um item");
      return;
    }

    setIsSending(true);

    try {
      // Auto-detect service type based on items or use default
      const serviceLabel = "Orçamento";

      const newProposal = await createProposal({
        client: {
          id: "",
          name: proposal.clientName.trim() || "Cliente",
          email: "",
          phone: proposal.clientPhone.trim(),
        },
        serviceType: proposal.serviceType || "manutencao",
        title: proposal.clientName.trim() ? `${serviceLabel} - ${proposal.clientName.trim()}` : serviceLabel,
        description: "",
        items: proposal.items.map(item => ({ ...item, id: "" })),
        notes: proposal.notes.trim(),
        validUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
      });

      if (!newProposal) {
        toast.error("Erro ao criar orcamento. Verifique sua conexão e tente novamente.");
        setIsSending(false);
        return;
      }

      await markAsSent(newProposal.id);

      const link = `https://verproposta.online/p/${newProposal.shortId || newProposal.id}`;

      // Try to copy link to clipboard (may fail on non-HTTPS)
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(link);
          toast.success("Orcamento criado! Link copiado.");
        } else {
          toast.success("Orcamento criado!");
        }
      } catch {
        toast.success("Orcamento criado!");
      }

      navigate(`/propostas/${newProposal.id}`);
    } catch (error) {
      console.error("Erro ao criar proposta:", error);
      if (error instanceof Error) {
        toast.error(error.message);
      } else {
        toast.error("Erro ao criar orcamento. Tente novamente.");
      }
      setIsSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-muted flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-card border-b border-border">
        <div className="px-3 sm:px-4 h-12 sm:h-14 flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              to="/propostas"
              className="p-1.5 sm:p-2 -ml-1.5 hover:bg-muted rounded-lg"
              aria-label="Voltar"
            >
              <ArrowLeft size={20} className="sm:w-[22px] sm:h-[22px]" />
            </Link>
            <h1 className="text-base sm:text-lg font-semibold">Novo Orçamento</h1>
          </div>
          {templates.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowTemplates(true)}
              className="gap-1.5 h-8 sm:h-9 text-xs sm:text-sm px-2 sm:px-3"
            >
              <FileStack size={14} className="sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">Templates</span>
            </Button>
          )}
        </div>
      </header>

      {/* Banner de limite de propostas */}
      {!canCreateProposal ? (
        <div className="bg-destructive/10 border-b border-destructive/20 px-3 sm:px-4 py-2 sm:py-3">
          <div className="max-w-lg mx-auto flex items-center gap-2 sm:gap-3">
            <AlertTriangle className="text-destructive flex-shrink-0" size={18} />
            <div className="flex-1 min-w-0">
              <p className="text-xs sm:text-sm font-medium text-destructive">
                Limite de {monthlyLimit} propostas/mês atingido
              </p>
              <p className="text-[10px] sm:text-xs text-destructive/80">
                Faça upgrade para criar propostas ilimitadas
              </p>
            </div>
            <Link to="/upgrade">
              <Button size="sm" variant="destructive" className="gap-1 h-7 sm:h-8 text-xs px-2 sm:px-3">
                <Crown size={12} className="sm:w-[14px] sm:h-[14px]" />
                Upgrade
              </Button>
            </Link>
          </div>
        </div>
      ) : remainingProposals <= 2 ? (
        <div className="bg-neutral-100 border-b border-neutral-200 px-3 sm:px-4 py-1.5 sm:py-2">
          <div className="max-w-lg mx-auto flex items-center justify-between">
            <p className="text-xs sm:text-sm text-neutral-600">
              <span className="font-medium">{remainingProposals}</span> {remainingProposals === 1 ? "proposta restante" : "propostas restantes"} este mês
            </p>
            <Link to="/upgrade" className="text-[10px] sm:text-xs text-emerald-600 hover:underline font-medium">
              Ver planos
            </Link>
          </div>
        </div>
      ) : null}

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto pb-24 sm:pb-28">
        <div className="max-w-lg mx-auto px-4 sm:px-6 py-6 sm:py-8">

          {/* Simple Progress Bar */}
          <div className="mb-6 sm:mb-8">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs sm:text-sm text-muted-foreground">
                Passo {currentStep} de {totalSteps}
              </span>
              <span className="text-xs sm:text-sm font-medium text-primary">
                {currentStep === 1 && "Cliente"}
                {currentStep === 2 && "Itens"}
                {currentStep === 3 && "Revisar"}
              </span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-300"
                style={{ width: `${(currentStep / totalSteps) * 100}%` }}
              />
            </div>
          </div>

          {/* STEP 1: Cliente */}
          {currentStep === 1 && (
            <div className="space-y-6 animate-page-in">
              <div className="text-center mb-6">
                <div className="w-16 h-16 sm:w-20 sm:h-20 bg-verde-50 rounded-full flex items-center justify-center mx-auto mb-4">
                  <User className="w-8 h-8 sm:w-10 sm:h-10 text-primary" />
                </div>
                <h2 className="text-xl sm:text-2xl font-bold mb-2">Para quem é o orçamento?</h2>
                <p className="text-sm sm:text-base text-muted-foreground">Digite o nome do seu cliente</p>
              </div>

              {/* Mostrar itens já selecionados */}
              {proposal.items.length > 0 && (
                <div className="bg-verde-50 border border-primary/20 rounded-xl p-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={18} className="text-primary" />
                    <span className="text-sm font-medium text-primary">
                      {proposal.items.length} {proposal.items.length === 1 ? "item selecionado" : "itens selecionados"}
                    </span>
                  </div>
                  <span className="font-bold text-primary">{formatCurrency(calculateTotal())}</span>
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Nome do cliente <span className="text-muted-foreground font-normal">(opcional)</span></label>
                  <Input
                    placeholder="Ex: João Silva"
                    value={proposal.clientName}
                    onChange={(e) => setProposal({ ...proposal, clientName: e.target.value })}
                    className="h-12 sm:h-14 text-base sm:text-lg"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block text-muted-foreground">Telefone (opcional)</label>
                  <Input
                    placeholder="(11) 99999-9999"
                    value={proposal.clientPhone}
                    onChange={(e) => setProposal({ ...proposal, clientPhone: e.target.value })}
                    className="h-12 sm:h-14 text-base sm:text-lg"
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: Itens */}
          {currentStep === 2 && (
            <div className="space-y-6 animate-page-in">
              <div className="text-center mb-4">
                <div className="w-16 h-16 sm:w-20 sm:h-20 bg-verde-50 rounded-full flex items-center justify-center mx-auto mb-4">
                  <ShoppingCart className="w-8 h-8 sm:w-10 sm:h-10 text-primary" />
                </div>
                <h2 className="text-xl sm:text-2xl font-bold mb-2">O que vai no orçamento?</h2>
                <p className="text-sm sm:text-base text-muted-foreground">Adicione plantas e serviços</p>
              </div>

              {/* Items List */}
              <div>
                {proposal.items.length > 0 && (
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium">{proposal.items.length} {proposal.items.length === 1 ? "item" : "itens"}</span>
                    <span className="text-lg font-bold text-primary">{formatCurrency(calculateTotal())}</span>
                  </div>
                )}

                {proposal.items.length === 0 ? (
                  <button
                    onClick={() => setShowCatalog(true)}
                    className="w-full h-32 sm:h-36 border-2 border-dashed border-primary bg-verde-50/50 rounded-xl flex flex-col items-center justify-center text-primary hover:bg-verde-50 transition-colors gap-3"
                  >
                    <Plus size={32} className="sm:w-10 sm:h-10" />
                    <span className="font-medium text-base sm:text-lg">Adicionar do Catálogo</span>
                  </button>
                ) : (
                  <div className="space-y-3">
                    {proposal.items.map((item) => (
                      <div key={item.id} className="bg-white rounded-2xl p-4 border border-border shadow-sm">
                        {/* Header: imagem, nome, total e excluir */}
                        <div className="flex items-start gap-3 mb-3">
                          {/* Imagem */}
                          {item.imageUrl ? (
                            <img
                              src={item.imageUrl}
                              alt={item.name}
                              className="w-12 h-12 object-cover rounded-xl flex-shrink-0 bg-muted"
                            />
                          ) : (
                            <div className="w-12 h-12 bg-muted rounded-xl flex items-center justify-center flex-shrink-0">
                              <Leaf size={20} className="text-muted-foreground" />
                            </div>
                          )}

                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-base truncate">{item.name}</p>
                            {/* Observação editável */}
                            {editingItemDesc === item.id ? (
                              <input
                                type="text"
                                autoFocus
                                placeholder="Ex: saco 20kg, vaso 40cm..."
                                defaultValue={item.description || ""}
                                className="w-full h-7 text-xs bg-white border-2 border-primary rounded px-2 outline-none mt-1"
                                onBlur={(e) => {
                                  updateItemDescription(item.id, e.target.value);
                                  setEditingItemDesc(null);
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    updateItemDescription(item.id, (e.target as HTMLInputElement).value);
                                    setEditingItemDesc(null);
                                  }
                                  if (e.key === "Escape") {
                                    setEditingItemDesc(null);
                                  }
                                }}
                              />
                            ) : (
                              <button
                                onClick={() => setEditingItemDesc(item.id)}
                                className="text-xs text-muted-foreground hover:text-primary transition-colors mt-0.5 text-left"
                              >
                                {item.description || "+ adicionar observação"}
                              </button>
                            )}
                          </div>

                          <button
                            onClick={() => removeItem(item.id)}
                            className="w-9 h-9 flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors touch-manipulation flex-shrink-0"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>

                        {/* Controles: quantidade, preço e total */}
                        <div className="flex items-center justify-between gap-2 pt-2 border-t border-border/50">
                          {/* Quantidade */}
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => updateItemQuantity(item.id, -1)}
                              disabled={item.quantity <= 1}
                              className={cn(
                                "w-9 h-9 flex items-center justify-center rounded-lg active:scale-95 transition-all touch-manipulation",
                                item.quantity > 1
                                  ? "text-white bg-primary"
                                  : "text-muted-foreground bg-muted cursor-not-allowed"
                              )}
                            >
                              <Minus size={16} />
                            </button>
                            <span className="w-8 text-center text-sm font-bold">{item.quantity}</span>
                            <button
                              onClick={() => updateItemQuantity(item.id, 1)}
                              className="w-9 h-9 flex items-center justify-center text-white bg-primary rounded-lg active:scale-95 transition-all touch-manipulation"
                            >
                              <Plus size={16} />
                            </button>
                          </div>

                          {/* Preço unitário */}
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs text-muted-foreground">×</span>
                            {editingItemPrice === item.id ? (
                              <div className="flex items-center bg-white border-2 border-primary rounded-lg overflow-hidden">
                                <span className="text-xs text-muted-foreground pl-2">R$</span>
                                <input
                                  type="number"
                                  inputMode="decimal"
                                  autoFocus
                                  defaultValue={item.unitPrice || ""}
                                  placeholder="0,00"
                                  className="w-16 h-9 text-sm font-semibold bg-transparent px-1 outline-none"
                                  onBlur={(e) => {
                                    const value = parseFloat(e.target.value) || 0;
                                    updateItemPrice(item.id, value);
                                    setEditingItemPrice(null);
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                      const value = parseFloat((e.target as HTMLInputElement).value) || 0;
                                      updateItemPrice(item.id, value);
                                      setEditingItemPrice(null);
                                    }
                                    if (e.key === "Escape") {
                                      setEditingItemPrice(null);
                                    }
                                  }}
                                />
                              </div>
                            ) : (
                              <button
                                onClick={() => setEditingItemPrice(item.id)}
                                className="h-9 px-2.5 text-sm font-bold text-primary bg-primary/10 hover:bg-primary/20 rounded-lg transition-colors touch-manipulation flex items-center gap-1"
                              >
                                <Pencil size={10} />
                                {item.unitPrice > 0 ? formatCurrency(item.unitPrice) : "R$ 0"}
                              </button>
                            )}
                          </div>

                          {/* Total do item */}
                          <div className="text-right">
                            <p className="text-sm font-bold text-primary">
                              {formatCurrency(item.quantity * item.unitPrice)}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                    <button
                      onClick={() => setShowCatalog(true)}
                      className="w-full h-12 border-2 border-dashed border-border rounded-xl flex items-center justify-center text-muted-foreground hover:border-primary hover:text-primary transition-colors gap-2"
                    >
                      <Plus size={18} />
                      <span className="text-sm font-medium">Adicionar mais</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* STEP 3: Review */}
          {currentStep === 3 && (
            <div className="space-y-6 animate-page-in">
              <div className="text-center mb-4">
                <div className="w-16 h-16 sm:w-20 sm:h-20 bg-verde-50 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 className="w-8 h-8 sm:w-10 sm:h-10 text-primary" />
                </div>
                <h2 className="text-xl sm:text-2xl font-bold mb-2">Tudo pronto!</h2>
                <p className="text-sm sm:text-base text-muted-foreground">Revise seu orçamento</p>
              </div>

              {/* Summary Card */}
              <div className="bg-card rounded-xl border border-border p-4 space-y-4">
                {(proposal.clientName || proposal.clientPhone) && (
                  <div className="flex items-center justify-between pb-3 border-b border-border">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-muted rounded-full flex items-center justify-center">
                        <User size={20} className="text-muted-foreground" />
                      </div>
                      <div>
                        <p className="font-semibold">{proposal.clientName || "Cliente não informado"}</p>
                        {proposal.clientPhone && (
                          <p className="text-xs text-muted-foreground">{proposal.clientPhone}</p>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => setCurrentStep(1)}
                      className="text-xs text-primary hover:underline"
                    >
                      Editar
                    </button>
                  </div>
                )}

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-muted-foreground">
                      {proposal.items.length} {proposal.items.length === 1 ? "item" : "itens"}
                    </span>
                    <button
                      onClick={() => setCurrentStep(2)}
                      className="text-xs text-primary hover:underline"
                    >
                      Editar
                    </button>
                  </div>
                  <div className="space-y-1">
                    {proposal.items.map((item) => (
                      <div key={item.id} className="flex justify-between text-sm">
                        <span className="text-muted-foreground">{item.quantity}x {item.name}</span>
                        <span>{formatCurrency(item.quantity * item.unitPrice)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-3 border-t border-border">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">Total</span>
                    <span className="text-xl font-bold text-primary">{formatCurrency(calculateTotal())}</span>
                  </div>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="text-sm font-medium mb-2 block text-muted-foreground">
                  Observações (opcional)
                </label>
                <textarea
                  placeholder="Ex: Inclui garantia de 30 dias..."
                  value={proposal.notes}
                  onChange={(e) => setProposal({ ...proposal, notes: e.target.value })}
                  className="w-full h-20 px-3 py-2 text-sm border border-border rounded-xl bg-background resize-none focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>
            </div>
          )}

        </div>
      </main>

      {/* Wizard Navigation Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-card border-t border-border p-4 safe-area-bottom shadow-lg">
        <div className="max-w-lg mx-auto">
          {/* Show total on step 2 and 3 */}
          {currentStep >= 2 && proposal.items.length > 0 && (
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-muted-foreground">Total</span>
              <span className="text-lg font-bold text-primary">{formatCurrency(calculateTotal())}</span>
            </div>
          )}

          <div className="flex gap-3">
            {/* Back Button */}
            {currentStep > 1 && (
              <Button
                variant="outline"
                size="lg"
                className="flex-1 h-12"
                onClick={() => setCurrentStep(currentStep - 1)}
              >
                <ArrowLeft size={18} className="mr-2" />
                Voltar
              </Button>
            )}

            {/* Next / Submit Button */}
            {currentStep < 3 ? (
              <Button
                variant="default"
                size="lg"
                className="flex-1 h-12"
                onClick={() => setCurrentStep(currentStep + 1)}
                disabled={currentStep === 2 && proposal.items.length === 0}
              >
                Continuar
                <ArrowLeft size={18} className="ml-2 rotate-180" />
              </Button>
            ) : (
              <Button
                variant="default"
                size="lg"
                className="flex-1 h-12"
                onClick={handleSend}
                disabled={isSending || !canCreateProposal}
              >
                <Send size={18} className="mr-2" />
                {isSending ? "Criando..." : "Enviar Orçamento"}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Catalog Modal */}
      {showCatalog && (
        <div className="fixed inset-0 z-50 bg-black/70 sm:flex sm:items-center sm:justify-center sm:p-4" onClick={() => setShowCatalog(false)}>
          <div
            className="fixed top-12 bottom-0 left-0 right-0 sm:relative sm:top-auto sm:bottom-auto sm:left-auto sm:right-auto bg-background rounded-t-2xl sm:rounded-2xl sm:max-h-[85vh] sm:w-full sm:max-w-md flex flex-col animate-in slide-in-from-bottom sm:zoom-in-95 duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="bg-background pt-3 px-3 pb-2 rounded-t-2xl border-b border-border relative">
              <div className="w-10 h-1 bg-muted-foreground/30 rounded-full mx-auto mb-3 sm:hidden" />

              {/* Botão fechar */}
              <button
                onClick={() => setShowCatalog(false)}
                className="absolute top-2 right-2 w-8 h-8 rounded-full bg-muted hover:bg-muted/80 flex items-center justify-center transition-colors"
              >
                <X size={16} />
              </button>

              {/* Search */}
              <div className="flex gap-2 items-center pr-10">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={14} />
                  <Input
                    placeholder="Buscar..."
                    value={catalogSearch}
                    onChange={(e) => setCatalogSearch(e.target.value)}
                    className="pl-8 h-9 rounded-lg bg-muted border-0 text-sm"
                  />
                  {catalogSearch && (
                    <button
                      onClick={() => setCatalogSearch("")}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-background rounded-full"
                    >
                      <X size={12} className="text-muted-foreground" />
                    </button>
                  )}
                </div>
              </div>

              {/* Filter Pills */}
              <div className="flex gap-1.5 mt-2">
                <button
                  onClick={() => setCatalogFilter("Plantas")}
                  className={cn(
                    "flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium transition-all",
                    catalogFilter === "Plantas"
                      ? "bg-primary text-white"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  <Sprout size={14} />
                  Plantas
                </button>
                <button
                  onClick={() => setCatalogFilter("Serviços")}
                  className={cn(
                    "flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium transition-all",
                    catalogFilter === "Serviços"
                      ? "bg-primary text-white"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  <Wrench size={14} />
                  Serviços e Materiais
                </button>
              </div>
            </div>

            {/* Items List */}
            <div className="flex-1 overflow-y-auto px-3 pb-2">
              {/* Contador de resultados */}
              {filteredCatalogItems.length > 0 && (
                <p className="text-xs text-muted-foreground mb-2 mt-2">
                  {filteredCatalogItems.length} {catalogFilter === "Plantas" ? "plantas" : "itens"}
                  {debouncedSearch && ` • "${debouncedSearch}"`}
                </p>
              )}

              {filteredCatalogItems.length === 0 ? (
                <div className="text-center py-8">
                  <Search size={28} className="mx-auto mb-2 text-muted-foreground/50" />
                  <p className="text-muted-foreground">Nenhum item encontrado</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {displayedItems.map((item) => {
                    const qtyInProposal = getItemQuantityInProposal(item.name);
                    const itemKey = String(item.id);
                    const currentPrice = getCatalogPrice(item.id);
                    const hasObs = getCatalogObs(item.id);

                    return (
                      <div
                        key={item.id}
                        className={cn(
                          "flex items-center gap-3 p-2 rounded-xl transition-all",
                          qtyInProposal > 0
                            ? "bg-verde-50/80"
                            : "hover:bg-muted/50"
                        )}
                      >
                        {/* Imagem */}
                        {item.imageUrl ? (
                          <img
                            src={item.imageUrl}
                            alt=""
                            loading="lazy"
                            decoding="async"
                            className="w-12 h-12 object-cover rounded-lg flex-shrink-0 bg-muted"
                          />
                        ) : (
                          <span className="text-xl w-12 h-12 flex items-center justify-center flex-shrink-0 bg-muted/50 rounded-lg">{item.image}</span>
                        )}

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm leading-tight truncate">{item.name}</p>

                          {/* Preço e unidade */}
                          {editingCatalogPrice === itemKey ? (
                            <input
                              type="number"
                              inputMode="decimal"
                              autoFocus
                              defaultValue={currentPrice || ""}
                              placeholder="0"
                              className="w-24 h-8 text-sm font-semibold text-primary bg-white border-2 border-primary rounded-lg px-2 outline-none mt-1"
                              onClick={(e) => e.stopPropagation()}
                              onBlur={(e) => {
                                setCatalogPrices(prev => ({ ...prev, [itemKey]: parseFloat(e.target.value) || 0 }));
                                setEditingCatalogPrice(null);
                              }}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  setCatalogPrices(prev => ({ ...prev, [itemKey]: parseFloat((e.target as HTMLInputElement).value) || 0 }));
                                  setEditingCatalogPrice(null);
                                }
                                if (e.key === "Escape") setEditingCatalogPrice(null);
                              }}
                            />
                          ) : editingCatalogUnit === itemKey ? (
                            <select
                              autoFocus
                              defaultValue={getCatalogUnit(item)}
                              className="h-8 text-sm text-primary bg-white border-2 border-primary rounded-lg px-2 outline-none mt-1"
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) => {
                                setCatalogUnits(prev => ({ ...prev, [itemKey]: e.target.value }));
                                setEditingCatalogUnit(null);
                              }}
                              onBlur={() => setEditingCatalogUnit(null)}
                            >
                              {UNIT_OPTIONS.map(opt => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                              ))}
                            </select>
                          ) : editingCatalogObs === itemKey ? (
                            <input
                              type="text"
                              autoFocus
                              placeholder="Ex: saco 20kg..."
                              defaultValue={hasObs}
                              className="w-full h-8 text-xs bg-white border-2 border-primary rounded-lg px-2 outline-none mt-1"
                              onClick={(e) => e.stopPropagation()}
                              onBlur={(e) => {
                                setCatalogObs(prev => ({ ...prev, [itemKey]: e.target.value }));
                                setEditingCatalogObs(null);
                              }}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  setCatalogObs(prev => ({ ...prev, [itemKey]: (e.target as HTMLInputElement).value }));
                                  setEditingCatalogObs(null);
                                }
                                if (e.key === "Escape") setEditingCatalogObs(null);
                              }}
                            />
                          ) : (
                            <div className="flex items-center gap-1.5 mt-1">
                              <button
                                onClick={(e) => { e.stopPropagation(); setEditingCatalogPrice(itemKey); }}
                                className="h-7 px-2 text-xs font-semibold text-primary bg-primary/10 hover:bg-primary/20 rounded-md flex items-center gap-1"
                              >
                                <Pencil size={10} />
                                {currentPrice > 0 ? formatCurrency(currentPrice) : "R$ --"}
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); setEditingCatalogUnit(itemKey); }}
                                className="h-7 px-2 text-xs text-muted-foreground bg-muted hover:bg-muted/80 rounded-md"
                              >
                                {formatUnit(getCatalogUnit(item))}
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); setEditingCatalogObs(itemKey); }}
                                className={cn(
                                  "h-7 px-2 text-xs rounded-md truncate max-w-[90px]",
                                  hasObs
                                    ? "text-muted-foreground bg-muted hover:bg-muted/80"
                                    : "text-muted-foreground/60 bg-muted/50 hover:bg-muted"
                                )}
                              >
                                {hasObs || "+ obs"}
                              </button>
                            </div>
                          )}
                        </div>

                        {/* Controles de quantidade */}
                        <div className="flex items-center gap-1">
                          {qtyInProposal > 0 && (
                            <button
                              onClick={() => decreaseItemFromCatalog(item)}
                              className="w-9 h-9 flex items-center justify-center text-primary hover:bg-primary/10 rounded-lg transition-colors"
                            >
                              <Minus size={18} />
                            </button>
                          )}
                          {editingCatalogQty === itemKey ? (
                            <input
                              type="number"
                              inputMode="numeric"
                              autoFocus
                              defaultValue={qtyInProposal}
                              className="w-12 h-9 text-center text-sm font-bold text-primary bg-white rounded-lg border-2 border-primary outline-none"
                              onBlur={(e) => {
                                setItemQuantityFromCatalog(item, parseInt(e.target.value) || 0);
                                setEditingCatalogQty(null);
                              }}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  setItemQuantityFromCatalog(item, parseInt((e.target as HTMLInputElement).value) || 0);
                                  setEditingCatalogQty(null);
                                }
                                if (e.key === "Escape") setEditingCatalogQty(null);
                              }}
                            />
                          ) : (
                            <button
                              onClick={() => qtyInProposal > 0 ? setEditingCatalogQty(itemKey) : addItemFromCatalog(item)}
                              className={cn(
                                "w-12 h-9 text-sm font-bold rounded-lg transition-colors",
                                qtyInProposal > 0
                                  ? "text-primary bg-primary/10"
                                  : "text-muted-foreground bg-muted/50"
                              )}
                            >
                              {qtyInProposal || 0}
                            </button>
                          )}
                          <button
                            onClick={() => addItemFromCatalog(item)}
                            className="w-9 h-9 flex items-center justify-center text-white bg-primary rounded-lg active:scale-95 transition-all"
                          >
                            <Plus size={18} />
                          </button>
                        </div>
                      </div>
                    );
                  })}

                  {/* Carregar Mais */}
                  {hasMoreItems && (
                    <button
                      onClick={() => setVisibleItems(prev => prev + 30)}
                      className="w-full py-3 text-sm font-medium text-primary hover:bg-primary/5 rounded-xl transition-colors"
                    >
                      + {filteredCatalogItems.length - visibleItems} itens
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="bg-background border-t px-3 py-2 safe-area-bottom flex items-center gap-3">
              {proposal.items.length > 0 && (
                <div className="flex-1">
                  <span className="text-[10px] text-muted-foreground block">
                    {proposal.items.reduce((sum, i) => sum + i.quantity, 0)} itens
                  </span>
                  <span className="font-bold text-primary text-sm">{formatCurrency(calculateTotal())}</span>
                </div>
              )}
              <Button
                onClick={async () => {
                  await saveCatalogChanges();
                  setShowCatalog(false);
                }}
                className={cn("h-9", proposal.items.length > 0 ? "flex-1" : "w-full")}
                variant="default"
              >
                Concluir
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Templates Modal */}
      {showTemplates && (
        <div className="fixed inset-0 z-50 bg-black/70 sm:flex sm:items-center sm:justify-center sm:p-4" onClick={() => setShowTemplates(false)}>
          <div
            className="fixed bottom-0 left-0 right-0 sm:relative sm:bottom-auto sm:left-auto sm:right-auto bg-background rounded-t-2xl sm:rounded-2xl max-h-[85vh] sm:max-h-[600px] sm:w-full sm:max-w-md flex flex-col animate-in slide-in-from-bottom sm:zoom-in-95 duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="bg-background pt-2 px-3 sm:px-4 pb-2 sm:pb-3 sm:pt-4 rounded-t-2xl border-b border-border">
              <div className="w-10 h-1 bg-muted-foreground/30 rounded-full mx-auto mb-3 sm:hidden" />
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 sm:gap-3">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 bg-primary/10 rounded-lg sm:rounded-xl flex items-center justify-center">
                    <FileStack className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm sm:text-base">Templates</h3>
                    <p className="text-[10px] sm:text-xs text-muted-foreground">Comece com um modelo pronto</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowTemplates(false)}
                  className="p-1.5 sm:p-2 hover:bg-muted rounded-lg"
                >
                  <X size={18} className="sm:w-5 sm:h-5" />
                </button>
              </div>
            </div>

            {/* Templates List */}
            <div className="flex-1 overflow-y-auto p-3 sm:p-4">
              {templates.length === 0 ? (
                <div className="text-center py-8 sm:py-12">
                  <FileStack className="w-10 h-10 sm:w-12 sm:h-12 text-muted-foreground mx-auto mb-2 sm:mb-3" />
                  <p className="text-muted-foreground text-sm sm:text-base">Nenhum template disponível</p>
                </div>
              ) : (
                <div className="space-y-2 sm:space-y-3">
                  {templates.map((template) => (
                    <button
                      key={template.id}
                      onClick={() => applyTemplate(template)}
                      className="w-full text-left p-3 sm:p-4 bg-card border border-border rounded-lg sm:rounded-xl hover:border-primary/50 hover:shadow-md transition-all"
                    >
                      <div className="flex items-start gap-2 sm:gap-3">
                        <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-br from-primary/20 to-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                          <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm sm:text-base mb-0.5 sm:mb-1">{template.name}</p>
                          {template.description && (
                            <p className="text-[10px] sm:text-xs text-muted-foreground mb-1.5 sm:mb-2">{template.description}</p>
                          )}
                          <div className="flex flex-wrap gap-1.5 sm:gap-2">
                            <span className="text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 bg-muted rounded-full">
                              {template.items.length} {template.items.length === 1 ? "item" : "itens"}
                            </span>
                            <span className="text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 bg-primary/10 text-primary rounded-full flex items-center gap-1">
                              {(() => {
                                const IconComp = SERVICE_ICONS[SERVICE_TYPES[template.service_type]?.icon];
                                return IconComp ? <IconComp className="w-3 h-3" /> : null;
                              })()}
                              {SERVICE_TYPES[template.service_type]?.label}
                            </span>
                          </div>
                        </div>
                        <Check size={16} className="text-muted-foreground/50 sm:w-[18px] sm:h-[18px]" />
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
