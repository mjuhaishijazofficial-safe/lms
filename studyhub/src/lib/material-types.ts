import { BookOpenCheck, FileText, Link2, NotebookText, Play, type LucideIcon } from "lucide-react";
import type { MaterialType } from "@prisma/client";
import { formatBytes } from "@/lib/format";
import { formatDuration } from "@/lib/media";

/**
 * How a material looks to a student. Documents are told apart by their file type, as in the reference
 * design (red PDF tile, other colours for Word and slides), and every type gets its own call to action.
 */
export function describeMaterial(m: { type: MaterialType; fileName?: string | null }): { label: string; icon: LucideIcon; tile: string; action: string } {
  if (m.type === "FILE") {
    const ext = (m.fileName ?? "").split(".").pop()?.toLowerCase();
    if (ext === "pdf") return { label: "PDF", icon: FileText, tile: "tile-red", action: "Download" };
    if (ext === "html" || ext === "htm") return { label: "Study guide", icon: BookOpenCheck, tile: "tile-amber", action: "Study" };
    if (ext === "doc" || ext === "docx") return { label: "Word document", icon: FileText, tile: "tile-blue", action: "Download" };
    if (ext === "ppt" || ext === "pptx") return { label: "Slides", icon: FileText, tile: "tile-amber", action: "Download" };
    if (ext === "xls" || ext === "xlsx") return { label: "Spreadsheet", icon: FileText, tile: "tile-green", action: "Download" };
    if (ext === "jpg" || ext === "jpeg" || ext === "png") return { label: "Image", icon: FileText, tile: "tile-purple", action: "Download" };
    if (ext === "txt") return { label: "Text file", icon: FileText, tile: "tile-blue", action: "Download" };
  }
  const t = MATERIAL_TYPES[m.type];
  return { label: t.label, icon: t.icon, tile: t.tile, action: t.action };
}

export const MATERIAL_TYPES: Record<MaterialType, { label: string; icon: LucideIcon; tile: string; action: string }> = {
  FILE: { label: "Document", icon: FileText, tile: "tile-red", action: "Download" },
  YOUTUBE: { label: "Video", icon: Play, tile: "tile-solid", action: "Watch Video" },
  LINK: { label: "Link", icon: Link2, tile: "tile-purple", action: "Open Link" },
  TEXT: { label: "Note", icon: NotebookText, tile: "tile-green", action: "Read" },
  LESSON: { label: "Lesson", icon: BookOpenCheck, tile: "tile-amber", action: "Study" },
};

/** The short detail line under a material's title: size, duration, or where a link goes. */
export function materialMeta(m: { type: MaterialType; fileSize?: number | null; durationSeconds?: number | null; externalUrl?: string | null }): string {
  switch (m.type) {
    case "FILE": return m.fileSize ? formatBytes(m.fileSize) : "";
    case "YOUTUBE": return m.durationSeconds ? formatDuration(m.durationSeconds) : "";
    case "LINK": {
      try { return m.externalUrl ? new URL(m.externalUrl).hostname.replace(/^www\./, "") : ""; } catch { return ""; }
    }
    case "TEXT": return "Read online";
    case "LESSON": return "Summary, definitions & MCQs";
  }
}
