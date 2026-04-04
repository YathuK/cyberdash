// Client-side YouTube stream fetcher
// Calls our server API which tries multiple extraction methods

export interface StreamResult {
  stream?: { url: string; mimeType: string; quality: string };
  embedUrl: string;
}

export async function getYouTubeStream(videoId: string): Promise<StreamResult> {
  const embedUrl = `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&playsinline=1&rel=0&modestbranding=1`;

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

    if (data.fallback && data.embedUrl) {
      return { embedUrl: data.embedUrl };
    }
  } catch {
    // Server error
  }

  return { embedUrl };
}
