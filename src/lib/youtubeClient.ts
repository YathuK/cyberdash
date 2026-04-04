// YouTube stream fetcher — tries external proxy first (residential IP),
// then falls back to Vercel server-side extraction

const PROXY_URL = process.env.NEXT_PUBLIC_YT_PROXY_URL || "";

export interface StreamResult {
  stream?: { url: string; mimeType: string; quality: string };
  embedUrl: string;
}

export async function getYouTubeStream(videoId: string): Promise<StreamResult> {
  const embedUrl = `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&playsinline=1&rel=0&modestbranding=1`;

  // Try external proxy first (residential IP — works for all videos)
  if (PROXY_URL) {
    try {
      const res = await fetch(`${PROXY_URL}/stream?v=${videoId}`, {
        headers: { "ngrok-skip-browser-warning": "1" },
      });
      const data = await res.json();
      if (data.url) {
        return {
          stream: {
            url: data.url,
            mimeType: data.mimeType || "video/mp4",
            quality: data.quality || "360p",
          },
          embedUrl,
        };
      }
    } catch {
      // Proxy failed, try Vercel
    }
  }

  // Fallback to Vercel API
  try {
    const res = await fetch(`/api/youtube/stream?v=${videoId}`);
    const data = await res.json();
    if (data.url) {
      return {
        stream: {
          url: data.url,
          mimeType: data.mimeType || "video/mp4",
          quality: data.quality || "360p",
        },
        embedUrl,
      };
    }
  } catch {
    // Server failed too
  }

  return { embedUrl };
}

export async function searchYouTube(query: string) {
  // Try proxy first for search too
  if (PROXY_URL) {
    try {
      const res = await fetch(`${PROXY_URL}/search?q=${encodeURIComponent(query)}`, {
        headers: { "ngrok-skip-browser-warning": "1" },
      });
      const data = await res.json();
      if (data.videos?.length > 0) return data.videos;
    } catch {
      // Proxy search failed
    }
  }

  // Fallback to Vercel
  const res = await fetch(`/api/youtube/search?q=${encodeURIComponent(query)}`);
  const data = await res.json();
  return data.videos || [];
}
