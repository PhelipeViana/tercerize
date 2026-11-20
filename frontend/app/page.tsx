import { redirect } from "next/navigation";
import { firstAllowedRoute, getSession } from "@/lib/auth/dal";

export default async function HomePage() {
  const session = await getSession();
  if (!session) redirect("/login");
  redirect(firstAllowedRoute(session));
}
