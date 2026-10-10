import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  authRequired,
  authConfigured,
  validSession,
  SESSION_COOKIE,
} from "@/server/session";
import { SignIn } from "@/components/sign-in";
export const dynamic = "force-dynamic";
export default async function Login() {
  if (
    !authRequired() ||
    validSession((await cookies()).get(SESSION_COOKIE)?.value)
  )
    redirect("/");
  return <SignIn configured={authConfigured()} />;
}
