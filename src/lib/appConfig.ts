// How each app should be opened in the Tesla browser
//
// "embed" = loads in an iframe inside CyberDash (stays on cyberdash page)
// "direct" = navigates the browser tab to the site (leaves CyberDash)
//
// Most major streaming sites block iframe embedding via X-Frame-Options.
// For those we open directly in the Tesla browser — this still works while
// driving because Tesla only restricts its own native apps, not the browser.

export type OpenMode = "embed" | "direct";

const appOpenMode: Record<string, OpenMode> = {
  // These have dedicated embed/player URLs that work in iframes
  twitch: "embed",
  games: "embed",    // CrazyGames allows embedding
  spotify: "embed",  // Spotify open.spotify.com works in iframe

  // These block iframes — must open directly
  youtube: "direct",
  netflix: "direct",
  prime: "direct",
  disney: "direct",
  plex: "direct",
  xbox: "direct",
  nvidia: "direct",
  luna: "direct",
  maps: "direct",
  reddit: "direct",
  twitter: "direct",
  weather: "direct",
};

export function getOpenMode(icon: string): OpenMode {
  return appOpenMode[icon] || "direct";
}

// For YouTube URLs pasted into the video player, we convert to embed URLs
// which DO work in iframes (youtube-nocookie.com/embed/...)
export function getYouTubeEmbedUrl(input: string): string | null {
  try {
    const u = new URL(input);
    if (u.hostname.includes("youtube.com") || u.hostname.includes("youtu.be")) {
      const videoId = u.hostname.includes("youtu.be")
        ? u.pathname.slice(1)
        : u.searchParams.get("v");
      if (videoId) {
        return `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&playsinline=1&rel=0&modestbranding=1`;
      }
    }
  } catch {
    // not a valid URL
  }
  return null;
}

export function getTwitchEmbedUrl(input: string, hostname: string): string | null {
  try {
    const u = new URL(input);
    if (u.hostname.includes("twitch.tv")) {
      const parts = u.pathname.split("/").filter(Boolean);
      if (parts[1] === "videos" && parts[2]) {
        return `https://player.twitch.tv/?video=${parts[2]}&parent=${hostname}&autoplay=true`;
      }
      if (parts[0]) {
        return `https://player.twitch.tv/?channel=${parts[0]}&parent=${hostname}&autoplay=true`;
      }
    }
  } catch {
    // not a valid URL
  }
  return null;
}
