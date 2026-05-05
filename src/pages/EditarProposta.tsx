import { useState, useEffect, useMemo } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useProposals, ProposalItem } from "@/contexts/ProposalsContext";
import { useCatalog, CatalogItem } from "@/contexts/CatalogContext";
import {
  ArrowLeft,
  Plus,
  Trash2,
  User,
  Phone,
  AlertCircle,
  Save,
  Search,
  X,
  Package,
  Minus,
  Pencil,
  Package,
  Wrench,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function EditarProposta() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getProposal, updateProposal } = useProposals();
  const { items: catalogItems, getPrice, updateItem: updateCatalogItem } = useCatalog();

  const existingProposal = getProposal(id || "");

  const [proposal, setProposal] = useState({
    clientName: "",
    clientPhone: "",
    title: "",
    items: [] as ProposalItem[],
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

  // Load existing proposal data
  useEffect(() => {
    if (existingProposal) {
      setProposal({
        clientName: existingProposal.client?.name || "",
        clientPhone: existingProposal.client?.phone || "",
        title: existingProposal.title,
        items: existingProposal.items,
      });
    }
  }, [existingProposal?.id]);

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

  const removeItem = (itemId: string) => {
    setProposal({
      ...proposal,
      items: proposal.items.filter((item) => item.id !== itemId),
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

  const formatPhone = (value: string) => {
    const numbers = value.replace(/\D/g, "").slice(0, 11);
    if (numbers.length <= 2) return numbers;
    if (numbers.length <= 7) return `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`;
    return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7)}`;
  };

  const handleSave = async () => {
    if (proposal.items.length === 0) {
      toast.error("Adicione pelo menos um item");
      return;
    }

    const hasEmptyItem = proposal.items.some(item => !item.name || item.unitPrice === 0);
    if (hasEmptyItem) {
      toast.error("Preencha todos os itens");
      return;
    }

    const total = proposal.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
    console.log("📝 Salvando proposta:", { id, items: proposal.items, total });

    await updateProposal(id!, {
      client: {
        id: existingProposal?.client?.id || Date.now(),
        name: proposal.clientName || "Cliente",
        phone: proposal.clientPhone || "",
        email: existingProposal?.client?.email || "",
      },
      title: proposal.title || `Proposta para ${proposal.clientName || "Cliente"}`,
      description: existingProposal?.description || "",
      items: proposal.items,
      notes: existingProposal?.notes || "",
      validUntil: existingProposal?.validUntil || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    });

    toast.success("Proposta atualizada!");
    navigate(`/propostas/${id}`);
  };

  if (!existingProposal) {
    return (
      <div className="min-h-screen bg-muted flex items-center justify-center p-4">
        <div className="bg-card rounded-2xl shadow-lg p-8 text-center max-w-md">
          <AlertCircle className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
          <h1 className="text-xl font-bold mb-2">Proposta não encontrada</h1>
          <p className="text-muted-foreground mb-4">
            Esta proposta pode ter sido excluída ou o link está incorreto.
          </p>
          <Button asChild>
            <Link to="/propostas">Voltar para Propostas</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-neutral-50 to-neutral-100 flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white border-b border-neutral-200">
        <div className="px-3 sm:px-4 h-14 sm:h-16 flex items-center gap-2 sm:gap-3 max-w-lg mx-auto">
          <Link
            to={`/propostas/${id}`}
            className="p-2 -ml-2 hover:bg-neutral-100 active:bg-neutral-200 rounded-lg sm:rounded-xl transition-colors"
            aria-label="Voltar"
          >
            <ArrowLeft size={20} className="text-neutral-600" />
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="text-base sm:text-lg font-bold text-neutral-900">Editar Proposta</h1>
            {proposal.clientName && (
              <p className="text-[11px] sm:text-xs text-neutral-500 truncate">{proposal.clientName}</p>
            )}
          </div>
        </div>
      </header>

      {/* Main Content - Scrollable */}
      <main className="flex-1 overflow-y-auto pb-36 sm:pb-44">
        <div className="max-w-lg mx-auto px-3 sm:px-4 py-4 space-y-3 sm:space-y-4">

          {/* Step 1: Cliente */}
          <div className="bg-white rounded-xl sm:rounded-2xl border border-neutral-200 p-3 sm:p-4 shadow-sm animate-card-in">
            <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-3">
              Cliente
            </p>
            <div className="space-y-2.5">
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" size={18} />
                <Input
                  placeholder="Nome do cliente"
                  value={proposal.clientName}
                  onChange={(e) => setProposal({ ...proposal, clientName: e.target.value })}
                  className="pl-10 h-11 sm:h-12 text-sm sm:text-base rounded-lg sm:rounded-xl border-neutral-200"
                />
              </div>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" size={18} />
                <Input
                  placeholder="(11) 99999-9999"
                  value={proposal.clientPhone}
                  onChange={(e) => setProposal({ ...proposal, clientPhone: formatPhone(e.target.value) })}
                  className="pl-10 h-11 sm:h-12 text-sm sm:text-base rounded-lg sm:rounded-xl border-neutral-200"
                />
              </div>
            </div>
          </div>

          {/* Step 2: Add Items */}
          <div className="bg-white rounded-xl sm:rounded-2xl border border-neutral-200 p-3 sm:p-4 shadow-sm animate-card-in stagger-1">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">
                Itens
              </p>
              {proposal.items.length > 0 && (
                <span className="text-xs text-neutral-400">{proposal.items.length} {proposal.items.length === 1 ? 'item' : 'itens'}</span>
              )}
            </div>

            {proposal.items.length === 0 ? (
              <button
                onClick={() => setShowCatalog(true)}
                className="w-full h-20 sm:h-24 border-2 border-dashed border-neutral-300 bg-neutral-50 rounded-lg sm:rounded-xl flex flex-col items-center justify-center text-neutral-500 hover:bg-accent/10 hover:border-green-400 hover:text-green-600 transition-all active:scale-[0.98]"
              >
                <Plus size={22} className="mb-1" />
                <span className="text-xs sm:text-sm font-medium">Adicionar do Catálogo</span>
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
                          <Package size={20} className="text-muted-foreground" />
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

          {/* Optional: Title */}
          {proposal.items.length > 0 && (
            <div className="bg-white rounded-xl sm:rounded-2xl border border-neutral-200 p-3 sm:p-4 shadow-sm">
              <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-3">
                Título <span className="text-neutral-400 font-normal">(opcional)</span>
              </p>
              <Input
                placeholder={proposal.clientName ? `Proposta para ${proposal.clientName}` : "Ex: Manutenção mensal"}
                value={proposal.title}
                onChange={(e) => setProposal({ ...proposal, title: e.target.value })}
                className="h-11 sm:h-12 text-sm sm:text-base rounded-lg sm:rounded-xl border-neutral-200"
              />
            </div>
          )}
        </div>
      </main>

      {/* Fixed Bottom Bar with Total */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-neutral-200 shadow-[0_-2px_10px_rgba(0,0,0,0.05)] safe-area-bottom">
        <div className="max-w-lg mx-auto p-3 sm:p-4">
          {proposal.items.length > 0 && (
            <div className="flex items-center justify-between mb-3">
              <div>
                <span className="text-[10px] sm:text-xs text-neutral-500 font-medium uppercase tracking-wide">Total</span>
                <p className="text-[10px] sm:text-xs text-neutral-400">{proposal.items.length} {proposal.items.length === 1 ? 'item' : 'itens'}</p>
              </div>
              <span className="text-xl sm:text-2xl font-bold text-green-600">
                {formatCurrency(calculateTotal())}
              </span>
            </div>
          )}
          <Button
            size="lg"
            className="w-full h-12 sm:h-14 text-sm sm:text-base"
            onClick={handleSave}
            disabled={proposal.items.length === 0}
          >
            <Save size={18} className="mr-2" />
            Salvar Alterações
          </Button>
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
                  <Package size={14} />
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

    </div>
  );
}
