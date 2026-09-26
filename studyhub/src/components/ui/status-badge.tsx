import { cn } from "@/lib/format";

const STYLES: Record<string, { label: string; cls: string }> = {
  ACTIVE: { label: "Active", cls: "bg-success-soft text-success ring-success/15" },
  INACTIVE: { label: "Inactive", cls: "bg-page text-muted ring-muted/15" },
  PUBLISHED: { label: "Published", cls: "bg-success-soft text-success ring-success/15" },
  DRAFT: { label: "Draft", cls: "bg-warning-soft text-warning ring-warning/20" },
  SCHEDULED: { label: "Scheduled", cls: "bg-info-soft text-info ring-info/15" },
  ARCHIVED: { label: "Archived", cls: "bg-page text-muted ring-muted/15" },
  PENDING: { label: "Pending", cls: "bg-warning-soft text-warning ring-warning/20" },
  PAID: { label: "Paid", cls: "bg-success-soft text-success ring-success/15" },
  WAIVED: { label: "Waived", cls: "bg-page text-muted ring-muted/15" },
};

export function StatusBadge({ status }: { status: string }) {
  const s = STYLES[status] ?? { label: status, cls: "bg-page text-muted ring-muted/15" };
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset", s.cls)}>
      <span className="size-1.5 rounded-full bg-current" aria-hidden />
      {s.label}
    </span>
  );
}

export const STATUS_OPTIONS = [
  { value: "PUBLISHED", label: "Published — visible to students" },
  { value: "DRAFT", label: "Draft — hidden from students" },
  { value: "ARCHIVED", label: "Archived — hidden and kept for reference" },
];
