import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center px-6 py-12",
        "rounded-2xl border-2 border-dashed border-neutral-200 bg-white/50",
        className
      )}
    >
      {Icon && (
        <div className="w-14 h-14 rounded-2xl bg-jd-marine/5 flex items-center justify-center mb-4">
          <Icon className="w-7 h-7 text-jd-marine/60" />
        </div>
      )}
      <h3 className="font-semibold text-jd-marine mb-1">{title}</h3>
      {description && (
        <p className="text-sm text-neutral-500 mb-5 max-w-sm">{description}</p>
      )}
      {action && <div>{action}</div>}
    </div>
  );
}
