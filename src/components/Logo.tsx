import { cn } from "@/lib/utils";
import { BRAND } from "@/lib/brand";

interface LogoProps {
  variant?: "default" | "white";
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function Logo({ variant = "default", size = "md", className }: LogoProps) {
  const sizes = {
    sm: { text: "text-lg" },
    md: { text: "text-xl" },
    lg: { text: "text-2xl" },
  };

  const colors = {
    default: {
      text: "text-neutral-900",
      accent: "text-emerald-600",
    },
    white: {
      text: "text-white",
      accent: "text-emerald-300",
    },
  };

  const name = BRAND.name;
  const lastChar = name.slice(-1);
  const rest = name.slice(0, -1);

  return (
    <div className={cn("flex items-center", className)}>
      <span
        className={cn(
          "font-semibold tracking-tight",
          sizes[size].text,
          colors[variant].text
        )}
      >
        {rest}
        <span className={colors[variant].accent}>{lastChar}</span>
      </span>
    </div>
  );
}
