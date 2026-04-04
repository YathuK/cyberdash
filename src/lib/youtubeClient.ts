// YouTube stream fetcher — tries external proxy first (residential IP),
// then falls back to Vercel server-side extraction

// Hardcoded — NEXT_PUBLIC env vars get replaced at build time and the fallback gets stripped
const PROXY_URL = "https://pal-mens-documentation-dublin.trycloudflare.com";

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
      });
      const text = await res.text();
      // Guard against ngrok HTML warning page
      if (text.startsWith("{")) {
        const data = JSON.parse(text);
        if (data.url) {
          // If URL is relative (from our proxy), make it absolute
          const fullUrl = data.url.startsWith("/") ? `${PROXY_URL}${data.url}` : data.url;
          console.log("[YaVik] Got direct stream via proxy:", data.quality);
          return {
            stream: {
              url: fullUrl,
              mimeType: data.mimeType || "video/mp4",
              quality: data.quality || "360p",
            },
            embedUrl,
          };
        }
      } else {
        console.warn("[YaVik] Proxy returned non-JSON (ngrok warning page?)");
      }
    } catch (err) {
      console.warn("[YaVik] Proxy failed:", err);
    }
  }

  // Fallback to Vercel API
  try {
    const res = await fetch(`/api/youtube/stream?v=${videoId}`);
    const data = await res.json();
    if (data.url) {
      console.log("[YaVik] Got direct stream via Vercel:", data.quality);
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

  console.warn("[YaVik] No direct stream — using embed fallback");
  return { embedUrl };
}

export async function searchYouTube(query: string) {
  if (PROXY_URL) {
    try {
      const res = await fetch(`${PROXY_URL}/search?q=${encodeURIComponent(query)}`, {
      });
      const text = await res.text();
      if (text.startsWith("{")) {
        const data = JSON.parse(text);
        if (data.videos?.length > 0) return data.videos;
      }
    } catch {
      // Proxy search failed
    }
  }

  const res = await fetch(`/api/youtube/search?q=${encodeURIComponent(query)}`);
  const data = await res.json();
  return data.videos || [];
}
