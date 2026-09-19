import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BookOpen, Info, ListOrdered, Sparkles } from "lucide-react";
import { requireStudent } from "@/server/auth/guards";
import { getSubjectView } from "@/server/services/library";
import { isSubjectBookmarked } from "@/server/services/bookmarks";
import { idSchema } from "@/server/validation/common";
import { idParam, one } from "@/lib/params";
import { plural } from "@/lib/format";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { EmptyState } from "@/components/ui/empty-state";
import { Tabs } from "@/components/ui/tabs";
import { ChapterAccordion } from "@/components/student/chapter-accordion";
import { MaterialCard, MaterialGrid } from "@/components/student/material-card";
import { SubjectHeader } from "@/components/student/subject-header";

export const metadata: Metadata = { title: "Subject" };

const TABS = ["chapters", "about", "recommended"] as const;
type Tab = (typeof TABS)[number];

export default async function SubjectPage({ params, searchParams }: PageProps<"/subjects/[id]">) {
  const user = await requireStudent();
  const { id } = await params;
  const sp = await searchParams;
  const view = idSchema.safeParse(id).success ? await getSubjectView(user.id, id) : null;
  if (!view) notFound();
  const { subject, progress, opened, completed } = view;
  const bookmarked = await isSubjectBookmarked(user.id, subject.id);

  const tab: Tab = TABS.find((t) => t === one(sp, "tab")) ?? "chapters";
  const base = `/subjects/${subject.id}`;
  const chapterParam = idParam(sp, "chapter");
  // Open the chapter named in the link, otherwise the first chapter that has something in it.
  const openId = chapterParam ?? subject.chapters.find((c) => c.materials.length > 0)?.id;
  const returnQs = new URLSearchParams({ ...(tab !== "chapters" ? { tab } : {}), ...(chapterParam ? { chapter: chapterParam } : {}) });
  const returnTo = returnQs.size ? `${base}?${returnQs}` : base;

  const materials = subject.chapters.flatMap((c) => c.materials.map((m) => ({ m, chapter: c })));
  const upNext = materials.filter(({ m }) => !opened.has(m.id)).slice(0, 8);
  const counts = { FILE: 0, YOUTUBE: 0, LINK: 0, TEXT: 0 };
  for (const { m } of materials) counts[m.type]++;

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[
        { label: "My Courses", href: "/courses" },
        { label: subject.course.name, href: `/courses/${subject.course.id}` },
        ...(subject.semester ? [{ label: subject.semester.name, href: `/courses/${subject.course.id}#semester-${subject.semester.id}` }] : []),
        { label: subject.name },
      ]} />
      <SubjectHeader
        name={subject.name} subtitle={[subject.course.name, subject.semester?.name].filter(Boolean).join(" · ")} description={subject.description} icon={subject.icon} progress={progress}
        subjectId={subject.id} bookmarked={bookmarked} returnTo={returnTo}
      />

      <Tabs
        label="Subject sections" active={tab}
        items={[
          { key: "chapters", label: "Chapters", icon: BookOpen, href: base },
          { key: "about", label: "About This Subject", icon: Info, href: `${base}?tab=about` },
          { key: "recommended", label: "Recommended", icon: Sparkles, href: `${base}?tab=recommended` },
        ]}
      />

      {tab === "chapters" && (
        subject.chapters.length === 0 ? (
          <div className="card"><EmptyState icon={ListOrdered} title="No chapters have been added yet." description="Chapters will appear here once your admin adds them." /></div>
        ) : (
          <ChapterAccordion chapters={subject.chapters} openId={openId} completed={completed} />
        )
      )}

      {tab === "about" && (
        <section className="card space-y-5 p-6 sm:p-8">
          <div>
            <h2 className="text-xl font-semibold">About {subject.name}</h2>
            <p className="mt-2 text-muted">{subject.description || "Your admin hasn't added a description for this subject yet."}</p>
          </div>
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {[
              ["Chapters", subject.chapters.length], ["Documents", counts.FILE], ["Videos", counts.YOUTUBE], ["Links", counts.LINK], ["Notes", counts.TEXT],
            ].map(([label, value]) => (
              <div key={label} className="rounded-2xl bg-page p-4">
                <dt className="text-sm text-muted">{label}</dt>
                <dd className="mt-1 text-2xl font-bold">{value}</dd>
              </div>
            ))}
          </dl>
          <p className="text-sm text-muted">{plural(materials.length, "study material")} in {[subject.course.name, subject.semester?.name].filter(Boolean).join(" · ")}.</p>
        </section>
      )}

      {tab === "recommended" && (
        materials.length === 0 ? (
          <div className="card"><EmptyState icon={Sparkles} title="No study material has been added yet." description="Suggestions will appear here once there is material to study." /></div>
        ) : upNext.length === 0 ? (
          <div className="card"><EmptyState icon={Sparkles} title="You've opened everything in this subject." description="Great work! Revisit any chapter to review." /></div>
        ) : (
          <section>
            <h2 className="mb-1 text-xl font-semibold">Up next</h2>
            <p className="mb-4 text-muted">Material you haven&apos;t opened yet, in study order.</p>
            <MaterialGrid>
              {upNext.map(({ m, chapter }) => <MaterialCard key={m.id} material={m} context={`Chapter ${chapter.chapterNumber}: ${chapter.title}`} />)}
            </MaterialGrid>
          </section>
        )
      )}
    </div>
  );
}
