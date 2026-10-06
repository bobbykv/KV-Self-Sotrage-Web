import { PageHeader } from "@/components/admin/LocationSwitcher";
import { PostForm } from "../PostForm";

export const metadata = { title: "New post" };

export default function NewPost() {
  return (
    <>
      <PageHeader title="New blog post" />
      <PostForm />
    </>
  );
}
