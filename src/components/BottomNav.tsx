import { Link, useLocation } from "react-router-dom";
import { FileText, Receipt, Users, BarChart3, Menu } from "lucide-react";
import { cn } from "@/lib/utils";

interface NavItem {
  label: string;
  to: string;
  icon: typeof FileText;
  matches: string[];
}

const NAV_ITEMS: NavItem[] = [
  { label: "Orçamentos", to: "/orcamentos", icon: FileText, matches: ["/orcamentos", "/propostas"] },
  { label: "Faturas", to: "/faturas", icon: Receipt, matches: ["/faturas"] },
  { label: "Clientes", to: "/clientes", icon: Users, matches: ["/clientes"] },
  { label: "Relatórios", to: "/relatorios", icon: BarChart3, matches: ["/relatorios"] },
  { label: "Mais", to: "/mais", icon: Menu, matches: ["/mais", "/meus-itens", "/despesas", "/agenda", "/configuracoes", "/recibos"] },
];

interface BottomNavProps {
  onMoreClick?: () => void;
}

export function BottomNav({ onMoreClick }: BottomNavProps) {
  const location = useLocation();
  const path = location.pathname;

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-neutral-200 pb-[env(safe-area-inset-bottom)]"
      aria-label="Navegação principal"
    >
      <div className="grid grid-cols-5 h-16">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = item.matches.some((m) => path === m || path.startsWith(m + "/"));
          if (item.label === "Mais") {
            return (
              <button
                key={item.to}
                onClick={onMoreClick}
                className={cn(
                  "flex flex-col items-center justify-center gap-0.5 transition-colors",
                  active ? "text-jd-marine" : "text-neutral-500"
                )}
              >
                <Icon size={22} strokeWidth={active ? 2.4 : 2} />
                <span className="text-[10px] font-medium">{item.label}</span>
              </button>
            );
          }
          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "flex flex-col items-center justify-center gap-0.5 transition-colors",
                active ? "text-jd-marine" : "text-neutral-500"
              )}
            >
              <Icon size={22} strokeWidth={active ? 2.4 : 2} />
              <span className="text-[10px] font-medium">{item.label}</span>
              {active && <span className="absolute bottom-1 w-8 h-0.5 bg-jd-marine rounded-full" />}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
