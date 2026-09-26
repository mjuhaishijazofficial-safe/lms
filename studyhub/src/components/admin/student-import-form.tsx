"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { Check, CircleAlert, Copy } from "lucide-react";
import type { SemesterTree } from "@/server/services/semesters";
import { importStudentsAction, type ImportState } from "@/app/admin/students/import/actions";
import type { ImportRow } from "@/server/services/student-import";
import { Alert } from "@/components/ui/notice";
import { Field } from "@/components/ui/field";
import { ProgramSemesterFields } from "./program-semester-fields";
import { TERMS } from "@/lib/terms";

const EXAMPLE = `hina
Cs301
Cs301 p
Mth 101

eman hafees
Mgt301
eng201`;

export function StudentImportForm({ tree }: { tree: SemesterTree }) {
  const [state, action, pending] = useActionState<ImportState, FormData>(importStudentsAction, {});
  const [copied, setCopied] = useState(false);
  const done = !!state.credentials?.length;

  async function copyAll() {
    const lines = (state.credentials ?? []).map((c) => `${c.name}\nUsername: ${c.username}\nPassword: ${c.password}`).join("\n\n");
    try {
      await navigator.clipboard.writeText(lines);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked: the table below can still be copied by hand */
    }
  }

  return (
    <div className="space-y-6">
      <form action={action} className="card max-w-3xl space-y-5 p-6 sm:p-8">
        <div>
          <h2 className="text-lg font-semibold">Paste your list</h2>
          <p className="mt-1 text-sm text-muted">
            One student per group: their name, then one subject code per line, with a blank line between students.
            This is the format you already send on WhatsApp.
          </p>
        </div>

        <Field id="text" label="Students and subjects" required>
          <textarea id="text" name="text" required rows={12} placeholder={EXAMPLE} className="textarea font-mono text-sm" />
        </Field>

        <ProgramSemesterFields
          tree={tree}
          noProgramLabel="Not assigned yet"
          noSemesterLabel={`First ${TERMS.semesterLower} (default)`}
          semesterHint="Applies to everyone in this list. Change individual students later if needed."
        />

        {state.error && <Alert tone="error">{state.error}</Alert>}

        <div className="flex flex-wrap items-center gap-3 pt-1">
          <button name="intent" value="preview" disabled={pending} className="btn-outline">Check the list</button>
          <button name="intent" value="create" disabled={pending || done} className="btn-primary">
            {pending ? "Working…" : "Create these students"}
          </button>
          <span className="text-sm text-muted">Checking changes nothing. Nothing is created until you press Create.</span>
        </div>
      </form>

      {state.plan && !done && (
        <div className="card max-w-3xl space-y-4 p-6 sm:p-8">
          <div>
            <h2 className="text-lg font-semibold">What will happen</h2>
            <p className="mt-1 text-sm text-muted">{state.plan.created} of {state.plan.rows.length} students will be created.</p>
          </div>
          <PlanTable rows={state.plan.rows} />
        </div>
      )}

      {done && state.plan && (
        <div className="card max-w-3xl space-y-4 p-6 sm:p-8">
          <Alert tone="success">
            {state.credentials!.length} student{state.credentials!.length === 1 ? "" : "s"} created.{" "}
            <strong>Copy these passwords now. They cannot be shown again.</strong>
          </Alert>
          <button type="button" onClick={copyAll} className="btn-soft">
            {copied ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
            {copied ? "Copied" : "Copy all usernames and passwords"}
          </button>
          <div className="overflow-x-auto rounded-xl border border-line">
            <table className="w-full text-sm">
              <thead className="bg-page text-left text-muted">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Student</th>
                  <th className="px-4 py-2.5 font-medium">Username</th>
                  <th className="px-4 py-2.5 font-medium">Temporary password</th>
                  <th className="px-4 py-2.5 font-medium">Subjects</th>
                </tr>
              </thead>
              <tbody>
                {state.credentials!.map((c) => (
                  <tr key={c.username} className="border-t border-line">
                    <td className="px-4 py-2.5 font-medium">{c.name}</td>
                    <td className="px-4 py-2.5 font-mono">{c.username}</td>
                    <td className="px-4 py-2.5 font-mono">{c.password}</td>
                    <td className="px-4 py-2.5">{c.subjects}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-sm text-muted">Each student must choose their own password when they first sign in.</p>
          {state.failed && state.failed.length > 0 && (
            <Alert tone="error">Not created: {state.failed.map((f) => f.name).join(", ")}. Add them by hand from Students, New student.</Alert>
          )}
          <PlanTable rows={state.plan.rows.filter((r) => r.skipped || r.unmatched.length > 0)} title="Needs attention" />
          <Link href="/admin/students" className="btn-outline">Go to Students</Link>
        </div>
      )}
    </div>
  );
}

function PlanTable({ rows, title }: { rows: ImportRow[]; title?: string }) {
  if (rows.length === 0) return null;
  return (
    <div>
      {title && <h3 className="mb-2 font-semibold">{title}</h3>}
      <div className="overflow-x-auto rounded-xl border border-line">
        <table className="w-full text-sm">
          <thead className="bg-page text-left text-muted">
            <tr>
              <th className="px-4 py-2.5 font-medium">Student</th>
              <th className="px-4 py-2.5 font-medium">Username</th>
              <th className="px-4 py-2.5 font-medium">Subjects found</th>
              <th className="px-4 py-2.5 font-medium">Problems</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={`${r.name}-${i}`} className="border-t border-line align-top">
                <td className="px-4 py-2.5 font-medium">{r.name}</td>
                <td className="px-4 py-2.5 font-mono">{r.username || "—"}</td>
                <td className="px-4 py-2.5">{r.subjects.length ? r.subjects.join(", ") : <span className="text-muted">none</span>}</td>
                <td className="px-4 py-2.5">
                  {r.skipped && (
                    <p className="flex items-start gap-1.5 text-warning"><CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />Skipped: {r.skipped}</p>
                  )}
                  {r.unmatched.length > 0 && (
                    <p className="flex items-start gap-1.5 text-danger"><CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />Not found: {r.unmatched.join(", ")}</p>
                  )}
                  {!r.skipped && r.unmatched.length === 0 && <span className="text-success">OK</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
