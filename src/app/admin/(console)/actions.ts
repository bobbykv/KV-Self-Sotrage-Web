"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { LOCATION_KEYS } from "@/config/locations";
import { audit } from "@/lib/audit";
import { endSession, hashPassword, requireAdmin } from "@/lib/auth";
import { slugify } from "@/lib/cms";
import { db } from "@/lib/db";
import { resetFaqToFile, saveFaqMarkdown } from "@/lib/faq";
import { releaseHold } from "@/lib/holds";
import { refreshInventory, refreshReports } from "@/lib/inventory";
import { sendLeadToGhl } from "@/lib/leads";
import { safeErrorMessage } from "@/lib/log";
import { passwordProblems } from "@/lib/password-policy";
import { halifaxDayBoundary, PLACEMENTS } from "@/lib/promotions";
import { updateSettings } from "@/lib/settings";
import { saveImage } from "@/lib/uploads";

type State = { ok?: boolean; error?: string; message?: string };

export async function adminLogout() {
  await endSession("admin");
  redirect("/admin/login");
}

// ---------- Cache / SiteLink jobs ----------

export async function refreshCacheAction(full: boolean) {
  const admin = await requireAdmin();
  await refreshInventory({ force: true, full });
  await audit(admin.email, full ? "cache.full_refresh" : "cache.refresh");
  revalidatePath("/admin");
}

export async function runReportsAction() {
  const admin = await requireAdmin();
  await refreshReports();
  await audit(admin.email, "reports.run");
  revalidatePath("/admin");
}

// ---------- Holds / leads / queues ----------

export async function releaseHoldAction(id: string) {
  const admin = await requireAdmin();
  await releaseHold(id);
  await audit(admin.email, "hold.release", id);
  revalidatePath("/admin/holds");
}

export async function retryLeadAction(id: string) {
  const admin = await requireAdmin();
  await sendLeadToGhl(id);
  await audit(admin.email, "lead.retry_ghl", id);
  revalidatePath("/admin/leads");
}

const queueUpdate = z.object({ status: z.enum(["new", "in_progress", "done"]), staffNotes: z.string().max(4000).optional() });

export async function updateMaintenanceAction(id: string, form: FormData) {
  const admin = await requireAdmin();
  const data = queueUpdate.parse({ status: form.get("status"), staffNotes: form.get("staffNotes") ?? undefined });
  await db.maintenanceRequest.update({ where: { id }, data });
  await audit(admin.email, "maintenance.update", id, { status: data.status });
  revalidatePath("/admin/maintenance");
}

export async function updateTransferAction(id: string, form: FormData) {
  const admin = await requireAdmin();
  const data = queueUpdate.parse({ status: form.get("status"), staffNotes: form.get("staffNotes") ?? undefined });
  await db.transferRequest.update({ where: { id }, data });
  await audit(admin.email, "transfer.update", id, { status: data.status });
  revalidatePath("/admin/transfers");
}

// ---------- Blog CMS ----------

const postSchema = z.object({
  title: z.string().trim().min(2).max(160),
  slug: z.string().trim().max(90).optional(),
  excerpt: z.string().trim().max(300).optional(),
  body: z.string().min(1).max(100_000),
  coverImageUrl: z.string().trim().max(500).optional(),
  published: z.boolean(),
  publishedAt: z.string().optional(),
  seoTitle: z.string().trim().max(70).optional(),
  seoDescription: z.string().trim().max(170).optional(),
});

export async function savePostAction(id: string | null, _prev: State, form: FormData): Promise<State> {
  const admin = await requireAdmin();
  const parsed = postSchema.safeParse({
    title: form.get("title"),
    slug: form.get("slug") || undefined,
    excerpt: form.get("excerpt") || undefined,
    body: form.get("body"),
    coverImageUrl: form.get("coverImageUrl") || undefined,
    published: form.get("published") === "on",
    publishedAt: form.get("publishedAt") || undefined,
    seoTitle: form.get("seoTitle") || undefined,
    seoDescription: form.get("seoDescription") || undefined,
  });
  if (!parsed.success) return { error: "Title and body are required (SEO title ≤ 70, description ≤ 170 characters)." };
  const d = parsed.data;
  const slug = slugify(d.slug || d.title);
  if (!slug) return { error: "Add a title or slug." };
  const clash = await db.blogPost.findUnique({ where: { slug } });
  if (clash && clash.id !== id) return { error: `Another post already uses /blog/${slug}. Change the slug.` };

  let coverImageUrl = d.coverImageUrl ?? null;
  const file = form.get("coverFile");
  if (file instanceof File && file.size > 0) {
    try {
      const uploadId = await saveImage(file, "blog_cover", true);
      if (uploadId) coverImageUrl = `/api/uploads/${uploadId}`;
    } catch (err) {
      return { error: safeErrorMessage(err) };
    }
  }
  if (coverImageUrl && !/^(https:\/\/|\/api\/uploads\/)/.test(coverImageUrl)) return { error: "Cover image must be an https:// link or an upload." };

  const existing = id ? await db.blogPost.findUnique({ where: { id } }) : null;
  const publishedAt = d.publishedAt && /^\d{4}-\d{2}-\d{2}$/.test(d.publishedAt) ? halifaxDayBoundary(d.publishedAt, "start") : d.published ? (existing?.publishedAt ?? new Date()) : (existing?.publishedAt ?? null);
  const data = {
    title: d.title,
    slug,
    excerpt: d.excerpt ?? null,
    body: d.body,
    coverImageUrl,
    published: d.published,
    publishedAt,
    seoTitle: d.seoTitle ?? null,
    seoDescription: d.seoDescription ?? null,
  };
  const post = id ? await db.blogPost.update({ where: { id }, data }) : await db.blogPost.create({ data });
  await audit(admin.email, id ? "blog.update" : "blog.create", post.id, { slug, published: d.published });
  revalidatePath("/blog");
  revalidatePath(`/blog/${slug}`);
  redirect(`/admin/blog?saved=${post.id}`);
}

export async function setPostPublishedAction(id: string, published: boolean) {
  const admin = await requireAdmin();
  const post = await db.blogPost.findUniqueOrThrow({ where: { id } });
  await db.blogPost.update({ where: { id }, data: { published, publishedAt: published ? (post.publishedAt ?? new Date()) : post.publishedAt } });
  await audit(admin.email, published ? "blog.publish" : "blog.unpublish", id);
  revalidatePath("/blog");
  revalidatePath("/admin/blog");
}

export async function deletePostAction(id: string) {
  const admin = await requireAdmin();
  await db.blogPost.delete({ where: { id } });
  await audit(admin.email, "blog.delete", id);
  revalidatePath("/blog");
  redirect("/admin/blog");
}

// ---------- Promotions CMS ----------

const promoSchema = z.object({
  headline: z.string().trim().min(2).max(120),
  body: z.string().trim().max(400).optional(),
  code: z.string().trim().max(40).optional(),
  startsAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endsAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  active: z.boolean(),
  locations: z.array(z.enum(["all", ...LOCATION_KEYS])).min(1),
  placements: z.array(z.enum(PLACEMENTS as [string, ...string[]])).min(1),
  sortOrder: z.coerce.number().int().min(0).max(999).default(0),
});

export async function savePromoAction(id: string | null, _prev: State, form: FormData): Promise<State> {
  const admin = await requireAdmin();
  const locations = form.getAll("locations").map(String);
  const parsed = promoSchema.safeParse({
    headline: form.get("headline"),
    body: form.get("body") || undefined,
    code: form.get("code") || undefined,
    startsAt: form.get("startsAt") || undefined,
    endsAt: form.get("endsAt") || undefined,
    active: form.get("active") === "on",
    locations: locations.includes("all") ? ["all"] : locations,
    placements: form.getAll("placements").map(String),
    sortOrder: form.get("sortOrder") || 0,
  });
  if (!parsed.success) return { error: "Add a headline, at least one location and at least one place to show it." };
  const d = parsed.data;
  const startsAt = d.startsAt ? halifaxDayBoundary(d.startsAt, "start") : null;
  const endsAt = d.endsAt ? halifaxDayBoundary(d.endsAt, "end") : null;
  if (startsAt && endsAt && endsAt < startsAt) return { error: "End date is before the start date." };
  const data = { headline: d.headline, body: d.body ?? null, code: d.code ?? null, startsAt, endsAt, active: d.active, locations: d.locations, placements: d.placements, sortOrder: d.sortOrder };
  const promo = id ? await db.promotion.update({ where: { id }, data }) : await db.promotion.create({ data });
  await audit(admin.email, id ? "promo.update" : "promo.create", promo.id, { active: d.active });
  revalidatePath("/", "layout");
  redirect("/admin/promotions");
}

export async function setPromoActiveAction(id: string, active: boolean) {
  const admin = await requireAdmin();
  await db.promotion.update({ where: { id }, data: { active } });
  await audit(admin.email, active ? "promo.activate" : "promo.deactivate", id);
  revalidatePath("/", "layout");
}

export async function deletePromoAction(id: string) {
  const admin = await requireAdmin();
  await db.promotion.delete({ where: { id } });
  await audit(admin.email, "promo.delete", id);
  revalidatePath("/", "layout");
  redirect("/admin/promotions");
}

// ---------- FAQ / settings / staff ----------

export async function saveFaqAction(_prev: State, form: FormData): Promise<State> {
  const admin = await requireAdmin();
  try {
    await saveFaqMarkdown(String(form.get("markdown") ?? ""));
  } catch (err) {
    return { error: safeErrorMessage(err) };
  }
  await audit(admin.email, "faq.save");
  revalidatePath("/faq");
  return { ok: true, message: "Saved. The FAQ page, website chat and Retell agents now use this version." };
}

export async function resetFaqAction() {
  const admin = await requireAdmin();
  await resetFaqToFile();
  await audit(admin.email, "faq.reset_to_file");
  revalidatePath("/admin/faq");
}

export async function saveSettingsAction(_prev: State, form: FormData): Promise<State> {
  const admin = await requireAdmin();
  const next = await updateSettings({
    maintenanceMode: form.get("maintenanceMode") === "on",
    maintenanceMessage: String(form.get("maintenanceMessage") ?? "").slice(0, 300),
    chatEnabled: form.get("chatEnabled") === "on",
    showReviews: form.get("showReviews") === "on",
    holdMinutes: Number(form.get("holdMinutes")),
    pollIntervalMinutes: Number(form.get("pollIntervalMinutes")),
    allUnitsPollMinutes: Number(form.get("allUnitsPollMinutes")),
    priceListPollMinutes: Number(form.get("priceListPollMinutes")),
    confirmedReservationHours: Number(form.get("confirmedReservationHours")),
  });
  await audit(admin.email, "settings.update", undefined, next);
  return { ok: true, message: "Settings saved." };
}

export async function createStaffAction(_prev: State, form: FormData): Promise<State> {
  const admin = await requireAdmin();
  if (admin.role !== "owner") return { error: "Only the owner account can add staff." };
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const name = String(form.get("name") ?? "").trim();
  const password = String(form.get("password") ?? "");
  if (!z.string().email().safeParse(email).success || !name) return { error: "Enter a name and valid email." };
  const problems = passwordProblems(password, email);
  if (problems.length) return { error: `Password needs: ${problems.join("; ")}.` };
  if (await db.adminUser.findUnique({ where: { email } })) return { error: "That email already has an account." };
  await db.adminUser.create({ data: { email, name, passwordHash: await hashPassword(password), role: form.get("role") === "owner" ? "owner" : "staff" } });
  await audit(admin.email, "staff.create", email);
  revalidatePath("/admin/settings");
  return { ok: true, message: `Account created for ${email}.` };
}

export async function changePasswordAction(_prev: State, form: FormData): Promise<State> {
  const admin = await requireAdmin();
  const current = String(form.get("current") ?? "");
  const next = String(form.get("next") ?? "");
  if (!(await bcrypt.compare(current, admin.passwordHash))) return { error: "Current password is incorrect." };
  const problems = passwordProblems(next, admin.email);
  if (problems.length) return { error: `New password needs: ${problems.join("; ")}.` };
  await db.adminUser.update({ where: { id: admin.id }, data: { passwordHash: await hashPassword(next) } });
  await db.session.deleteMany({ where: { adminUserId: admin.id } });
  await audit(admin.email, "staff.change_password");
  redirect("/admin/login");
}
