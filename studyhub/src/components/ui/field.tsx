import { cn } from "@/lib/format";

/** Label + control + hint/error. Pass the control as children with a matching id. */
export function Field({ id, label, hint, error, required, className, children }: {
  id: string; label: string; hint?: string; error?: string[] | string; required?: boolean; className?: string; children: React.ReactNode;
}) {
  const message = Array.isArray(error) ? error[0] : error;
  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={id} className="block text-sm font-medium text-ink">
        {label}
        {required && <span className="text-danger" aria-hidden> *</span>}
      </label>
      {children}
      {message ? (
        <p id={`${id}-error`} className="text-sm text-danger">{message}</p>
      ) : (
        hint && <p id={`${id}-hint`} className="text-sm text-muted">{hint}</p>
      )}
    </div>
  );
}

export const invalid = (error?: string[] | string) => (error && error.length ? "border-danger/30 focus:border-danger focus:ring-danger/10" : "");
