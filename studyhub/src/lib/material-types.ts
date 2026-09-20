import { FileText, Link2, NotebookText, Play, type LucideIcon } from "lucide-react";
import type { MaterialType } from "@prisma/client";
import { formatBytes } from "@/lib/format";
import { formatDuration } from "@/lib/media";

/**
 * How a material looks to a student. Documents are told apart by their file type, as in the reference
 * design (one consistent icon style for every file type), and every type gets its own call to action.
 */
export function describeMaterial(m: { type: MaterialType; fileName?: string | null }): { label: string; icon: LucideIcon; tile: string; action: string } {
  if (m.type === "FILE") {
    const ext = (m.fileName ?? "").split(".").pop()?.toLowerCase();
    if (ext === "pdf") return { label: "PDF", icon: FileText, tile: "bg-tile-blue text-primary", action: "Download" };
    if (ext === "doc" || ext === "docx") return { label: "Word document", icon: FileText, tile: "bg-tile-blue text-primary", action: "Download" };
    if (ext === "ppt" || ext === "pptx") return { label: "Slides", icon: FileText, tile: "bg-tile-blue text-primary", action: "Download" };
  }
  const t = MATERIAL_TYPES[m.type];
  return { label: t.label, icon: t.icon, tile: t.tile, action: t.action };
}

export const MATERIAL_TYPES: Record<MaterialType, { label: string; icon: LucideIcon; tile: string; action: string }> = {
  FILE: { label: "Document", icon: FileText, tile: "bg-tile-blue text-primary", action: "Download" },
  YOUTUBE: { label: "Video", icon: Play, tile: "bg-tile-blue text-primary", action: "Watch Video" },
  LINK: { label: "Link", icon: Link2, tile: "bg-tile-blue text-primary", action: "Open Link" },
  TEXT: { label: "Note", icon: NotebookText, tile: "bg-tile-blue text-primary", action: "Read" },
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
  }
}
