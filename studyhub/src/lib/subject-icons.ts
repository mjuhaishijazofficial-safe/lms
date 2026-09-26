import {
  Atom, BookOpen, Calculator, Code, Dna, FlaskConical, Globe, Landmark, Languages, Leaf, Music, Palette, PenLine, Sigma, TrendingUp,
  type LucideIcon,
} from "lucide-react";

export const SUBJECT_ICON_KEYS = [
  "book", "calculator", "sigma", "atom", "flask", "dna", "leaf", "globe", "landmark", "languages", "pen", "code", "chart", "palette", "music",
] as const;
export type SubjectIconKey = (typeof SUBJECT_ICON_KEYS)[number];

type IconDef = { icon: LucideIcon; label: string; tile: string };

// Tile colours follow the reference screens: soft tinted square, saturated glyph.
export const SUBJECT_ICONS: Record<SubjectIconKey, IconDef> = {
  book: { icon: BookOpen, label: "Book", tile: "tile-blue" },
  calculator: { icon: Calculator, label: "Mathematics", tile: "tile-solid" },
  sigma: { icon: Sigma, label: "Formulae", tile: "tile-purple" },
  atom: { icon: Atom, label: "Physics", tile: "tile-blue" },
  flask: { icon: FlaskConical, label: "Chemistry", tile: "tile-green" },
  dna: { icon: Dna, label: "Biology", tile: "tile-red" },
  leaf: { icon: Leaf, label: "Nature", tile: "tile-green" },
  globe: { icon: Globe, label: "Geography", tile: "tile-blue" },
  landmark: { icon: Landmark, label: "History", tile: "tile-amber" },
  languages: { icon: Languages, label: "Languages", tile: "tile-amber" },
  pen: { icon: PenLine, label: "English", tile: "tile-red" },
  code: { icon: Code, label: "Computer", tile: "tile-solid" },
  chart: { icon: TrendingUp, label: "Economics", tile: "tile-green" },
  palette: { icon: Palette, label: "Art", tile: "tile-purple" },
  music: { icon: Music, label: "Music", tile: "tile-red" },
};

/**
 * Each subject gets one vivid colour, picked from its id so it stays the same on every page
 * (card, subject page, bookmarks, admin tables). `bar` colours its progress bar to match.
 */
const SUBJECT_COLORS = [
  { tile: "bg-vivid-indigo text-white", bar: "bg-vivid-indigo" },
  { tile: "bg-vivid-green text-white", bar: "bg-vivid-green" },
  { tile: "bg-vivid-blue text-white", bar: "bg-vivid-blue" },
  { tile: "bg-vivid-orange text-white", bar: "bg-vivid-orange" },
  { tile: "bg-vivid-pink text-white", bar: "bg-vivid-pink" },
  { tile: "bg-vivid-cyan text-white", bar: "bg-vivid-cyan" },
  { tile: "bg-vivid-violet text-white", bar: "bg-vivid-violet" },
] as const;

function colorFor(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return SUBJECT_COLORS[h % SUBJECT_COLORS.length];
}

/** The subject's glyph plus its colours. Pass the subject id to get its own vivid colour. */
export function subjectIcon(key: string, id?: string): IconDef & { bar: string } {
  const def = SUBJECT_ICONS[key as SubjectIconKey] ?? SUBJECT_ICONS.book;
  if (!id) return { ...def, bar: "bg-primary" };
  const c = colorFor(id);
  return { ...def, tile: c.tile, bar: c.bar };
}
