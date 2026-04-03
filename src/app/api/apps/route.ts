import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const category = request.nextUrl.searchParams.get("category");

  const where = category ? { category } : {};
  const apps = await prisma.app.findMany({
    where,
    orderBy: { order: "asc" },
  });

  return Response.json(apps);
}
