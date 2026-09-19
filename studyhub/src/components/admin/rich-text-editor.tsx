"use client";

import { useState } from "react";
import { EditorContent, useEditor, useEditorState, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Bold, Heading2, Heading3, Italic, Link2, List, ListOrdered, Quote, Redo2, Underline, Undo2, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/format";
import { safeExternalUrl } from "@/lib/media";
import { Field } from "@/components/ui/field";

function ToolButton({ icon: Icon, label, active, disabled, onClick }: { icon: LucideIcon; label: string; active?: boolean; disabled?: boolean; onClick: () => void }) {
  return (
    <button
      type="button" title={label} aria-label={label} aria-pressed={active} disabled={disabled} onClick={onClick}
      className={cn("inline-flex size-9 items-center justify-center rounded-lg transition disabled:opacity-30", active ? "bg-primary-soft text-primary" : "text-ink/70 hover:bg-page")}
    >
      <Icon className="size-4.5" aria-hidden />
    </button>
  );
}

function Toolbar({ editor }: { editor: Editor }) {
  // Re-render the toolbar when the selection or formatting changes so pressed states stay right.
  const s = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive("bold"), italic: e.isActive("italic"), underline: e.isActive("underline"), h2: e.isActive("heading", { level: 2 }),
      h3: e.isActive("heading", { level: 3 }), bullet: e.isActive("bulletList"), ordered: e.isActive("orderedList"), quote: e.isActive("blockquote"),
      link: e.isActive("link"), canUndo: e.can().undo(), canRedo: e.can().redo(),
    }),
  });
  const chain = () => editor.chain().focus();

  function setLink() {
    if (s.link) return void chain().unsetLink().run();
    const entered = window.prompt("Link address (https://…)");
    if (!entered) return;
    const url = safeExternalUrl(entered);
    if (!url) return void window.alert("Enter a full web address starting with https://");
    chain().extendMarkRange("link").setLink({ href: url }).run();
  }

  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b border-line bg-page/60 px-2 py-1.5" role="toolbar" aria-label="Formatting">
      <ToolButton icon={Bold} label="Bold" active={s.bold} onClick={() => chain().toggleBold().run()} />
      <ToolButton icon={Italic} label="Italic" active={s.italic} onClick={() => chain().toggleItalic().run()} />
      <ToolButton icon={Underline} label="Underline" active={s.underline} onClick={() => chain().toggleUnderline().run()} />
      <span className="mx-1 h-5 w-px bg-line" aria-hidden />
      <ToolButton icon={Heading2} label="Heading" active={s.h2} onClick={() => chain().toggleHeading({ level: 2 }).run()} />
      <ToolButton icon={Heading3} label="Subheading" active={s.h3} onClick={() => chain().toggleHeading({ level: 3 }).run()} />
      <span className="mx-1 h-5 w-px bg-line" aria-hidden />
      <ToolButton icon={List} label="Bulleted list" active={s.bullet} onClick={() => chain().toggleBulletList().run()} />
      <ToolButton icon={ListOrdered} label="Numbered list" active={s.ordered} onClick={() => chain().toggleOrderedList().run()} />
      <ToolButton icon={Quote} label="Quote" active={s.quote} onClick={() => chain().toggleBlockquote().run()} />
      <ToolButton icon={Link2} label={s.link ? "Remove link" : "Add link"} active={s.link} onClick={setLink} />
      <span className="mx-1 h-5 w-px bg-line" aria-hidden />
      <ToolButton icon={Undo2} label="Undo" disabled={!s.canUndo} onClick={() => chain().undo().run()} />
      <ToolButton icon={Redo2} label="Redo" disabled={!s.canRedo} onClick={() => chain().redo().run()} />
    </div>
  );
}

/** Writes sanitized-on-the-server HTML into a hidden input named `name`. */
export function RichTextEditor({ name, initialHtml, error }: { name: string; initialHtml: string; error?: string[] }) {
  const [html, setHtml] = useState(initialHtml);
  const editor = useEditor({
    extensions: [StarterKit.configure({ heading: { levels: [2, 3] }, link: { openOnClick: false, protocols: ["http", "https", "mailto"] } })],
    content: initialHtml,
    immediatelyRender: false, // avoids a server/client markup mismatch
    onUpdate: ({ editor: e }) => setHtml(e.isEmpty ? "" : e.getHTML()),
    editorProps: { attributes: { class: "note min-h-56 px-4 py-3 outline-none", "aria-label": "Note content" } },
  });

  return (
    <Field id="textContent" label="Note" required error={error} hint="Formatting is kept simple on purpose so notes look the same for every student.">
      <input type="hidden" name={name} value={html} />
      <div className={cn("overflow-hidden rounded-xl border bg-surface transition focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/10", error?.length ? "border-red-400" : "border-line")}>
        {editor ? <Toolbar editor={editor} /> : <div className="h-12 border-b border-line bg-page/60" />}
        <EditorContent editor={editor} />
      </div>
    </Field>
  );
}
