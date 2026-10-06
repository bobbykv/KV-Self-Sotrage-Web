import Link from "next/link";
import { PageHeader, StatusBadge } from "@/components/admin/LocationSwitcher";
import { db } from "@/lib/db";
import { deletePostAction, setPostPublishedAction } from "../actions";

export const metadata = { title: "Blog" };

export default async function AdminBlog({ searchParams }: { searchParams: Promise<{ saved?: string }> }) {
  const { saved } = await searchParams;
  const posts = await db.blogPost.findMany({ orderBy: [{ published: "asc" }, { updatedAt: "desc" }] });
  return (
    <>
      <PageHeader title="Blog">
        <Link href="/admin/blog/new" className="btn-primary btn-sm">
          New post
        </Link>
      </PageHeader>
      {saved && <p className="mb-4 rounded-xl bg-kv-navy-50 p-3 text-sm font-semibold text-kv-navy">Post saved.</p>}
      {!posts.length && <p className="text-sm text-kv-muted">No posts yet.</p>}
      <div className="grid gap-3">
        {posts.map((p) => (
          <article key={p.id} className="card flex flex-wrap items-center justify-between gap-3 p-4">
            <div>
              <p className="font-bold text-kv-navy">
                {p.title} <StatusBadge status={p.published ? "published" : "draft"} />
              </p>
              <p className="text-sm text-kv-muted">
                /blog/{p.slug} · updated {p.updatedAt.toLocaleDateString("en-CA", { timeZone: "America/Halifax" })}
                {p.publishedAt && ` · published ${p.publishedAt.toLocaleDateString("en-CA", { timeZone: "America/Halifax" })}`}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {p.published && (
                <a href={`/blog/${p.slug}`} target="_blank" rel="noopener noreferrer" className="btn-ghost btn-sm">
                  View
                </a>
              )}
              <Link href={`/admin/blog/${p.id}`} className="btn-ghost btn-sm">
                Edit
              </Link>
              <form action={setPostPublishedAction.bind(null, p.id, !p.published)}>
                <button className="btn-navy btn-sm">{p.published ? "Unpublish" : "Publish"}</button>
              </form>
              <form action={deletePostAction.bind(null, p.id)}>
                <button className="btn-ghost btn-sm text-kv-red">Delete</button>
              </form>
            </div>
          </article>
        ))}
      </div>
    </>
  );
}
