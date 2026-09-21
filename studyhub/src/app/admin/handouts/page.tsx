import type { Metadata } from "next";
import { subjectOptions } from "@/server/services/subjects";
import { aiStatus } from "@/server/ai/client";
import { PageHeader } from "@/components/ui/page-header";
import { HandoutImport } from "@/components/admin/handout-import";

export const metadata: Metadata = { title: "Handouts" };

// Each request to the model can take a while. 60 seconds is the most every hosting plan allows, and one call to the
// model is given up on after 50 (see server/ai/openai.ts), so a slow answer fails cleanly instead of being cut off.
export const maxDuration = 60;

export default async function HandoutsPage() {
  const [subjects, ai] = await Promise.all([subjectOptions(), Promise.resolve(aiStatus())]);
  return (
    <>
      <PageHeader
        title="Handouts"
        description="Turn a course handout into study guides, one for each lesson: notes, key terms and practice questions."
      />
      <HandoutImport subjects={subjects} ai={ai} />
    </>
  );
}
