import { cn } from "@/lib/utils";

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
      text: "text-jd-marine",
      accent: "text-green-500",
    },
    white: {
      text: "text-white",
      accent: "text-green-400",
    },
  };

  return (
    <div className={cn("flex items-center", className)}>
      <span
        className={cn(
          "font-bold tracking-tight",
          sizes[size].text,
          colors[variant].text
        )}
      >
        Fecha<span className={colors[variant].accent}>Aqui</span>
      </span>
    </div>
  );
}
