import type { Metadata } from "next";
import { MessageCircle, Wallet } from "lucide-react";
import { requireStudent } from "@/server/auth/guards";
import { studentFees } from "@/server/services/fees";
import { formatAmount } from "@/lib/fees";
import { formatDate } from "@/lib/format";
import { feePaymentUrl } from "@/lib/contact";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/ui/status-badge";

export const metadata: Metadata = { title: "Fee" };

export default async function StudentFeePage() {
  const user = await requireStudent();
  const fees = await studentFees(user.id);
  const pending = fees.filter((f) => f.status === "PENDING");

  return (
    <div className="space-y-6">
      <PageHeader title="Fee" description="Your StudyHub usage fee. Payment is handled by your admin, not inside the app." />

      {fees.length === 0 ? (
        <div className="card">
          <EmptyState icon={Wallet} title="No fee on record" description="Nothing is due right now. Your admin will let you know if that changes." />
        </div>
      ) : (
        <div className="space-y-4">
          {pending.map((f) => (
            <div key={f.id} className="card flex flex-wrap items-center justify-between gap-4 border-l-4 border-l-amber-400 p-5">
              <div>
                <p className="font-semibold">{f.period} — {formatAmount(f.amount)}</p>
                <p className="text-sm text-muted">{f.dueDate ? `Due ${formatDate(f.dueDate)}` : "No due date set"}{f.note ? ` · ${f.note}` : ""}</p>
              </div>
              <a href={feePaymentUrl(f.period)} target="_blank" rel="noopener noreferrer" className="btn-primary">
                <MessageCircle className="size-4.5" aria-hidden /> Pay via WhatsApp
              </a>
            </div>
          ))}

          <div className="card overflow-hidden">
            <ul className="divide-y divide-line">
              {fees.map((f) => (
                <li key={f.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <div>
                    <p className="font-medium">{f.period}</p>
                    <p className="text-sm text-muted">{formatAmount(f.amount)}{f.dueDate ? ` · Due ${formatDate(f.dueDate)}` : ""}</p>
                  </div>
                  <StatusBadge status={f.status} />
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
