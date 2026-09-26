import { CircleAlert, CircleCheck } from "lucide-react";
import { ERRORS, NOTICES } from "@/lib/notices";
import { cn } from "@/lib/format";

export function Alert({ tone, children }: { tone: "success" | "error"; children: React.ReactNode }) {
  const Icon = tone === "success" ? CircleCheck : CircleAlert;
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "flex items-start gap-3 rounded-xl border px-4 py-3 text-sm",
        tone === "success" ? "border-success/25 bg-success-soft text-success" : "border-danger/30 bg-danger-soft text-danger",
      )}
    >
      <Icon className="mt-0.5 size-4.5 shrink-0" aria-hidden />
      <div>{children}</div>
    </div>
  );
}

/** Shows the fixed message for ?notice= or ?error= after a redirect. Unknown keys render nothing. */
export function Notice({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const n = typeof searchParams.n === "string" && /^\d{1,6}$/.test(searchParams.n) ? searchParams.n : "0";
  const raw = typeof searchParams.notice === "string" ? NOTICES[searchParams.notice as keyof typeof NOTICES] : undefined;
  const notice = raw?.replace("{n}", n);
  const error = typeof searchParams.error === "string" ? ERRORS[searchParams.error as keyof typeof ERRORS] : undefined;
  if (!notice && !error) return null;
  return <div className="mb-6">{error ? <Alert tone="error">{error}</Alert> : <Alert tone="success">{notice}</Alert>}</div>;
}
