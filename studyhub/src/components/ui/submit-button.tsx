"use client";

import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/format";

export function SubmitButton({ children, pendingText, variant = "primary", className }: {
  children: React.ReactNode; pendingText?: string; variant?: "primary" | "soft" | "danger"; className?: string;
}) {
  const { pending } = useFormStatus();
  const base = variant === "primary" ? "btn-primary" : variant === "soft" ? "btn-soft" : "btn-danger";
  return (
    <button type="submit" disabled={pending} aria-busy={pending} className={cn(base, className)}>
      {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {pending && pendingText ? pendingText : children}
    </button>
  );
}
