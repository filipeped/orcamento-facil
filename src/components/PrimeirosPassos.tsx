import { Link } from "react-router-dom";
import { Check, ChevronRight, X } from "lucide-react";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { getSupabase } from "@/lib/supabase";

interface PrimeirosPassosProps {
  hasProposal: boolean;
  hasProfile: boolean;
  hasCustomItem: boolean;
  tourCompleted: boolean;
  onDismiss: () => void;
  onComplete: () => void;
  userId?: string;
}

export function PrimeirosPassos({
  hasProposal,
  hasProfile,
  hasCustomItem,
  tourCompleted,
  onDismiss,
  onComplete,
  userId,
}: PrimeirosPassosProps) {
  const [dismissed, setDismissed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Check if checklist was dismissed from database
  useEffect(() => {
    const checkDismissed = async () => {
      if (!userId) {
        setIsLoading(false);
        return;
      }
      try {
        const { data } = await getSupabase()
          .from("profiles")
          .select("checklist_dismissed")
          .eq("user_id", userId)
          .single();
        if (data?.checklist_dismissed) {
          setDismissed(true);
        }
      } catch (error) {
        console.error("Error checking checklist:", error);
      } finally {
        setIsLoading(false);
      }
    };
    checkDismissed();
  }, [userId]);

  const allTasksComplete = tourCompleted && hasProposal && hasProfile && hasCustomItem;

  // Quando todas as tarefas forem completadas, salva no banco
  useEffect(() => {
    const saveCompletion = async () => {
      if (allTasksComplete && userId) {
        try {
          await getSupabase()
            .from("profiles")
            .update({ onboarding_completed: true })
            .eq("user_id", userId);
          onComplete();
        } catch (error) {
          console.error("Error saving onboarding completion:", error);
        }
      }
    };
    saveCompletion();
  }, [allTasksComplete, userId, onComplete]);

  const steps = [
    {
      id: 1,
      title: "Conhecer o Jardinei",
      description: "Faça o tour pelo sistema",
      completed: tourCompleted,
      href: "#",
    },
    {
      id: 2,
      title: "Complete seu perfil",
      description: "Adicione logo e dados da empresa",
      completed: hasProfile,
      href: "/configuracoes?tab=proposal",
    },
    {
      id: 3,
      title: "Adicione um item",
      description: "Personalize seu catálogo",
      completed: hasCustomItem,
      href: "/meus-itens",
    },
    {
      id: 4,
      title: "Crie seu primeiro orçamento",
      description: "Envie uma proposta para um cliente",
      completed: hasProposal,
      href: "/propostas/nova",
    },
  ];

  const completedCount = steps.filter((s) => s.completed).length;
  const allCompleted = completedCount === steps.length;

  // Find the first incomplete step (current step)
  const currentStepIndex = steps.findIndex((s) => !s.completed);

  const handleDismiss = async () => {
    setDismissed(true);
    if (userId) {
      try {
        await getSupabase()
          .from("profiles")
          .update({ checklist_dismissed: true })
          .eq("user_id", userId);
      } catch (error) {
        console.error("Error dismissing checklist:", error);
      }
    }
    onDismiss();
  };

  if (isLoading || dismissed || allCompleted) return null;

  return (
    <div className="bg-white rounded-xl border border-neutral-200 mb-5 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-100">
        <div>
          <h2 className="text-sm font-semibold text-neutral-900">Primeiros passos</h2>
          <p className="text-xs text-neutral-500">{completedCount} de {steps.length} concluídos</p>
        </div>
        <button
          onClick={handleDismiss}
          className="p-1.5 -mr-1 rounded-lg hover:bg-neutral-100 text-neutral-400 hover:text-neutral-600 transition-colors"
        >
          <X size={16} />
        </button>
      </div>

      {/* Steps */}
      <div>
        {steps.map((step, index) => {
          const isCurrent = index === currentStepIndex;

          return (
            <Link
              key={step.id}
              to={step.completed ? "#" : step.href}
              onClick={(e) => step.completed && e.preventDefault()}
              className={cn(
                "flex items-center gap-3 px-4 py-3 border-b border-neutral-100 last:border-b-0 transition-colors",
                step.completed && "opacity-50 cursor-default",
                isCurrent && "bg-primary/5 border-l-2 border-l-primary",
                !step.completed && !isCurrent && "hover:bg-neutral-50"
              )}
            >
              {/* Checkbox */}
              <div className={cn(
                "w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all",
                step.completed && "bg-primary border-primary",
                isCurrent && "border-primary",
                !step.completed && !isCurrent && "border-neutral-300"
              )}>
                {step.completed && <Check className="w-3.5 h-3.5 text-white" />}
                {isCurrent && !step.completed && (
                  <div className="w-2 h-2 rounded-full bg-primary" />
                )}
              </div>

              {/* Text */}
              <div className="flex-1 min-w-0">
                <p className={cn(
                  "text-sm font-medium",
                  step.completed && "text-neutral-400 line-through",
                  isCurrent && "text-primary",
                  !step.completed && !isCurrent && "text-neutral-600"
                )}>
                  {step.title}
                </p>
                {isCurrent && (
                  <p className="text-xs text-neutral-500 mt-0.5">
                    {step.description}
                  </p>
                )}
              </div>

              {/* Arrow - only for current step */}
              {isCurrent && (
                <ChevronRight className="w-5 h-5 text-primary flex-shrink-0" />
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
