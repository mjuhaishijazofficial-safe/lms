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
  book: { icon: BookOpen, label: "Book", tile: "bg-tile-blue text-primary" },
  calculator: { icon: Calculator, label: "Mathematics", tile: "bg-indigo-500 text-white" },
  sigma: { icon: Sigma, label: "Formulae", tile: "bg-tile-purple text-violet-600" },
  atom: { icon: Atom, label: "Physics", tile: "bg-sky-100 text-sky-600" },
  flask: { icon: FlaskConical, label: "Chemistry", tile: "bg-tile-green text-emerald-600" },
  dna: { icon: Dna, label: "Biology", tile: "bg-rose-100 text-rose-600" },
  leaf: { icon: Leaf, label: "Nature", tile: "bg-lime-100 text-lime-700" },
  globe: { icon: Globe, label: "Geography", tile: "bg-cyan-100 text-cyan-700" },
  landmark: { icon: Landmark, label: "History", tile: "bg-tile-amber text-amber-700" },
  languages: { icon: Languages, label: "Languages", tile: "bg-orange-100 text-orange-600" },
  pen: { icon: PenLine, label: "English", tile: "bg-tile-red text-red-600" },
  code: { icon: Code, label: "Computer", tile: "bg-blue-600 text-white" },
  chart: { icon: TrendingUp, label: "Economics", tile: "bg-teal-100 text-teal-700" },
  palette: { icon: Palette, label: "Art", tile: "bg-fuchsia-100 text-fuchsia-600" },
  music: { icon: Music, label: "Music", tile: "bg-pink-100 text-pink-600" },
};

export function subjectIcon(key: string): IconDef {
  return SUBJECT_ICONS[key as SubjectIconKey] ?? SUBJECT_ICONS.book;
}
