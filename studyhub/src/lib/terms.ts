/**
 * The words users see for the levels above a subject. The database calls the top level a "Course"; universities
 * call it a program. Change these strings to fit another institution (e.g. "Class" and "Term") without touching code.
 */
export const TERMS = {
  program: "Program",
  programs: "Programs",
  programLower: "program",
  semester: "Semester",
  semesters: "Semesters",
  semesterLower: "semester",
} as const;
