import { Link } from "react-router-dom";
import { Receipt, ArrowRight, Sparkles } from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";

export default function FaturasStub() {
  return (
    <DashboardLayout>
      <div className="px-4 sm:px-6 py-12 max-w-3xl mx-auto w-full">
        <div className="bg-white rounded-2xl border border-neutral-200 p-8 sm:p-12 text-center">
          <div className="w-14 h-14 rounded-2xl bg-emerald-50 flex items-center justify-center mx-auto mb-5">
            <Receipt className="w-7 h-7 text-emerald-600" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-semibold text-neutral-900 tracking-tight mb-3">
            Faturas estão chegando
          </h1>
          <p className="text-sm sm:text-base text-neutral-600 max-w-lg mx-auto leading-relaxed mb-2">
            Em breve você vai poder converter um orçamento aprovado em fatura
            com 1 clique, gerar QR Code Pix automático e marcar como pago
            quando o cliente quitar.
          </p>
          <p className="text-xs text-neutral-400 mb-8">
            Por enquanto, use <strong>Orçamentos</strong> para tudo — a base
            é a mesma e seus dados serão preservados.
          </p>

          <div className="grid sm:grid-cols-3 gap-3 mb-10 text-left">
            <FeatureCard
              icon={<Sparkles className="w-4 h-4" />}
              title="Conversão em 1 clique"
              description="Orçamento aprovado vira fatura mantendo todos os itens e cliente."
            />
            <FeatureCard
              icon={<Sparkles className="w-4 h-4" />}
              title="Pix automático"
              description="QR Code e código copia-e-cola direto na fatura — cliente paga sem sair do link."
            />
            <FeatureCard
              icon={<Sparkles className="w-4 h-4" />}
              title="Selo PAGO"
              description="Quando o pagamento confirmar, a fatura ganha selo automático no PDF."
            />
          </div>

          <Button asChild size="lg">
            <Link to="/orcamentos">
              Ir para Orçamentos
              <ArrowRight className="w-4 h-4 ml-1.5" />
            </Link>
          </Button>
        </div>
      </div>
    </DashboardLayout>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="bg-neutral-50 border border-neutral-200 rounded-xl p-4">
      <div className="flex items-center gap-2 text-emerald-600 mb-1.5">
        {icon}
        <span className="text-xs font-semibold uppercase tracking-wider">
          {title}
        </span>
      </div>
      <p className="text-xs text-neutral-600 leading-relaxed">{description}</p>
    </div>
  );
}
