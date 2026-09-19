import type { LucideIcon } from "lucide-react";
import { IconTile } from "./icon-tile";

export function EmptyState({ icon, title, description, action }: {
  icon: LucideIcon; title: string; description?: string; action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      <IconTile icon={icon} size="lg" />
      <p className="mt-4 font-semibold text-ink">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-muted">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
