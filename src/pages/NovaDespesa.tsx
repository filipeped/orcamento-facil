import { useRef, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { ArrowLeft, Camera, Loader2, X } from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useExpenses, EXPENSE_CATEGORIES } from "@/contexts/ExpensesContext";
import { toast } from "sonner";

export default function NovaDespesa() {
  const navigate = useNavigate();
  const { addExpense } = useExpenses();
  const fileRef = useRef<HTMLInputElement>(null);

  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState(EXPENSE_CATEGORIES[0]);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [receiptDataUrl, setReceiptDataUrl] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const handleReceiptUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Selecione uma imagem (JPG, PNG ou WebP)");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Imagem deve ter no maximo 5MB");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setReceiptDataUrl(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    const numericAmount = parseFloat(amount.replace(",", "."));
    if (!numericAmount || numericAmount <= 0) {
      toast.error("Informe um valor valido");
      return;
    }
    if (!description.trim()) {
      toast.error("Informe uma descricao");
      return;
    }

    setIsSaving(true);
    try {
      addExpense({
        amount: numericAmount,
        description: description.trim(),
        category,
        date,
        notes: notes.trim() || undefined,
        receiptUrl: receiptDataUrl || undefined,
      });
      toast.success("Despesa salva!");
      navigate("/despesas");
    } catch (error) {
      console.error(error);
      toast.error("Erro ao salvar despesa");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="px-4 sm:px-6 py-6 max-w-2xl mx-auto w-full space-y-6">
        <div>
          <Link
            to="/despesas"
            className="inline-flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-800 transition-colors mb-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar
          </Link>
          <h1 className="text-2xl font-semibold text-neutral-900 tracking-tight">
            Nova despesa
          </h1>
          <p className="text-sm text-neutral-500 mt-1">
            Registre um gasto e anexe a foto do recibo se quiser.
          </p>
        </div>

        <div className="bg-white rounded-xl border border-neutral-200 p-5 sm:p-6 space-y-5">
          {/* Recibo */}
          <div>
            <label className="text-sm font-medium text-neutral-700 mb-2 block">
              Foto do recibo (opcional)
            </label>
            <input
              type="file"
              ref={fileRef}
              onChange={handleReceiptUpload}
              accept="image/png,image/jpeg,image/jpg,image/webp"
              className="hidden"
            />
            {receiptDataUrl ? (
              <div className="relative inline-block">
                <img
                  src={receiptDataUrl}
                  alt="Recibo"
                  className="w-32 h-32 rounded-xl object-cover border border-neutral-200"
                />
                <button
                  type="button"
                  onClick={() => setReceiptDataUrl(null)}
                  className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-white border border-neutral-200 shadow-sm flex items-center justify-center hover:bg-red-50 hover:border-red-200 transition-colors"
                  aria-label="Remover recibo"
                >
                  <X className="w-3 h-3 text-neutral-600" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="w-32 h-32 rounded-xl border-2 border-dashed border-neutral-300 hover:border-green-400 hover:bg-accent/10 transition-colors flex flex-col items-center justify-center gap-1 text-neutral-500"
              >
                <Camera className="w-6 h-6" />
                <span className="text-xs">Adicionar foto</span>
              </button>
            )}
          </div>

          {/* Valor */}
          <div>
            <label className="text-sm font-medium text-neutral-700 mb-2 block">
              Valor
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-neutral-500">
                R$
              </span>
              <Input
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0,00"
                className="pl-9"
              />
            </div>
          </div>

          {/* Descricao */}
          <div>
            <label className="text-sm font-medium text-neutral-700 mb-2 block">
              Descrição
            </label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ex: Combustível para visita ao cliente"
            />
          </div>

          {/* Categoria + Data */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-neutral-700 mb-2 block">
                Categoria
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
              >
                {EXPENSE_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-neutral-700 mb-2 block">
                Data
              </label>
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
          </div>

          {/* Notas */}
          <div>
            <label className="text-sm font-medium text-neutral-700 mb-2 block">
              Observações (opcional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Detalhes, número da nota fiscal etc."
              className="w-full min-h-[80px] px-3 py-2 text-sm rounded-md border border-input bg-background resize-none"
            />
          </div>

          <div className="flex items-center gap-3 pt-2">
            <Button onClick={handleSave} disabled={isSaving} className="flex-1">
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Salvar despesa"}
            </Button>
            <Button asChild variant="outline">
              <Link to="/despesas">Cancelar</Link>
            </Button>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
