import type { Metadata } from "next";
import { env } from "@/server/env";
import { subjectOptions } from "@/server/services/subjects";
import { nextChapterNumbers } from "@/server/services/guides";
import { idParam } from "@/lib/params";
import { PageHeader } from "@/components/ui/page-header";
import { GuideChaptersForm } from "@/components/admin/guide-chapters-form";

export const metadata: Metadata = { title: "Chapters from study guides" };

export default async function GuideChaptersPage({ searchParams }: PageProps<"/admin/chapters/guides">) {
  const sp = await searchParams;
  const [groups, nextNumbers] = await Promise.all([subjectOptions(), nextChapterNumbers()]);
  const subjectId = idParam(sp, "subject");

  return (
    <>
      <PageHeader
        title="Chapters from study guides"
        description="Drop a course's NotebookLM HTML guides. Each one becomes the next chapter, with the guide attached and a practice test made from its MCQs, released on your schedule."
        crumbs={[{ label: "Chapters", href: "/admin/chapters" }, { label: "From study guides" }]}
      />
      <GuideChaptersForm
        groups={groups.map((g) => ({ key: g.key, course: g.course, subjects: g.subjects }))}
        nextNumbers={nextNumbers}
        defaultSubjectId={groups.some((g) => g.subjects.some((s) => s.id === subjectId)) ? subjectId : undefined}
        maxMb={env.MAX_UPLOAD_MB}
      />
    </>
  );
}
