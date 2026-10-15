// YouTube stream fetcher

const PROXY_URL = "https://yavik-proxy.ineffableconstruction.ca";

export interface StreamResult {
  stream?: { url: string; audioUrl?: string; mimeType: string; quality: string };
  embedUrl: string;
}

export async function getYouTubeStream(videoId: string): Promise<StreamResult> {
  const embedUrl = `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&playsinline=1&rel=0&modestbranding=1`;

  // Retry the proxy a few times before giving up: a tunnel blip or cold
  // yt-dlp resolve shouldn't drop us to the embed, which Tesla can't play.
  for (let attempt = 0; PROXY_URL && attempt < 3; attempt++) {
    if (attempt > 0) await new Promise(r => setTimeout(r, 1500 * attempt));
    try {
      const res = await fetch(`${PROXY_URL}/stream?v=${videoId}`, { signal: AbortSignal.timeout(60000) });
      const text = await res.text();

      if (text.startsWith("{")) {
        const data = JSON.parse(text);
        if (data.url) {
          const fullUrl = data.url.startsWith("/") ? `${PROXY_URL}${data.url}` : data.url;
          const fullAudioUrl = data.audioUrl
            ? (data.audioUrl.startsWith("/") ? `${PROXY_URL}${data.audioUrl}` : data.audioUrl)
            : fullUrl;
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
        // Proxy resolved the video and found it unplayable; retrying won't help.
        if (data.fallback) break;
      }
    } catch (err) {
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
