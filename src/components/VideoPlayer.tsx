"use client";

import { useState } from "react";
import { getYouTubeEmbedUrl, getTwitchEmbedUrl } from "@/lib/appConfig";

export default function VideoPlayer({
  onOpenViewer,
}: {
  onOpenViewer: (name: string, url: string) => void;
}) {
  const [url, setUrl] = useState("");

  const handlePlay = () => {
    const input = url.trim();
    if (!input) return;

    // YouTube → use embed URL (works in iframe)
    const ytEmbed = getYouTubeEmbedUrl(input);
    if (ytEmbed) {
      onOpenViewer("YouTube", ytEmbed);
      setUrl("");
      return;
    }

    // Twitch → use embed player (works in iframe)
    const twitchEmbed = getTwitchEmbedUrl(input, window.location.hostname);
    if (twitchEmbed) {
      onOpenViewer("Twitch", twitchEmbed);
      setUrl("");
      return;
    }

    // Direct video file → open in viewer
    if (/\.(mp4|webm|ogv|ogg)(\?|$)/i.test(input)) {
      onOpenViewer("Video", input);
      setUrl("");
      return;
    }

    // Anything else → open directly in browser
    window.location.href = input;
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
