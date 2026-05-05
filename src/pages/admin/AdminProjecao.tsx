import { useState, useMemo } from "react";
import {
  TrendingUp,
  DollarSign,
  Users,
  Calculator,
  Target,
  Zap,
  Rocket,
} from "lucide-react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";

// Preços dos planos (valor mensal equivalente)
const PRICES = {
  mensal: 97,
  anual: 67,   // 804/12
};

// Cenários pré-definidos
const SCENARIOS = {
  conservador: { name: "Conservador", icon: Target, mensal: 30, anual: 15 },
  moderado: { name: "Moderado", icon: TrendingUp, mensal: 100, anual: 50 },
  otimista: { name: "Otimista", icon: Zap, mensal: 250, anual: 100 },
  sonho: { name: "Sonho", icon: Rocket, mensal: 600, anual: 300 },
};

export default function AdminProjecao() {
  const [mensal, setMensal] = useState(30);
  const [anual, setAnual] = useState(15);

  const applyScenario = (scenario: keyof typeof SCENARIOS) => {
    const s = SCENARIOS[scenario];
    setMensal(s.mensal);
    setAnual(s.anual);
  };

  const metrics = useMemo(() => {
    const receitaMensal = mensal * PRICES.mensal;
    const receitaAnual = anual * PRICES.anual;
    const mrr = receitaMensal + receitaAnual;

    return {
      mrr,
      arr: mrr * 12,
      totalClientes: mensal + anual,
      ticketMedio: (mensal + anual) > 0 ? mrr / (mensal + anual) : 0,
      receitaMensal,
      receitaAnual,
    };
  }, [mensal, anual]);

  const fmt = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v);

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <Calculator className="w-6 h-6 text-green-600" />
            </div>
            <h1 className="text-xl font-bold text-neutral-900">Projeção Financeira</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            {Object.entries(SCENARIOS).map(([key, s]) => (
              <Button key={key} variant="outline" size="sm" onClick={() => applyScenario(key as keyof typeof SCENARIOS)} className="gap-1.5">
                <s.icon className="w-4 h-4" />
                {s.name}
              </Button>
            ))}
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-4 text-white">
            <div className="flex items-center justify-between mb-2">
              <span className="text-green-100 text-sm">MRR</span>
              <TrendingUp className="w-5 h-5 text-green-200" />
            </div>
            <p className="text-2xl font-bold">{fmt(metrics.mrr)}</p>
          </div>
          <div className="bg-white rounded-xl border p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-neutral-500 text-sm">ARR</span>
              <DollarSign className="w-5 h-5 text-neutral-400" />
            </div>
            <p className="text-2xl font-bold text-neutral-900">{fmt(metrics.arr)}</p>
          </div>
          <div className="bg-white rounded-xl border p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-neutral-500 text-sm">Ticket Médio</span>
              <DollarSign className="w-5 h-5 text-neutral-400" />
            </div>
            <p className="text-2xl font-bold text-neutral-900">{fmt(metrics.ticketMedio)}</p>
          </div>
          <div className="bg-white rounded-xl border p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-neutral-500 text-sm">Clientes</span>
              <Users className="w-5 h-5 text-neutral-400" />
            </div>
            <p className="text-2xl font-bold text-neutral-900">{metrics.totalClientes}</p>
          </div>
        </div>

        {/* Simulador + Breakdown */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl border p-6">
            <h3 className="text-lg font-semibold text-neutral-900 mb-6">Simulador</h3>
            <div className="space-y-6">
              {[
                { label: "Mensal", price: 97, value: mensal, set: setMensal, max: 500 },
                { label: "Anual", price: 67, value: anual, set: setAnual, max: 200 },
              ].map((item) => (
                <div key={item.label}>
                  <div className="flex justify-between mb-2">
                    <span className="text-sm font-medium">{item.label} <span className="text-neutral-400">(R$ {item.price})</span></span>
                    <span className="text-sm font-bold text-green-600">{item.value}</span>
                  </div>
                  <Slider value={[item.value]} onValueChange={(v) => item.set(v[0])} min={0} max={item.max} />
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-xl border p-6">
            <h3 className="text-lg font-semibold text-neutral-900 mb-6">Receita por Plano</h3>
            <div className="space-y-3">
              {[
                { label: "Mensal (R$97/mês)", value: metrics.receitaMensal },
                { label: "Anual (R$804/ano = R$67/mês)", value: metrics.receitaAnual },
              ].map((item) => (
                <div key={item.label} className="flex justify-between py-3 border-b">
                  <span className="text-neutral-600">{item.label}</span>
                  <span className="font-semibold">{fmt(item.value)}</span>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between p-4 bg-neutral-900 rounded-lg mt-6">
              <span className="font-medium text-white">Total MRR</span>
              <span className="text-2xl font-bold text-green-400">{fmt(metrics.mrr)}</span>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
