import type { BlogPost } from "@prisma/client";
import { ActionForm } from "@/components/ActionForm";
import { savePostAction } from "../actions";

function toDateInput(d: Date | null | undefined) {
  return d ? d.toLocaleDateString("en-CA", { timeZone: "America/Halifax" }) : "";
}

export function PostForm({ post }: { post?: BlogPost }) {
  return (
    <ActionForm action={savePostAction.bind(null, post?.id ?? null)} submitLabel={post ? "Save post" : "Create post"} pendingLabel="Saving…" buttonClassName="btn-primary" className="card max-w-3xl space-y-4 p-5">
      <div>
        <label className="label" htmlFor="title">Title</label>
        <input id="title" name="title" required maxLength={160} defaultValue={post?.title} className="input" />
      </div>
      <div>
        <label className="label" htmlFor="slug">Slug</label>
        <div className="flex items-center gap-1 text-sm text-kv-muted">
          /blog/
          <input id="slug" name="slug" maxLength={90} defaultValue={post?.slug} placeholder="auto from title" className="input" />
        </div>
      </div>
      <div>
        <label className="label" htmlFor="excerpt">Excerpt (shown on the blog list)</label>
        <textarea id="excerpt" name="excerpt" rows={2} maxLength={300} defaultValue={post?.excerpt ?? ""} className="input py-2" />
      </div>
      <div>
        <label className="label" htmlFor="body">Body (Markdown)</label>
        <textarea id="body" name="body" required rows={16} defaultValue={post?.body} className="input py-2 font-mono text-sm" />
        <p className="mt-1 text-xs text-kv-muted">Use ## for headings, **bold**, - lists and [links](https://…). HTML is stripped for safety.</p>
      </div>
      <fieldset className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="coverImageUrl">Cover image URL</label>
          <input id="coverImageUrl" name="coverImageUrl" defaultValue={post?.coverImageUrl ?? ""} placeholder="https://…" className="input" />
        </div>
        <div>
          <label className="label" htmlFor="coverFile">…or upload (JPG/PNG/WebP, ≤ 4 MB)</label>
          <input id="coverFile" name="coverFile" type="file" accept="image/jpeg,image/png,image/webp" className="block w-full text-sm" />
        </div>
      </fieldset>
      <fieldset className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="seoTitle">SEO title (≤ 70)</label>
          <input id="seoTitle" name="seoTitle" maxLength={70} defaultValue={post?.seoTitle ?? ""} className="input" />
        </div>
        <div>
          <label className="label" htmlFor="seoDescription">SEO description (≤ 170)</label>
          <input id="seoDescription" name="seoDescription" maxLength={170} defaultValue={post?.seoDescription ?? ""} className="input" />
        </div>
      </fieldset>
      <div className="flex flex-wrap items-end gap-6">
        <label className="flex items-center gap-2 font-semibold text-kv-navy">
          <input type="checkbox" name="published" defaultChecked={post?.published ?? false} className="h-5 w-5" /> Published
        </label>
        <div>
          <label className="label" htmlFor="publishedAt">Publish date</label>
          <input id="publishedAt" name="publishedAt" type="date" defaultValue={toDateInput(post?.publishedAt)} className="input" />
        </div>
      </div>
    </ActionForm>
  );
}
