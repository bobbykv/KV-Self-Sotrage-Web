import { NextResponse } from "next/server";
import { getAdmin } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const upload = await db.upload.findUnique({ where: { id } });
  if (!upload) return new NextResponse("Not found", { status: 404 });
  if (!upload.isPublic && !(await getAdmin())) return new NextResponse("Not found", { status: 404 });
  return new NextResponse(new Uint8Array(upload.bytes), {
    headers: {
      "Content-Type": upload.mime,
      "Cache-Control": upload.isPublic ? "public, max-age=31536000, immutable" : "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
