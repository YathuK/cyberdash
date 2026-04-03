import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const sessionId = request.nextUrl.searchParams.get("sessionId");
  if (!sessionId) return Response.json([]);

  const bookmarks = await prisma.videoBookmark.findMany({
    where: { sessionId },
    orderBy: { createdAt: "desc" },
  });

  return Response.json(bookmarks);
}

export async function POST(request: NextRequest) {
  const { title, url, thumbnail, sessionId } = await request.json();

  if (!title || !url || !sessionId) {
    return Response.json({ error: "Missing required fields" }, { status: 400 });
  }

  const bookmark = await prisma.videoBookmark.create({
    data: { title, url, thumbnail, sessionId },
  });

  return Response.json(bookmark);
}

export async function DELETE(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id");
  if (!id) return Response.json({ error: "Missing id" }, { status: 400 });

  await prisma.videoBookmark.delete({ where: { id } });
  return Response.json({ deleted: true });
}
