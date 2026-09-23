"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bookmark, BookMarked, Megaphone, ShieldCheck, Clock, Files, GraduationCap, Headset, Home, Layers, LayoutDashboard, ListOrdered, Menu, Search, Settings, User, Users, X,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/format";
import { Logo } from "./logo";
import { TERMS } from "@/lib/terms";
import { ADMIN_WHATSAPP_URL } from "@/lib/contact";

type NavItem = { href: string; label: string; icon: LucideIcon; exact?: boolean };

// Icons live here (not passed from the server) because components can't be serialised across the boundary.
const NAV: Record<"admin" | "student", NavItem[]> = {
  admin: [
    { href: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
    { href: "/admin/students", label: "Students", icon: Users },
    { href: "/admin/courses", label: TERMS.programs, icon: GraduationCap },
    { href: "/admin/subjects", label: "Subjects", icon: Layers },
    { href: "/admin/chapters", label: "Chapters", icon: ListOrdered },
    { href: "/admin/materials", label: "Materials", icon: Files },
    { href: "/admin/announcements", label: "Announcements", icon: Megaphone },
    { href: "/admin/admins", label: "Admins", icon: ShieldCheck },
    { href: "/admin/settings", label: "Settings", icon: Settings },
  ],
  student: [
    { href: "/dashboard", label: "Dashboard", icon: Home, exact: true },
    { href: "/courses", label: "My Courses", icon: BookMarked },
    { href: "/subjects", label: "Subjects", icon: Layers },
    { href: "/search", label: "Search", icon: Search },
    { href: "/recent", label: "Recent Materials", icon: Clock },
    { href: "/bookmarks", label: "Bookmarks", icon: Bookmark },
    { href: "/profile", label: "Profile", icon: User },
  ],
};

function NavList({ items, onNavigate }: { items: NavItem[]; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <ul className="space-y-1.5">
      {items.map(({ href, label, icon: Icon, exact }) => {
        const active = exact ? pathname === href : pathname === href || pathname.startsWith(href + "/");
        return (
          <li key={href}>
            <Link
              href={href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-4 rounded-xl px-4 py-3 text-[15px] font-medium transition",
                active ? "bg-primary-soft text-primary shadow-[inset_3px_0_0_var(--color-accent)]" : "text-ink/85 hover:bg-page hover:text-ink",
              )}
            >
              <Icon className="size-5.5 shrink-0" strokeWidth={active ? 2.2 : 1.8} aria-hidden />
              {label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function HelpCard() {
  return (
    <a href={ADMIN_WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 rounded-2xl bg-primary-soft/70 p-4">
      <Headset className="size-7 shrink-0 text-primary" aria-hidden />
      <div className="text-sm leading-tight">
        <p className="font-semibold text-ink">Need Help?</p>
        <p className="mt-0.5 text-muted">WhatsApp your admin</p>
      </div>
    </a>
  );
}

function Panel({ variant, onNavigate }: { variant: "admin" | "student"; onNavigate?: () => void }) {
  return (
    <div className="flex h-full flex-col px-4 py-6">
      <div className="mb-9 px-3"><Logo /></div>
      <nav aria-label="Main" className="flex-1 overflow-y-auto">
        <NavList items={NAV[variant]} onNavigate={onNavigate} />
      </nav>
      {variant === "student" && <HelpCard />}
    </div>
  );
}

/** Fixed sidebar, shown from the `lg` breakpoint up. */
export function Sidebar({ variant }: { variant: "admin" | "student" }) {
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-66 border-r border-line bg-surface/80 lg:block">
      <Panel variant={variant} />
    </aside>
  );
}

/** Hamburger button + slide-in drawer, for screens below `lg`. */
export function MobileMenu({ variant }: { variant: "admin" | "student" }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Close the drawer after navigating (adjusting state during render, as React recommends) and on Escape.
  const [seenPath, setSeenPath] = useState(pathname);
  if (seenPath !== pathname) {
    setSeenPath(pathname);
    setOpen(false);
  }
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
  }, [open]);

  return (
    <div className="lg:hidden">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex size-10 items-center justify-center rounded-xl border border-line bg-surface text-ink"
        aria-label="Open menu"
        aria-expanded={open}
      >
        <Menu className="size-5" aria-hidden />
      </button>

      {open && (
        <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="absolute inset-0 bg-ink/40" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-[min(18rem,85vw)] bg-surface shadow-2xl">
            <button type="button" onClick={() => setOpen(false)} className="absolute right-3 top-3 rounded-lg p-2 text-muted hover:bg-page" aria-label="Close menu">
              <X className="size-5" aria-hidden />
            </button>
            <Panel variant={variant} onNavigate={() => setOpen(false)} />
          </div>
        </div>
      )}
    </div>
  );
}
