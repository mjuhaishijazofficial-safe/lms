"use client";

import { useEffect, useRef, useState } from "react";
import { FileText, UploadCloud, X } from "lucide-react";
import { ACCEPT_ATTRIBUTE, ALLOWED_EXTENSIONS, ALLOWED_TYPES_TEXT, extensionOf } from "@/server/materials/upload";
import { cn, formatBytes } from "@/lib/format";
import { Field } from "@/components/ui/field";

/**
 * Click-or-drop file picker. The checks here are only for quick feedback;
 * the server re-validates the file's type, contents and size before storing anything.
 */
export function UploadDropzone({ maxMb, current, error, required }: {
  maxMb: number; current?: { name: string; size: number | null }; error?: string[]; required?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [picked, setPicked] = useState<{ name: string; size: number } | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  // React clears the form (file input included) after every submitted action, so drop the chip with it.
  useEffect(() => {
    const form = input.current?.form;
    if (!form) return;
    const onReset = () => setPicked(null);
    form.addEventListener("reset", onReset);
    return () => form.removeEventListener("reset", onReset);
  }, []);

  function accept(list: FileList | null) {
    const file = list?.[0];
    if (!file) return;
    const ext = extensionOf(file.name);
    let problem: string | null = null;
    if (!(ALLOWED_EXTENSIONS as readonly string[]).includes(ext)) problem = `That file type${ext ? ` (.${ext})` : ""} isn't allowed. Upload a ${ALLOWED_TYPES_TEXT} file.`;
    else if (file.size === 0) problem = "This file is empty.";
    else if (file.size > maxMb * 1_048_576) problem = `This file is too large. The limit is ${maxMb} MB.`;
    if (problem) {
      if (input.current) input.current.value = "";
      setPicked(null);
      setLocalError(problem);
      return;
    }
    setLocalError(null);
    setPicked({ name: file.name, size: file.size });
  }

  function clear() {
    if (input.current) input.current.value = "";
    setPicked(null);
    setLocalError(null);
  }

  const message = localError ?? error?.[0];
  return (
    <Field id="file" label="File" required={required} error={message} hint={message ? undefined : `PDF, Word, PowerPoint, Excel, text or image, up to ${maxMb} MB.`}>
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (input.current && e.dataTransfer.files.length) { input.current.files = e.dataTransfer.files; accept(e.dataTransfer.files); }
        }}
        className={cn(
          "relative rounded-2xl border-2 border-dashed p-6 text-center transition",
          dragging ? "border-primary bg-primary-soft" : message ? "border-danger/30 bg-danger-soft/40" : "border-line bg-page/50 hover:border-primary/40",
        )}
      >
        <input
          ref={input} id="file" name="file" type="file" accept={ACCEPT_ATTRIBUTE}
          onChange={(e) => accept(e.target.files)}
          className="absolute inset-0 size-full cursor-pointer opacity-0"
          aria-describedby={message ? "file-error" : "file-hint"}
        />
        {picked ? (
          <div className="relative z-10 flex items-center justify-center gap-3 text-left">
            <span className="inline-flex size-11 items-center justify-center rounded-xl tile-red"><FileText className="size-5" aria-hidden /></span>
            <div className="min-w-0">
              <p className="truncate font-medium">{picked.name}</p>
              <p className="text-sm text-muted">{formatBytes(picked.size)} · ready to upload</p>
            </div>
            <button type="button" onClick={clear} className="relative z-20 rounded-lg p-1.5 text-muted hover:bg-white hover:text-ink" aria-label="Remove selected file">
              <X className="size-5" aria-hidden />
            </button>
          </div>
        ) : (
          <div className="pointer-events-none">
            <UploadCloud className="mx-auto size-9 text-primary" aria-hidden />
            <p className="mt-2 font-medium"><span className="text-primary">Choose a file</span> or drag it here</p>
            {current && <p className="mt-1 text-sm text-muted">Current file: {current.name}{current.size ? ` (${formatBytes(current.size)})` : ""}. Choose a new one to replace it.</p>}
          </div>
        )}
      </div>
    </Field>
  );
}
