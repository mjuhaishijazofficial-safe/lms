import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, Clock, ListChecks, PlayCircle } from "lucide-react";
import { requireStudent } from "@/server/auth/guards";
import { listStudentTests } from "@/server/services/test-attempts";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { IconTile } from "@/components/ui/icon-tile";

export const metadata: Metadata = { title: "Tests" };

const STATUS_LABEL: Record<string, string> = {
  "not-started": "Not started",
  "in-progress": "In progress — resume",
  expired: "Time's up — view result",
  done: "Completed",
};

export default async function StudentTestsPage() {
  const user = await requireStudent();
  const tests = await listStudentTests(user);

  return (
    <div className="space-y-6">
      <PageHeader title="Tests" description="Timed tests your admin has set for your subjects. Each one is a single attempt." />

      {tests.length === 0 ? (
        <div className="card">
          <EmptyState icon={ListChecks} title="No tests yet" description="Your admin hasn't published a test for your subjects yet — check back later." />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {tests.map((t) => (
            <Link key={t.id} href={`/tests/${t.id}`} className="card flex flex-col gap-3 p-5 transition hover:border-primary/40 hover:shadow-md">
              <div className="flex items-start gap-3">
                <IconTile icon={ListChecks} size="sm" className="bg-tile-purple text-violet-800" />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{t.title}</p>
                  <p className="truncate text-sm text-muted">{t.subjectName} · {t.courseName}</p>
                </div>
              </div>
              {t.description && <p className="text-sm text-muted">{t.description}</p>}
              <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
                <span className="inline-flex items-center gap-1.5"><Clock className="size-4" aria-hidden /> {t.durationMinutes} min</span>
                <span>{t.totalQuestions} question{t.totalQuestions === 1 ? "" : "s"}</span>
              </div>
              <div className={`inline-flex w-fit items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${
                t.status === "done" ? "bg-emerald-50 text-emerald-700" : t.status === "not-started" ? "bg-page text-muted" : "bg-amber-50 text-amber-800"
              }`}>
                {t.status === "done" ? <CheckCircle2 className="size-3.5" aria-hidden /> : t.status === "not-started" ? null : <PlayCircle className="size-3.5" aria-hidden />}
                {t.status === "done" ? `Completed — ${t.score}/${t.totalQuestions}` : STATUS_LABEL[t.status]}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
