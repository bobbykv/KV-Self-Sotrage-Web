import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPublishedPost } from "@/lib/cms";
import { excerptOf, renderMarkdown } from "@/lib/markdown";

type Params = { slug: string };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const post = await getPublishedPost((await params).slug);
  if (!post) return { title: "Post not found" };
  return {
    title: post.seoTitle || post.title,
    description: post.seoDescription || post.excerpt || excerptOf(post.body, 155),
    openGraph: { type: "article", images: post.coverImageUrl ? [post.coverImageUrl] : undefined },
  };
}

export default async function BlogPost({ params }: { params: Promise<Params> }) {
  const post = await getPublishedPost((await params).slug);
  if (!post) notFound();
  return (
    <article className="container-kv max-w-3xl py-10 sm:py-16">
      <Link href="/blog" className="text-sm font-semibold text-kv-navy hover:text-kv-red">
        ← All posts
      </Link>
      <p className="mt-6 text-sm text-kv-muted">{post.publishedAt?.toLocaleDateString("en-CA", { dateStyle: "long" })}</p>
      <h1 className="h1 mt-1">{post.title}</h1>
      {post.coverImageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={post.coverImageUrl} alt="" className="mt-6 aspect-[16/9] w-full rounded-3xl object-cover" />
      )}
      <div className="prose-kv mt-8" dangerouslySetInnerHTML={{ __html: renderMarkdown(post.body) }} />
      <div className="mt-12 rounded-3xl bg-kv-navy-50 p-6">
        <p className="font-bold text-kv-navy">Need storage in Antigonish or Pictou County?</p>
        <Link href="/units" className="btn-primary mt-3">
          See what&apos;s open
        </Link>
      </div>
    </article>
  );
}
