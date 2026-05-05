import { useState, useRef, useMemo, useEffect } from "react";
import { createPortal } from "react-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useCatalog } from "@/contexts/CatalogContext";
import {
  Search,
  Plus,
  X,
  Trash2,
  Pencil,
  Copy,
  AlertTriangle,
  Upload,
  Loader2,
  Sprout,
  Wrench,
  Leaf,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Check,
  Eye,
} from "lucide-react";

const ITEMS_PER_PAGE = 20; // 4 colunas x 5 linhas

// Opções de unidades de medida
const UNIT_OPTIONS = [
  { value: "", label: "Selecionar..." },
  { value: "un", label: "Unidade (un)" },
  { value: "m", label: "Metro (m)" },
  { value: "m²", label: "Metro² (m²)" },
  { value: "m³", label: "Metro³ (m³)" },
  { value: "kg", label: "Quilo (kg)" },
  { value: "saco", label: "Saco" },
  { value: "diária", label: "Diária" },
  { value: "hora", label: "Hora" },
];
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { uploadImage } from "@/lib/storage";
import { CsvImportDialog } from "@/components/CsvImportDialog";
import type { ImportedItem } from "@/lib/csvImport";

export default function Catalogo() {
  const { items, isLoading, updatePrice, getPrice, addItem, updateItem, deleteItem, duplicateItem } = useCatalog();

  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [catalogFilter, setCatalogFilter] = useState<"Plantas" | "Serviços e Materiais">("Plantas");
  const [selectedPlantCategory, setSelectedPlantCategory] = useState<string>("Todas");
  const [currentPage, setCurrentPage] = useState(1);
  const [showImportDialog, setShowImportDialog] = useState(false);

  const handleImportItems = async (data: ImportedItem[] | unknown[]): Promise<{ inserted: number; failed: number }> => {
    const items = data as ImportedItem[];
    let inserted = 0;
    let failed = 0;
    for (const it of items) {
      try {
        await addItem(it.name, it.category || "Serviços", it.price, undefined, it.unit || "un");
        inserted++;
      } catch (err) {
        console.error("Erro ao importar item:", err);
        failed++;
      }
    }
    if (inserted > 0) {
      toast.success(`${inserted} item(s) importado(s)`);
    }
    return { inserted, failed };
  };

  // Debounce search input (300ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);
  const [editingPrice, setEditingPrice] = useState<number | string | null>(null);
  const [tempPrice, setTempPrice] = useState("");
  const [showAddItem, setShowAddItem] = useState(false);
  const [newItem, setNewItem] = useState({ name: "", category: "Plantas", price: "", imageUrl: "", unit: "" });
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const editFileInputRef = useRef<HTMLInputElement>(null);

  // Edit item state
  const [showEditItem, setShowEditItem] = useState(false);
  const [editItem, setEditItem] = useState<{
    id: number | string;
    name: string;
    category: string;
    price: string;
    imageUrl: string;
    unit: string;
    hasSizes: boolean;
    priceP: string;
    priceM: string;
    priceG: string;
  } | null>(null);

  // Delete confirmation state
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: number | string; name: string } | null>(null);

  // View item details state
  const [viewItem, setViewItem] = useState<typeof items[0] | null>(null);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [showCategoryMenu, setShowCategoryMenu] = useState(false);

  // Extrair categorias únicas das plantas
  const plantCategories = useMemo(() => {
    const allCategories = new Set<string>();
    items.forEach(item => {
      if (item.categorias) {
        item.categorias.split(',').forEach(cat => {
          allCategories.add(cat.trim());
        });
      }
    });
    return ["Todas", ...Array.from(allCategories).sort()];
  }, [items]);

  // Filter and sort items alphabetically (memoized with debounced search)
  const filteredItems = useMemo(() => {
    return items
      .filter((item) => {
        // Filtro por tipo (Plantas ou Serviços e Materiais)
        const isService = item.category === "Serviços";
        const matchesType =
          (catalogFilter === "Serviços e Materiais" && isService) ||
          (catalogFilter === "Plantas" && !isService);

        if (!matchesType) return false;

        // Busca por nome popular OU nome científico
        const searchLower = debouncedSearch.toLowerCase();
        const matchesSearch =
          item.name.toLowerCase().includes(searchLower) ||
          (item.nomeCientifico?.toLowerCase().includes(searchLower) ?? false);

        // Filtro por categoria de planta (só aplica quando está em Plantas)
        const matchesPlantCategory =
          catalogFilter === "Serviços e Materiais" ||
          selectedPlantCategory === "Todas" ||
          (item.categorias?.includes(selectedPlantCategory) ?? false);

        return matchesSearch && matchesPlantCategory;
      })
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  }, [items, debouncedSearch, catalogFilter, selectedPlantCategory]);

  // Paginação
  const totalPages = Math.ceil(filteredItems.length / ITEMS_PER_PAGE);
  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredItems.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredItems, currentPage]);

  // Reset página quando mudar filtro/busca
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, catalogFilter, selectedPlantCategory]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const handleSavePrice = (id: number) => {
    const price = parseFloat(tempPrice) || 0;
    if (price > 0) {
      updatePrice(id, price);
      toast.success("Preço atualizado!", { duration: 1500 });
    }
    setEditingPrice(null);
  };

  const handleImageUpload = async (file: File, isEdit: boolean = false) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Selecione uma imagem válida");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Imagem deve ter no máximo 5MB");
      return;
    }

    setIsUploading(true);
    const url = await uploadImage(file, "catalog");
    setIsUploading(false);

    if (url) {
      if (isEdit && editItem) {
        setEditItem({ ...editItem, imageUrl: url });
      } else {
        setNewItem({ ...newItem, imageUrl: url });
      }
      toast.success("Imagem enviada!");
    } else {
      toast.error("Erro ao enviar imagem");
    }
  };

  const handleAddCustomItem = () => {
    if (!newItem.name.trim()) {
      toast.error("Digite o nome do item");
      return;
    }
    const price = parseFloat(newItem.price) || 0;
    addItem(newItem.name.trim(), newItem.category, price, newItem.imageUrl.trim() || undefined, newItem.unit.trim() || undefined);
    toast.success("Item adicionado!");
    setNewItem({ name: "", category: "Plantas", price: "", imageUrl: "", unit: "" });
    setShowAddItem(false);
  };

  const handleOpenEdit = (item: typeof items[0]) => {
    setEditItem({
      id: item.id,
      name: item.name,
      category: item.category,
      price: getPrice(item.id).toString(),
      imageUrl: item.imageUrl || "",
      unit: item.unit || "",
      hasSizes: !!item.sizePrices,
      priceP: item.sizePrices?.P.toString() || "",
      priceM: item.sizePrices?.M.toString() || "",
      priceG: item.sizePrices?.G.toString() || "",
    });
    setShowEditItem(true);
  };

  const handleSaveEdit = () => {
    if (!editItem) return;
    if (!editItem.name.trim()) {
      toast.error("Digite o nome do item");
      return;
    }

    if (editItem.hasSizes) {
      const priceP = parseFloat(editItem.priceP) || 0;
      const priceM = parseFloat(editItem.priceM) || 0;
      const priceG = parseFloat(editItem.priceG) || 0;
      updateItem(editItem.id, {
        name: editItem.name.trim(),
        category: editItem.category,
        imageUrl: editItem.imageUrl.trim() || undefined,
        unit: editItem.unit.trim() || undefined,
        sizePrices: { P: priceP, M: priceM, G: priceG },
      });
    } else {
      const price = parseFloat(editItem.price) || 0;
      updateItem(editItem.id, {
        name: editItem.name.trim(),
        category: editItem.category,
        price,
        imageUrl: editItem.imageUrl.trim() || undefined,
        unit: editItem.unit.trim() || undefined,
      });
    }
    toast.success("Item atualizado!");
    setShowEditItem(false);
    setEditItem(null);
  };

  const handleConfirmDelete = () => {
    if (!deleteConfirm) return;
    deleteItem(deleteConfirm.id);
    toast.success("Item removido do catálogo!");
    setDeleteConfirm(null);
  };

  const handleDuplicate = async (item: typeof items[0]) => {
    const newItem = await duplicateItem(item.id);
    if (newItem) {
      toast.success(`"${item.name}" duplicado!`);
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto">
        {/* Header - Compacto no mobile */}
        <header className="flex items-center justify-between pb-2 sm:pb-4">
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-neutral-900">
            Meus Itens
          </h1>
          <div className="flex gap-2">
            <Button
              onClick={() => setShowImportDialog(true)}
              size="sm"
              variant="outline"
              className="gap-1.5"
              title="Importar itens de um arquivo CSV"
            >
              <Upload size={16} />
              <span className="hidden sm:inline">Importar CSV</span>
            </Button>
            <Button
              onClick={() => setShowAddItem(true)}
              size="sm"
              className="gap-1.5"
              data-tour="adicionar-item"
            >
              <Plus size={16} />
              <span className="hidden sm:inline">Novo Item</span>
            </Button>
          </div>
        </header>

        <CsvImportDialog
          open={showImportDialog}
          onClose={() => setShowImportDialog(false)}
          mode="items"
          onImport={handleImportItems}
        />

        {/* Search & Filters */}
        <div data-tour="filtros-itens" className="sticky top-14 z-10 bg-neutral-50 -mx-4 px-4 pt-1 pb-3 space-y-2">
          {/* Filter Pills - Plantas / Serviços e Materiais */}
          <div className="flex gap-2">
            {(["Plantas", "Serviços e Materiais"] as const).map((cat) => (
              <button
                key={cat}
                onClick={() => setCatalogFilter(cat)}
                className={cn(
                  "flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-all",
                  catalogFilter === cat
                    ? "bg-primary text-white shadow-md"
                    : "bg-white text-neutral-600 border border-neutral-200 hover:border-primary/50"
                )}
              >
                {cat === "Plantas" && <Sprout size={16} />}
                {cat === "Serviços e Materiais" && <Wrench size={16} />}
                {cat}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" size={16} />
            <Input
              placeholder="Buscar por nome ou nome científico..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-9 h-10 sm:h-11 rounded-lg sm:rounded-xl bg-white border-neutral-200 text-sm sm:text-base"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-neutral-100 rounded-full transition-colors"
              >
                <X size={16} className="text-neutral-400" />
              </button>
            )}
          </div>

          {/* Filtro por categoria de planta (só em Plantas) */}
          {catalogFilter === "Plantas" && plantCategories.length > 1 && (
            <div className="relative">
              {/* Botão do dropdown */}
              <button
                onClick={() => setShowCategoryMenu(!showCategoryMenu)}
                className={cn(
                  "w-full flex items-center justify-between gap-3 h-12 px-4 rounded-xl border-2 transition-all",
                  selectedPlantCategory !== "Todas"
                    ? "bg-primary text-white border-primary"
                    : "bg-white text-neutral-700 border-neutral-200 hover:border-primary/50"
                )}
              >
                <div className="flex items-center gap-2">
                  <Leaf size={18} />
                  <span className="font-medium">
                    {selectedPlantCategory === "Todas" ? "Filtrar por categoria" : selectedPlantCategory}
                  </span>
                </div>
                <ChevronDown size={18} className={cn("transition-transform", showCategoryMenu && "rotate-180")} />
              </button>

              {/* Menu dropdown */}
              {showCategoryMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowCategoryMenu(false)} />
                  <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl border border-neutral-200 shadow-xl z-50 max-h-80 overflow-y-auto animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="p-2">
                      {plantCategories.map((cat) => (
                        <button
                          key={cat}
                          onClick={() => { setSelectedPlantCategory(cat); setShowCategoryMenu(false); }}
                          className={cn(
                            "w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg text-left transition-colors",
                            selectedPlantCategory === cat
                              ? "bg-primary text-white"
                              : "hover:bg-neutral-100 text-neutral-700"
                          )}
                        >
                          <span className="font-medium text-sm">
                            {cat === "Todas" ? "Todas as categorias" : cat}
                          </span>
                          {selectedPlantCategory === cat && <Check size={16} />}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Contador de resultados */}
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm text-neutral-500">
            {isLoading ? (
              <span className="inline-block w-32 h-4 bg-neutral-200 rounded animate-pulse" />
            ) : (
              <>
                <span className="font-semibold text-neutral-800">{filteredItems.length}</span>
                {" "}{catalogFilter === "Plantas" ? "plantas" : "itens"}
                {catalogFilter === "Plantas" && selectedPlantCategory !== "Todas" && (
                  <span className="text-primary"> em {selectedPlantCategory}</span>
                )}
              </>
            )}
          </p>
          {totalPages > 1 && (
            <p className="text-xs text-neutral-400">
              Página {currentPage} de {totalPages}
            </p>
          )}
        </div>

        {/* Items Grid */}
        <div className="pb-28">
          {isLoading ? (
            // Skeleton loading
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="bg-white rounded-xl sm:rounded-2xl overflow-hidden border border-neutral-200/80 animate-pulse">
                  <div className="aspect-square bg-neutral-200" />
                  <div className="p-3 space-y-2">
                    <div className="h-4 bg-neutral-200 rounded w-3/4" />
                    <div className="h-5 bg-neutral-200 rounded w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : paginatedItems.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-xl border border-neutral-200/80">
              <div className="w-14 h-14 rounded-full bg-primary/5 flex items-center justify-center mx-auto mb-3">
                {catalogFilter === "Plantas" ? (
                  <Leaf className="w-7 h-7 text-primary" />
                ) : (
                  <Wrench className="w-7 h-7 text-primary" />
                )}
              </div>
              <p className="text-base font-semibold text-neutral-900 mb-1">Nenhum {catalogFilter === "Plantas" ? "planta" : "item"} encontrado</p>
              <p className="text-sm text-neutral-500 mb-4">
                {debouncedSearch || (catalogFilter === "Plantas" && selectedPlantCategory !== "Todas")
                  ? "Tente mudar os filtros"
                  : `Adicione ${catalogFilter === "Plantas" ? "plantas" : "serviços e materiais"} ao catálogo`}
              </p>
              {(debouncedSearch || (catalogFilter === "Plantas" && selectedPlantCategory !== "Todas")) ? (
                <Button
                  onClick={() => { setSearchTerm(""); setSelectedPlantCategory("Todas"); }}
                  variant="outline"
                  size="sm"
                >
                  <X size={16} className="mr-1" />
                  Limpar filtros
                </Button>
              ) : (
                <Button onClick={() => setShowAddItem(true)} size="sm">
                  <Plus size={16} className="mr-1" />
                  Adicionar
                </Button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3">
              {paginatedItems.map((item, index) => {
                const price = getPrice(item.id);

                return (
                  <div
                    key={item.id}
                    data-tour={index === 0 ? "primeiro-item" : undefined}
                    className="group relative bg-white rounded-xl sm:rounded-2xl overflow-hidden transition-all border border-neutral-200/80 animate-card-in"
                    style={{ animationDelay: `${Math.min(index * 0.03, 0.3)}s` }}
                  >
                    {/* Image */}
                    <div className="relative aspect-square bg-neutral-100">
                      {item.imageUrl ? (
                        <img
                          src={item.imageUrl}
                          alt={item.name}
                          loading="lazy"
                          decoding="async"
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-4xl sm:text-5xl">
                          {item.image}
                        </div>
                      )}

                      {/* Action Buttons - Sempre visível no mobile */}
                      <div className="absolute top-1.5 right-1.5 flex gap-1">
                        <button
                          onClick={() => {
                            setViewItem(item);
                            setSelectedImageIndex(0);
                          }}
                          className="w-7 h-7 sm:w-6 sm:h-6 rounded-full bg-white/90 shadow-sm flex items-center justify-center hover:bg-neutral-100 active:scale-95 transition-all sm:opacity-0 sm:group-hover:opacity-100"
                        >
                          <Eye size={14} className="text-neutral-600 sm:w-3 sm:h-3" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenEdit(item);
                          }}
                          className="w-7 h-7 sm:w-6 sm:h-6 rounded-full bg-white/90 shadow-sm flex items-center justify-center hover:bg-white active:scale-95 transition-all sm:opacity-0 sm:group-hover:opacity-100"
                        >
                          <Pencil size={14} className="text-neutral-600 sm:w-3 sm:h-3" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDuplicate(item);
                          }}
                          className="w-7 h-7 sm:w-6 sm:h-6 rounded-full bg-white/90 shadow-sm flex items-center justify-center hover:bg-emerald-50 active:scale-95 transition-all sm:opacity-0 sm:group-hover:opacity-100"
                        >
                          <Copy size={14} className="text-emerald-600 sm:w-3 sm:h-3" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteConfirm({ id: item.id, name: item.name });
                          }}
                          className="w-7 h-7 sm:w-6 sm:h-6 rounded-full bg-white/90 shadow-sm flex items-center justify-center hover:bg-red-50 active:scale-95 transition-all sm:opacity-0 sm:group-hover:opacity-100"
                        >
                          <Trash2 size={14} className="text-red-500 sm:w-3 sm:h-3" />
                        </button>
                      </div>
                    </div>

                    {/* Content - Mais compacto no mobile */}
                    <div className="p-2 sm:p-3">
                      <h3 className="font-medium text-xs sm:text-sm text-neutral-900 truncate mb-0.5 sm:mb-1">
                        {item.name}
                      </h3>

                      {/* Edição inline do preço */}
                      {editingPrice === item.id ? (
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-neutral-400">R$</span>
                          <input
                            type="number"
                            value={tempPrice}
                            onChange={(e) => setTempPrice(e.target.value)}
                            onBlur={() => handleSavePrice(item.id)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleSavePrice(item.id);
                              if (e.key === "Escape") setEditingPrice(null);
                            }}
                            className="w-16 text-sm font-bold text-primary bg-primary/10 rounded px-1 py-0.5 border-0 outline-none focus:ring-1 focus:ring-primary"
                            autoFocus
                          />
                        </div>
                      ) : (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingPrice(item.id);
                            setTempPrice((item.sizePrices?.P ?? price).toString());
                          }}
                          className="text-sm sm:text-base font-bold text-primary truncate hover:bg-primary/10 rounded px-1 -ml-1 transition-colors"
                        >
                          {formatCurrency(item.sizePrices?.P ?? price)}
                        </button>
                      )}
                      {item.unit && (
                        <p className="text-[10px] sm:text-xs text-neutral-400">/{item.unit}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Paginação */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-1 mt-6">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="w-9 h-9 rounded-lg flex items-center justify-center border border-neutral-200 bg-white hover:bg-neutral-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft size={18} />
              </button>

              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (currentPage <= 3) {
                  pageNum = i + 1;
                } else if (currentPage >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = currentPage - 2 + i;
                }
                return (
                  <button
                    key={pageNum}
                    onClick={() => setCurrentPage(pageNum)}
                    className={cn(
                      "w-9 h-9 rounded-lg flex items-center justify-center text-sm font-medium transition-colors",
                      currentPage === pageNum
                        ? "bg-primary text-white"
                        : "border border-neutral-200 bg-white hover:bg-neutral-50"
                    )}
                  >
                    {pageNum}
                  </button>
                );
              })}

              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="w-9 h-9 rounded-lg flex items-center justify-center border border-neutral-200 bg-white hover:bg-neutral-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight size={18} />
              </button>
            </div>
          )}
        </div>
      </div>


      {/* Add Item Modal */}
      {showAddItem && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/70" onClick={() => setShowAddItem(false)} />
          <div
            className="relative bg-white rounded-2xl w-full max-w-md animate-in zoom-in-95 duration-300 max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="pt-5 px-5 pb-3">
              <div className="flex items-center justify-between">
                <h2 className="font-bold text-xl">Novo Item</h2>
                <button
                  type="button"
                  onClick={() => setShowAddItem(false)}
                  className="w-10 h-10 rounded-full hover:bg-neutral-100 flex items-center justify-center transition-colors touch-manipulation"
                >
                  <X size={22} />
                </button>
              </div>
            </div>

            <div className="px-5 pb-6 space-y-4">
              {/* Category */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setNewItem({ ...newItem, category: "Plantas" })}
                  className={cn(
                    "p-4 rounded-xl border-2 transition-all text-center",
                    newItem.category === "Plantas"
                      ? "border-primary bg-primary/5"
                      : "border-neutral-200 hover:border-neutral-300"
                  )}
                >
                  <Sprout size={28} className={cn("mx-auto mb-2", newItem.category === "Plantas" ? "text-primary" : "text-neutral-400")} />
                  <span className="font-medium">Planta</span>
                </button>
                <button
                  onClick={() => setNewItem({ ...newItem, category: "Serviços" })}
                  className={cn(
                    "p-4 rounded-xl border-2 transition-all text-center",
                    newItem.category === "Serviços"
                      ? "border-emerald-500 bg-emerald-50"
                      : "border-neutral-200 hover:border-neutral-300"
                  )}
                >
                  <Wrench size={28} className={cn("mx-auto mb-2", newItem.category === "Serviços" ? "text-emerald-600" : "text-neutral-400")} />
                  <span className="font-medium text-sm">Serviço ou Material</span>
                </button>
              </div>

              {/* Name */}
              <Input
                placeholder={newItem.category === "Plantas" ? "Nome da planta..." : "Nome do serviço ou material..."}
                value={newItem.name}
                onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                className="h-12 rounded-xl text-base"
              />

              {/* Price and Unit */}
              <div className="flex gap-3">
                <div className="flex-1 relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-500 font-medium">R$</span>
                  <Input
                    type="number"
                    placeholder="0,00"
                    value={newItem.price}
                    onChange={(e) => setNewItem({ ...newItem, price: e.target.value })}
                    className="h-12 pl-12 rounded-xl font-semibold text-base"
                  />
                </div>
                <div className="w-32">
                  <select
                    value={newItem.unit}
                    onChange={(e) => setNewItem({ ...newItem, unit: e.target.value })}
                    className="w-full h-12 rounded-xl text-sm border border-neutral-200 bg-white px-3 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  >
                    {UNIT_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Image Upload */}
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleImageUpload(file, false);
                  }}
                />
                {newItem.imageUrl ? (
                  <div className="flex items-center gap-4 p-3 bg-neutral-50 rounded-xl">
                    <img
                      src={newItem.imageUrl}
                      alt="Preview"
                      referrerPolicy="no-referrer"
                      className="w-20 h-20 rounded-lg object-cover"
                    />
                    <div className="flex-1">
                      <p className="font-medium text-sm">Imagem enviada</p>
                      <button
                        onClick={() => setNewItem({ ...newItem, imageUrl: "" })}
                        className="text-sm text-red-500 hover:underline mt-1"
                      >
                        Remover
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                    className="w-full h-28 border-2 border-dashed border-neutral-200 rounded-xl flex flex-col items-center justify-center gap-2 hover:border-primary hover:bg-primary/5/50 transition-all"
                  >
                    {isUploading ? (
                      <Loader2 className="w-7 h-7 animate-spin text-primary" />
                    ) : (
                      <>
                        <Upload className="w-7 h-7 text-neutral-400" />
                        <span className="text-sm text-neutral-500">Enviar foto (opcional)</span>
                      </>
                    )}
                  </button>
                )}
              </div>

              <Button
                type="button"
                onClick={handleAddCustomItem}
                className="w-full h-12 text-base font-semibold touch-manipulation"
                disabled={!newItem.name.trim() || !newItem.price || isUploading}
              >
                Adicionar ao Catálogo
              </Button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Edit Item Modal */}
      {showEditItem && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/70" onClick={() => { setShowEditItem(false); setEditItem(null); }} />
          <div
            className="relative bg-white rounded-2xl w-full max-w-md animate-in zoom-in-95 duration-300 max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
              <div className="pt-5 px-5 pb-3">
              <div className="flex items-center justify-between">
                <h2 className="font-bold text-xl">Editar Item</h2>
                <button
                  type="button"
                  onClick={() => { setShowEditItem(false); setEditItem(null); }}
                  className="w-10 h-10 rounded-full hover:bg-neutral-100 flex items-center justify-center transition-colors touch-manipulation"
                >
                  <X size={22} />
                </button>
              </div>
            </div>

            <div className="px-5 pb-6 space-y-5">
              {/* Categoria */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setEditItem({ ...editItem, category: "Plantas" })}
                  className={cn(
                    "p-3 rounded-xl border-2 transition-all text-center",
                    editItem.category === "Plantas"
                      ? "border-primary bg-primary/5"
                      : "border-neutral-200 hover:border-neutral-300"
                  )}
                >
                  <Sprout size={24} className={cn("mx-auto mb-1", editItem.category === "Plantas" ? "text-primary" : "text-neutral-400")} />
                  <span className="font-medium text-sm">Planta</span>
                </button>
                <button
                  onClick={() => setEditItem({ ...editItem, category: "Serviços" })}
                  className={cn(
                    "p-3 rounded-xl border-2 transition-all text-center",
                    editItem.category === "Serviços"
                      ? "border-emerald-500 bg-emerald-50"
                      : "border-neutral-200 hover:border-neutral-300"
                  )}
                >
                  <Wrench size={24} className={cn("mx-auto mb-1", editItem.category === "Serviços" ? "text-emerald-600" : "text-neutral-400")} />
                  <span className="font-medium text-sm">Serviço ou Material</span>
                </button>
              </div>

              {/* Nome */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-neutral-700">Nome</label>
                <Input
                  placeholder={editItem.category === "Plantas" ? "Nome da planta..." : "Nome do serviço ou material..."}
                  value={editItem.name}
                  onChange={(e) => setEditItem({ ...editItem, name: e.target.value })}
                  className="h-12 rounded-xl text-base"
                />
              </div>

              <hr className="border-neutral-200" />

              {/* Preço e Unidade */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-neutral-700">Preço</label>
                {editItem.hasSizes ? (
                  <div className="space-y-2">
                    <p className="text-xs text-neutral-500">Preços por tamanho</p>
                    <div className="grid grid-cols-3 gap-3">
                      {(["P", "M", "G"] as const).map((size) => (
                        <div key={size}>
                          <label className="text-xs text-neutral-500 mb-1 block text-center font-medium">{size}</label>
                          <div className="relative">
                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-neutral-500">R$</span>
                            <Input
                              type="number"
                              placeholder="0"
                              value={editItem[`price${size}` as keyof typeof editItem] as string}
                              onChange={(e) => setEditItem({ ...editItem, [`price${size}`]: e.target.value })}
                              className="h-11 pl-8 rounded-lg font-semibold text-center"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-3">
                    <div className="flex-1 relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-500 font-medium">R$</span>
                      <Input
                        type="number"
                        placeholder="0,00"
                        value={editItem.price}
                        onChange={(e) => setEditItem({ ...editItem, price: e.target.value })}
                        className="h-12 pl-12 rounded-xl font-semibold text-base"
                      />
                    </div>
                    <div className="w-28">
                      <select
                        value={editItem.unit}
                        onChange={(e) => setEditItem({ ...editItem, unit: e.target.value })}
                        className="w-full h-12 rounded-xl text-sm border border-neutral-200 bg-white px-3 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                      >
                        {UNIT_OPTIONS.map(opt => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}
              </div>

              <hr className="border-neutral-200" />

              {/* Imagem */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-neutral-700">Imagem</label>
                <input
                  ref={editFileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleImageUpload(file, true);
                  }}
                />
                {editItem.imageUrl ? (
                  <div className="flex items-center gap-4 p-3 bg-neutral-50 rounded-xl">
                    <img
                      src={editItem.imageUrl}
                      alt="Preview"
                      referrerPolicy="no-referrer"
                      className="w-20 h-20 rounded-lg object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = "none";
                      }}
                    />
                    <div className="flex-1">
                      <p className="font-medium text-sm">Imagem atual</p>
                      <div className="flex gap-3 mt-1">
                        <button
                          type="button"
                          onClick={() => editFileInputRef.current?.click()}
                          className="text-sm text-primary hover:underline touch-manipulation"
                        >
                          Trocar
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditItem({ ...editItem, imageUrl: "" })}
                          className="text-sm text-red-500 hover:underline touch-manipulation"
                        >
                          Remover
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => editFileInputRef.current?.click()}
                    disabled={isUploading}
                    className="w-full h-28 border-2 border-dashed border-neutral-200 rounded-xl flex flex-col items-center justify-center gap-2 hover:border-primary hover:bg-primary/5/50 transition-all touch-manipulation"
                  >
                    {isUploading ? (
                      <Loader2 className="w-7 h-7 animate-spin text-primary" />
                    ) : (
                      <>
                        <Upload className="w-7 h-7 text-neutral-400" />
                        <span className="text-sm text-neutral-500">Enviar foto (máx. 2MB)</span>
                      </>
                    )}
                  </button>
                )}
              </div>

              <hr className="border-neutral-200" />

              <Button
                type="button"
                onClick={handleSaveEdit}
                className="w-full h-12 text-base font-semibold touch-manipulation"
                disabled={!editItem.name.trim() || (!editItem.hasSizes && !editItem.price) || isUploading}
              >
                Salvar Alterações
              </Button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/70" onClick={() => setDeleteConfirm(null)} />
          <div
            className="relative bg-white rounded-2xl w-full max-w-sm animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 text-center">
              <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertTriangle className="w-8 h-8 text-red-500" />
              </div>
              <h2 className="font-bold text-xl mb-2">Excluir Item?</h2>
              <p className="text-neutral-500 mb-6">
                Tem certeza que deseja excluir <strong>"{deleteConfirm.name}"</strong> do catálogo?
              </p>
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1 h-12"
                  onClick={() => setDeleteConfirm(null)}
                >
                  Cancelar
                </Button>
                <Button
                  variant="destructive"
                  className="flex-1 h-12"
                  onClick={handleConfirmDelete}
                >
                  Excluir
                </Button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* View Item Details Modal */}
      {viewItem && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/70" onClick={() => setViewItem(null)} />
          <div
            className="relative bg-white rounded-2xl w-full max-w-md animate-in zoom-in-95 duration-300 max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Galeria de Imagens */}
            <div className="relative">
              <div className="aspect-[4/3] bg-neutral-100 rounded-t-2xl overflow-hidden">
                {(viewItem.todasImagens && viewItem.todasImagens.length > 0) ? (
                  <img
                    src={viewItem.todasImagens[selectedImageIndex]}
                    alt={viewItem.name}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                ) : viewItem.imageUrl ? (
                  <img
                    src={viewItem.imageUrl}
                    alt={viewItem.name}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-6xl">
                    {viewItem.image}
                  </div>
                )}
              </div>

              {/* Botão fechar */}
              <button
                onClick={() => setViewItem(null)}
                className="absolute top-3 right-3 w-10 h-10 rounded-full bg-black/50 hover:bg-black/70 flex items-center justify-center transition-colors"
              >
                <X size={20} className="text-white" />
              </button>

              {/* Thumbnails */}
              {viewItem.todasImagens && viewItem.todasImagens.length > 1 && (
                <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1.5 px-3">
                  <div className="flex gap-1.5 bg-black/40 rounded-full p-1.5 overflow-x-auto max-w-full">
                    {viewItem.todasImagens.slice(0, 8).map((img, idx) => (
                      <button
                        key={idx}
                        onClick={(e) => { e.stopPropagation(); setSelectedImageIndex(idx); }}
                        className={cn(
                          "w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 border-2 transition-all",
                          selectedImageIndex === idx ? "border-white" : "border-transparent opacity-70 hover:opacity-100"
                        )}
                      >
                        <img src={img} alt="" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Conteúdo */}
            <div className="p-5 space-y-4">
              {/* Nome e preço */}
              <div>
                <h2 className="text-xl font-bold text-neutral-900">{viewItem.name}</h2>
                {viewItem.nomeCientifico && (
                  <p className="text-sm text-neutral-500 italic">{viewItem.nomeCientifico}</p>
                )}
                <p className="text-2xl font-bold text-primary mt-2">
                  {formatCurrency(viewItem.defaultPrice)}
                  {viewItem.unit && <span className="text-sm font-normal text-neutral-500">/{viewItem.unit}</span>}
                </p>
              </div>

              {/* Categorias */}
              {viewItem.categorias && (
                <div className="flex flex-wrap gap-1.5">
                  {viewItem.categorias.split(',').map((cat, idx) => (
                    <span
                      key={idx}
                      className="px-2.5 py-1 bg-primary/10 text-primary text-xs font-medium rounded-full"
                    >
                      {cat.trim()}
                    </span>
                  ))}
                </div>
              )}

              {/* Descrição */}
              {viewItem.descricao && (
                <div>
                  <h3 className="text-sm font-semibold text-neutral-700 mb-1">Sobre</h3>
                  <p className="text-sm text-neutral-600 leading-relaxed">{viewItem.descricao}</p>
                </div>
              )}

              {/* Ações */}
              <div className="flex gap-3 pt-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => { handleOpenEdit(viewItem); setViewItem(null); }}
                >
                  <Pencil size={16} className="mr-2" />
                  Editar
                </Button>
                <Button
                  className="flex-1"
                  onClick={() => setViewItem(null)}
                >
                  Fechar
                </Button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

    </DashboardLayout>
  );
}
