import type { Metadata } from "next";
import Link from "next/link";
import { getPublishedPosts } from "@/lib/cms";
import { excerptOf } from "@/lib/markdown";

export const metadata: Metadata = {
  title: "Storage Tips | KV Self Storage Antigonish and Stellarton",
  description: "Tips for choosing a storage size, packing your unit and storing between moves or school terms.",
};

export default async function BlogIndex() {
  const posts = await getPublishedPosts();
  return (
    <div className="container-kv max-w-4xl py-10 sm:py-16">
      <h1 className="h1 mt-2">Self storage tips for Antigonish and Stellarton</h1>
      <p className="mt-3 text-kv-muted">Help with choosing a size, packing your unit and getting ready to move.</p>
      {posts.length === 0 ? (
        <div className="mt-6 rounded-2xl bg-kv-navy-50 p-6">
          <p className="text-kv-muted">No storage tips have been posted yet. Need help now? Call (902) 867-3779.</p>
        </div>
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
                <Link href={`/blog/${p.slug}`} className="mt-3 inline-block text-sm font-semibold text-kv-red">
                  Read more
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
