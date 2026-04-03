"use client";

import { useState } from "react";

export default function VideoPlayer({
  onOpenViewer,
}: {
  onOpenViewer: (name: string, url: string) => void;
}) {
  const [url, setUrl] = useState("");

  const getEmbedUrl = (input: string): { name: string; url: string } | null => {
    try {
      const u = new URL(input);

      // YouTube
      if (u.hostname.includes("youtube.com") || u.hostname.includes("youtu.be")) {
        const videoId = u.hostname.includes("youtu.be")
          ? u.pathname.slice(1)
          : u.searchParams.get("v");
        if (videoId) {
          return {
            name: "YouTube",
            url: `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&playsinline=1&rel=0&modestbranding=1`,
          };
        }
      }

      // Twitch
      if (u.hostname.includes("twitch.tv")) {
        const parts = u.pathname.split("/").filter(Boolean);
        if (parts[1] === "videos" && parts[2]) {
          return {
            name: "Twitch VOD",
            url: `https://player.twitch.tv/?video=${parts[2]}&parent=${window.location.hostname}&autoplay=true`,
          };
        }
        if (parts[0]) {
          return {
            name: `Twitch - ${parts[0]}`,
            url: `https://player.twitch.tv/?channel=${parts[0]}&parent=${window.location.hostname}&autoplay=true`,
          };
        }
      }

      // Direct video URL — open in a simple page
      if (/\.(mp4|webm|ogv|ogg)(\?|$)/i.test(input)) {
        return { name: "Video", url: input };
      }

      // Any other URL - open as-is
      return { name: "Video", url: input };
    } catch {
      return null;
    }
  };

  const handlePlay = () => {
    const result = getEmbedUrl(url.trim());
    if (result) {
      onOpenViewer(result.name, result.url);
      setUrl("");
    }
  };

  return (
    <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
      <input
        type="text"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && handlePlay()}
        placeholder="Paste YouTube or video URL..."
        style={{
          flex: 1,
          background: "rgba(31,41,55,0.6)",
          border: "1px solid rgba(75,85,99,0.4)",
          borderRadius: 12,
          padding: "10px 14px",
          color: "#fff",
          fontSize: 14,
          outline: "none",
          minHeight: 44,
          boxSizing: "border-box",
        }}
      />
      <button
        onClick={handlePlay}
        disabled={!url.trim()}
        style={{
          padding: "10px 20px",
          background: url.trim() ? "var(--cyan-dim)" : "rgba(31,41,55,0.4)",
          color: url.trim() ? "var(--cyan)" : "#4b5563",
          border: url.trim() ? "1px solid var(--cyan-border)" : "1px solid rgba(75,85,99,0.3)",
          borderRadius: 12,
          fontSize: 14,
          fontWeight: 600,
          cursor: url.trim() ? "pointer" : "default",
          minHeight: 44,
          minWidth: 72,
          whiteSpace: "nowrap",
        }}
      >
        ▶ Play
      </button>
    </div>
  );
}
