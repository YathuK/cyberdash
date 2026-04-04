// YouTube stream fetcher

const PROXY_URL = "https://theoretical-partition-unified-stored.trycloudflare.com";

export interface StreamResult {
  stream?: { url: string; audioUrl?: string; mimeType: string; quality: string };
  embedUrl: string;
}

export async function getYouTubeStream(videoId: string): Promise<StreamResult> {
  const embedUrl = `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&playsinline=1&rel=0&modestbranding=1`;

  if (PROXY_URL) {
    try {
      console.log("[YaVik] Fetching stream from:", PROXY_URL);
      const res = await fetch(`${PROXY_URL}/stream?v=${videoId}`);
      console.log("[YaVik] Stream response status:", res.status);
      const text = await res.text();
      console.log("[YaVik] Stream response:", text.substring(0, 100));

      if (text.startsWith("{")) {
        const data = JSON.parse(text);
        if (data.url) {
          const fullUrl = data.url.startsWith("/") ? `${PROXY_URL}${data.url}` : data.url;
          const fullAudioUrl = data.audioUrl
            ? (data.audioUrl.startsWith("/") ? `${PROXY_URL}${data.audioUrl}` : data.audioUrl)
            : fullUrl;
          console.log("[YaVik] Stream URL:", fullUrl.substring(0, 60));
          console.log("[YaVik] Audio URL:", fullAudioUrl.substring(0, 60));
          return {
            stream: {
              url: fullUrl,
              audioUrl: fullAudioUrl,
              mimeType: data.mimeType || "video/mp4",
              quality: data.quality || "720p",
            },
            embedUrl,
          };
        }
      }
      console.warn("[YaVik] Proxy returned non-stream response");
    } catch (err) {
      console.warn("[YaVik] Proxy failed:", err);
    }
  }

  // Fallback to Vercel API
  try {
    const res = await fetch(`/api/youtube/stream?v=${videoId}`);
    const data = await res.json();
    if (data.url) {
      return {
        stream: { url: data.url, mimeType: data.mimeType || "video/mp4", quality: data.quality || "360p" },
        embedUrl,
      };
    }
  } catch { /* Vercel failed too */ }

  return { embedUrl };
}

export async function searchYouTube(query: string) {
  if (PROXY_URL) {
    try {
      const res = await fetch(`${PROXY_URL}/search?q=${encodeURIComponent(query)}`);
      const text = await res.text();
      if (text.startsWith("{")) {
        const data = JSON.parse(text);
        if (data.videos?.length > 0) return data.videos;
      }
    } catch { /* proxy search failed */ }
  }

  const res = await fetch(`/api/youtube/search?q=${encodeURIComponent(query)}`);
  const data = await res.json();
  return data.videos || [];
}
