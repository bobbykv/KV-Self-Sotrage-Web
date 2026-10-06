import type { Metadata } from "next";
import Image from "next/image";
import { redirect } from "next/navigation";
import { ActionForm } from "@/components/ActionForm";
import { adminLogin, getAdmin } from "@/lib/auth";

export const metadata: Metadata = { title: "Staff login", robots: { index: false } };

async function loginAction(_prev: { error?: string }, form: FormData) {
  "use server";
  const res = await adminLogin(String(form.get("email") ?? ""), String(form.get("password") ?? ""));
  if (!res.ok) return { error: res.error };
  redirect("/admin");
}

export default async function AdminLogin() {
  if (await getAdmin()) redirect("/admin");
  return (
    <div className="flex min-h-screen items-center justify-center bg-kv-navy-50 p-4">
      <div className="card w-full max-w-sm p-8">
        <Image src="/photos/logo-original.jpg" alt="KV Self Storage" width={1134} height={496} className="mx-auto h-14 w-auto" />
        <h1 className="mt-6 text-center text-xl font-extrabold text-kv-navy">Staff console</h1>
        <p className="mb-6 text-center text-sm text-kv-muted">All three locations, one login.</p>
        <ActionForm action={loginAction} submitLabel="Sign in" pendingLabel="Signing in…" hideOnSuccess={false}>
          <label className="block">
            <span className="label">Email</span>
            <input name="email" type="email" required autoComplete="username" className="input" />
          </label>
          <label className="block">
            <span className="label">Password</span>
            <input name="password" type="password" required autoComplete="current-password" className="input" />
          </label>
        </ActionForm>
      </div>
    </div>
  );
}
