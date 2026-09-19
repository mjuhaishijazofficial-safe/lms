/**
 * Development seed. Safe to re-run: existing rows are left untouched.
 *   npm run db:seed        -> the first admin (SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD)
 *   npm run db:seed:demo   -> plus a sample university: programs, semesters, subjects, chapters, materials and students
 * Sample data exists only for development. Nothing in the app hardcodes it.
 */
import { randomBytes } from "node:crypto";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { PrismaClient, type MaterialType } from "@prisma/client";
import { hash } from "@node-rs/argon2";

const db = new PrismaClient();
const argon = { memoryCost: 19456, timeCost: 2, parallelism: 1 };
const STORAGE = path.resolve(process.cwd(), process.env.STORAGE_LOCAL_DIR ?? "./storage");

async function ensureUser(email: string, name: string, password: string, role: "ADMIN" | "STUDENT", opts: { courseId?: string; semesterId?: string; studentId?: string; mustChangePassword?: boolean } = {}) {
  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`exists: ${email}`);
    if (opts.courseId && !(await db.enrollment.findFirst({ where: { userId: existing.id } }))) {
      await db.enrollment.create({ data: { userId: existing.id, courseId: opts.courseId, semesterId: opts.semesterId } });
      console.log(`  enrolled ${email}`);
    }
    return existing;
  }
  console.log(`created ${role.toLowerCase()}: ${email}`);
  return db.user.create({
    data: {
      email, name, role, passwordHash: await hash(password, argon), mustChangePassword: opts.mustChangePassword ?? false,
      ...(role === "ADMIN" ? { adminProfile: { create: {} } } : { studentProfile: { create: { studentId: opts.studentId } } }),
      ...(opts.courseId ? { enrollments: { create: { courseId: opts.courseId, semesterId: opts.semesterId } } } : {}),
    },
  });
}

/** A program with its semesters ("Semester 1" .. "Semester n"). */
async function ensureProgram(name: string, description: string, order: number, semesterCount: number) {
  const course = (await db.course.findFirst({ where: { name } })) ?? (await db.course.create({ data: { name, description, order } }));
  const have = await db.semester.count({ where: { courseId: course.id } });
  if (have < semesterCount) {
    await db.semester.createMany({ data: Array.from({ length: semesterCount - have }, (_, i) => ({ courseId: course.id, name: `Semester ${have + i + 1}`, order: have + i })) });
  }
  const semesters = await db.semester.findMany({ where: { courseId: course.id }, orderBy: { order: "asc" } });
  return { course, semesters };
}

async function ensureSubject(courseId: string, semesterId: string | null, name: string, icon: string, description: string, order: number) {
  return (await db.subject.findFirst({ where: { courseId, name } })) ?? db.subject.create({ data: { courseId, semesterId, name, icon, description, order } });
}

async function ensureChapters(subjectId: string, chapters: [string, string][]) {
  for (const [i, [title, description]] of chapters.entries()) {
    if (await db.chapter.findFirst({ where: { subjectId, title } })) continue;
    await db.chapter.create({ data: { subjectId, title, description, chapterNumber: i + 1, order: i } });
  }
}

/** A tiny but valid one-page PDF, so demo files really open in the browser. */
function makePdf(title: string, lines: string[]): Buffer {
  const esc = (t: string) => t.replace(/[\\()]/g, (c) => `\\${c}`);
  const text = lines.map((l) => `(${esc(l)}) Tj 0 -18 Td`).join(" ");
  const content = `BT /F1 24 Tf 72 720 Td (${esc(title)}) Tj /F1 12 Tf 0 -36 Td ${text} ET`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 5 0 R /Resources << /Font << /F1 4 0 R >> >> >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
  ];
  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((body, i) => {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  pdf += offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("");
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(pdf, "latin1");
}

type DemoMaterial = {
  type: MaterialType; title: string; description: string;
  youtubeId?: string; durationSeconds?: number; externalUrl?: string; textContent?: string; pdfLines?: string[];
};

async function ensureMaterials(chapterId: string, uploadedById: string, items: DemoMaterial[]) {
  for (const [i, m] of items.entries()) {
    if (await db.material.findFirst({ where: { chapterId, title: m.title } })) continue;
    let file: { fileKey: string; fileName: string; mimeType: string; fileSize: number } | undefined;
    if (m.type === "FILE") {
      const data = makePdf(m.title, m.pdfLines ?? ["Sample study material for local development."]);
      const fileKey = `${randomBytes(24).toString("hex")}.pdf`;
      mkdirSync(STORAGE, { recursive: true });
      writeFileSync(path.join(STORAGE, fileKey), data);
      file = { fileKey, fileName: `${m.title}.pdf`, mimeType: "application/pdf", fileSize: data.length };
    }
    await db.material.create({
      data: {
        chapterId, type: m.type, title: m.title, description: m.description, order: i, uploadedById,
        youtubeId: m.youtubeId, durationSeconds: m.durationSeconds, externalUrl: m.externalUrl, textContent: m.textContent, ...file,
      },
    });
    console.log(`  material: ${m.title}`);
  }
}

/** Removes the earlier school-style demo data ("Class 10" / "Class 9") and any files it uploaded. */
async function removeLegacyDemo() {
  const legacy = await db.course.findMany({ where: { name: { in: ["Class 10", "Class 9"] } }, select: { id: true } });
  if (!legacy.length) return;
  const ids = legacy.map((c) => c.id);
  const files = await db.material.findMany({ where: { fileKey: { not: null }, chapter: { subject: { courseId: { in: ids } } } }, select: { fileKey: true } });
  for (const f of files) rmSync(path.join(STORAGE, f.fileKey!), { force: true });
  await db.course.deleteMany({ where: { id: { in: ids } } });
  console.log(`removed old demo data (${legacy.length} programs, ${files.length} files)`);
}

async function main() {
  const email = process.env.SEED_ADMIN_EMAIL?.toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!email || !password) throw new Error("Set SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD in .env");
  await ensureUser(email, "Admin", password, "ADMIN");
  if (!process.argv.includes("--demo")) return;
  await removeLegacyDemo();

  const cs = await ensureProgram("BS Computer Science", "Four-year undergraduate degree in computer science.", 0, 8);
  const bba = await ensureProgram("BS Business Administration", "Four-year undergraduate degree in business.", 1, 8);
  const [s1, s2, s3, s4] = cs.semesters;

  // Semester 1 and 2 (earlier semesters stay open to students who have moved on)
  await ensureSubject(cs.course.id, s1.id, "Programming Fundamentals", "code", "Problem solving and first steps in programming.", 0);
  await ensureSubject(cs.course.id, s1.id, "Calculus I", "calculator", "Limits, derivatives and integrals.", 1);
  await ensureSubject(cs.course.id, s2.id, "Linear Algebra", "sigma", "Vectors, matrices and linear transformations.", 0);
  await ensureSubject(cs.course.id, s2.id, "Physics for Computing", "atom", "Mechanics, electricity and digital circuits.", 1);
  // Semester 3: the current semester of the demo students
  const dsa = await ensureSubject(cs.course.id, s3.id, "Data Structures & Algorithms", "code", "Explore lectures, videos and practice material organised by chapters.", 0);
  await ensureSubject(cs.course.id, s3.id, "Discrete Mathematics", "sigma", "Logic, sets, relations, graphs and counting.", 1);
  await ensureSubject(cs.course.id, s3.id, "Object Oriented Programming", "code", "Classes, inheritance, polymorphism and design.", 2);
  await ensureSubject(cs.course.id, s3.id, "Database Systems", "chart", "Relational model, SQL and normalisation.", 3);
  await ensureSubject(cs.course.id, s3.id, "Probability & Statistics", "chart", "Random variables, distributions and inference.", 4);
  // Semester 4: not yet visible to semester-3 students
  await ensureSubject(cs.course.id, s4.id, "Operating Systems", "code", "Processes, memory, file systems and concurrency.", 0);
  await ensureSubject(cs.course.id, s4.id, "Computer Networks", "globe", "Protocols, routing and network security.", 1);
  // Applies to the whole program
  await ensureSubject(cs.course.id, null, "Academic Writing", "pen", "Reports, referencing and presentations for every semester.", 0);
  // Business program
  await ensureSubject(bba.course.id, bba.semesters[0].id, "Principles of Management", "landmark", "Planning, organising, leading and controlling.", 0);
  await ensureSubject(bba.course.id, bba.semesters[0].id, "Financial Accounting", "chart", "Recording, summarising and reporting transactions.", 1);

  await ensureChapters(dsa.id, [
    ["Introduction to Data Structures", "Why data structures matter and how to measure an algorithm."],
    ["Arrays and Linked Lists", "Contiguous and linked storage, and their trade-offs."],
    ["Stacks and Queues", "LIFO and FIFO structures and where they are used."],
    ["Trees and Traversals", "Binary trees, search trees and traversal orders."],
    ["Graphs", "Representations, BFS, DFS and shortest paths."],
    ["Sorting and Searching", "Comparison sorts, hashing and search strategies."],
  ]);

  const admin = await db.user.findFirstOrThrow({ where: { role: "ADMIN" }, select: { id: true } });
  const chapters = await db.chapter.findMany({ where: { subjectId: dsa.id }, orderBy: { chapterNumber: "asc" } });
  await ensureMaterials(chapters[0].id, admin.id, [
    { type: "FILE", title: "Lecture 1 Notes", description: "Complete notes for the first lecture", pdfLines: ["A data structure organises data so it can be used efficiently.", "Big-O notation describes how running time grows with input size."] },
    { type: "FILE", title: "Practice Problems", description: "Problem set with hints", pdfLines: ["1. Determine the time complexity of a nested loop.", "2. Compare linear and binary search on 1,000,000 items."] },
    { type: "YOUTUBE", title: "Introduction to Data Structures", description: "Watch this video for a full explanation", youtubeId: "aqz-KE-bpKQ", durationSeconds: 1455 },
    { type: "LINK", title: "VisuAlgo: Data Structure Visualisations", description: "Interactive animations of common data structures", externalUrl: "https://visualgo.net/en" },
    {
      type: "TEXT", title: "Complexity Cheat Sheet", description: "Quick reference for common growth rates",
      textContent: "<h2>Common growth rates</h2><ul><li><strong>O(1)</strong>: constant, such as reading an array element.</li><li><strong>O(log n)</strong>: binary search.</li><li><strong>O(n)</strong>: a single pass over the data.</li><li><strong>O(n log n)</strong>: merge sort.</li></ul><blockquote>Tip: drop constants and lower-order terms when comparing algorithms.</blockquote>",
    },
  ]);
  await ensureMaterials(chapters[1].id, admin.id, [
    { type: "FILE", title: "Arrays and Linked Lists Slides", description: "Lecture slides with worked examples", pdfLines: ["Arrays give O(1) indexing; linked lists give O(1) insertion at the head."] },
    { type: "YOUTUBE", title: "Linked Lists Explained", description: "Singly and doubly linked lists", youtubeId: "aqz-KE-bpKQ", durationSeconds: 1122 },
  ]);

  // Semester 1 material, to show that earlier semesters remain available
  const pf = await db.subject.findFirstOrThrow({ where: { courseId: cs.course.id, name: "Programming Fundamentals" } });
  await ensureChapters(pf.id, [["Getting Started", "Set up your tools and write your first program."], ["Control Flow", "Decisions and loops."]]);
  const pfChapters = await db.chapter.findMany({ where: { subjectId: pf.id }, orderBy: { chapterNumber: "asc" } });
  await ensureMaterials(pfChapters[0].id, admin.id, [
    { type: "FILE", title: "Course Outline", description: "Topics, weekly plan and assessment", pdfLines: ["Weeks 1-4: variables, types and control flow."] },
  ]);

  await ensureUser("ali@studyhub.local", "Ali Khan", "Student-Demo-2026", "STUDENT", { courseId: cs.course.id, semesterId: s3.id, studentId: "CS-2024-014" });
  await ensureUser("sara@studyhub.local", "Sara Ahmed", "Student-Demo-2026", "STUDENT", { courseId: cs.course.id, semesterId: s3.id, studentId: "CS-2024-021" });
  await ensureUser("zoya@studyhub.local", "Zoya Malik", "Student-Demo-2026", "STUDENT", { courseId: cs.course.id, semesterId: s1.id, studentId: "CS-2026-003" });
  await ensureUser("hamza@studyhub.local", "Hamza Ali", "Student-Demo-2026", "STUDENT", { courseId: bba.course.id, semesterId: bba.semesters[0].id, studentId: "BBA-2026-009", mustChangePassword: true });
}

main().finally(() => db.$disconnect());
