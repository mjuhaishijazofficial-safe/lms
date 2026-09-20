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
  calculator: { icon: Calculator, label: "Mathematics", tile: "bg-tile-blue text-primary" },
  sigma: { icon: Sigma, label: "Formulae", tile: "bg-tile-blue text-primary" },
  atom: { icon: Atom, label: "Physics", tile: "bg-tile-blue text-primary" },
  flask: { icon: FlaskConical, label: "Chemistry", tile: "bg-tile-blue text-primary" },
  dna: { icon: Dna, label: "Biology", tile: "bg-tile-blue text-primary" },
  leaf: { icon: Leaf, label: "Nature", tile: "bg-tile-blue text-primary" },
  globe: { icon: Globe, label: "Geography", tile: "bg-tile-blue text-primary" },
  landmark: { icon: Landmark, label: "History", tile: "bg-tile-blue text-primary" },
  languages: { icon: Languages, label: "Languages", tile: "bg-tile-blue text-primary" },
  pen: { icon: PenLine, label: "English", tile: "bg-tile-blue text-primary" },
  code: { icon: Code, label: "Computer", tile: "bg-tile-blue text-primary" },
  chart: { icon: TrendingUp, label: "Economics", tile: "bg-tile-blue text-primary" },
  palette: { icon: Palette, label: "Art", tile: "bg-tile-blue text-primary" },
  music: { icon: Music, label: "Music", tile: "bg-tile-blue text-primary" },
};

export function subjectIcon(key: string): IconDef {
  return SUBJECT_ICONS[key as SubjectIconKey] ?? SUBJECT_ICONS.book;
}
