import { redirect } from "next/navigation";
import { getSessionUser } from "@/server/auth/session";
import { homeFor } from "@/server/auth/guards";

export default async function Home() {
  const user = await getSessionUser();
  redirect(user ? homeFor(user) : "/login");
}
