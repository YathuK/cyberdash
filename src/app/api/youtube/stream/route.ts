import { NextRequest } from "next/server";
import { getInnertube } from "@/lib/youtube";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  const videoId = request.nextUrl.searchParams.get("v");
  const requestedItag = request.nextUrl.searchParams.get("itag");

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

    // Find the best combined (video+audio) format
    const allFormats = [
      ...(streamingData.formats || []),
      ...(streamingData.adaptive_formats || []),
    ];

    let format;

    if (requestedItag) {
      format = allFormats.find((f) => f.itag === parseInt(requestedItag));
    }

    if (!format) {
      // Prefer combined formats (has both video and audio)
      format = (streamingData.formats || [])
        .filter((f) => f.has_video && f.has_audio)
        .sort((a, b) => {
          const aH = a.height || 0;
          const bH = b.height || 0;
          if (aH <= 720 && bH <= 720) return bH - aH;
          if (aH <= 720) return -1;
          if (bH <= 720) return 1;
          return aH - bH;
        })[0];
    }

    if (!format) {
      // Fallback to any format with video
      format = allFormats.find((f) => f.has_video && f.has_audio);
    }

    if (!format) {
      format = allFormats.find((f) => f.has_video);
    }

    if (!format) {
      return new Response("No playable format found", { status: 404 });
    }

    // Get the stream URL - youtubei.js decipher method
    const streamUrl = await format.decipher(yt.session.player);

    if (!streamUrl) {
      return new Response("Could not decipher stream URL", { status: 500 });
    }

    // Proxy the stream
    const rangeHeader = request.headers.get("range");
    const fetchHeaders: Record<string, string> = {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0",
    };
    if (rangeHeader) {
      fetchHeaders["Range"] = rangeHeader;
    }

    const videoResponse = await fetch(streamUrl, { headers: fetchHeaders });

    const responseHeaders = new Headers();
    responseHeaders.set("Content-Type", format.mime_type?.split(";")[0] || "video/mp4");
    responseHeaders.set("Access-Control-Allow-Origin", "*");
    responseHeaders.set("Accept-Ranges", "bytes");
    responseHeaders.set("Cache-Control", "public, max-age=3600");

    const contentLength = videoResponse.headers.get("content-length");
    if (contentLength) responseHeaders.set("Content-Length", contentLength);

    const contentRange = videoResponse.headers.get("content-range");
    if (contentRange) responseHeaders.set("Content-Range", contentRange);

    return new Response(videoResponse.body, {
      status: videoResponse.status,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error("YouTube stream error:", error);
    return new Response(
      `Stream failed: ${error instanceof Error ? error.message : error}`,
      { status: 500 }
    );
  }
}
