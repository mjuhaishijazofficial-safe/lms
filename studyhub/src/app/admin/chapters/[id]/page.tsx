import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getChapter } from "@/server/services/chapters";
import { subjectOptions } from "@/server/services/subjects";
import { idSchema } from "@/server/validation/common";
import { plural } from "@/lib/format";
import { PageHeader } from "@/components/ui/page-header";
import { Notice } from "@/components/ui/notice";
import { ChapterForm } from "@/components/admin/chapter-form";

export const metadata: Metadata = { title: "Edit chapter" };

export default async function EditChapterPage({ params, searchParams }: PageProps<"/admin/chapters/[id]">) {
  const { id } = await params;
  const [chapter, groups] = await Promise.all([idSchema.safeParse(id).success ? getChapter(id) : null, subjectOptions()]);
  if (!chapter) notFound();

  return (
    <>
      <PageHeader
        title={chapter.title}
        description={[chapter.subject.course.name, chapter.subject.semester?.name, chapter.subject.name, plural(chapter._count.materials, "material")].filter(Boolean).join(" · ")}
        crumbs={[{ label: "Chapters", href: "/admin/chapters" }, { label: chapter.title }]}
      />
      <Notice searchParams={await searchParams} />
      <ChapterForm
        groups={groups}
        chapter={{ id: chapter.id, subjectId: chapter.subjectId, title: chapter.title, chapterNumber: chapter.chapterNumber, description: chapter.description, status: chapter.status }}
      />
    </>
  );
}
