import { NextRequest } from "next/server";
import ytdl from "@distube/ytdl-core";

export const runtime = "nodejs";
// Allow longer streaming for video
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  const videoId = request.nextUrl.searchParams.get("v");
  const itag = request.nextUrl.searchParams.get("itag");

  if (!videoId) {
    return new Response("Missing video ID", { status: 400 });
  }

  try {
    const url = `https://www.youtube.com/watch?v=${videoId}`;

    const options: Parameters<typeof ytdl>[1] = {};
    if (itag) {
      options.filter = (format) => format.itag === parseInt(itag);
    } else {
      // Default: get best quality with audio that's 720p or lower
      options.quality = "highest";
      options.filter = (format) =>
        format.hasVideo && format.hasAudio && (format.height || 0) <= 720;
    }

    const info = await ytdl.getInfo(url);
    const format = ytdl.chooseFormat(info.formats, options);

    if (!format) {
      return new Response("No suitable format found", { status: 404 });
    }

    // Fetch the actual video stream from YouTube
    const rangeHeader = request.headers.get("range");
    const headers: Record<string, string> = {};
    if (rangeHeader) {
      headers["Range"] = rangeHeader;
    }

    const videoResponse = await fetch(format.url, { headers });

    // Forward the response with CORS headers
    const responseHeaders = new Headers();
    responseHeaders.set("Content-Type", format.mimeType?.split(";")[0] || "video/mp4");
    responseHeaders.set("Access-Control-Allow-Origin", "*");
    responseHeaders.set("Accept-Ranges", "bytes");

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
    return new Response("Stream failed", { status: 500 });
  }
}
