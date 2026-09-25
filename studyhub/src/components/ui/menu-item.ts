// Kept out of menu.tsx on purpose: that is a client module, and a server component that imports a plain string from a
// client module gets a reference object, not the string.

/** A full-width row inside a Menu. */
export const menuItem = "flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm font-medium text-ink transition hover:bg-page disabled:pointer-events-none disabled:opacity-40";
