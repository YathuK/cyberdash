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

    const allFormats = [
      ...(streamingData.formats || []),
      ...(streamingData.adaptive_formats || []),
    ];

    let format;

    if (requestedItag) {
      format = allFormats.find((f) => f.itag === parseInt(requestedItag));
    }

    if (!format) {
      // MUST use MP4 (H.264) — this is the only format guaranteed to work
      // on all browsers including Tesla's Chromium. WebM/VP9 may not be supported.
      format = (streamingData.formats || [])
        .filter((f) => f.has_video && f.has_audio && f.mime_type?.includes("video/mp4"))
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
      // Fallback: any MP4 with video+audio
      format = allFormats.find((f) => f.has_video && f.has_audio && f.mime_type?.includes("video/mp4"));
    }

    if (!format) {
      // Fallback: any combined format (even WebM)
      format = (streamingData.formats || []).find((f) => f.has_video && f.has_audio);
    }

    if (!format) {
      return new Response("No playable MP4 format found", { status: 404 });
    }

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
    // Always report as video/mp4 for maximum browser compat
    responseHeaders.set("Content-Type", "video/mp4");
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
