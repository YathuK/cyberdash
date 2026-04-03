"use client";

import { useState } from "react";

function extractYouTubeId(input: string): string | null {
  try {
    const u = new URL(input);
    if (u.hostname.includes("youtu.be")) return u.pathname.slice(1).split("/")[0];
    if (u.hostname.includes("youtube.com")) return u.searchParams.get("v");
  } catch {
    // not a URL
  }
  return null;
}

export default function VideoPlayer({
  onPlayYouTube,
  onOpenViewer,
}: {
  onPlayYouTube: (videoId: string, title: string) => void;
  onOpenViewer: (name: string, url: string) => void;
}) {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);

  const handlePlay = async () => {
    const input = url.trim();
    if (!input) return;

    // YouTube → use canvas player (works while driving)
    const videoId = extractYouTubeId(input);
    if (videoId) {
      setLoading(true);
      try {
        const res = await fetch(`/api/youtube/info?v=${videoId}`);
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        onPlayYouTube(videoId, data.title || "YouTube Video");
      } catch {
        onPlayYouTube(videoId, "YouTube Video");
      }
      setLoading(false);
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
        placeholder="Paste YouTube URL to play while driving..."
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
        disabled={!url.trim() || loading}
        style={{
          padding: "10px 20px",
          background: url.trim() && !loading ? "var(--cyan-dim)" : "rgba(31,41,55,0.4)",
          color: url.trim() && !loading ? "var(--cyan)" : "#4b5563",
          border: url.trim() && !loading ? "1px solid var(--cyan-border)" : "1px solid rgba(75,85,99,0.3)",
          borderRadius: 12,
          fontSize: 14,
          fontWeight: 600,
          cursor: url.trim() && !loading ? "pointer" : "default",
          minHeight: 44,
          minWidth: 72,
          whiteSpace: "nowrap",
        }}
      >
        {loading ? "..." : "▶ Play"}
      </button>
    </div>
  );
}
