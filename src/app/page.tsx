import { QuoteGuardApp } from "@/components/quoteguard-app";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { authRequired, validSession, SESSION_COOKIE } from "@/server/session";
export const dynamic = "force-dynamic";
export default async function Page() {
  if (
    authRequired() &&
    !validSession((await cookies()).get(SESSION_COOKIE)?.value)
  )
    redirect("/login");
  return <QuoteGuardApp />;
}
