import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  Tag,
  ScrollText,
  ArrowLeft,
  Menu,
  X,
  BarChart3,
  AlertCircle,
  TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/Logo";
import { getSupabase } from "@/lib/supabase";

interface NavItem {
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
  badge?: number;
}

export function AdminSidebar() {
  const location = useLocation();
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [pendingAlerts, setPendingAlerts] = useState(0);

  useEffect(() => {
    loadAlerts();
  }, []);

  const loadAlerts = async () => {
    try {
      const { data: payments } = await getSupabase()
        .from("payments")
        .select("id")
        .in("status", ["pending", "failed", "overdue"]);

      setPendingAlerts(payments?.length || 0);
    } catch (error) {
      console.error("Error loading alerts:", error);
    }
  };

  const navigation: NavItem[] = [
    { name: "Dashboard", icon: LayoutDashboard, href: "/admin" },
    { name: "Assinantes", icon: Users, href: "/admin/assinantes" },
    { name: "Relatórios", icon: BarChart3, href: "/admin/relatorios" },
    { name: "Projeção", icon: TrendingUp, href: "/admin/projecao" },
    { name: "Cupons", icon: Tag, href: "/admin/cupons" },
    { name: "Histórico", icon: ScrollText, href: "/admin/logs", badge: pendingAlerts > 0 ? pendingAlerts : undefined },
  ];

  return (
    <>
      {/* Mobile menu button */}
      <button
        onClick={() => setIsMobileOpen(true)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Mobile overlay */}
      {isMobileOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 bg-gradient-to-b from-neutral-900 to-neutral-950 text-white transform transition-transform lg:translate-x-0",
          isMobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between h-16 px-4 border-b border-neutral-800">
          <div className="flex items-center gap-2">
            <Logo size="sm" variant="white" />
            <span className="text-xs font-medium text-green-400 bg-green-900/50 px-2 py-0.5 rounded-full">
              Admin
            </span>
          </div>
          <button
            onClick={() => setIsMobileOpen(false)}
            className="lg:hidden p-1 hover:bg-neutral-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Alert Banner */}
        {pendingAlerts > 0 && (
          <div className="mx-4 mt-4 p-3 bg-neutral-800 border border-neutral-700 rounded-lg">
            <div className="flex items-center gap-2 text-neutral-300">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span className="text-xs font-medium">
                {pendingAlerts} alerta{pendingAlerts > 1 ? "s" : ""} pendente{pendingAlerts > 1 ? "s" : ""}
              </span>
            </div>
          </div>
        )}

        {/* Navigation */}
        <nav className="p-4 space-y-1">
          {navigation.map((item) => {
            const isActive = location.pathname === item.href;
            return (
              <Link
                key={item.name}
                to={item.href}
                onClick={() => setIsMobileOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
                  isActive
                    ? "bg-gradient-to-r from-green-600 to-green-500 text-white shadow-lg shadow-green-600/20"
                    : "text-neutral-400 hover:bg-neutral-800/50 hover:text-white"
                )}
              >
                <item.icon className={cn("w-5 h-5", isActive && "text-white")} />
                <span className="flex-1">{item.name}</span>
                {item.badge !== undefined && item.badge > 0 && (
                  <span className={cn(
                    "px-2 py-0.5 text-xs font-bold rounded-full",
                    isActive
                      ? "bg-white/20 text-white"
                      : "bg-neutral-700 text-neutral-300"
                  )}>
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-neutral-800">
          <Link
            to="/propostas"
            className="flex items-center gap-2 px-3 py-2.5 text-sm text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar ao App
          </Link>
        </div>
      </aside>
    </>
  );
}
