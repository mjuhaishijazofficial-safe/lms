import { cn } from "@/lib/format";

const STYLES: Record<string, { label: string; cls: string }> = {
  ACTIVE: { label: "Active", cls: "bg-emerald-50 text-emerald-700 ring-emerald-600/15" },
  INACTIVE: { label: "Inactive", cls: "bg-slate-100 text-slate-600 ring-slate-500/15" },
  PUBLISHED: { label: "Published", cls: "bg-emerald-50 text-emerald-700 ring-emerald-600/15" },
  DRAFT: { label: "Draft", cls: "bg-amber-50 text-amber-700 ring-amber-600/20" },
  ARCHIVED: { label: "Archived", cls: "bg-slate-100 text-slate-600 ring-slate-500/15" },
};

export function StatusBadge({ status }: { status: string }) {
  const s = STYLES[status] ?? { label: status, cls: "bg-slate-100 text-slate-600 ring-slate-500/15" };
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
