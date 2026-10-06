import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ActionForm } from "@/components/ActionForm";
import { adminLogin, getAdmin } from "@/lib/auth";
import { DEMO_ADMIN, ensureDemoAdmin } from "@/lib/demo-admin";
import { env } from "@/lib/env";

export const metadata: Metadata = { title: "Staff login", robots: { index: false } };

async function loginAction(_prev: { error?: string }, form: FormData) {
  "use server";
  await ensureDemoAdmin();
  const res = await adminLogin(String(form.get("email") ?? ""), String(form.get("password") ?? ""));
  if (!res.ok) return { error: res.error };
  redirect("/admin");
}

export default async function AdminLogin() {
  await ensureDemoAdmin();
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
            <input
              name="email"
              type="email"
              required
              autoComplete="username"
              className="input"
              defaultValue={env.appTestMode ? DEMO_ADMIN.email : undefined}
            />
          </label>
          <label className="block">
            <span className="label">Password</span>
            <input name="password" type="password" required autoComplete="current-password" className="input" />
          </label>
        </ActionForm>
        {env.appTestMode && (
          <p className="mt-4 rounded-xl bg-kv-yellow-light p-3 text-sm text-kv-navy">
            Test staff login: <strong>{DEMO_ADMIN.email}</strong> / <strong>{DEMO_ADMIN.password}</strong>. See{" "}
            <Link href="/testing" className="font-semibold underline">
              test instructions
            </Link>
            .
          </p>
        )}
      </div>
    </div>
  );
}
