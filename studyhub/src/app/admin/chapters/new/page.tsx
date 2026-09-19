import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { nextChapterNumber } from "@/server/services/chapters";
import { subjectOptions } from "@/server/services/subjects";
import { idParam } from "@/lib/params";
import { PageHeader } from "@/components/ui/page-header";
import { ChapterForm } from "@/components/admin/chapter-form";

export const metadata: Metadata = { title: "New chapter" };

export default async function NewChapterPage({ searchParams }: PageProps<"/admin/chapters/new">) {
  const groups = await subjectOptions();
  if (groups.length === 0) redirect("/admin/chapters");
  const subjectId = idParam(await searchParams, "subject");
  const suggestedNumber = subjectId ? await nextChapterNumber(subjectId) : 1;

  return (
    <>
      <PageHeader title="New chapter" crumbs={[{ label: "Chapters", href: "/admin/chapters" }, { label: "New chapter" }]} />
      <ChapterForm groups={groups} defaultSubjectId={subjectId} suggestedNumber={suggestedNumber} />
    </>
  );
}
