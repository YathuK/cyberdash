"use client";

import { useState } from "react";

interface Video {
  id: string;
  title: string;
  thumbnail: string;
  author: string;
  duration: string;
  views: string;
}

interface YouTubeBrowserProps {
  onPlay: (videoId: string, title: string) => void;
  onClose: () => void;
}

export default function YouTubeBrowser({ onPlay, onClose }: YouTubeBrowserProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Video[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const handleSearch = async () => {
    const input = query.trim();
    if (!input) return;

    // Check if it's a YouTube URL — play directly
    let videoId: string | null = null;
    try {
      const u = new URL(input);
      if (u.hostname.includes("youtu.be")) videoId = u.pathname.slice(1).split("/")[0];
      else if (u.hostname.includes("youtube.com")) videoId = u.searchParams.get("v");
    } catch {
      if (/^[a-zA-Z0-9_-]{11}$/.test(input)) videoId = input;
    }

    if (videoId) {
      onPlay(videoId, "YouTube Video");
      return;
    }

    // Search
    setLoading(true);
    setSearched(true);
    try {
      const res = await fetch(`/api/youtube/search?q=${encodeURIComponent(input)}`);
      const data = await res.json();
      setResults(data.videos || []);
    } catch {
      setResults([]);
    }
    setLoading(false);
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        background: "#030712",
        display: "flex",
        flexDirection: "column",
        transform: "translateZ(0)",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 16,
          padding: "12px 20px",
          borderBottom: "1px solid rgba(34,211,238,0.15)",
          flexShrink: 0,
        }}
      >
        {/* YouTube logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: "#FF0000",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg width={18} height={18} viewBox="0 0 24 24" fill="#fff">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
          <span style={{ color: "#fff", fontWeight: 700, fontSize: 16 }}>YouTube</span>
        </div>

        {/* Search bar */}
        <div style={{ flex: 1, display: "flex", gap: 10 }}>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            placeholder="Search YouTube or paste a URL..."
            autoFocus
            style={{
              flex: 1,
              background: "rgba(31,41,55,0.6)",
              border: "1px solid rgba(75,85,99,0.5)",
              borderRadius: 12,
              padding: "10px 16px",
              color: "#fff",
              fontSize: 15,
              outline: "none",
              minHeight: 48,
              boxSizing: "border-box",
            }}
          />
          <button
            onClick={handleSearch}
            disabled={!query.trim() || loading}
            style={{
              padding: "10px 24px",
              background: query.trim() && !loading ? "#FF0000" : "rgba(31,41,55,0.4)",
              color: query.trim() && !loading ? "#fff" : "#6b7280",
              border: "none",
              borderRadius: 12,
              fontSize: 15,
              fontWeight: 700,
              cursor: query.trim() && !loading ? "pointer" : "default",
              minHeight: 48,
              minWidth: 90,
            }}
          >
            {loading ? "..." : "Search"}
          </button>
        </div>

        {/* Close */}
        <button
          onClick={onClose}
          style={{
            padding: "10px 20px",
            background: "rgba(239,68,68,0.12)",
            color: "#f87171",
            border: "1px solid rgba(239,68,68,0.25)",
            borderRadius: 10,
            fontSize: 14,
            fontWeight: 600,
            cursor: "pointer",
            minHeight: 48,
            flexShrink: 0,
          }}
        >
          Close
        </button>
      </div>

      {/* Results */}
      <div
        className="scroll-area"
        style={{ flex: 1, padding: "16px 20px", minHeight: 0 }}
      >
        {!searched && (
          <div style={{ textAlign: "center", padding: "80px 0" }}>
            <p style={{ color: "#6b7280", fontSize: 16, margin: "0 0 8px" }}>
              Search for any video or paste a YouTube URL
            </p>
            <p style={{ color: "#4b5563", fontSize: 13 }}>
              Works while driving
            </p>
          </div>
        )}

        {loading && (
          <div style={{ textAlign: "center", padding: "60px 0" }}>
            <p style={{ color: "var(--cyan)", fontSize: 16 }}>Searching...</p>
          </div>
        )}

        {searched && !loading && results.length === 0 && (
          <div style={{ textAlign: "center", padding: "60px 0" }}>
            <p style={{ color: "#6b7280", fontSize: 16 }}>No results found</p>
          </div>
        )}

        {results.length > 0 && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
              gap: 16,
            }}
          >
            {results.map((video) => (
              <div
                key={video.id}
                onClick={() => onPlay(video.id, video.title)}
                style={{
                  background: "rgba(17,24,39,0.7)",
                  border: "1px solid rgba(75,85,99,0.3)",
                  borderRadius: 14,
                  overflow: "hidden",
                  cursor: "pointer",
                  transform: "translateZ(0)",
                }}
              >
                {/* Thumbnail */}
                <div
                  style={{
                    position: "relative",
                    width: "100%",
                    paddingTop: "56.25%",
                    background: "#111827",
                  }}
                >
                  {video.thumbnail && (
                    <img
                      src={video.thumbnail}
                      alt=""
                      style={{
                        position: "absolute",
                        inset: 0,
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                      }}
                    />
                  )}
                  {video.duration && (
                    <span
                      style={{
                        position: "absolute",
                        bottom: 6,
                        right: 6,
                        background: "rgba(0,0,0,0.8)",
                        color: "#fff",
                        fontSize: 12,
                        fontWeight: 600,
                        padding: "2px 6px",
                        borderRadius: 4,
                      }}
                    >
                      {video.duration}
                    </span>
                  )}
                </div>

                {/* Info */}
                <div style={{ padding: "10px 12px" }}>
                  <div
                    style={{
                      color: "#fff",
                      fontSize: 14,
                      fontWeight: 600,
                      lineHeight: 1.3,
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                    }}
                  >
                    {video.title}
                  </div>
                  <div style={{ color: "#9ca3af", fontSize: 12, marginTop: 4 }}>
                    {video.author}
                    {video.views && ` · ${video.views}`}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
