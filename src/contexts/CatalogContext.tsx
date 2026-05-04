import { createContext, useContext, useState, useEffect, ReactNode, useCallback, useMemo } from "react";
import { useAuth } from "./AuthContext";
import { getSupabase } from "@/lib/supabase";

export interface CatalogItem {
  id: number | string;
  name: string;
  category: string;
  image: string;
  imageUrl?: string;
  defaultPrice: number;
  customPrice?: number;
  unit?: string;
  size?: "P" | "M" | "G";
  sizePrices?: { P: number; M: number; G: number };
  nomeCientifico?: string;
  descricao?: string;
  todasImagens?: string[];
  categorias?: string;
}

export interface CartItem {
  catalogId: number | string;
  name: string;
  image: string;
  imageUrl?: string;
  quantity: number;
  price: number;
  unit?: string;
  size?: "P" | "M" | "G";
}

// Limites de itens próprios por plano
// - free (Grátis): 0 após trial (forçar upgrade)
// - essential (Mensal R$97): 20 itens
// - pro (Anual R$804): Ilimitado
export const CATALOG_LIMITS = {
  free: { customItemsLimit: 0 },
  essential: { customItemsLimit: 20 },
  pro: { customItemsLimit: Infinity },
  admin: { customItemsLimit: Infinity },
};

interface CatalogContextType {
  items: CatalogItem[];
  cart: CartItem[];
  isLoading: boolean;
  updatePrice: (id: number | string, price: number) => void;
  getPrice: (id: number | string) => number;
  addToCart: (item: CatalogItem, quantity: number) => void;
  removeFromCart: (catalogId: number | string) => void;
  updateCartQuantity: (catalogId: number | string, quantity: number) => void;
  clearCart: () => void;
  getCartTotal: () => number;
  addItem: (name: string, category: string, price: number, imageUrl?: string, unit?: string) => Promise<CatalogItem>;
  updateItem: (id: number | string, data: { name?: string; nomeCientifico?: string; descricao?: string; category?: string; price?: number; imageUrl?: string; unit?: string; sizePrices?: { P: number; M: number; G: number } }) => Promise<void>;
  deleteItem: (id: number | string) => Promise<void>;
  duplicateItem: (id: number | string) => Promise<CatalogItem | null>;
  restoreDefaults: () => Promise<void>;
  refreshCatalog: () => Promise<void>;
  // Limites de itens próprios
  customItemsCount: number;
  customItemsLimit: number;
  canAddCustomItem: boolean;
}

const CatalogContext = createContext<CatalogContextType | undefined>(undefined);

// Itens base genéricos — usuário substitui pelos seus no onboarding por ramo
const defaultServices: CatalogItem[] = [
  { id: 100, name: "Mão de Obra", category: "Mão de Obra", image: "👷", defaultPrice: 250, unit: "dia" },
  { id: 101, name: "Hora Técnica", category: "Mão de Obra", image: "⏱️", defaultPrice: 120, unit: "hr" },
  { id: 102, name: "Deslocamento", category: "Deslocamento", image: "🚚", defaultPrice: 50, unit: "serviço" },
  { id: 103, name: "Material", category: "Materiais", image: "📦", defaultPrice: 0, unit: "un" },
];

// Interface para plantas do Supabase
interface DbPlanta {
  id: string;
  nome_popular: string;
  nome_cientifico: string | null;
  descricao: string | null;
  imagem_principal: string | null;
  todas_imagens: string | null;
  categorias: string | null;
  preco: number | null;
  unidade: string | null;
}

// Interface para dados do banco
interface DbCatalogItem {
  id: string;
  user_id: string;
  item_id: number | string;
  name: string;
  nome_cientifico: string | null;
  descricao: string | null;
  category: string;
  image: string;
  image_url: string | null;
  default_price: number;
  size_prices: { P: number; M: number; G: number } | null;
  unit: string | null;
  is_custom: boolean;
  is_hidden: boolean;
}

export function CatalogProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [dbItems, setDbItems] = useState<DbCatalogItem[]>([]);
  const [plantas, setPlantas] = useState<CatalogItem[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [plantasLoaded, setPlantasLoaded] = useState(false);
  const [catalogLoaded, setCatalogLoaded] = useState(false);
  const isLoading = !plantasLoaded || !catalogLoaded;

  // Contar itens customizados (criados pelo usuário)
  const customItemsCount = useMemo(() => {
    return dbItems.filter(item => item.is_custom && !item.is_hidden).length;
  }, [dbItems]);

  // Determinar plano do usuário para limites
  const userPlan = useMemo((): "free" | "essential" | "pro" | "admin" => {
    if (user?.isAdmin) return "admin";
    if (!user?.plan) return "free";
    if (user.plan === "Mensal") return "essential";
    if (user.plan === "Anual") return "pro";
    if (user.plan === "Admin") return "admin";
    return "free";
  }, [user?.plan, user?.isAdmin]);

  // Se está no trial (3 dias), tem itens ilimitados
  // Depois do trial, aplica o limite do plano
  const customItemsLimit = user?.isInTrial ? Infinity : CATALOG_LIMITS[userPlan].customItemsLimit;
  const canAddCustomItem = customItemsCount < customItemsLimit;

  // Carregar plantas da tabela `plantas` do Supabase (com retry)
  const loadPlantasFromDb = useCallback(async (retryCount = 0) => {
    try {
      // Buscar todas as plantas com limite alto e ordenação
      const { data, error, count } = await getSupabase()
        .from("plantas")
        .select("id, nome_popular, nome_cientifico, descricao, imagem_principal, todas_imagens, categorias, preco, unidade", { count: "exact" })
        .order("nome_popular", { ascending: true })
        .limit(1000);

      if (error) {
        console.error("Erro ao carregar plantas:", error);
        // Retry até 3 vezes em caso de erro
        if (retryCount < 3) {
          console.log(`Tentando novamente... (${retryCount + 1}/3)`);
          setTimeout(() => loadPlantasFromDb(retryCount + 1), 1000);
        }
        return;
      }

      console.log(`📦 Plantas carregadas: ${data?.length || 0} de ${count || "?"}`);

      // Verificar se carregou menos do esperado (possível problema de conexão)
      if (data && count && data.length < count && retryCount < 3) {
        console.log(`⚠️ Carregou apenas ${data.length} de ${count}, tentando novamente...`);
        setTimeout(() => loadPlantasFromDb(retryCount + 1), 1000);
        return;
      }

      // Mapear para CatalogItem
      const plantasMapeadas: CatalogItem[] = (data || []).map((planta: DbPlanta) => {
        // Parse todas_imagens (pode ser string JSON ou array)
        let todasImagens: string[] = [];
        if (planta.todas_imagens) {
          try {
            todasImagens = typeof planta.todas_imagens === 'string'
              ? JSON.parse(planta.todas_imagens)
              : planta.todas_imagens;
          } catch {
            todasImagens = [];
          }
        }

        return {
          id: planta.id,
          name: planta.nome_popular,
          category: "Plantas",
          image: "🌿",
          imageUrl: planta.imagem_principal || undefined,
          defaultPrice: planta.preco || 0,
          unit: planta.unidade || undefined,
          nomeCientifico: planta.nome_cientifico || undefined,
          descricao: planta.descricao || undefined,
          todasImagens: todasImagens.length > 0 ? todasImagens : undefined,
          categorias: planta.categorias || undefined,
        };
      });

      setPlantas(plantasMapeadas);
      setPlantasLoaded(true);
    } catch (error) {
      console.error("Erro ao carregar plantas:", error);
      // Retry em caso de exceção
      if (retryCount < 3) {
        console.log(`Erro de conexão, tentando novamente... (${retryCount + 1}/3)`);
        setTimeout(() => loadPlantasFromDb(retryCount + 1), 1500);
      } else {
        setPlantasLoaded(true); // Marca como carregado mesmo com erro para não travar a UI
      }
    }
  }, []);

  // Carregar itens customizados do usuário
  const loadCatalogFromDb = useCallback(async () => {
    if (!user?.id) {
      setDbItems([]);
      setCatalogLoaded(true);
      return;
    }

    try {
      const { data, error } = await getSupabase()
        .from("catalog_items")
        .select("*")
        .eq("user_id", user.id);

      if (error) {
        console.error("Erro ao carregar catálogo:", error);
        return;
      }

      setDbItems(data || []);
    } catch (error) {
      console.error("Erro ao carregar catálogo:", error);
    } finally {
      setCatalogLoaded(true);
    }
  }, [user?.id]);

  // Carregar plantas (tabela global)
  useEffect(() => {
    loadPlantasFromDb();
  }, [loadPlantasFromDb]);

  // Carregar customizações do usuário
  useEffect(() => {
    setCatalogLoaded(false);
    loadCatalogFromDb();
  }, [loadCatalogFromDb]);

  // Montar lista de itens combinando: plantas (Supabase) + serviços (fixos) + customizações do usuário
  const items: CatalogItem[] = useMemo(() => {
    // Itens ocultos pelo usuário
    const hiddenIds = dbItems.filter(item => item.is_hidden).map(item => item.item_id);

    // Itens customizados (modificações de itens padrão/plantas)
    const customizations = dbItems.filter(item => !item.is_custom && !item.is_hidden);

    // Itens criados manualmente pelo usuário
    const userItems = dbItems.filter(item => item.is_custom && !item.is_hidden);

    // Plantas do Supabase (aplicando customizações do usuário)
    const plantasWithCustom = plantas
      .filter(planta => !hiddenIds.includes(planta.id as number))
      .map(planta => {
        const custom = customizations.find(c => c.item_id === planta.id);
        if (custom) {
          return {
            ...planta,
            name: custom.name,
            category: custom.category,
            nomeCientifico: custom.nome_cientifico || planta.nomeCientifico,
            descricao: custom.descricao || planta.descricao,
            imageUrl: custom.image_url || planta.imageUrl,
            defaultPrice: Number(custom.default_price),
            customPrice: Number(custom.default_price),
            unit: custom.unit || planta.unit,
          };
        }
        return planta;
      });

    // Serviços fixos (aplicando customizações do usuário)
    const servicesWithCustom = defaultServices
      .filter(item => !hiddenIds.includes(item.id as number))
      .map(item => {
        const custom = customizations.find(c => c.item_id === item.id);
        if (custom) {
          return {
            ...item,
            name: custom.name,
            category: custom.category,
            imageUrl: custom.image_url || item.imageUrl,
            defaultPrice: Number(custom.default_price),
            customPrice: Number(custom.default_price),
            sizePrices: custom.size_prices || item.sizePrices,
            unit: custom.unit || item.unit,
          };
        }
        return item;
      });

    // Itens criados manualmente pelo usuário
    const userCatalogItems: CatalogItem[] = userItems.map(item => ({
      id: item.item_id,
      name: item.name,
      nomeCientifico: item.nome_cientifico || undefined,
      descricao: item.descricao || undefined,
      category: item.category,
      image: item.image,
      imageUrl: item.image_url || undefined,
      defaultPrice: Number(item.default_price),
      sizePrices: item.size_prices || undefined,
      unit: item.unit || undefined,
    }));

    return [...plantasWithCustom, ...servicesWithCustom, ...userCatalogItems].sort((a, b) => a.name.localeCompare(b.name));
  }, [dbItems, plantas]);

  const getPrice = (id: number | string): number => {
    const item = items.find(i => String(i.id) === String(id));
    return item?.customPrice ?? item?.defaultPrice ?? 0;
  };

  const updatePrice = (id: number | string, price: number) => {
    // Atualiza localmente para UI imediata
    const item = items.find(i => String(i.id) === String(id));
    if (item) {
      item.customPrice = price;
    }
  };

  const addToCart = (item: CatalogItem, quantity: number) => {
    setCart((prev) => {
      const existing = prev.find((c) => String(c.catalogId) === String(item.id));
      if (existing) {
        return prev.map((c) =>
          String(c.catalogId) === String(item.id) ? { ...c, quantity: c.quantity + quantity } : c
        );
      }
      return [
        ...prev,
        {
          catalogId: item.id,
          name: item.name,
          image: item.image,
          imageUrl: item.imageUrl,
          quantity,
          price: getPrice(item.id),
          unit: item.unit,
          size: item.size,
        },
      ];
    });
  };

  const removeFromCart = (catalogId: number | string) => {
    setCart((prev) => prev.filter((c) => String(c.catalogId) !== String(catalogId)));
  };

  const updateCartQuantity = (catalogId: number | string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(catalogId);
      return;
    }
    setCart((prev) =>
      prev.map((c) => (String(c.catalogId) === String(catalogId) ? { ...c, quantity } : c))
    );
  };

  const clearCart = () => {
    setCart([]);
  };

  const getCartTotal = () => {
    return cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  };

  // Adicionar novo item (salva no Supabase)
  const addItem = async (name: string, category: string, price: number, imageUrl?: string, unit?: string): Promise<CatalogItem> => {
    if (!user?.id) throw new Error("Usuário não autenticado");

    // Verificar limite de itens próprios do plano
    if (!canAddCustomItem) {
      const planName = user?.plan || "Grátis";
      if (user?.isInTrial === false && userPlan === "free") {
        throw new Error("Plano Grátis não permite itens próprios. Faça upgrade para Mensal ou Anual.");
      }
      throw new Error(`Limite de ${customItemsLimit} itens próprios atingido. Faça upgrade para criar mais.`);
    }

    const newItemId = Date.now();
    const newItem: CatalogItem = {
      id: newItemId,
      name,
      category,
      image: category === "Serviços" ? "🔧" : "🌿",
      imageUrl,
      defaultPrice: price,
      unit,
    };

    const { error } = await getSupabase()
      .from("catalog_items")
      .insert({
        user_id: user.id,
        item_id: newItemId,
        name,
        category,
        image: newItem.image,
        image_url: imageUrl || null,
        default_price: price,
        unit: unit || null,
        is_custom: true,
        is_hidden: false,
      });

    if (error) {
      console.error("Erro ao adicionar item:", error);
      throw error;
    }

    await loadCatalogFromDb();
    return newItem;
  };

  // Atualizar item (salva no Supabase)
  const updateItem = async (id: number | string, data: { name?: string; nomeCientifico?: string; descricao?: string; category?: string; price?: number; imageUrl?: string; unit?: string; sizePrices?: { P: number; M: number; G: number } }) => {
    if (!user?.id) throw new Error("Usuário não autenticado");

    const isService = defaultServices.some(item => item.id === id);
    const isPlanta = plantas.some(planta => planta.id === id);
    const existingDbItem = dbItems.find(item => String(item.item_id) === String(id));

    if (existingDbItem) {
      // Atualizar item existente no banco
      const { error } = await getSupabase()
        .from("catalog_items")
        .update({
          name: data.name ?? existingDbItem.name,
          nome_cientifico: data.nomeCientifico !== undefined ? data.nomeCientifico : existingDbItem.nome_cientifico,
          descricao: data.descricao !== undefined ? data.descricao : existingDbItem.descricao,
          category: data.category ?? existingDbItem.category,
          image_url: data.imageUrl !== undefined ? data.imageUrl : existingDbItem.image_url,
          default_price: data.price ?? existingDbItem.default_price,
          size_prices: data.sizePrices ?? existingDbItem.size_prices,
          unit: data.unit !== undefined ? data.unit : existingDbItem.unit,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", user.id)
        .eq("item_id", String(id));

      if (error) {
        console.error("Erro ao atualizar item:", error);
        throw error;
      }
    } else if (isService) {
      // Criar ou atualizar customização de serviço
      const service = defaultServices.find(item => item.id === id)!;
      const { error } = await getSupabase()
        .from("catalog_items")
        .upsert({
          user_id: user.id,
          item_id: String(id),
          name: data.name ?? service.name,
          nome_cientifico: data.nomeCientifico ?? null,
          descricao: data.descricao ?? null,
          category: data.category ?? service.category,
          image: service.image,
          image_url: data.imageUrl ?? service.imageUrl ?? null,
          default_price: data.price ?? service.defaultPrice,
          size_prices: data.sizePrices ?? service.sizePrices ?? null,
          unit: data.unit ?? service.unit ?? null,
          is_custom: false,
          is_hidden: false,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id,item_id' });

      if (error) {
        console.error("Erro ao salvar customização:", error);
        throw error;
      }
    } else if (isPlanta) {
      // Criar ou atualizar customização de planta
      const planta = plantas.find(p => p.id === id)!;
      const { error } = await getSupabase()
        .from("catalog_items")
        .upsert({
          user_id: user.id,
          item_id: String(id),
          name: data.name ?? planta.name,
          nome_cientifico: data.nomeCientifico ?? planta.nomeCientifico ?? null,
          descricao: data.descricao ?? planta.descricao ?? null,
          category: data.category ?? "Plantas",
          image: "🌿",
          image_url: data.imageUrl ?? planta.imageUrl ?? null,
          default_price: data.price ?? planta.defaultPrice,
          size_prices: data.sizePrices ?? null,
          unit: data.unit ?? planta.unit ?? null,
          is_custom: false,
          is_hidden: false,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id,item_id' });

      if (error) {
        console.error("Erro ao salvar customização:", error);
        throw error;
      }
    }

    await loadCatalogFromDb();
  };

  // Deletar item (salva no Supabase)
  const deleteItem = async (id: number | string) => {
    if (!user?.id) throw new Error("Usuário não autenticado");

    const isService = defaultServices.some(item => item.id === id);
    const isPlanta = plantas.some(planta => planta.id === id);
    const existingDbItem = dbItems.find(item => String(item.item_id) === String(id));

    if (isService || isPlanta) {
      // Para serviços e plantas, marcar como oculto
      if (existingDbItem) {
        await getSupabase()
          .from("catalog_items")
          .update({ is_hidden: true, updated_at: new Date().toISOString() })
          .eq("user_id", user.id)
          .eq("item_id", String(id));
      } else {
        // Criar registro para marcar como oculto
        const item = isService
          ? defaultServices.find(s => s.id === id)!
          : plantas.find(p => p.id === id)!;

        await getSupabase()
          .from("catalog_items")
          .insert({
            user_id: user.id,
            item_id: String(id),
            name: item.name,
            category: item.category,
            image: item.image,
            image_url: item.imageUrl ?? null,
            default_price: item.defaultPrice,
            is_custom: false,
            is_hidden: true,
          });
      }
    } else {
      // Para itens customizados pelo usuário, deletar do banco
      await getSupabase()
        .from("catalog_items")
        .delete()
        .eq("user_id", user.id)
        .eq("item_id", String(id));
    }

    // Remover do carrinho se presente
    setCart((prev) => prev.filter((item) => String(item.catalogId) !== String(id)));
    await loadCatalogFromDb();
  };

  // Duplicar item
  const duplicateItem = async (id: number | string): Promise<CatalogItem | null> => {
    const item = items.find(i => String(i.id) === String(id));
    if (!item) return null;

    const price = getPrice(id);
    const newItem = await addItem(
      `${item.name} (cópia)`,
      item.category,
      price,
      item.imageUrl
    );
    return newItem;
  };

  // Restaurar itens padrão ocultos
  const restoreDefaults = async () => {
    if (!user?.id) return;

    await getSupabase()
      .from("catalog_items")
      .update({ is_hidden: false, updated_at: new Date().toISOString() })
      .eq("user_id", user.id)
      .eq("is_hidden", true);

    await loadCatalogFromDb();
  };

  // Função para recarregar catálogo manualmente (plantas + customizações)
  const refreshCatalog = async () => {
    setPlantasLoaded(false);
    setCatalogLoaded(false);
    await Promise.all([loadPlantasFromDb(), loadCatalogFromDb()]);
  };

  return (
    <CatalogContext.Provider
      value={{
        items,
        cart,
        isLoading,
        updatePrice,
        getPrice,
        addToCart,
        removeFromCart,
        updateCartQuantity,
        clearCart,
        getCartTotal,
        addItem,
        updateItem,
        deleteItem,
        duplicateItem,
        restoreDefaults,
        refreshCatalog,
        // Limites de itens próprios
        customItemsCount,
        customItemsLimit,
        canAddCustomItem,
      }}
    >
      {children}
    </CatalogContext.Provider>
  );
}

export function useCatalog() {
  const context = useContext(CatalogContext);
  if (context === undefined) {
    throw new Error("useCatalog must be used within a CatalogProvider");
  }
  return context;
}
