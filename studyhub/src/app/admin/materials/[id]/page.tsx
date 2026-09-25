import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Download, ExternalLink } from "lucide-react";
import { env } from "@/server/env";
import { chapterPickerTree, getMaterial } from "@/server/services/materials";
import { idSchema } from "@/server/validation/common";
import { MATERIAL_TYPES } from "@/lib/material-types";
import { formatBytes, formatDate } from "@/lib/format";
import { formatDuration, youtubeEmbedUrl, youtubeWatchUrl } from "@/lib/media";
import { PageHeader } from "@/components/ui/page-header";
import { Notice } from "@/components/ui/notice";
import { StatusBadge } from "@/components/ui/status-badge";
import { MaterialForm } from "@/components/admin/material-form";

export const metadata: Metadata = { title: "Edit material" };

export default async function EditMaterialPage({ params, searchParams }: PageProps<"/admin/materials/[id]">) {
  const { id } = await params;
  const [material, tree] = await Promise.all([idSchema.safeParse(id).success ? getMaterial(id) : null, chapterPickerTree()]);
  if (!material) notFound();
  const meta = MATERIAL_TYPES[material.type];
  const where = [material.chapter.subject.course.name, material.chapter.subject.semester?.name, material.chapter.subject.name, `Chapter ${material.chapter.chapterNumber}`].filter(Boolean).join(" · ");

  return (
    <>
      <PageHeader
        title={material.title}
        description={`${meta.label} · ${where}`}
        crumbs={[{ label: "Materials", href: "/admin/materials" }, { label: material.title }]}
        actions={<StatusBadge status={material.status} />}
      />
      <Notice searchParams={await searchParams} />

      <div className="space-y-6">
        {material.type === "FILE" && material.fileName && (
          <div className="card flex max-w-3xl flex-wrap items-center gap-4 p-5">
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{material.fileName}</p>
              <p className="text-sm text-muted">{material.fileSize ? `${formatBytes(material.fileSize)} · ` : ""}uploaded {formatDate(material.createdAt)}</p>
            </div>
            <a href={`/api/materials/${material.id}/file`} target="_blank" rel="noopener" className="btn-outline"><ExternalLink className="size-4.5" aria-hidden /> Open</a>
            <a href={`/api/materials/${material.id}/file?download=1`} className="btn-outline"><Download className="size-4.5" aria-hidden /> Download</a>
          </div>
        )}
        {material.type === "YOUTUBE" && material.youtubeId && (
          <div className="card max-w-3xl overflow-hidden">
            <div className="aspect-video bg-ink">
              <iframe
                src={youtubeEmbedUrl(material.youtubeId)} title={material.title} loading="lazy" allowFullScreen
                referrerPolicy="strict-origin-when-cross-origin"
                allow="accelerometer; encrypted-media; gyroscope; picture-in-picture"
                className="size-full border-0"
              />
            </div>
            <p className="px-5 py-3 text-sm text-muted">
              Preview as students see it{material.durationSeconds ? ` · ${formatDuration(material.durationSeconds)}` : ""} ·{" "}
              <a className="text-primary hover:underline" href={youtubeWatchUrl(material.youtubeId)} target="_blank" rel="noopener noreferrer">Open on YouTube</a>
            </p>
          </div>
        )}

        <MaterialForm
          tree={tree}
          maxMb={env.MAX_UPLOAD_MB}
          material={{
            id: material.id, type: material.type, chapterId: material.chapterId, title: material.title, description: material.description, status: material.status,
            publishAt: material.publishAt?.toISOString() ?? null,
            youtubeUrl: material.youtubeId ? youtubeWatchUrl(material.youtubeId) : "", duration: material.durationSeconds ? formatDuration(material.durationSeconds) : "",
            externalUrl: material.externalUrl ?? "", textContent: material.textContent ?? "",
            lessonJson: material.lessonData ? JSON.stringify(material.lessonData, null, 2) : "",
            file: material.fileName ? { name: material.fileName, size: material.fileSize } : null,
          }}
        />
        <p className="text-sm text-muted">
          Need to move it? Change the chapter above and save. <Link href={`/admin/materials?chapter=${material.chapterId}`} className="text-primary hover:underline">See everything in this chapter</Link>.
        </p>
      </div>
    </>
  );
}
