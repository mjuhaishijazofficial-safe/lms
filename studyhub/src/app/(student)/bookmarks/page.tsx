import type { Metadata } from "next";
import Link from "next/link";
import { Bookmark } from "lucide-react";
import { requireStudent } from "@/server/auth/guards";
import { getSubjectsByIds } from "@/server/services/library";
import { listBookmarkedMaterials, listBookmarkedSubjectIds } from "@/server/services/bookmarks";
import { PAGE_SIZE } from "@/server/services/_shared";
import { pageParam } from "@/lib/params";
import { subjectIcon } from "@/lib/subject-icons";
import { plural } from "@/lib/format";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { IconTile } from "@/components/ui/icon-tile";
import { Pagination } from "@/components/ui/pagination";
import { ProgressBar } from "@/components/student/progress-bar";
import { RecentMaterialCard } from "@/components/student/recent-material-card";
import { RemoveBookmarkButton } from "@/components/student/toggle-buttons";

export const metadata: Metadata = { title: "Bookmarks" };

export default async function BookmarksPage({ searchParams }: PageProps<"/bookmarks">) {
  const user = await requireStudent();
  const sp = await searchParams;
  const page = pageParam(sp);

  const [subjectIds, materials] = await Promise.all([
    listBookmarkedSubjectIds(user.id),
    listBookmarkedMaterials(user.id, page),
  ]);
  const subjects = await getSubjectsByIds(user.id, subjectIds);
  const empty = subjects.length === 0 && materials.total === 0;

  return (
    <>
      <PageHeader title="Bookmarks" description="Subjects and study material you saved for later." />

      {empty ? (
        <div className="card">
          <EmptyState icon={Bookmark} title="No bookmarks yet." description="Bookmark a subject or a material and it will show up here." />
        </div>
      ) : (
        <div className="space-y-10">
          {subjects.length > 0 && (
            <section>
              <h2 className="section-title mb-4">Subjects</h2>
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {subjects.map((s) => {
                  const icon = subjectIcon(s.icon, s.id);
                  return (
                    <div key={s.id} className="card flex flex-col p-5">
                      <div className="flex items-center gap-4">
                        <IconTile icon={icon.icon} size="lg" className={icon.tile} />
                        <div className="min-w-0">
                          <Link href={`/subjects/${s.id}`} className="truncate text-lg font-semibold hover:text-primary">{s.name}</Link>
                          <p className="text-sm text-muted">{plural(s.chapterCount, "chapter")} · {plural(s.materialCount, "material")}</p>
                        </div>
                      </div>
                      <div className="mt-4">
                        <div className="mb-1.5 flex justify-between text-sm"><span className="text-muted">Progress</span><span className="font-medium">{s.progress.percent}%</span></div>
                        <ProgressBar percent={s.progress.percent} label={`${s.name} progress`} />
                      </div>
                      <div className="mt-3 flex justify-end">
                        <RemoveBookmarkButton kind="subject" id={s.id} returnTo="/bookmarks" />
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {materials.total > 0 && (
            <section>
              <h2 className="section-title mb-4">Materials</h2>
              <div className="card divide-y divide-line">
                {materials.rows.map((m) => (
                  <RecentMaterialCard key={m.id} material={m}
                    extra={<RemoveBookmarkButton kind="material" id={m.id} returnTo={`/bookmarks${page > 1 ? `?page=${page}` : ""}`} />} />
                ))}
              </div>
              <div className="card mt-4 overflow-hidden"><Pagination page={page} total={materials.total} pageSize={PAGE_SIZE} basePath="/bookmarks" params={{}} /></div>
            </section>
          )}
        </div>
      )}
    </>
  );
}
