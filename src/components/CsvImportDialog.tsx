import { useRef, useState } from "react";
import { Upload, FileText, X, Check, AlertTriangle, Download, Loader2 } from "lucide-react";
import { parseCsv, mapCsvToClients, mapCsvToItems, ImportedClient, ImportedItem } from "@/lib/csvImport";

type Mode = "clients" | "items";

interface CsvImportDialogProps {
  open: boolean;
  onClose: () => void;
  mode: Mode;
  onImport: (data: ImportedClient[] | ImportedItem[]) => Promise<{ inserted: number; failed: number }>;
}

export function CsvImportDialog({ open, onClose, mode, onImport }: CsvImportDialogProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [parsed, setParsed] = useState<{
    valid: ImportedClient[] | ImportedItem[];
    invalid: { row: Record<string, string>; reason: string }[];
  } | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [result, setResult] = useState<{ inserted: number; failed: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const sampleUrl = mode === "clients" ? "/samples/modelo-clientes.csv" : "/samples/modelo-itens.csv";
  const title = mode === "clients" ? "Importar clientes" : "Importar itens";
  const requiredCols = mode === "clients"
    ? "Nome (obrigatório), Email, Telefone, Endereço, Observações"
    : "Nome (obrigatório), Descrição, Preço, Unidade, Categoria";

  const reset = () => {
    setParsed(null);
    setResult(null);
    setError(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const handleFile = async (file: File) => {
    setError(null);
    setResult(null);
    try {
      const text = await file.text();
      const csv = parseCsv(text);
      if (csv.rows.length === 0) {
        setError("Arquivo sem linhas de dados.");
        return;
      }
      const mapped = mode === "clients" ? mapCsvToClients(csv.rows) : mapCsvToItems(csv.rows);
      setParsed(mapped);
    } catch (e) {
      setError("Erro ao ler arquivo. Confira que é CSV válido.");
      console.error(e);
    }
  };

  const handleConfirm = async () => {
    if (!parsed || parsed.valid.length === 0) return;
    setIsImporting(true);
    try {
      const r = await onImport(parsed.valid);
      setResult(r);
    } catch (e) {
      setError("Falha ao importar. Tente novamente.");
      console.error(e);
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full p-6 relative max-h-[90vh] overflow-y-auto">
        <button
          onClick={() => { reset(); onClose(); }}
          className="absolute top-3 right-3 p-2 rounded-lg hover:bg-neutral-100"
          aria-label="Fechar"
          disabled={isImporting}
        >
          <X className="w-5 h-5 text-neutral-500" />
        </button>

        <h2 className="text-xl font-semibold text-neutral-900 mb-1">{title}</h2>
        <p className="text-sm text-neutral-500 mb-5">
          Envie um arquivo .csv com os dados. Colunas: {requiredCols}.
        </p>

        {/* Resultado da importação */}
        {result && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 mb-4">
            <div className="flex items-start gap-3">
              <Check className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-emerald-900">
                  {result.inserted} {mode === "clients" ? "cliente(s)" : "item(s)"} importado(s)
                </p>
                {result.failed > 0 && (
                  <p className="text-xs text-emerald-700 mt-0.5">{result.failed} linha(s) ignorada(s)</p>
                )}
              </div>
            </div>
            <button
              onClick={() => { reset(); onClose(); }}
              className="mt-3 w-full px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium"
            >
              Concluir
            </button>
          </div>
        )}

        {/* Erro */}
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 mb-4 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-900">{error}</p>
          </div>
        )}

        {/* Upload inicial */}
        {!parsed && !result && (
          <>
            <button
              onClick={() => inputRef.current?.click()}
              className="w-full border-2 border-dashed border-neutral-300 rounded-xl p-8 hover:border-emerald-500 hover:bg-emerald-50/50 transition-colors flex flex-col items-center gap-2"
            >
              <Upload className="w-8 h-8 text-neutral-400" />
              <span className="text-sm font-medium text-neutral-700">Clique para escolher o arquivo</span>
              <span className="text-xs text-neutral-500">Apenas .csv</span>
            </button>
            <input
              ref={inputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
              }}
            />

            <a
              href={sampleUrl}
              download
              className="mt-4 inline-flex items-center gap-1.5 text-sm text-emerald-600 hover:text-emerald-700"
            >
              <Download className="w-4 h-4" />
              Baixar modelo CSV
            </a>
          </>
        )}

        {/* Preview */}
        {parsed && !result && (
          <>
            <div className="rounded-xl border border-neutral-200 p-4 mb-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-medium text-neutral-900">
                  {parsed.valid.length} {mode === "clients" ? "cliente(s)" : "item(s)"} a importar
                </p>
                {parsed.invalid.length > 0 && (
                  <span className="text-xs text-amber-600">
                    {parsed.invalid.length} ignorado(s)
                  </span>
                )}
              </div>

              <div className="max-h-48 overflow-y-auto space-y-1.5">
                {parsed.valid.slice(0, 10).map((item, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-xs text-neutral-600">
                    <FileText className="w-3.5 h-3.5 text-neutral-400 flex-shrink-0" />
                    <span className="truncate">
                      {mode === "clients"
                        ? `${(item as ImportedClient).name}${(item as ImportedClient).phone ? ` · ${(item as ImportedClient).phone}` : ""}`
                        : `${(item as ImportedItem).name} · R$ ${(item as ImportedItem).price.toFixed(2).replace(".", ",")}`}
                    </span>
                  </div>
                ))}
                {parsed.valid.length > 10 && (
                  <p className="text-xs text-neutral-400 italic">+{parsed.valid.length - 10} mais</p>
                )}
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={reset}
                className="flex-1 px-4 py-3 rounded-lg border border-neutral-200 text-neutral-700 text-sm font-medium hover:bg-neutral-50"
                disabled={isImporting}
              >
                Trocar arquivo
              </button>
              <button
                onClick={handleConfirm}
                disabled={isImporting || parsed.valid.length === 0}
                className="flex-1 px-4 py-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isImporting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Importando...
                  </>
                ) : (
                  <>Importar {parsed.valid.length}</>
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
