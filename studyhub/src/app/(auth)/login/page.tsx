import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { BookOpenCheck, ChartNoAxesColumn, Layers, MessageCircle } from "lucide-react";
import { getSessionUser } from "@/server/auth/session";
import { homeFor } from "@/server/auth/guards";
import { Logo } from "@/components/layout/logo";
import { ADMIN_WHATSAPP_DISPLAY, FORGOT_PASSWORD_URL } from "@/lib/contact";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

const FEATURES = [
  { icon: Layers, title: "Organised by semester", text: "Notes, videos and links, chapter by chapter." },
  { icon: BookOpenCheck, title: "Tests and study guides", text: "Practise with MCQs written for your subjects." },
  { icon: ChartNoAxesColumn, title: "Track your progress", text: "See what you've finished and what's next." },
];

export default async function LoginPage() {
  const user = await getSessionUser();
  if (user) redirect(homeFor(user));

  return (
    <main className="grid min-h-screen lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      {/* Brand panel, wide screens only. */}
      <section className="relative hidden overflow-hidden bg-sidebar p-12 text-white lg:flex lg:flex-col">
        <div aria-hidden className="pointer-events-none absolute -right-32 -top-32 size-96 rounded-full bg-primary/25 blur-3xl" />
        <div aria-hidden className="pointer-events-none absolute -bottom-40 -left-24 size-96 rounded-full bg-vivid-violet/20 blur-3xl" />
        <div className="relative"><Logo tone="dark" /></div>
        <div className="relative my-auto max-w-md">
          <h2 className="text-4xl font-bold leading-tight tracking-tight">All your study material in one place.</h2>
          <p className="mt-4 text-lg text-sidebar-ink">Sign in to pick up where you left off.</p>
          <ul className="mt-10 space-y-6">
            {FEATURES.map(({ icon: Icon, title, text }) => (
              <li key={title} className="flex items-start gap-4">
                <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-control bg-white/10 text-sidebar-accent">
                  <Icon className="size-5" aria-hidden />
                </span>
                <div>
                  <p className="font-semibold">{title}</p>
                  <p className="text-sm text-sidebar-ink">{text}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <div className="flex items-center justify-center px-4 py-12 sm:px-8">
        <div className="w-full max-w-md">
          <div className="mb-8 flex justify-center lg:hidden">
            <Logo />
          </div>
          <div className="card p-6 sm:p-8">
            <h1 className="text-2xl font-bold tracking-tight text-ink">Welcome back</h1>
            <p className="mb-7 mt-1 text-muted">Sign in to continue to your study material.</p>
            <LoginForm />
            <div className="mt-7 border-t border-line pt-6 text-sm">
              <p className="font-medium text-ink">Forgot your password?</p>
              <p className="mt-1 text-muted">
                Your admin will set a temporary password for you. You choose your own when you sign in.
              </p>
              <a href={FORGOT_PASSWORD_URL} target="_blank" rel="noopener noreferrer" className="btn-outline mt-4 w-full">
                <MessageCircle aria-hidden /> Message your admin on WhatsApp
              </a>
              <p className="mt-3 text-center text-muted">Admin: {ADMIN_WHATSAPP_DISPLAY}</p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
