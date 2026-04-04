import { NextRequest } from "next/server";
import { getInnertube } from "@/lib/youtube";

export async function GET(request: NextRequest) {
  const videoId = request.nextUrl.searchParams.get("v");

  if (!videoId) {
    return Response.json({ error: "Missing video ID" }, { status: 400 });
  }

  try {
    const yt = await getInnertube();
    const info = await yt.getBasicInfo(videoId);

    const streamingData = info.streaming_data;
    if (!streamingData) {
      // Server can't get streaming data (likely IP blocked by YouTube)
      // Return a fallback embed URL instead — the client will use this
      return Response.json({
        fallback: true,
        embedUrl: `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&playsinline=1&rel=0&modestbranding=1`,
      });
    }

    const allCombined = (streamingData.formats || []).filter((f) => f.has_video && f.has_audio);
    const mp4Format = allCombined
      .filter((f) => f.mime_type?.includes("video/mp4"))
      .sort((a, b) => {
        const aH = a.height || 0;
        const bH = b.height || 0;
        if (aH <= 720 && bH <= 720) return bH - aH;
        if (aH <= 720) return -1;
        if (bH <= 720) return 1;
        return aH - bH;
      })[0];

    const format = mp4Format || allCombined[0];

    if (!format) {
      return Response.json({
        fallback: true,
        embedUrl: `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&playsinline=1&rel=0&modestbranding=1`,
      });
    }

    const streamUrl = await format.decipher(yt.session.player);

    if (!streamUrl) {
      return Response.json({
        fallback: true,
        embedUrl: `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&playsinline=1&rel=0&modestbranding=1`,
      });
    }

    return Response.json({
      url: streamUrl,
      mimeType: format.mime_type,
      quality: format.quality_label,
      width: format.width,
      height: format.height,
    });
  } catch (error) {
    console.error("YouTube stream error:", error);
    // On any error, fall back to embed
    return Response.json({
      fallback: true,
      embedUrl: `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&playsinline=1&rel=0&modestbranding=1`,
    });
  }
}
