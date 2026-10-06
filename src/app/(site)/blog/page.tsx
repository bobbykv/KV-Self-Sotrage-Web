import type { Metadata } from "next";
import Link from "next/link";
import { getPublishedPosts } from "@/lib/cms";
import { excerptOf } from "@/lib/markdown";

export const metadata: Metadata = {
  title: "Storage Tips for Your Next Move",
  description: "Moving, packing and storage tips from the KV Self Storage team.",
};

export default async function BlogIndex() {
  const posts = await getPublishedPosts();
  return (
    <div className="container-kv max-w-4xl py-10 sm:py-16">
      <p className="eyebrow">Storage tips</p>
      <h1 className="h1 mt-2">A little guidance for your next move</h1>
      {posts.length === 0 ? (
        <div className="mt-6 rounded-2xl bg-kv-navy-50 p-6"><p className="text-kv-muted">Planning where everything will go? Start with the size guide, or tell us what you&apos;re storing and we&apos;ll help.</p><div className="mt-4 flex flex-wrap gap-3"><Link href="/size-finder" className="btn-primary">Help me choose a size</Link><Link href="/contact" className="btn-ghost">Ask for help</Link></div></div>
      ) : (
        <div className="mt-8 grid gap-6 sm:grid-cols-2">
          {posts.map((p) => (
            <article key={p.id} className="card overflow-hidden">
              {p.coverImageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.coverImageUrl} alt="" className="aspect-[16/9] w-full object-cover" />
              )}
              <div className="p-5">
                <p className="text-xs text-kv-muted">{p.publishedAt?.toLocaleDateString("en-CA", { dateStyle: "long" })}</p>
                <h2 className="mt-1 text-xl font-extrabold text-kv-navy">
                  <Link href={`/blog/${p.slug}`} className="hover:text-kv-red">
                    {p.title}
                  </Link>
                </h2>
                <p className="mt-2 text-sm text-kv-muted">{p.excerpt || excerptOf(p.body)}</p>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
