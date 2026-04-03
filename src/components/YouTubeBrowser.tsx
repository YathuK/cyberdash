"use client";

import { useState } from "react";

interface YouTubeBrowserProps {
  onPlay: (videoId: string, title: string) => void;
  onClose: () => void;
}

export default function YouTubeBrowser({ onPlay, onClose }: YouTubeBrowserProps) {
  const [url, setUrl] = useState("");

  const handleSubmit = () => {
    const input = url.trim();
    if (!input) return;

    // Extract video ID from URL
    let videoId: string | null = null;
    try {
      const u = new URL(input);
      if (u.hostname.includes("youtu.be")) videoId = u.pathname.slice(1).split("/")[0];
      else if (u.hostname.includes("youtube.com")) videoId = u.searchParams.get("v");
    } catch {
      // Maybe they pasted just a video ID
      if (/^[a-zA-Z0-9_-]{11}$/.test(input)) videoId = input;
    }

    if (videoId) {
      onPlay(videoId, "YouTube Video");
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        background: "rgba(3,7,18,0.97)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        transform: "translateZ(0)",
      }}
    >
      {/* Close button */}
      <button
        onClick={onClose}
        style={{
          position: "absolute",
          top: 16,
          right: 16,
          padding: "8px 24px",
          background: "rgba(239,68,68,0.12)",
          color: "#f87171",
          border: "1px solid rgba(239,68,68,0.25)",
          borderRadius: 8,
          fontSize: 14,
          fontWeight: 600,
          cursor: "pointer",
          minHeight: 44,
        }}
      >
        Close
      </button>

      <div style={{ maxWidth: 600, width: "100%", padding: "0 24px" }}>
        {/* YouTube branding */}
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <div
            style={{
              width: 80,
              height: 80,
              borderRadius: 20,
              background: "#FF0000",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 16,
            }}
          >
            <svg width={40} height={40} viewBox="0 0 24 24" fill="#fff">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
          <h2 style={{ color: "#fff", fontSize: 28, fontWeight: 700, margin: "0 0 8px" }}>
            YouTube <span style={{ color: "var(--cyan)" }}>Canvas Player</span>
          </h2>
          <p style={{ color: "#9ca3af", fontSize: 14, margin: 0 }}>
            Renders video to canvas — works while driving
          </p>
        </div>

        {/* URL input */}
        <div style={{ display: "flex", gap: 12 }}>
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            placeholder="Paste YouTube URL or video ID..."
            autoFocus
            style={{
              flex: 1,
              background: "rgba(31,41,55,0.6)",
              border: "1px solid rgba(75,85,99,0.5)",
              borderRadius: 14,
              padding: "14px 18px",
              color: "#fff",
              fontSize: 16,
              outline: "none",
              minHeight: 52,
              boxSizing: "border-box",
            }}
          />
          <button
            onClick={handleSubmit}
            disabled={!url.trim()}
            style={{
              padding: "14px 28px",
              background: url.trim() ? "#FF0000" : "rgba(31,41,55,0.4)",
              color: url.trim() ? "#fff" : "#4b5563",
              border: "none",
              borderRadius: 14,
              fontSize: 16,
              fontWeight: 700,
              cursor: url.trim() ? "pointer" : "default",
              minHeight: 52,
              minWidth: 100,
            }}
          >
            ▶ Play
          </button>
        </div>

        <p style={{ color: "#6b7280", fontSize: 12, textAlign: "center", marginTop: 16 }}>
          Tip: You can also paste URLs in the player bar on the dashboard
        </p>
      </div>
    </div>
  );
}
