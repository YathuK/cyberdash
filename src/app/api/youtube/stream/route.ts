import { NextRequest } from "next/server";
import ytdl from "@distube/ytdl-core";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  const videoId = request.nextUrl.searchParams.get("v");
  const itag = request.nextUrl.searchParams.get("itag");

  if (!videoId) {
    return new Response("Missing video ID", { status: 400 });
  }

  try {
    const url = `https://www.youtube.com/watch?v=${videoId}`;
    const info = await ytdl.getInfo(url);

    let format;

    if (itag) {
      format = info.formats.find((f) => f.itag === parseInt(itag));
    }

    if (!format) {
      // Try combined (video+audio) first, prefer 720p or lower
      format = info.formats
        .filter((f) => f.hasVideo && f.hasAudio)
        .sort((a, b) => {
          const aH = a.height || 0;
          const bH = b.height || 0;
          // Prefer highest quality that's <= 720p
          if (aH <= 720 && bH <= 720) return bH - aH;
          if (aH <= 720) return -1;
          if (bH <= 720) return 1;
          return aH - bH; // If both > 720, pick lowest
        })[0];
    }

    if (!format) {
      // Fallback: any format with video+audio
      format = info.formats.find((f) => f.hasVideo && f.hasAudio);
    }

    if (!format) {
      // Last resort: any format with video
      format = info.formats.find((f) => f.hasVideo);
    }

    if (!format || !format.url) {
      return new Response("No playable format found", { status: 404 });
    }

    // Proxy the video stream
    const rangeHeader = request.headers.get("range");
    const fetchHeaders: Record<string, string> = {};
    if (rangeHeader) {
      fetchHeaders["Range"] = rangeHeader;
    }

    const videoResponse = await fetch(format.url, { headers: fetchHeaders });

    const responseHeaders = new Headers();
    responseHeaders.set("Content-Type", format.mimeType?.split(";")[0] || "video/mp4");
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
    return new Response(`Stream failed: ${error instanceof Error ? error.message : error}`, { status: 500 });
  }
}
