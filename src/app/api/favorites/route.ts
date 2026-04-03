import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const sessionId = request.nextUrl.searchParams.get("sessionId");
  if (!sessionId) return Response.json([]);

  const favorites = await prisma.favorite.findMany({
    where: { sessionId },
    include: { app: true },
    orderBy: { createdAt: "desc" },
  });

  return Response.json(favorites);
}

export async function POST(request: NextRequest) {
  const { appId, sessionId } = await request.json();

  if (!appId || !sessionId) {
    return Response.json({ error: "Missing appId or sessionId" }, { status: 400 });
  }

  const existing = await prisma.favorite.findUnique({
    where: { appId_sessionId: { appId, sessionId } },
  });

  if (existing) {
    await prisma.favorite.delete({ where: { id: existing.id } });
    return Response.json({ removed: true });
  }

  const favorite = await prisma.favorite.create({
    data: { appId, sessionId },
    include: { app: true },
  });

  return Response.json(favorite);
}
