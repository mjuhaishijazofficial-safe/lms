import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/server/auth/session";
import { homeFor } from "@/server/auth/guards";
import { Logo } from "@/components/layout/logo";
import { ADMIN_WHATSAPP_DISPLAY, ADMIN_WHATSAPP_URL } from "@/lib/contact";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage() {
  const user = await getSessionUser();
  if (user) redirect(homeFor(user));

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <Logo />
        </div>
        <div className="card p-8">
          <h1 className="text-2xl font-bold text-ink">Welcome back</h1>
          <p className="mt-1 mb-7 text-muted">Sign in to continue to your study material.</p>
          <LoginForm />
        </div>
        <p className="mt-6 text-center text-sm text-muted">
          Forgot your password? Contact your admin on{" "}
          <a href={ADMIN_WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className="font-semibold text-primary hover:underline">
            WhatsApp ({ADMIN_WHATSAPP_DISPLAY})
          </a>
          .
        </p>
      </div>
    </main>
  );
}
