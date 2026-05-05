import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { ChevronRight, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { getSupabase } from "@/lib/supabase";

export interface TourStep {
  target: string;
  title: string;
  description: string;
  position?: "top" | "bottom" | "left" | "right";
  navigateTo?: string;
}

interface ProductTourProps {
  steps: TourStep[];
  userId: string;
  onComplete: () => void;
  onSkip: () => void;
}

export function ProductTour({ steps, userId, onComplete, onSkip }: ProductTourProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [currentStep, setCurrentStep] = useState<number | null>(null);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const step = currentStep !== null ? steps[currentStep] : null;
  const isLastStep = currentStep === steps.length - 1;

  // Fetch current step from database on mount
  useEffect(() => {
    const fetchTourStep = async () => {
      try {
        const { data, error } = await getSupabase()
          .from("profiles")
          .select("tour_step")
          .eq("user_id", userId)
          .single();

        // If column doesn't exist or error, start from 0
        if (error || data?.tour_step === undefined || data?.tour_step === null) {
          console.log("[Tour] No tour_step found, starting from 0");
          setCurrentStep(0);
        } else {
          console.log("[Tour] Loaded step from DB:", data.tour_step);
          setCurrentStep(data.tour_step);
        }
      } catch (error) {
        console.error("[Tour] Error loading step:", error);
        setCurrentStep(0);
      } finally {
        setIsLoading(false);
      }
    };

    fetchTourStep();
  }, [userId]);

  // Save step to database when it changes (ignore errors if column doesn't exist)
  const saveStepToDb = async (stepNum: number) => {
    try {
      const { error } = await getSupabase()
        .from("profiles")
        .update({ tour_step: stepNum })
        .eq("user_id", userId);

      if (error) {
        console.log("[Tour] Could not save step (column may not exist):", error.message);
      } else {
        console.log("[Tour] Saved step to DB:", stepNum);
      }
    } catch (error) {
      console.log("[Tour] Error saving step (ignored):", error);
    }
  };

  // Navigate to correct page when step changes
  useEffect(() => {
    if (currentStep === null || !step?.navigateTo) return;

    const targetPath = step.navigateTo;
    const currentPath = location.pathname + location.search;

    // Extract just the pathname for comparison
    const targetPathname = targetPath.split('?')[0];
    const currentPathname = location.pathname;

    console.log(`[Tour] Step ${currentStep}: need=${targetPath}, at=${currentPath}`);

    // Navigate if not on correct page, or if query params differ
    if (currentPathname !== targetPathname || (targetPath.includes('?') && currentPath !== targetPath)) {
      console.log(`[Tour] Navigating to ${targetPath}`);
      navigate(targetPath);
    }
  }, [currentStep, step?.navigateTo, location.pathname, location.search, navigate]);

  // Find target element when on correct page
  useEffect(() => {
    if (currentStep === null || !step?.target) return;

    // Check if we're on the correct page (compare only pathname)
    const targetPathname = step.navigateTo?.split('?')[0];
    if (step.navigateTo && location.pathname !== targetPathname) {
      setIsVisible(false);
      setTargetRect(null);
      return;
    }

    const findElement = () => {
      const element = document.querySelector(step.target);
      if (element) {
        const isMobileView = window.innerWidth < 640;
        const rect = element.getBoundingClientRect();

        if (isMobileView) {
          // On mobile, scroll so element + tooltip both fit on screen
          const elementHeight = Math.min(rect.height, 200);
          const tooltipSpace = 200;
          const totalHeight = elementHeight + tooltipSpace;
          const targetScrollY = window.scrollY + rect.top - (window.innerHeight - totalHeight) / 2;

          window.scrollTo({
            top: Math.max(0, targetScrollY),
            behavior: "smooth"
          });
        } else {
          element.scrollIntoView({ behavior: "smooth", block: "center" });
        }

        // Small delay to let scroll finish before getting rect
        setTimeout(() => {
          const newRect = element.getBoundingClientRect();
          setTargetRect(newRect);
          setIsVisible(true);
        }, 400);
        return true;
      }
      return false;
    };

    // Try immediately
    if (findElement()) return;

    // Retry for dynamic content (5 seconds max)
    let attempts = 0;
    const interval = setInterval(() => {
      attempts++;
      if (findElement() || attempts >= 25) {
        clearInterval(interval);
      }
    }, 200);

    return () => clearInterval(interval);
  }, [currentStep, step?.target, step?.navigateTo, location.pathname]);

  // Update rect on scroll/resize
  useEffect(() => {
    if (!step?.target || !isVisible) return;

    const updateRect = () => {
      const element = document.querySelector(step.target);
      if (element) {
        setTargetRect(element.getBoundingClientRect());
      }
    };

    window.addEventListener("resize", updateRect);
    window.addEventListener("scroll", updateRect, true);
    return () => {
      window.removeEventListener("resize", updateRect);
      window.removeEventListener("scroll", updateRect, true);
    };
  }, [step?.target, isVisible]);

  const handleNext = async () => {
    if (isLastStep) {
      onComplete();
    } else {
      const nextStep = (currentStep ?? 0) + 1;
      setIsVisible(false);
      setTargetRect(null);
      await saveStepToDb(nextStep);
      setCurrentStep(nextStep);
    }
  };

  const handleSkip = () => {
    onSkip();
  };

  // Loading state
  if (isLoading || currentStep === null) {
    return (
      <div className="fixed inset-0 z-[9999] bg-black/60 flex items-center justify-center">
        <div className="bg-white rounded-xl p-6 shadow-2xl flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-neutral-600">Preparando tour...</p>
        </div>
      </div>
    );
  }

  // Finding element state
  if (!targetRect || !isVisible) {
    return (
      <div className="fixed inset-0 z-[9999] bg-black/60 flex items-center justify-center">
        <div className="bg-white rounded-xl p-6 shadow-2xl flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-neutral-600">Carregando...</p>
        </div>
      </div>
    );
  }

  // Calculate tooltip position - responsive for mobile
  const isMobile = window.innerWidth < 640;
  const padding = isMobile ? 8 : 12;
  const tooltipWidth = isMobile ? Math.min(280, window.innerWidth - 32) : 300;
  const tooltipHeight = 160;

  // Limit highlight height on mobile (max 200px) and center it
  const maxMobileHeight = 200;
  const originalHeight = targetRect.height + 12;
  const highlightHeight = isMobile
    ? Math.min(originalHeight, maxMobileHeight)
    : originalHeight;
  const highlightWidth = targetRect.width + 12;

  // On mobile, if we're limiting height, offset the top to center the highlight
  const highlightTop = isMobile && originalHeight > maxMobileHeight
    ? targetRect.top - 6 + (originalHeight - highlightHeight) / 2
    : targetRect.top - 6;

  // On mobile, smart positioning based on available space
  let position = step?.position || "bottom";
  if (isMobile) {
    // Convert left/right to top/bottom
    if (position === "left" || position === "right") {
      const elementCenter = highlightTop + highlightHeight / 2;
      position = elementCenter > window.innerHeight / 2 ? "top" : "bottom";
    }
    // If position is "top" but element is too high, switch to "bottom"
    if (position === "top" && highlightTop < tooltipHeight + 60) {
      position = "bottom";
    }
    // If position is "bottom" but element is too low, switch to "top"
    if (position === "bottom" && (highlightTop + highlightHeight + tooltipHeight + 60) > window.innerHeight) {
      position = "top";
    }
  }

  let tooltipStyle: React.CSSProperties = {};
  let arrowStyle: React.CSSProperties = {};
  let arrowClass = "";

  switch (position) {
    case "bottom":
      tooltipStyle = {
        top: targetRect.bottom + padding,
        left: Math.max(padding, Math.min(
          targetRect.left + targetRect.width / 2 - tooltipWidth / 2,
          window.innerWidth - tooltipWidth - padding
        )),
      };
      arrowClass = "bottom-full left-1/2 -translate-x-1/2 border-b-white border-x-transparent border-t-transparent";
      arrowStyle = { borderWidth: "0 8px 8px 8px" };
      break;
    case "top":
      tooltipStyle = {
        bottom: window.innerHeight - targetRect.top + padding,
        left: Math.max(padding, Math.min(
          targetRect.left + targetRect.width / 2 - tooltipWidth / 2,
          window.innerWidth - tooltipWidth - padding
        )),
      };
      arrowClass = "top-full left-1/2 -translate-x-1/2 border-t-white border-x-transparent border-b-transparent";
      arrowStyle = { borderWidth: "8px 8px 0 8px" };
      break;
    case "right":
      tooltipStyle = {
        top: Math.max(padding, Math.min(
          targetRect.top + targetRect.height / 2 - tooltipHeight / 2,
          window.innerHeight - tooltipHeight - padding
        )),
        left: targetRect.right + padding,
      };
      arrowClass = "right-full top-1/2 -translate-y-1/2 border-r-white border-y-transparent border-l-transparent";
      arrowStyle = { borderWidth: "8px 8px 8px 0" };
      break;
    case "left":
      tooltipStyle = {
        top: Math.max(padding, Math.min(
          targetRect.top + targetRect.height / 2 - tooltipHeight / 2,
          window.innerHeight - tooltipHeight - padding
        )),
        right: window.innerWidth - targetRect.left + padding,
      };
      arrowClass = "left-full top-1/2 -translate-y-1/2 border-l-white border-y-transparent border-r-transparent";
      arrowStyle = { borderWidth: "8px 0 8px 8px" };
      break;
  }

  return (
    <div className="fixed inset-0 z-[9999]">
      {/* Overlay with spotlight */}
      <svg className="absolute inset-0 w-full h-full">
        <defs>
          <mask id="spotlight-mask">
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            <rect
              x={targetRect.left - 6}
              y={highlightTop}
              width={highlightWidth}
              height={highlightHeight}
              rx="12"
              fill="black"
            />
          </mask>
        </defs>
        <rect
          x="0"
          y="0"
          width="100%"
          height="100%"
          fill="rgba(0, 0, 0, 0.8)"
          mask="url(#spotlight-mask)"
        />
      </svg>

      {/* Highlight border */}
      <div
        className="absolute border-2 border-primary rounded-xl pointer-events-none"
        style={{
          top: highlightTop,
          left: targetRect.left - 6,
          width: highlightWidth,
          height: highlightHeight,
          boxShadow: "0 0 0 4px rgba(34, 197, 94, 0.3), 0 0 20px rgba(34, 197, 94, 0.4)",
        }}
      />

      {/* Tooltip */}
      <div
        className={cn(
          "absolute bg-white rounded-2xl shadow-2xl",
          isMobile ? "p-4" : "p-5"
        )}
        style={{ width: tooltipWidth, ...tooltipStyle }}
      >
        <div className={cn("absolute w-0 h-0 border-solid", arrowClass)} style={arrowStyle} />

        <button
          onClick={handleSkip}
          className={cn(
            "absolute rounded-full hover:bg-neutral-100 active:bg-neutral-200 text-neutral-400 hover:text-neutral-600",
            isMobile ? "top-2 right-2 p-2" : "top-3 right-3 p-1.5"
          )}
        >
          <X className={isMobile ? "w-5 h-5" : "w-4 h-4"} />
        </button>

        {/* Progress */}
        <div className="flex gap-1.5 mb-3">
          {steps.map((_, idx) => (
            <div
              key={idx}
              className={cn(
                "h-1.5 rounded-full flex-1",
                idx <= currentStep ? "bg-primary" : "bg-neutral-200"
              )}
            />
          ))}
        </div>

        <h3 className={cn(
          "font-bold text-neutral-900 mb-1.5 pr-6",
          isMobile ? "text-base" : "text-lg"
        )}>{step?.title}</h3>
        <p className={cn(
          "text-neutral-600 leading-relaxed",
          isMobile ? "text-xs mb-4" : "text-sm mb-5"
        )}>{step?.description}</p>

        <div className="flex items-center justify-between gap-3">
          <button
            onClick={handleSkip}
            className={cn(
              "text-neutral-400 hover:text-neutral-600 active:text-neutral-800",
              isMobile ? "text-xs py-2" : "text-sm"
            )}
          >
            Pular
          </button>
          <button
            onClick={handleNext}
            className={cn(
              "flex items-center gap-1.5 bg-primary hover:bg-primary/90 active:bg-primary/80 text-white rounded-xl font-medium",
              isMobile ? "px-4 py-2.5 text-sm" : "px-5 py-2.5 text-sm"
            )}
          >
            {isLastStep ? "Concluir" : "Próximo"}
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
