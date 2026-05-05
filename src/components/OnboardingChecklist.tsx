import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Check, ChevronRight, X, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { getSupabase } from "@/lib/supabase";

interface ChecklistItem {
  id: string;
  label: string;
  completed: boolean;
  href?: string;
}

interface OnboardingChecklistProps {
  userId: string;
  hasProposals: boolean;
  hasCatalogItems: boolean;
}

export function OnboardingChecklist({ userId, hasProposals, hasCatalogItems }: OnboardingChecklistProps) {
  const [isVisible, setIsVisible] = useState(true);
  const [isDismissed, setIsDismissed] = useState(false);
  const [hasCompanyName, setHasCompanyName] = useState(false);
  const [hasLogo, setHasLogo] = useState(false);
  const [tourCompleted, setTourCompleted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchProgress = async () => {
      try {
        // Check if dismissed
        const dismissed = localStorage.getItem("fechaaqui_checklist_dismissed");
        if (dismissed === "true") {
          setIsDismissed(true);
          setIsLoading(false);
          return;
        }

        // Fetch profile data
        const { data } = await getSupabase()
          .from("profiles")
          .select("company_name, logo_url, show_tour")
          .eq("user_id", userId)
          .single();

        if (data) {
          setHasCompanyName(!!data.company_name);
          setHasLogo(!!data.logo_url);
          setTourCompleted(data.show_tour === false);
        }
      } catch (error) {
        console.error("Error fetching checklist progress:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchProgress();
  }, [userId]);

  const handleDismiss = () => {
    setIsVisible(false);
    localStorage.setItem("fechaaqui_checklist_dismissed", "true");
  };

  const items: ChecklistItem[] = [
    {
      id: "tour",
      label: "Conhecer o FechaAqui",
      completed: tourCompleted,
    },
    {
      id: "company",
      label: "Configurar sua empresa",
      completed: hasCompanyName && hasLogo,
      href: "/configuracoes",
    },
    {
      id: "catalog",
      label: "Adicionar primeiro item",
      completed: hasCatalogItems,
      href: "/meus-itens",
    },
    {
      id: "proposal",
      label: "Criar primeira proposta",
      completed: hasProposals,
      href: "/propostas/nova",
    },
  ];

  const completedCount = items.filter((item) => item.completed).length;
  const allCompleted = completedCount === items.length;
  const progress = (completedCount / items.length) * 100;

  // Don't show if loading, dismissed, or all completed
  if (isLoading || isDismissed || allCompleted || !isVisible) {
    return null;
  }

  return (
    <div className="bg-white rounded-2xl border border-neutral-200/80 p-4 mb-4 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute -right-6 -top-6 w-24 h-24 rounded-full bg-primary/5" />
      <div className="absolute -right-2 -bottom-8 w-20 h-20 rounded-full bg-amber-500/5" />

      <div className="relative">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-amber-100 flex items-center justify-center">
              <Sparkles className="w-3.5 h-3.5 text-amber-600" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-neutral-900">Primeiros passos</h3>
              <p className="text-[11px] text-neutral-500">{completedCount} de {items.length} concluídos</p>
            </div>
          </div>
          <button
            onClick={handleDismiss}
            className="p-1.5 rounded-full hover:bg-neutral-100 text-neutral-400 hover:text-neutral-600 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Progress bar */}
        <div className="h-1.5 bg-neutral-100 rounded-full mb-4 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-primary to-green-400 rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Checklist items */}
        <div className="space-y-1">
          {items.map((item) => (
            <div key={item.id}>
              {item.href && !item.completed ? (
                <Link
                  to={item.href}
                  className={cn(
                    "flex items-center justify-between py-2 px-2 -mx-2 rounded-lg transition-colors",
                    "hover:bg-neutral-50 active:bg-neutral-100"
                  )}
                >
                  <div className="flex items-center gap-2.5">
                    <div
                      className={cn(
                        "w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 transition-all",
                        item.completed
                          ? "bg-primary"
                          : "border-2 border-neutral-300"
                      )}
                    >
                      {item.completed && <Check className="w-3 h-3 text-white" />}
                    </div>
                    <span
                      className={cn(
                        "text-sm",
                        item.completed
                          ? "text-neutral-400 line-through"
                          : "text-neutral-700 font-medium"
                      )}
                    >
                      {item.label}
                    </span>
                  </div>
                  {!item.completed && (
                    <ChevronRight className="w-4 h-4 text-neutral-400" />
                  )}
                </Link>
              ) : (
                <div className="flex items-center gap-2.5 py-2 px-2 -mx-2">
                  <div
                    className={cn(
                      "w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 transition-all",
                      item.completed
                        ? "bg-primary"
                        : "border-2 border-neutral-300"
                    )}
                  >
                    {item.completed && <Check className="w-3 h-3 text-white" />}
                  </div>
                  <span
                    className={cn(
                      "text-sm",
                      item.completed
                        ? "text-neutral-400 line-through"
                        : "text-neutral-700"
                    )}
                  >
                    {item.label}
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
