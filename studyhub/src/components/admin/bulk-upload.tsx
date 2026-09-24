"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { CheckCircle2, FileUp, Loader2, Trash2, UploadCloud, XCircle } from "lucide-react";
import type { PickerTree } from "@/server/services/materials";
import { ACCEPT_ATTRIBUTE, ALLOWED_EXTENSIONS, ALLOWED_TYPES_TEXT, extensionOf } from "@/server/materials/upload";
import { bulkUploadMaterialAction } from "@/app/admin/materials/actions";
import { titleFromFileName } from "@/lib/filename";
import { formatBytes, cn } from "@/lib/format";
import { Field } from "@/components/ui/field";
import { ChapterPicker } from "./chapter-picker";

type Status = "pending" | "uploading" | "done" | "error";
type Row = { key: number; file: File; title: string; status: Status; error?: string };

const STATUS_STYLE: Record<Status, string> = {
  pending: "text-muted", uploading: "text-primary", done: "text-emerald-600", error: "text-red-600",
};

export function BulkUpload({ tree, maxMb }: { tree: PickerTree; maxMb: number }) {
  const formRef = useRef<HTMLFormElement>(null);
  const nextKey = useRef(0);
  const [chapterId, setChapterId] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [running, setRunning] = useState(false);
  const [dragging, setDragging] = useState(false);

  function addFiles(list: FileList | null) {
    if (!list?.length) return;
    const added: Row[] = Array.from(list).map((file) => {
      const ext = extensionOf(file.name);
      let error: string | undefined;
      if (!(ALLOWED_EXTENSIONS as readonly string[]).includes(ext)) error = `That file type${ext ? ` (.${ext})` : ""} isn't allowed.`;
      else if (file.size === 0) error = "This file is empty.";
      else if (file.size > maxMb * 1_048_576) error = `Too large — the limit is ${maxMb} MB.`;
      return { key: nextKey.current++, file, title: titleFromFileName(file.name), status: error ? "error" : "pending", error };
    });
    setRows((prev) => [...prev, ...added]);
  }

  const removeRow = (key: number) => setRows((prev) => prev.filter((r) => r.key !== key));
  const renameRow = (key: number, title: string) => setRows((prev) => prev.map((r) => (r.key === key ? { ...r, title } : r)));

  async function uploadAll() {
    if (!formRef.current || !chapterId || running) return;
    const shared = new FormData(formRef.current);
    setRunning(true);
    for (const row of rows) {
      if (row.status !== "pending") continue;
      setRows((prev) => prev.map((r) => (r.key === row.key ? { ...r, status: "uploading" } : r)));
      const fd = new FormData();
      fd.set("type", "FILE");
      fd.set("chapterId", chapterId);
      fd.set("status", String(shared.get("status") ?? "DRAFT"));
      fd.set("title", row.title.trim() || "Untitled");
      fd.set("description", "");
      fd.set("file", row.file);
      const res = await bulkUploadMaterialAction(fd);
      setRows((prev) => prev.map((r) => (r.key === row.key ? (res.ok ? { ...r, status: "done" } : { ...r, status: "error", error: res.error }) : r)));
    }
    setRunning(false);
  }

  const pendingCount = rows.filter((r) => r.status === "pending").length;
  const doneCount = rows.filter((r) => r.status === "done").length;
  const allDone = rows.length > 0 && rows.every((r) => r.status === "done" || r.status === "error");

  return (
    <form ref={formRef} className="space-y-6" onChange={(e) => setChapterId(String(new FormData(e.currentTarget).get("chapterId") ?? ""))}>
      <div className="card max-w-2xl space-y-5 p-6 sm:p-8">
        <ChapterPicker tree={tree} />
        <Field id="status" label="Status for all of these" hint="You can change any of them individually afterwards.">
          <select id="status" name="status" defaultValue="DRAFT" className="select">
            <option value="DRAFT">Draft — hidden from students</option>
            <option value="PUBLISHED">Published — visible to students</option>
          </select>
        </Field>
      </div>

      <div className="card max-w-2xl space-y-4 p-6 sm:p-8">
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => { e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files); }}
          className={cn(
            "relative rounded-2xl border-2 border-dashed p-6 text-center transition",
            dragging ? "border-primary bg-primary-soft" : "border-line bg-page/50 hover:border-primary/40",
          )}
        >
          <input
            type="file" multiple accept={ACCEPT_ATTRIBUTE}
            onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }}
            className="absolute inset-0 size-full cursor-pointer opacity-0"
          />
          <UploadCloud className="mx-auto size-9 text-primary" aria-hidden />
          <p className="mt-2 font-medium pointer-events-none"><span className="text-primary">Choose files</span> or drag them here</p>
          <p className="mt-1 text-sm text-muted pointer-events-none">{ALLOWED_TYPES_TEXT}, up to {maxMb} MB each.</p>
        </div>

        {rows.length > 0 && (
          <ul className="divide-y divide-line">
            {rows.map((r) => (
              <li key={r.key} className="flex items-center gap-3 py-3">
                <FileUp className="size-4.5 shrink-0 text-muted" aria-hidden />
                <div className="min-w-0 flex-1">
                  <input
                    value={r.title} onChange={(e) => renameRow(r.key, e.target.value)} disabled={r.status !== "pending"}
                    className="input h-9 w-full py-1 text-sm disabled:bg-transparent disabled:opacity-100" aria-label={`Title for ${r.file.name}`}
                  />
                  <p className={cn("mt-1 truncate text-xs", r.error ? "text-red-600" : "text-muted")}>
                    {r.error ?? `${r.file.name} · ${formatBytes(r.file.size)}`}
                  </p>
                </div>
                <span className={cn("flex shrink-0 items-center gap-1.5 text-sm font-medium", STATUS_STYLE[r.status])}>
                  {r.status === "uploading" && <Loader2 className="size-4 animate-spin" aria-hidden />}
                  {r.status === "done" && <CheckCircle2 className="size-4" aria-hidden />}
                  {r.status === "error" && <XCircle className="size-4" aria-hidden />}
                  {r.status === "pending" ? "" : r.status[0].toUpperCase() + r.status.slice(1)}
                </span>
                {r.status !== "uploading" && r.status !== "done" && (
                  <button type="button" onClick={() => removeRow(r.key)} className="btn-ghost !p-1.5 shrink-0" aria-label={`Remove ${r.file.name}`} title="Remove">
                    <Trash2 className="size-4" aria-hidden />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className="btn-primary" disabled={!chapterId || pendingCount === 0 || running} onClick={() => void uploadAll()}>
          {running ? <Loader2 className="size-4.5 animate-spin" aria-hidden /> : <UploadCloud className="size-4.5" aria-hidden />}
          {running ? "Uploading…" : `Upload ${pendingCount || ""} file${pendingCount === 1 ? "" : "s"}`.trim()}
        </button>
        {!chapterId && rows.length > 0 && <p className="text-sm text-muted">Choose a chapter above first.</p>}
        {doneCount > 0 && (
          <Link href={`/admin/materials?chapter=${chapterId}`} className="btn-outline">
            {allDone ? "Done — review in Materials" : `View the ${doneCount} already uploaded`}
          </Link>
        )}
      </div>
    </form>
  );
}
