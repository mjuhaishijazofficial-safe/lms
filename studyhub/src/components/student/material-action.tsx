import Link from "next/link";
import { BookOpen, Download, ExternalLink, Play } from "lucide-react";
import type { MaterialType } from "@prisma/client";

/**
 * The one call-to-action for a material, matching the reference: Download, Watch Video, Open Link.
 * Files download straight from the permission-checked route; videos and notes open the reader page;
 * links go through a redirect route so the click is checked (and, later, counted) before leaving the site.
 */
export function MaterialAction({ id, type, className }: { id: string; type: MaterialType; className?: string }) {
  switch (type) {
    case "FILE":
      return <a href={`/api/materials/${id}/file?download=1`} className={className}><Download className="size-4.5" aria-hidden /> Download</a>;
    case "YOUTUBE":
      return <Link href={`/materials/${id}`} prefetch={false} className={className}><Play className="size-4.5" aria-hidden /> Watch Video</Link>;
    case "LINK":
      return <a href={`/api/materials/${id}/open`} target="_blank" rel="noopener noreferrer" className={className}><ExternalLink className="size-4.5" aria-hidden /> Open Link</a>;
    case "TEXT":
      return <Link href={`/materials/${id}`} prefetch={false} className={className}><BookOpen className="size-4.5" aria-hidden /> Read</Link>;
  }
}
