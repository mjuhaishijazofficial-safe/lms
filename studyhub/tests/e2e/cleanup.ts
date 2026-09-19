import { rm } from "node:fs/promises";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

// Removes everything the end-to-end tests create: rows named "SmokeTest…" and any stored files they left behind.
const db = new PrismaClient();
const STORAGE = path.resolve(process.cwd(), process.env.STORAGE_LOCAL_DIR ?? "./storage");

async function main() {
  const leftovers = await db.material.findMany({ where: { fileKey: { not: null }, chapter: { subject: { course: { name: { startsWith: "SmokeTest" } } } } }, select: { fileKey: true } });
  for (const m of leftovers) await rm(path.join(STORAGE, m.fileKey!), { force: true });

  const u = await db.user.deleteMany({ where: { email: { startsWith: "smoketest" } } });
  const c = await db.course.deleteMany({ where: { name: { startsWith: "SmokeTest" } } }); // subjects, chapters and materials cascade
  console.log(`removed ${u.count} test users, ${c.count} test classes, ${leftovers.length} leftover stored files`);
  console.log("remaining:", JSON.stringify({ users: await db.user.count(), courses: await db.course.count(), materials: await db.material.count() }));
}

main().finally(() => db.$disconnect());
