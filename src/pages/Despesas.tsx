import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Trash2, Receipt as ReceiptIcon, Wallet, Calendar } from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useExpenses, EXPENSE_CATEGORIES } from "@/contexts/ExpensesContext";

function formatBRL(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR");
}

export default function Despesas() {
  const { expenses, deleteExpense, totalForMonth, isLoading } = useExpenses();
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("");

  const now = new Date();
  const currentMonthTotal = totalForMonth(now.getFullYear(), now.getMonth());

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return expenses.filter((e) => {
      if (categoryFilter && e.category !== categoryFilter) return false;
      if (!term) return true;
      return (
        e.description.toLowerCase().includes(term) ||
        e.category.toLowerCase().includes(term)
      );
    });
  }, [expenses, search, categoryFilter]);

  const totalFiltered = filtered.reduce((sum, e) => sum + e.amount, 0);

  return (
    <DashboardLayout>
      <div className="px-4 sm:px-6 py-6 max-w-6xl mx-auto w-full space-y-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold text-neutral-900 tracking-tight flex items-center gap-2">
              <Wallet className="w-6 h-6 text-green-600" />
              Despesas
            </h1>
            <p className="text-sm text-neutral-500 mt-1">
              Acompanhe seus gastos e mantenha o controle do seu lucro líquido.
            </p>
          </div>
          <Button asChild>
            <Link to="/despesas/nova">
              <Plus className="w-4 h-4 mr-1.5" />
              Nova despesa
            </Link>
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <StatCard
            label="Mês atual"
            value={formatBRL(currentMonthTotal)}
            icon={<Calendar className="w-4 h-4" />}
            tone="emerald"
          />
          <StatCard
            label="Total de lançamentos"
            value={String(expenses.length)}
            icon={<ReceiptIcon className="w-4 h-4" />}
          />
          <StatCard
            label="Total filtrado"
            value={formatBRL(totalFiltered)}
            icon={<Wallet className="w-4 h-4" />}
          />
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 flex-wrap">
          <Input
            placeholder="Buscar por descrição ou categoria..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-sm"
          />
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="h-10 px-3 rounded-md border border-input bg-background text-sm"
          >
            <option value="">Todas as categorias</option>
            {EXPENSE_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>

        {/* List */}
        <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
          {isLoading ? (
            <div className="p-12 text-center text-sm text-neutral-500">
              Carregando...
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center">
              <Wallet className="w-10 h-10 text-neutral-300 mx-auto mb-3" />
              <p className="text-sm text-neutral-600 mb-4">
                {expenses.length === 0
                  ? "Nenhuma despesa cadastrada ainda"
                  : "Nenhuma despesa encontrada com esses filtros"}
              </p>
              {expenses.length === 0 && (
                <Button asChild variant="outline" size="sm">
                  <Link to="/despesas/nova">
                    <Plus className="w-4 h-4 mr-1" />
                    Adicionar primeira despesa
                  </Link>
                </Button>
              )}
            </div>
          ) : (
            <ul className="divide-y divide-neutral-100">
              {filtered.map((expense) => (
                <li
                  key={expense.id}
                  className="px-4 py-3 sm:px-5 sm:py-4 flex items-center gap-3 hover:bg-neutral-50 transition-colors"
                >
                  {expense.receiptUrl ? (
                    <img
                      src={expense.receiptUrl}
                      alt="Recibo"
                      className="w-12 h-12 rounded-md object-cover border border-neutral-200 flex-shrink-0"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-md bg-neutral-100 flex items-center justify-center flex-shrink-0">
                      <ReceiptIcon className="w-5 h-5 text-neutral-400" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-neutral-900 truncate">
                      {expense.description || "(sem descrição)"}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5 text-xs text-neutral-500">
                      <span className="px-1.5 py-0.5 bg-neutral-100 rounded">
                        {expense.category}
                      </span>
                      <span>·</span>
                      <span>{formatDate(expense.date)}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-neutral-900 tabular-nums">
                      {formatBRL(expense.amount)}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      if (confirm("Excluir esta despesa?")) {
                        deleteExpense(expense.id);
                      }
                    }}
                    className="p-2 text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                    aria-label="Excluir despesa"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}

function StatCard({
  label,
  value,
  icon,
  tone,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  tone?: "emerald";
}) {
  return (
    <div
      className={
        tone === "emerald"
          ? "bg-accent/10 border border-green-200 rounded-xl p-4"
          : "bg-white border border-neutral-200 rounded-xl p-4"
      }
    >
      <div className="flex items-center gap-1.5 text-xs text-neutral-500 mb-1">
        {icon}
        {label}
      </div>
      <p className="text-xl font-semibold text-neutral-900 tabular-nums">
        {value}
      </p>
    </div>
  );
}
