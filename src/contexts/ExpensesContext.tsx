import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

export interface Expense {
  id: string;
  amount: number;
  description: string;
  category: string;
  date: string;
  receiptUrl?: string;
  notes?: string;
  createdAt: string;
}

export const EXPENSE_CATEGORIES = [
  "Material",
  "Combustível",
  "Equipamento",
  "Impostos e Taxas",
  "Marketing",
  "Software",
  "Telefonia/Internet",
  "Mão de obra terceirizada",
  "Manutenção de veículo",
  "Outros",
];

interface ExpensesContextValue {
  expenses: Expense[];
  isLoading: boolean;
  addExpense: (data: Omit<Expense, "id" | "createdAt">) => Expense;
  updateExpense: (id: string, data: Partial<Omit<Expense, "id" | "createdAt">>) => void;
  deleteExpense: (id: string) => void;
  totalForMonth: (year: number, month: number) => number;
}

const ExpensesContext = createContext<ExpensesContextValue | undefined>(undefined);

const STORAGE_KEY = "fechaaqui_expenses_v1";
const LEGACY_STORAGE_KEY = "orcafacil_expenses_v1";

function readStorage(): Expense[] {
  try {
    let raw = localStorage.getItem(STORAGE_KEY);
    // Migração silenciosa: se não tem chave nova mas tem antiga, copia e remove a antiga
    if (!raw) {
      const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
      if (legacy) {
        localStorage.setItem(STORAGE_KEY, legacy);
        localStorage.removeItem(LEGACY_STORAGE_KEY);
        raw = legacy;
      }
    }
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeStorage(items: Expense[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // ignore quota errors
  }
}

function uuid() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `exp_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function ExpensesProvider({ children }: { children: React.ReactNode }) {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setExpenses(readStorage());
    setIsLoading(false);
  }, []);

  useEffect(() => {
    if (!isLoading) writeStorage(expenses);
  }, [expenses, isLoading]);

  const addExpense = useCallback(
    (data: Omit<Expense, "id" | "createdAt">) => {
      const expense: Expense = {
        ...data,
        id: uuid(),
        createdAt: new Date().toISOString(),
      };
      setExpenses((prev) => [expense, ...prev]);
      return expense;
    },
    []
  );

  const updateExpense = useCallback(
    (id: string, data: Partial<Omit<Expense, "id" | "createdAt">>) => {
      setExpenses((prev) =>
        prev.map((e) => (e.id === id ? { ...e, ...data } : e))
      );
    },
    []
  );

  const deleteExpense = useCallback((id: string) => {
    setExpenses((prev) => prev.filter((e) => e.id !== id));
  }, []);

  const totalForMonth = useCallback(
    (year: number, month: number) => {
      return expenses
        .filter((e) => {
          const d = new Date(e.date);
          return d.getFullYear() === year && d.getMonth() === month;
        })
        .reduce((sum, e) => sum + e.amount, 0);
    },
    [expenses]
  );

  const value = useMemo<ExpensesContextValue>(
    () => ({
      expenses,
      isLoading,
      addExpense,
      updateExpense,
      deleteExpense,
      totalForMonth,
    }),
    [expenses, isLoading, addExpense, updateExpense, deleteExpense, totalForMonth]
  );

  return (
    <ExpensesContext.Provider value={value}>{children}</ExpensesContext.Provider>
  );
}

export function useExpenses() {
  const ctx = useContext(ExpensesContext);
  if (!ctx) {
    throw new Error("useExpenses must be used within ExpensesProvider");
  }
  return ctx;
}
