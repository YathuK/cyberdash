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

    // Get formats that work for canvas playback
    // Prefer WebM (for OGV.js) and MP4 (for fallback)
    const formats = info.formats
      .filter((f) => f.hasVideo && f.hasAudio)
      .map((f) => ({
        itag: f.itag,
        mimeType: f.mimeType,
        quality: f.qualityLabel,
        width: f.width,
        height: f.height,
        contentLength: f.contentLength,
        container: f.container,
      }))
      .sort((a, b) => {
        // Prefer 720p or lower for Tesla browser performance
        const aHeight = a.height || 0;
        const bHeight = b.height || 0;
        const aScore = aHeight <= 720 ? aHeight : -(aHeight);
        const bScore = bHeight <= 720 ? bHeight : -(bHeight);
        return bScore - aScore;
      });

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
