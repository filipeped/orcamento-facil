import { LucideIcon, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface StatsCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  trend?: {
    value: number;
    isPositive: boolean;
    previousValue?: string;
  };
  variant?: "default" | "primary" | "muted";
  loading?: boolean;
}

export function StatsCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  variant = "default",
  loading = false,
}: StatsCardProps) {
  const variantStyles = {
    default: "bg-white border-neutral-200 hover:border-neutral-300",
    primary: "bg-gradient-to-br from-emerald-50 to-emerald-100/50 border-emerald-200 hover:border-emerald-300",
    muted: "bg-neutral-50 border-neutral-200 hover:border-neutral-300",
  };

  const iconStyles = {
    default: "bg-neutral-100 text-neutral-600",
    primary: "bg-emerald-100 text-emerald-600",
    muted: "bg-neutral-200 text-neutral-500",
  };

  const TrendIcon = trend
    ? trend.value === 0
      ? Minus
      : trend.isPositive
      ? TrendingUp
      : TrendingDown
    : null;

  const trendContent = trend && (
    <div
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium",
        trend.value === 0
          ? "bg-neutral-100 text-neutral-600"
          : trend.isPositive
          ? "bg-emerald-100 text-emerald-700"
          : "bg-neutral-200 text-neutral-600"
      )}
    >
      {TrendIcon && <TrendIcon className="w-3 h-3" />}
      <span>{trend.value === 0 ? "0%" : `${trend.isPositive ? "+" : ""}${trend.value.toFixed(1)}%`}</span>
    </div>
  );

  return (
    <div
      className={cn(
        "p-4 lg:p-6 rounded-xl border shadow-sm transition-all duration-300 hover:shadow-md hover:-translate-y-0.5 group",
        variantStyles[variant]
      )}
    >
      <div className="flex items-start justify-between">
        <div className="space-y-0.5 lg:space-y-1 flex-1 min-w-0">
          <p className="text-xs lg:text-sm font-medium text-neutral-500 group-hover:text-neutral-600 transition-colors truncate">
            {title}
          </p>

          {loading ? (
            <div className="h-7 lg:h-9 w-16 lg:w-24 bg-neutral-200 rounded animate-pulse" />
          ) : (
            <p className="text-xl lg:text-3xl font-bold text-neutral-900 tracking-tight truncate">
              {value}
            </p>
          )}

          {subtitle && (
            <p className="text-[10px] lg:text-xs text-neutral-400 truncate hidden sm:block">{subtitle}</p>
          )}

          {trend && !loading && (
            <div className="mt-1 lg:mt-2 hidden sm:block">
              {trend.previousValue ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="inline-block cursor-help">
                      {trendContent}
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="text-xs">
                    <p>Mês anterior: <strong>{trend.previousValue}</strong></p>
                  </TooltipContent>
                </Tooltip>
              ) : (
                trendContent
              )}
              <span className="text-xs text-neutral-400 ml-2 hidden lg:inline">vs mês anterior</span>
            </div>
          )}
        </div>

        <div
          className={cn(
            "p-2 lg:p-3 rounded-lg lg:rounded-xl transition-transform duration-300 group-hover:scale-110 flex-shrink-0",
            iconStyles[variant]
          )}
        >
          <Icon className="w-4 h-4 lg:w-6 lg:h-6" />
        </div>
      </div>
    </div>
  );
}

// Mini Stats Card para uso inline
export function MiniStatsCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  icon?: LucideIcon;
}) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-white rounded-lg border shadow-sm">
      {Icon && <Icon className="w-4 h-4 text-neutral-600" />}
      <div className="flex items-baseline gap-1.5">
        <span className="text-sm font-semibold text-neutral-900">{value}</span>
        <span className="text-xs text-neutral-500">{label}</span>
      </div>
    </div>
  );
}
