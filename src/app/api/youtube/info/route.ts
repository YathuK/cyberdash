import { NextRequest } from "next/server";
import ytdl from "@distube/ytdl-core";

export async function GET(request: NextRequest) {
  const videoId = request.nextUrl.searchParams.get("v");

  if (!videoId) {
    return Response.json({ error: "Missing video ID" }, { status: 400 });
  }

  try {
    const url = `https://www.youtube.com/watch?v=${videoId}`;
    const info = await ytdl.getInfo(url);

    // Get all available formats
    const formats = info.formats
      .filter((f) => f.hasVideo)
      .map((f) => ({
        itag: f.itag,
        mimeType: f.mimeType,
        quality: f.qualityLabel,
        width: f.width,
        height: f.height,
        hasAudio: f.hasAudio,
        container: f.container,
      }));

    return Response.json({
      title: info.videoDetails.title,
      author: info.videoDetails.author.name,
      lengthSeconds: info.videoDetails.lengthSeconds,
      thumbnail: info.videoDetails.thumbnails.pop()?.url,
      formats,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("YouTube info error:", msg);
    return Response.json(
      { error: "Failed to get video info", details: msg },
      { status: 500 }
    );
  }
}
