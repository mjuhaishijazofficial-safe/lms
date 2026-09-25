"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import type { MaterialType } from "@prisma/client";
import type { FormState } from "@/server/action-result";
import type { PickerTree } from "@/server/services/materials";
import { createMaterialAction, updateMaterialAction } from "@/app/admin/materials/actions";
import { MATERIAL_TYPES } from "@/lib/material-types";
import { cn } from "@/lib/format";
import { Alert } from "@/components/ui/notice";
import { Field, invalid } from "@/components/ui/field";
import { IconTile } from "@/components/ui/icon-tile";
import { STATUS_OPTIONS } from "@/components/ui/status-badge";
import { SubmitButton } from "@/components/ui/submit-button";
import { ChapterPicker } from "./chapter-picker";
import { RichTextEditor } from "./rich-text-editor";
import { ScheduleField } from "./schedule-field";
import { UploadDropzone } from "./upload-dropzone";

export type MaterialInitial = {
  id: string; type: MaterialType; chapterId: string; title: string; description: string; status: string; publishAt: string | null;
  youtubeUrl: string; duration: string; externalUrl: string; textContent: string; lessonJson: string; file: { name: string; size: number | null } | null;
};

const TYPE_HELP: Record<MaterialType, string> = {
  FILE: "PDF, Word or PowerPoint",
  YOUTUBE: "An educational video",
  LINK: "A website or resource",
  TEXT: "Write a note",
  LESSON: "Summary, definitions and MCQs",
};

const LESSON_PLACEHOLDER = `{
  "subtitle": "One line about this chapter",
  "topics": [{ "ref": "1", "title": "Topic title", "body": "<p>Explanation…</p>" }],
  "definitions": [{ "term": "Term", "definition": "Meaning", "example": "Everyday example" }],
  "mcqs": [{ "question": "…?", "options": ["A", "B", "C", "D"], "answer": 1, "explanation": "Why" }]
}`;

export function MaterialForm({ tree, material, defaultChapterId, maxMb }: {
  tree: PickerTree; material?: MaterialInitial; defaultChapterId?: string; maxMb: number;
}) {
  const [state, action] = useActionState<FormState, FormData>(material ? updateMaterialAction : createMaterialAction, {});
  const [chosen, setChosen] = useState<MaterialType>((state.values?.type as MaterialType) ?? material?.type ?? "FILE");
  const type = material?.type ?? chosen;
  const e = state.fieldErrors ?? {};
  const v = <K extends keyof MaterialInitial>(k: K, fallback = "") => (state.values?.[k] ?? (material?.[k] as string | undefined) ?? fallback) as string;

  return (
    <form action={action} className="card max-w-3xl space-y-6 p-6 sm:p-8" noValidate>
      {material && <input type="hidden" name="id" value={material.id} />}
      {state.error && <Alert tone="error">{state.error}</Alert>}

      <fieldset>
        <legend className="mb-2 text-sm font-medium">Material type</legend>
        {material ? (
          <>
            <input type="hidden" name="type" value={material.type} />
            <div className="flex items-center gap-3 rounded-xl bg-page px-4 py-3">
              <IconTile icon={MATERIAL_TYPES[type].icon} size="sm" className={MATERIAL_TYPES[type].tile} />
              <div>
                <p className="font-medium">{MATERIAL_TYPES[type].label}</p>
                <p className="text-sm text-muted">The type can&apos;t be changed after creation. Create a new material instead.</p>
              </div>
            </div>
          </>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {(Object.keys(MATERIAL_TYPES) as MaterialType[]).map((t) => {
              const meta = MATERIAL_TYPES[t];
              return (
                <label key={t} className={cn("relative cursor-pointer rounded-2xl border p-4 transition has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-primary/20", type === t ? "border-primary bg-primary-soft/50" : "border-line hover:border-primary/40")}>
                  <input type="radio" name="type" value={t} checked={type === t} onChange={() => setChosen(t)} className="sr-only" />
                  <IconTile icon={meta.icon} size="sm" className={meta.tile} />
                  <p className="mt-3 font-semibold">{meta.label}</p>
                  <p className="text-xs text-muted">{TYPE_HELP[t]}</p>
                </label>
              );
            })}
          </div>
        )}
      </fieldset>

      <ChapterPicker tree={tree} initialChapterId={state.values?.chapterId ?? material?.chapterId ?? defaultChapterId} error={e.chapterId} />

      <Field id="title" label="Title" required error={e.title}>
        <input id="title" name="title" defaultValue={v("title")} required maxLength={160} className={`input ${invalid(e.title)}`} placeholder={type === "FILE" ? "Chapter 1 Notes" : type === "YOUTUBE" ? "Introduction to Real Numbers" : ""} />
      </Field>
      <Field id="description" label="Description" error={e.description} hint="One or two lines students see under the title.">
        <textarea id="description" name="description" defaultValue={v("description")} maxLength={1000} className={`textarea min-h-20 ${invalid(e.description)}`} />
      </Field>

      {type === "FILE" && <UploadDropzone maxMb={maxMb} required={!material} error={e.file} current={material?.file ?? undefined} />}

      {type === "YOUTUBE" && (
        <div className="grid gap-5 sm:grid-cols-[1fr_11rem]">
          <Field id="youtubeUrl" label="YouTube link" required error={e.youtubeUrl} hint="Paste the video's address. It plays inside the platform.">
            <input id="youtubeUrl" name="youtubeUrl" type="url" inputMode="url" defaultValue={v("youtubeUrl")} required className={`input ${invalid(e.youtubeUrl)}`} placeholder="https://www.youtube.com/watch?v=…" />
          </Field>
          <Field id="duration" label="Duration" error={e.duration} hint="Optional, e.g. 24:15">
            <input id="duration" name="duration" defaultValue={v("duration")} className={`input ${invalid(e.duration)}`} placeholder="mm:ss" />
          </Field>
        </div>
      )}

      {type === "LINK" && (
        <Field id="externalUrl" label="Link address" required error={e.externalUrl} hint="Opens in a new tab for the student.">
          <input id="externalUrl" name="externalUrl" type="url" inputMode="url" defaultValue={v("externalUrl")} required className={`input ${invalid(e.externalUrl)}`} placeholder="https://" />
        </Field>
      )}

      {type === "TEXT" && <RichTextEditor name="textContent" initialHtml={v("textContent")} error={e.textContent} />}

      {type === "LESSON" && (
        <Field
          id="lessonJson" label="Lesson content" required error={e.lessonJson}
          hint="Paste the lesson as JSON: topics, definitions and mcqs. Students get it as a lesson they can study in the app, and as a file they can download."
        >
          <textarea
            id="lessonJson" name="lessonJson" defaultValue={v("lessonJson")} required rows={16} spellCheck={false}
            className={`textarea font-mono text-xs ${invalid(e.lessonJson)}`}
            placeholder={LESSON_PLACEHOLDER}
          />
        </Field>
      )}

      <Field id="status" label="Status" error={e.status} hint="Only published material is visible to students.">
        <select id="status" name="status" defaultValue={v("status", "PUBLISHED")} className="select">
          {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </Field>
      <ScheduleField initial={v("publishAt")} error={e.publishAt} />

      <div className="flex items-center gap-3 pt-2">
        <SubmitButton pendingText={type === "FILE" ? "Uploading…" : "Saving…"}>{material ? "Save changes" : "Add material"}</SubmitButton>
        <Link href="/admin/materials" className="btn-outline">Cancel</Link>
      </div>
    </form>
  );
}
