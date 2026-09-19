"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, LogOut, Settings, User } from "lucide-react";
import { logoutAction } from "@/app/(auth)/login/actions";
import { Avatar } from "@/components/ui/avatar";

/** Avatar + name + role, opening a small menu. Built on <details> so it works before JS loads. */
export function UserMenu({ name, role }: { name: string; role: "ADMIN" | "STUDENT" }) {
  const ref = useRef<HTMLDetailsElement>(null);
  const pathname = usePathname();
  useEffect(() => { if (ref.current) ref.current.open = false; }, [pathname]);
  useEffect(() => {
    const close = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) ref.current.open = false; };
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, []);

  const profileHref = role === "ADMIN" ? "/admin/settings" : "/profile";
  return (
    <details ref={ref} className="group relative">
      <summary className="flex cursor-pointer list-none items-center gap-3 rounded-xl py-1 pl-1 pr-2 transition hover:bg-surface [&::-webkit-details-marker]:hidden">
        <Avatar name={name} />
        <span className="hidden text-left leading-tight sm:block">
          <span className="block max-w-40 truncate font-semibold text-ink">{name}</span>
          <span className="block text-sm text-muted">{role === "ADMIN" ? "Admin" : "Student"}</span>
        </span>
        <ChevronDown className="size-4.5 text-ink/70 transition group-open:rotate-180" aria-hidden />
      </summary>
      <div className="card absolute right-0 z-40 mt-2 w-56 p-1.5">
        <Link href={profileHref} className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm hover:bg-page">
          {role === "ADMIN" ? <Settings className="size-4" aria-hidden /> : <User className="size-4" aria-hidden />}
          {role === "ADMIN" ? "Account settings" : "My profile"}
        </Link>
        <form action={logoutAction}>
          <button className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50">
            <LogOut className="size-4" aria-hidden /> Log out
          </button>
        </form>
      </div>
    </details>
  );
}
