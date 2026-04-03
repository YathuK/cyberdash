"use client";

import { useState } from "react";

export default function VideoPlayer() {
  const [url, setUrl] = useState("");
  const [isPlaying, setIsPlaying] = useState(false);

  const getEmbedUrl = (input: string): string | null => {
    try {
      const u = new URL(input);
      // YouTube
      if (u.hostname.includes("youtube.com") || u.hostname.includes("youtu.be")) {
        const videoId = u.hostname.includes("youtu.be")
          ? u.pathname.slice(1)
          : u.searchParams.get("v");
        if (videoId) return `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&playsinline=1`;
      }
      // Twitch
      if (u.hostname.includes("twitch.tv")) {
        const channel = u.pathname.split("/").filter(Boolean)[0];
        if (channel)
          return `https://player.twitch.tv/?channel=${channel}&parent=${window.location.hostname}`;
      }
      return input;
    } catch {
      return null;
    }
  };

  const handlePlay = () => {
    if (url.trim()) setIsPlaying(true);
  };

  const embedUrl = isPlaying ? getEmbedUrl(url) : null;
  const isDirectVideo = embedUrl && /\.(mp4|webm|ogv|ogg)(\?|$)/i.test(embedUrl);

  if (isPlaying && embedUrl) {
    return (
      <div
        style={{
          background: "rgba(17,24,39,0.8)",
          border: "1px solid var(--cyan-border)",
          borderRadius: 16,
          overflow: "hidden",
          transform: "translateZ(0)",
        }}
      >
        {/* Controls bar */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "8px 16px",
            borderBottom: "1px solid rgba(75,85,99,0.3)",
          }}
        >
          <span style={{ color: "#9ca3af", fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "60%" }}>
            {url}
          </span>
          <button
            onClick={() => { setIsPlaying(false); setUrl(""); }}
            style={{
              padding: "8px 20px",
              background: "rgba(239,68,68,0.15)",
              color: "#f87171",
              border: "1px solid rgba(239,68,68,0.3)",
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
              minHeight: 44,
            }}
          >
            Close
          </button>
        </div>
        {/* Video area - uses padding-top fallback for aspect ratio */}
        <div className="video-wrapper" style={{ background: "#000" }}>
          {isDirectVideo ? (
            <video
              src={embedUrl}
              controls
              autoPlay
              playsInline
              style={{ width: "100%", height: "100%" }}
            />
          ) : (
            <iframe
              src={embedUrl}
              style={{ width: "100%", height: "100%", border: "none" }}
              allow="autoplay; fullscreen; encrypted-media"
              allowFullScreen
            />
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        gap: 12,
        alignItems: "center",
      }}
    >
      <input
        type="text"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && handlePlay()}
        placeholder="Paste YouTube, Twitch, or video URL..."
        style={{
          flex: 1,
          background: "rgba(31,41,55,0.6)",
          border: "1px solid rgba(75,85,99,0.4)",
          borderRadius: 12,
          padding: "12px 16px",
          color: "#fff",
          fontSize: 14,
          outline: "none",
          minHeight: 48,
        }}
      />
      <button
        onClick={handlePlay}
        disabled={!url.trim()}
        style={{
          padding: "12px 24px",
          background: url.trim() ? "var(--cyan-dim)" : "rgba(31,41,55,0.4)",
          color: url.trim() ? "var(--cyan)" : "#4b5563",
          border: url.trim() ? "1px solid var(--cyan-border)" : "1px solid rgba(75,85,99,0.3)",
          borderRadius: 12,
          fontSize: 14,
          fontWeight: 600,
          cursor: url.trim() ? "pointer" : "default",
          minHeight: 48,
          minWidth: 80,
        }}
      >
        ▶ Play
      </button>
    </div>
  );
}
