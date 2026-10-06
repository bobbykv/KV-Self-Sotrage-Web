import { notFound } from "next/navigation";
import { PageHeader } from "@/components/admin/LocationSwitcher";
import { db } from "@/lib/db";
import { PostForm } from "../PostForm";

export const metadata = { title: "Edit post" };

export default async function EditPost({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const post = await db.blogPost.findUnique({ where: { id } });
  if (!post) notFound();
  return (
    <>
      <PageHeader title="Edit blog post" />
      <PostForm post={post} />
    </>
  );
}
