import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, Download } from "lucide-react";
import { requireStudent } from "@/server/auth/guards";
import { getMaterialView } from "@/server/services/library";
import { isMaterialBookmarked } from "@/server/services/bookmarks";
import { getMaterialProgress, recordOpened } from "@/server/services/progress";
import { idSchema } from "@/server/validation/common";
import { describeMaterial, materialMeta } from "@/lib/material-types";
import { timeAgo } from "@/lib/format";
import { PageHeader } from "@/components/ui/page-header";
import { IconTile } from "@/components/ui/icon-tile";
import { DocumentCard, LinkCard, NoteReader, PdfViewer, VideoPlayer } from "@/components/student/material-viewers";
import { MarkCompleteButton, MaterialBookmarkButton } from "@/components/student/toggle-buttons";

export const metadata: Metadata = { title: "Study material" };

export default async function MaterialPage({ params }: PageProps<"/materials/[id]">) {
  const user = await requireStudent();
  const { id } = await params;
  const view = idSchema.safeParse(id).success ? await getMaterialView(user.id, id) : null;
  if (!view) notFound();
  const { material: m, previous, next, position, total } = view;
  const d = describeMaterial(m);
  const { chapter } = m;
  const isPdf = m.type === "FILE" && m.mimeType === "application/pdf";
  const returnTo = `/materials/${m.id}`;

  // Visiting this page is what "opened" means. Links to it (cards, previous/next) all disable prefetch, so this
  // only runs on a real navigation, never just because a link scrolled into view.
  await recordOpened(user.id, m.id);
  const [bookmarked, progress] = await Promise.all([isMaterialBookmarked(user.id, m.id), getMaterialProgress(user.id, m.id)]);

  return (
    <div className="space-y-6">
      <PageHeader
        title={m.title}
        description={m.description || undefined}
        crumbs={[
          { label: "My Courses", href: "/courses" },
          { label: chapter.subject.course.name, href: `/courses/${chapter.subject.course.id}` },
          ...(chapter.subject.semester ? [{ label: chapter.subject.semester.name, href: `/courses/${chapter.subject.course.id}#semester-${chapter.subject.semester.id}` }] : []),
          { label: chapter.subject.name, href: `/subjects/${chapter.subject.id}` },
          { label: `Chapter ${chapter.chapterNumber}`, href: `/subjects/${chapter.subject.id}?chapter=${chapter.id}#chapter-${chapter.id}` },
          { label: m.title },
        ]}
        actions={isPdf ? <a href={`/api/materials/${m.id}/file?download=1`} className="btn-primary"><Download className="size-4.5" aria-hidden /> Download</a> : undefined}
      />

      <div className="flex flex-wrap items-center gap-3">
        <MarkCompleteButton materialId={m.id} completed={progress.completed} returnTo={returnTo} />
        <MaterialBookmarkButton materialId={m.id} bookmarked={bookmarked} returnTo={returnTo} />
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
        <span className="inline-flex items-center gap-2"><IconTile icon={d.icon} size="sm" className={d.tile} /> {d.label}</span>
        {materialMeta(m) && <span>· {materialMeta(m)}</span>}
        <span>· Chapter {chapter.chapterNumber}: {chapter.title}</span>
        <span>· Added {timeAgo(m.createdAt)}</span>
      </div>

      {isPdf && <PdfViewer id={m.id} title={m.title} />}
      {m.type === "FILE" && !isPdf && <DocumentCard id={m.id} fileName={m.fileName} fileSize={m.fileSize} type="FILE" />}
      {m.type === "YOUTUBE" && m.youtubeId && <VideoPlayer videoId={m.youtubeId} title={m.title} durationSeconds={m.durationSeconds} />}
      {m.type === "LINK" && <LinkCard id={m.id} host={materialMeta(m)} />}
      {m.type === "TEXT" && m.textContent && <NoteReader html={m.textContent} />}

      <nav aria-label="Other material in this chapter" className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5">
        {previous ? (
          <Link href={`/materials/${previous.id}`} prefetch={false} className="btn-outline max-w-full"><ArrowLeft className="size-4.5 shrink-0" aria-hidden /> <span className="truncate">{previous.title}</span></Link>
        ) : <span />}
        <p className="text-sm text-muted">{position} of {total} in this chapter</p>
        {next ? (
          <Link href={`/materials/${next.id}`} prefetch={false} className="btn-outline max-w-full"><span className="truncate">{next.title}</span> <ArrowRight className="size-4.5 shrink-0" aria-hidden /></Link>
        ) : <span />}
      </nav>
    </div>
  );
}
