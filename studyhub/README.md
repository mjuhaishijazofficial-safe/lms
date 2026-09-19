# StudyHub

A centralized study-material platform for university students. Admins organise content; students log in and study.

**Structure:** Program (e.g. BS Computer Science) → Semester → Subject → Chapter → Material.
Students see the subjects of their **current semester and earlier ones**; later semesters stay hidden until an admin promotes them.
Materials are documents (PDF, Word, PowerPoint), YouTube videos, external links, or text notes.

Stack: Next.js (App Router) · TypeScript · Tailwind CSS · PostgreSQL · Prisma. No external services beyond Postgres.

## Run it locally

You need Node.js 22+ and a PostgreSQL database.

```bash
npm install
cp .env.example .env        # then edit DATABASE_URL and the seed admin password
npx prisma migrate deploy   # creates the tables
npm run db:seed             # creates the first admin from SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD
npm run dev                 # http://localhost:3000
```

For a sample university (programs, semesters, subjects, materials, students) while developing:

```bash
npm run db:seed:demo        # development only, never run this in production
```

Demo students sign in with `ali@studyhub.local` / `Student-Demo-2026` (and `sara@`, `zoya@`, `hamza@`).

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` / `build` / `start` | Development server, production build, production server |
| `npm run typecheck` / `lint` | TypeScript and ESLint checks |
| `npm test` | Unit tests (validation, file safety, progress, visibility rules) |
| `npm run test:e2e` | End-to-end tests against a running app on port 3200 (see below) |
| `npm run db:migrate` | Create a new migration during development |

**End-to-end tests** drive the real forms over HTTP. Build and start the app on port 3200 first
(`npm run build && npx next start -p 3200`), with `.env` loaded. They create and remove records named `SmokeTest…`.

Six suites, ~396 checks: `auth` (login, sessions, rate limiting), `admin` (class/subject/chapter/student CRUD,
reordering, filters, pagination), `materials` (uploads incl. disguised/oversized files, YouTube/link/note
validation, download authorization), `semesters` (program setup, promotion, cross-semester visibility),
`student` (dashboard/subject/material pages, isolation between students, access tampering), and `engagement`
(bookmarks, mark-as-complete, search scoping). Every suite includes deliberate tampering attempts (wrong role,
wrong owner, content outside the caller's visibility) to confirm the server — not just the UI — refuses them.

## Where things live

- `src/server/services/` business rules and database access (every function checks the caller is allowed)
- `src/server/services/visibility.ts` the single definition of what a student may see
- `src/server/auth/` sessions (database-backed, HttpOnly cookie), password hashing (argon2id), role guards
- `src/server/storage/` where uploaded files go. Local disk today; add an S3-compatible driver behind the same interface
- `src/app/admin/` admin screens, `src/app/(student)/` student screens, `src/app/api/materials/` permission-checked file routes
- `src/lib/terms.ts` the words used for "program" and "semester", so another institution can rename them

## Security notes

- Uploaded files are checked by content (not just name), stored under random names, and served only through routes that verify the student's access. There are no public file URLs.
- Passwords are hashed; deactivating a student ends their sessions immediately; students created or reset by an admin must choose their own password at first sign-in.
- Every admin action re-checks the caller's role on the server. Hidden buttons are never the protection.
- Before deploying: use a strong `SEED_ADMIN_PASSWORD`, serve over HTTPS, and do not run `db:seed:demo`.
