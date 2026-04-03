"use client";

import { useEffect, useState, useCallback } from "react";
import AppCard from "./AppCard";
import CategoryNav from "./CategoryNav";
import VideoPlayer from "./VideoPlayer";
import AppViewer from "./AppViewer";
import CanvasPlayer from "./CanvasPlayer";
import YouTubeBrowser from "./YouTubeBrowser";
import { getSessionId } from "@/lib/session";

interface App {
  id: string;
  name: string;
  url: string;
  icon: string;
  category: string;
  description: string | null;
}

type ViewerState =
  | { type: "iframe"; name: string; url: string }
  | { type: "youtube"; videoId: string; title: string }
  | { type: "youtube-browse" };

export default function Dashboard() {
  const [apps, setApps] = useState<App[]>([]);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [category, setCategory] = useState("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [viewer, setViewer] = useState<ViewerState | null>(null);

  const fetchApps = useCallback(async () => {
    const res = await fetch("/api/apps");
    const data = await res.json();
    setApps(data);
    setLoading(false);
  }, []);

  const fetchFavorites = useCallback(async () => {
    const sessionId = getSessionId();
    if (!sessionId) return;
    const res = await fetch(`/api/favorites?sessionId=${sessionId}`);
    const data = await res.json();
    setFavorites(new Set(data.map((f: { appId: string }) => f.appId)));
  }, []);

  useEffect(() => {
    fetchApps();
    fetchFavorites();
  }, [fetchApps, fetchFavorites]);

  const toggleFavorite = async (appId: string) => {
    const sessionId = getSessionId();
    await fetch("/api/favorites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ appId, sessionId }),
    });
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(appId)) next.delete(appId);
      else next.add(appId);
      return next;
    });
  };

  const embedApp = (app: App) => {
    setViewer({ type: "iframe", name: app.name, url: app.url });
  };

  const playYouTube = (videoId: string, title: string) => {
    setViewer({ type: "youtube", videoId, title });
  };

  const openViewer = (name: string, url: string) => {
    setViewer({ type: "iframe", name, url });
  };

  const filtered = apps.filter((app) => {
    if (category === "favorites") return favorites.has(app.id);
    if (category !== "all" && app.category !== category) return false;
    if (search && !app.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <>
      {/* Viewer overlays */}
      {viewer?.type === "iframe" && (
        <AppViewer
          name={viewer.name}
          url={viewer.url}
          onClose={() => setViewer(null)}
        />
      )}
      {viewer?.type === "youtube" && (
        <CanvasPlayer
          videoId={viewer.videoId}
          title={viewer.title}
          onClose={() => setViewer(null)}
        />
      )}
      {viewer?.type === "youtube-browse" && (
        <YouTubeBrowser
          onPlay={(videoId, title) => setViewer({ type: "youtube", videoId, title })}
          onClose={() => setViewer(null)}
        />
      )}

      <div
        style={{
          width: "100vw",
          height: "100vh",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          background: "linear-gradient(135deg, #030712 0%, #0f172a 50%, #030712 100%)",
          position: "relative",
        }}
      >
        {/* Cyber grid overlay */}
        <div
          className="cyber-grid"
          style={{
            position: "fixed",
            inset: 0,
            opacity: 0.4,
            pointerEvents: "none",
            zIndex: 0,
          }}
        />

        {/* Header */}
        <header
          style={{
            position: "relative",
            zIndex: 10,
            padding: "16px 24px 12px",
            flexShrink: 0,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            {/* Logo */}
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  background: "var(--cyan-dim)",
                  border: "1px solid var(--cyan-border)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <span style={{ color: "var(--cyan)", fontWeight: 700, fontSize: 20 }}>C</span>
              </div>
              <div>
                <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: "#fff", letterSpacing: "-0.02em" }}>
                  Cyber<span style={{ color: "var(--cyan)" }}>Dash</span>
                </h1>
                <p style={{ margin: 0, fontSize: 11, color: "#6b7280", letterSpacing: "0.15em", textTransform: "uppercase" }}>
                  Drive. Watch. Explore.
                </p>
              </div>
            </div>

            {/* Search + Video Player */}
            <div style={{ display: "flex", alignItems: "center", gap: 16, flex: 1, maxWidth: 700, marginLeft: 32 }}>
              <div style={{ position: "relative", width: 200, flexShrink: 0 }}>
                <svg
                  style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", width: 16, height: 16, color: "#6b7280" }}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search..."
                  style={{
                    width: "100%",
                    background: "rgba(31,41,55,0.5)",
                    border: "1px solid rgba(75,85,99,0.4)",
                    borderRadius: 12,
                    paddingLeft: 36,
                    paddingRight: 12,
                    paddingTop: 10,
                    paddingBottom: 10,
                    fontSize: 14,
                    color: "#fff",
                    outline: "none",
                    minHeight: 44,
                    boxSizing: "border-box",
                  }}
                />
              </div>

              <div style={{ flex: 1 }}>
                <VideoPlayer onPlayYouTube={playYouTube} onOpenViewer={openViewer} />
              </div>
            </div>
          </div>

          <CategoryNav active={category} onChange={setCategory} />
        </header>

        {/* App Grid */}
        <main
          className="scroll-area"
          style={{
            flex: 1,
            position: "relative",
            zIndex: 10,
            padding: "8px 24px 16px",
            minHeight: 0,
          }}
        >
          {loading ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 16 }}>
              {Array.from({ length: 8 }).map((_, i) => (
                <div
                  key={i}
                  style={{
                    background: "rgba(17,24,39,0.4)",
                    border: "1px solid rgba(75,85,99,0.2)",
                    borderRadius: 16,
                    height: 140,
                  }}
                />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: "center", padding: "60px 0" }}>
              <p style={{ color: "#6b7280", fontSize: 16 }}>
                {category === "favorites"
                  ? "No favorites yet. Tap the star on any app."
                  : "No apps found."}
              </p>
            </div>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
                gap: 16,
              }}
            >
              {filtered.map((app) => (
                <AppCard
                  key={app.id}
                  app={app}
                  isFavorite={favorites.has(app.id)}
                  onToggleFavorite={toggleFavorite}
                  onEmbed={embedApp}
                  onYouTube={() => setViewer({ type: "youtube-browse" })}
                />
              ))}
            </div>
          )}
        </main>
      </div>
    </>
  );
}
