import { TERMS } from "@/lib/terms";
// Fixed messages shown after a redirect (?notice=key / ?error=key). Keys only — query text is never rendered.
export const NOTICES = {
  "student-created": "Student created. They'll choose their own password when they first sign in.",
  "student-updated": "Student details saved.",
  "student-deleted": "Student deleted.",
  "student-activated": "Student reactivated. They can sign in again.",
  "student-deactivated": "Student deactivated and signed out everywhere.",
  "password-reset": "Temporary password set. The student has been signed out and must choose a new password at next sign-in.",
  "course-created": `${TERMS.program} created.`,
  "course-updated": `${TERMS.program} saved.`,
  "course-deleted": `${TERMS.program} deleted.`,
  "subject-created": "Subject created.",
  "subject-updated": "Subject saved.",
  "subject-deleted": "Subject deleted.",
  "chapter-created": "Chapter created.",
  "chapter-updated": "Chapter saved.",
  "chapter-deleted": "Chapter deleted.",
  "material-created": "Material added.",
  "material-updated": "Material saved.",
  "material-deleted": "Material deleted.",
  "semester-created": `${TERMS.semester} added.`,
  "semesters-generated": `${TERMS.semesters} added.`,
  "semester-renamed": `${TERMS.semester} renamed.`,
  "semester-deleted": `${TERMS.semester} deleted.`,
  // {n} is replaced by the number in the ?n= parameter (digits only).
  "students-promoted": `Moved {n} student(s) up to the next ${TERMS.semesterLower}.`,
  "status-updated": "Status updated.",
  "account-updated": "Your account details were saved.",
  "password-changed": "Your password was changed. Other devices have been signed out.",
} as const;

export const ERRORS = {
  "course-not-empty": `This ${TERMS.programLower} still has subjects or students. Archive it instead, or remove them first.`,
  "subject-not-empty": "This subject still has chapters. Archive it instead, or delete its chapters first.",
  "chapter-not-empty": "This chapter still has study materials. Archive it instead, or move or delete its materials first.",
  "semester-not-empty": `This ${TERMS.semesterLower} still has subjects or students. Move them to another ${TERMS.semesterLower} first.`,
  "semester-last": `This is the last ${TERMS.semesterLower}, so there is nowhere to promote students to.`,
  "not-found": "That item no longer exists. It may have been deleted.",
  "forbidden": "You don't have permission to do that.",
  "failed": "Something went wrong. Please try again.",
} as const;

export type NoticeKey = keyof typeof NOTICES;
export type ErrorKey = keyof typeof ERRORS;
