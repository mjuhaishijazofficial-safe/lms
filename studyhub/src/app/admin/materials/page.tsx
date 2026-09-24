import type { Metadata } from "next";
import Link from "next/link";
import { ExternalLink, FileUp, Files, Plus } from "lucide-react";
import type { MaterialType } from "@prisma/client";
import { courseOptions } from "@/server/services/courses";
import { chapterPickerTree, listMaterials, SORTS, type SortKey } from "@/server/services/materials";
import { subjectOptions } from "@/server/services/subjects";
import { PAGE_SIZE } from "@/server/services/_shared";
import { idParam, one, pageParam } from "@/lib/params";
import { MATERIAL_TYPES } from "@/lib/material-types";
import { formatBytes, timeAgo } from "@/lib/format";
import { formatDuration } from "@/lib/media";
import { PageHeader } from "@/components/ui/page-header";
import { Notice } from "@/components/ui/notice";
import { EmptyState } from "@/components/ui/empty-state";
import { IconTile } from "@/components/ui/icon-tile";
import { StatusBadge } from "@/components/ui/status-badge";
import { Pagination } from "@/components/ui/pagination";
import { Table, TableCard, Td, Th, Tr } from "@/components/ui/data-table";
import { FilterBar, FilterSelect } from "@/components/admin/filter-bar";
import { MoveButtons, RowActions } from "@/components/admin/row-actions";
import { deleteMaterialAction, moveMaterialAction, setMaterialStatusAction } from "./actions";
import { TERMS } from "@/lib/terms";

export const metadata: Metadata = { title: "Materials" };

const TYPES = Object.keys(MATERIAL_TYPES) as MaterialType[];

export default async function MaterialsPage({ searchParams }: PageProps<"/admin/materials">) {
  const sp = await searchParams;
  const courseId = idParam(sp, "course");
  const subjectId = idParam(sp, "subject");
  const chapterId = idParam(sp, "chapter");
  const q = one(sp, "q");
  const typeRaw = one(sp, "type");
  const type = TYPES.find((t) => t === typeRaw);
  const statusRaw = one(sp, "status");
  const status = statusRaw === "DRAFT" || statusRaw === "PUBLISHED" || statusRaw === "ARCHIVED" ? statusRaw : undefined;
  const sortRaw = one(sp, "sort");
  const sort: SortKey = sortRaw && sortRaw in SORTS ? (sortRaw as SortKey) : "library";
  const page = pageParam(sp);

  const [courses, subjectGroups, tree, { rows, total }] = await Promise.all([
    courseOptions(), subjectOptions(), chapterPickerTree(), listMaterials({ courseId, subjectId, chapterId, type, status, q, sort, page }),
  ]);
  const hasChapters = tree.some((c) => c.subjects.some((s) => s.chapters.length > 0));
  const filtered = !!(courseId || subjectId || chapterId || type || status || q);
  const params = { course: courseId, subject: subjectId, chapter: chapterId, type, status, q, sort: sort === "library" ? undefined : sort };
  const returnTo = "/admin/materials" + (chapterId ? `?chapter=${chapterId}` : "");

  return (
    <>
      <PageHeader
        title="Materials"
        description={`Study files, videos, links and notes, organised by ${TERMS.programLower}, subject and chapter.`}
        actions={hasChapters && (
          <>
            <Link href="/admin/materials/bulk" className="btn-outline"><FileUp className="size-4.5" aria-hidden /> Add multiple</Link>
            <Link href={`/admin/materials/new${chapterId ? `?chapter=${chapterId}` : ""}`} className="btn-primary"><Plus className="size-4.5" aria-hidden /> New material</Link>
          </>
        )}
      />
      <Notice searchParams={sp} />

      {!hasChapters ? (
        <div className="card">
          <EmptyState icon={Files} title="Create a chapter first" description="Every material belongs to a chapter, so add a subject and a chapter before adding study material."
            action={<Link href="/admin/chapters/new" className="btn-primary">Create a chapter</Link>} />
        </div>
      ) : (
        <>
          <FilterBar basePath="/admin/materials" q={q} placeholder="Search materials…" active={filtered}>
            <FilterSelect name="course" label={TERMS.program} value={courseId}>
              <option value="">All {TERMS.programs.toLowerCase()}</option>
              {courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </FilterSelect>
            <FilterSelect name="subject" label="Subject" value={subjectId}>
              <option value="">All subjects</option>
              {subjectGroups.map((g) => (
                <optgroup key={g.courseId} label={g.course}>{g.subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</optgroup>
              ))}
            </FilterSelect>
            <FilterSelect name="chapter" label="Chapter" value={chapterId}>
              <option value="">All chapters</option>
              {tree.flatMap((c) => c.subjects.filter((s) => s.chapters.length).map((s) => (
                <optgroup key={s.id} label={`${c.name} › ${s.name}`}>{s.chapters.map((ch) => <option key={ch.id} value={ch.id}>{ch.label}</option>)}</optgroup>
              )))}
            </FilterSelect>
            <FilterSelect name="type" label="Type" value={type}>
              <option value="">Any type</option>
              {TYPES.map((t) => <option key={t} value={t}>{MATERIAL_TYPES[t].label}</option>)}
            </FilterSelect>
            <FilterSelect name="status" label="Status" value={status}>
              <option value="">Any status</option>
              <option value="PUBLISHED">Published</option>
              <option value="DRAFT">Draft</option>
              <option value="ARCHIVED">Archived</option>
            </FilterSelect>
            <FilterSelect name="sort" label="Sort by" value={sort}>
              {Object.entries(SORTS).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
            </FilterSelect>
          </FilterBar>

          {rows.length === 0 ? (
            <div className="card">
              <EmptyState icon={Files} title={filtered ? "No materials match your filters." : "No study material has been added yet."}
                description={filtered ? "Try a different search or clear the filters." : "Upload a document, add a video or link, or write a note."}
                action={!filtered && <Link href="/admin/materials/new" className="btn-primary">Add your first material</Link>} />
            </div>
          ) : (
            <TableCard footer={<Pagination page={page} total={total} pageSize={PAGE_SIZE} basePath="/admin/materials" params={params} />}>
              <Table caption="Materials" className="lg:min-w-200">
                <thead>
                  <tr>
                    {sort === "library" && <Th className="hidden md:table-cell">Order</Th>}
                    <Th>Material</Th>
                    <Th className="hidden md:table-cell">Location</Th><Th className="hidden md:table-cell">Status</Th><Th className="hidden md:table-cell">Added</Th>
                    <Th className="hidden md:table-cell"><span className="sr-only">Actions</span></Th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((m, i) => {
                    const meta = MATERIAL_TYPES[m.type];
                    const detail =
                      m.type === "FILE" ? [m.fileName, m.fileSize ? formatBytes(m.fileSize) : null].filter(Boolean).join(" · ")
                      : m.type === "YOUTUBE" ? (m.durationSeconds ? `Video · ${formatDuration(m.durationSeconds)}` : "Video")
                      : m.type === "LINK" ? (m.externalUrl ? new URL(m.externalUrl).hostname : "Link")
                      : "Note";
                    const actions = (
                      <div className="flex items-center justify-end gap-1">
                        {m.type === "FILE" && (
                          <a href={`/api/materials/${m.id}/file`} target="_blank" rel="noopener" className="btn-ghost" aria-label={`Open ${m.title}`} title="Open file">
                            <ExternalLink className="size-4" aria-hidden />
                          </a>
                        )}
                        <RowActions id={m.id} name={m.title} status={m.status} editHref={`/admin/materials/${m.id}`} returnTo={returnTo}
                          setStatus={setMaterialStatusAction} remove={deleteMaterialAction}
                          deleteHint={m.type === "FILE" ? "The uploaded file is deleted too, and students lose their bookmarks and progress for it." : "Students lose their bookmarks and progress for it."} />
                      </div>
                    );
                    return (
                      <Tr key={m.id}>
                        {sort === "library" && (
                          <Td className="hidden md:table-cell">
                            <MoveButtons id={m.id} action={moveMaterialAction} returnTo={returnTo} label={m.title}
                              first={i > 0 && rows[i - 1].chapterId !== m.chapterId} last={i < rows.length - 1 && rows[i + 1].chapterId !== m.chapterId} />
                          </Td>
                        )}
                        <Td>
                          <div className="flex items-center gap-3">
                            <IconTile icon={meta.icon} size="sm" className={meta.tile} />
                            <div className="min-w-0">
                              <Link href={`/admin/materials/${m.id}`} className="font-semibold hover:text-primary">{m.title}</Link>
                              <p className="max-w-xs truncate text-muted">{detail}</p>
                              <div className="mt-1 md:hidden"><StatusBadge status={m.status} /></div>
                              <div className="-ml-2.5 mt-1 md:hidden [&>div]:justify-start">{actions}</div>
                            </div>
                          </div>
                        </Td>
                        <Td className="hidden md:table-cell">
                          <p className="whitespace-nowrap">{m.chapter.subject.name} · <span className="text-muted">{[m.chapter.subject.course.name, m.chapter.subject.semester?.name].filter(Boolean).join(" · ")}</span></p>
                          <Link href={`/admin/materials?chapter=${m.chapterId}`} className="text-muted hover:text-primary">Ch {m.chapter.chapterNumber}. {m.chapter.title}</Link>
                        </Td>
                        <Td className="hidden md:table-cell"><StatusBadge status={m.status} /></Td>
                        <Td className="hidden whitespace-nowrap text-muted md:table-cell">{timeAgo(m.createdAt)}</Td>
                        <Td className="hidden md:table-cell">{actions}</Td>
                      </Tr>
                    );
                  })}
                </tbody>
              </Table>
            </TableCard>
          )}
        </>
      )}
    </>
  );
}
