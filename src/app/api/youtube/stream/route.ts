import { NextRequest } from "next/server";
import { getInnertube } from "@/lib/youtube";

export async function GET(request: NextRequest) {
  const videoId = request.nextUrl.searchParams.get("v");

  if (!videoId) {
    return new Response("Missing video ID", { status: 400 });
  }

  try {
    const yt = await getInnertube();
    const info = await yt.getBasicInfo(videoId);

    const streamingData = info.streaming_data;
    if (!streamingData) {
      return new Response("No streaming data", { status: 404 });
    }

    // Find best MP4 combined format (video + audio)
    let format = (streamingData.formats || [])
      .filter((f) => f.has_video && f.has_audio && f.mime_type?.includes("video/mp4"))
      .sort((a, b) => {
        const aH = a.height || 0;
        const bH = b.height || 0;
        if (aH <= 720 && bH <= 720) return bH - aH;
        if (aH <= 720) return -1;
        if (bH <= 720) return 1;
        return aH - bH;
      })[0];

    if (!format) {
      // Fallback: any combined format
      format = (streamingData.formats || []).find((f) => f.has_video && f.has_audio);
    }

    if (!format) {
      return Response.json({ error: "No playable format found" }, { status: 404 });
    }

    // Decipher the URL and redirect the client directly to YouTube's CDN
    // This avoids Vercel function timeout issues from proxying large video files
    const streamUrl = await format.decipher(yt.session.player);

    if (!streamUrl) {
      return Response.json({ error: "Could not decipher stream URL" }, { status: 500 });
    }

    // Return the direct URL — the client <video> element will fetch from YouTube's CDN
    return Response.json({
      url: streamUrl,
      mimeType: format.mime_type,
      quality: format.quality_label,
      width: format.width,
      height: format.height,
    });
  } catch (error) {
    console.error("YouTube stream error:", error);
    return Response.json(
      { error: `Stream failed: ${error instanceof Error ? error.message : error}` },
      { status: 500 }
    );
  }
}
