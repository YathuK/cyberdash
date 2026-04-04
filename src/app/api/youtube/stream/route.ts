import { NextRequest } from "next/server";
import { getInnertube } from "@/lib/youtube";

const INNERTUBE_API = "https://www.youtube.com/youtubei/v1/player";
const API_KEY = "AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8";

// Try multiple client types to find one YouTube doesn't block
const CLIENTS = [
  {
    name: "IOS",
    body: {
      context: {
        client: {
          clientName: "IOS",
          clientVersion: "19.29.1",
          deviceMake: "Apple",
          deviceModel: "iPhone16,2",
          hl: "en",
          osName: "iPhone",
          osVersion: "17.5.1.21F90",
        },
      },
      contentCheckOk: true,
      racyCheckOk: true,
    },
  },
  {
    name: "ANDROID",
    body: {
      context: {
        client: {
          clientName: "ANDROID",
          clientVersion: "19.09.37",
          androidSdkVersion: 30,
          hl: "en",
          gl: "US",
        },
      },
      contentCheckOk: true,
      racyCheckOk: true,
    },
  },
  {
    name: "TV_EMBEDDED",
    body: {
      context: {
        client: {
          clientName: "TVHTML5_SIMPLY_EMBEDDED_PLAYER",
          clientVersion: "2.0",
        },
        thirdParty: { embedUrl: "https://www.google.com" },
      },
      contentCheckOk: true,
      racyCheckOk: true,
    },
  },
];

async function tryInnertubeClients(videoId: string): Promise<{ url: string; mimeType: string; quality: string } | null> {
  for (const client of CLIENTS) {
    try {
      const res = await fetch(`${INNERTUBE_API}?key=${API_KEY}&prettyPrint=false`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "Mozilla/5.0",
        },
        body: JSON.stringify({ ...client.body, videoId }),
      });

      if (!res.ok) continue;
      const data = await res.json();
      const formats = data.streamingData?.formats || [];

      // Find MP4 combined format
      const mp4 = formats
        .filter((f: { mimeType?: string; url?: string }) => f.mimeType?.includes("video/mp4") && f.url)
        .sort((a: { height?: number }, b: { height?: number }) => {
          const aH = a.height || 0;
          const bH = b.height || 0;
          if (aH <= 720 && bH <= 720) return bH - aH;
          return aH - bH;
        })[0];

      const format = mp4 || formats.find((f: { url?: string }) => f.url);
      if (format?.url) {
        return {
          url: format.url,
          mimeType: format.mimeType || "video/mp4",
          quality: format.qualityLabel || "360p",
        };
      }
    } catch {
      continue;
    }
  }
  return null;
}

export async function GET(request: NextRequest) {
  const videoId = request.nextUrl.searchParams.get("v");
  if (!videoId) {
    return Response.json({ error: "Missing video ID" }, { status: 400 });
  }

  const fallbackEmbed = `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&playsinline=1&rel=0&modestbranding=1`;

  try {
    // Method 1: Try raw innertube API with multiple clients
    const innertubeResult = await tryInnertubeClients(videoId);
    if (innertubeResult) {
      return Response.json(innertubeResult);
    }

    // Method 2: Try youtubei.js library
    try {
      const yt = await getInnertube();
      const info = await yt.getBasicInfo(videoId);
      const allCombined = (info.streaming_data?.formats || []).filter((f) => f.has_video && f.has_audio);
      const mp4 = allCombined.filter((f) => f.mime_type?.includes("video/mp4"));
      const format = mp4[0] || allCombined[0];

      if (format) {
        const streamUrl = await format.decipher(yt.session.player);
        if (streamUrl) {
          return Response.json({
            url: streamUrl,
            mimeType: format.mime_type || "video/mp4",
            quality: format.quality_label || "360p",
          });
        }
      }
    } catch {
      // youtubei.js also failed
    }

    // All methods failed — return embed fallback
    return Response.json({ fallback: true, embedUrl: fallbackEmbed });
  } catch (error) {
    console.error("YouTube stream error:", error);
    return Response.json({ fallback: true, embedUrl: fallbackEmbed });
  }
}
