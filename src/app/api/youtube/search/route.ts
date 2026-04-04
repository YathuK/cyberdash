import { NextRequest } from "next/server";
import { getInnertubeWeb } from "@/lib/youtube";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q");

  if (!query) {
    return Response.json({ error: "Missing search query" }, { status: 400 });
  }

  try {
    const yt = await getInnertubeWeb();
    const results = await yt.search(query, { type: "video" });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const videos = (results.results || [] as any[])
      .filter((item) => item.type === "Video")
      .slice(0, 20)
      .map((item) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const video = item as any;
        return {
          id: video.id || "",
          title: video.title?.text || video.title?.toString() || "",
          thumbnail: video.thumbnails?.[0]?.url || "",
          author: video.author?.name || "",
          duration: video.duration?.text || "",
          views: video.short_view_count?.text || "",
        };
      });

    return Response.json({ videos });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("YouTube search error:", msg);
    return Response.json({ error: "Search failed", details: msg }, { status: 500 });
  }
}
