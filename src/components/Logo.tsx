import { Sprout } from "lucide-react";
import { cn } from "@/lib/utils";

interface LogoProps {
  variant?: "default" | "white";
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function Logo({ variant = "default", size = "md", className }: LogoProps) {
  const sizes = {
    sm: { icon: 18, text: "text-lg", padding: "p-1" },
    md: { icon: 20, text: "text-xl", padding: "p-1.5" },
    lg: { icon: 26, text: "text-2xl", padding: "p-2" },
  };

  const colors = {
    default: {
      icon: "text-emerald-600",
      bg: "bg-emerald-100",
      text: "text-neutral-900",
      accent: "text-emerald-600",
    },
    white: {
      icon: "text-emerald-400",
      bg: "bg-white/15",
      text: "text-white",
      accent: "text-emerald-300",
    },
  };

  return (
    <div className={cn("flex items-center", className)}>
      <span className={cn(
        "font-semibold tracking-tight",
        sizes[size].text,
        colors[variant].text
      )}>
        JARDINE<span className={colors[variant].accent}>I</span>
      </span>
    </div>
  );
}
