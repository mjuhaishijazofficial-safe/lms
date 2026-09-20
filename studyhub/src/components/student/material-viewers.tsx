import { Download, ExternalLink, FileText } from "lucide-react";
import { formatBytes } from "@/lib/format";
import { formatDuration, youtubeEmbedUrl, youtubeWatchUrl } from "@/lib/media";
import { describeMaterial } from "@/lib/material-types";
import { sanitizeNoteHtml } from "@/server/materials/sanitize";
import { IconTile } from "@/components/ui/icon-tile";

/** PDF shown inside the page. The file comes from the permission-checked route, never a public link. */
export function PdfViewer({ id, title }: { id: string; title: string }) {
  return (
    <div className="space-y-3">
      <iframe src={`/api/materials/${id}/file`} title={title} className="h-[75vh] min-h-96 w-full rounded-2xl border border-line bg-white" />
      <p className="text-sm text-muted">Can&apos;t see the document? Use the Download button above instead.</p>
    </div>
  );
}

/** Word and PowerPoint files can't be previewed reliably in a browser, so they are offered as a download. */
export function DocumentCard({ id, fileName, fileSize, type }: { id: string; fileName: string | null; fileSize: number | null; type: "FILE" }) {
  const d = describeMaterial({ type, fileName });
  return (
    <div className="card flex flex-wrap items-center gap-5 p-6">
      <IconTile icon={FileText} size="lg" className={d.tile} />
      <div className="min-w-0 flex-1 basis-60">
        <p className="truncate font-semibold">{fileName ?? "Document"}</p>
        <p className="text-sm text-muted">{d.label}{fileSize ? ` · ${formatBytes(fileSize)}` : ""} · opens in Word or PowerPoint on your device</p>
      </div>
      <a href={`/api/materials/${id}/file?download=1`} className="btn-primary"><Download className="size-4.5" aria-hidden /> Download</a>
    </div>
  );
}

/** YouTube inside the platform using the privacy-friendly player. */
export function VideoPlayer({ videoId, title, durationSeconds }: { videoId: string; title: string; durationSeconds: number | null }) {
  return (
    <div className="card overflow-hidden">
      <div className="aspect-video bg-ink">
        <iframe
          src={youtubeEmbedUrl(videoId)} title={title} loading="lazy" allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
          allow="accelerometer; encrypted-media; gyroscope; picture-in-picture"
          className="size-full border-0"
        />
      </div>
      <p className="px-5 py-3 text-sm text-muted">
        {durationSeconds ? `${formatDuration(durationSeconds)} · ` : ""}
        <a className="text-primary hover:underline" href={youtubeWatchUrl(videoId)} target="_blank" rel="noopener noreferrer">Trouble playing? Open on YouTube</a>
      </p>
    </div>
  );
}

export function LinkCard({ id, host }: { id: string; host: string }) {
  return (
    <div className="card flex flex-wrap items-center gap-5 p-6">
      <IconTile icon={ExternalLink} size="lg" className="bg-tile-purple text-violet-600" />
      <div className="min-w-0 flex-1 basis-60">
        <p className="font-semibold">External resource</p>
        <p className="truncate text-sm text-muted">Opens {host || "the website"} in a new tab</p>
      </div>
      <a href={`/api/materials/${id}/open`} target="_blank" rel="noopener noreferrer" className="btn-primary"><ExternalLink className="size-4.5" aria-hidden /> Open Link</a>
    </div>
  );
}

/** A text note. The HTML is sanitized when saved and again here, so stored content can never run script. */
export function NoteReader({ html }: { html: string }) {
  return <article className="note card p-6 sm:p-8" dangerouslySetInnerHTML={{ __html: sanitizeNoteHtml(html) }} />;
}
