"use client";

import { useEffect, useState, useCallback } from "react";
import AppIcon from "./AppIcon";
import Logo from "./Logo";
import AppViewer from "./AppViewer";
import CanvasPlayer from "./CanvasPlayer";
import YouTubeBrowser from "./YouTubeBrowser";
import { getSessionId } from "@/lib/session";
import { getOpenMode } from "@/lib/appConfig";

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

  const handleAppClick = (app: App) => {
    const mode = getOpenMode(app.icon);
    if (mode === "canvas") {
      setViewer({ type: "youtube-browse" });
    } else if (mode === "embed") {
      setViewer({ type: "iframe", name: app.name, url: app.url });
    } else {
      window.location.href = app.url;
    }
  };

  // Sort: Netflix first, then Prime, then the rest
  const priorityOrder = ["netflix", "prime", "disney", "twitch", "plex", "xbox", "nvidia", "luna", "games"];
  const otherApps = apps
    .filter((a) => a.icon !== "youtube")
    .sort((a, b) => {
      const ai = priorityOrder.indexOf(a.icon);
      const bi = priorityOrder.indexOf(b.icon);
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    });

  return (
    <>
      {/* Overlays */}
      {viewer?.type === "iframe" && (
        <AppViewer name={viewer.name} url={viewer.url} onClose={() => setViewer(null)} />
      )}
      {viewer?.type === "youtube" && (
        <CanvasPlayer videoId={viewer.videoId} title={viewer.title} onClose={() => setViewer(null)} />
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
          background: "radial-gradient(ellipse at 50% 30%, rgba(34,211,238,0.04) 0%, #030712 60%)",
          position: "relative",
        }}
      >
        {/* Animated grid + scan line */}
        <div
          className="cyber-grid scan-line"
          style={{ position: "fixed", inset: 0, opacity: 0.5, pointerEvents: "none", zIndex: 0 }}
        />

        {/* Header — clean, just the logo */}
        <header
          style={{
            position: "relative",
            zIndex: 10,
            padding: "14px 24px",
            flexShrink: 0,
          }}
        >
          <div className="float" style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <Logo size={44} />
            <div>
              <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "#fff", letterSpacing: "-0.02em" }}>
                Ya<span className="gradient-text">Vik</span>
              </h1>
              <p style={{ margin: 0, fontSize: 10, color: "#6b7280", letterSpacing: "0.15em", textTransform: "uppercase" }}>
                Drive. Watch. Explore.
              </p>
            </div>
          </div>
        </header>

        {/* Main content — must scroll to show all apps */}
        <main
          className="scroll-area"
          style={{
            flex: 1,
            position: "relative",
            zIndex: 10,
            padding: "0 24px 24px",
            minHeight: 0,
            overflowY: "auto",
          }}
        >
          {loading ? (
            <div style={{ color: "var(--cyan)", fontSize: 16, marginTop: 60, textAlign: "center" }}>Loading...</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 24, width: "100%", maxWidth: 1100, margin: "0 auto" }}>

              {/* ===== YOUTUBE HERO CARD ===== */}
              <div
                className="hero-glow press-effect"
                onClick={() => setViewer({ type: "youtube-browse" })}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 20,
                  padding: "20px 28px",
                  background: "linear-gradient(135deg, rgba(255,0,0,0.12) 0%, rgba(17,24,39,0.8) 50%, rgba(255,0,0,0.08) 100%)",
                  border: "1px solid rgba(255,0,0,0.3)",
                  borderRadius: 20,
                  cursor: "pointer",
                  width: "100%",
                  maxWidth: 480,
                  position: "relative",
                  overflow: "hidden",
                  transform: "translateZ(0)",
                }}
              >
                {/* Corner accents */}
                <div style={{ position: "absolute", top: 0, left: 0, width: 40, height: 40, borderTop: "2px solid rgba(255,0,0,0.5)", borderLeft: "2px solid rgba(255,0,0,0.5)", borderRadius: "24px 0 0 0" }} />
                <div style={{ position: "absolute", bottom: 0, right: 0, width: 40, height: 40, borderBottom: "2px solid rgba(255,0,0,0.5)", borderRight: "2px solid rgba(255,0,0,0.5)", borderRadius: "0 0 24px 0" }} />

                <div
                  style={{
                    width: 56, height: 56, borderRadius: 14,
                    background: "#FF0000",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <svg width={28} height={28} viewBox="0 0 24 24" fill="#fff">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </div>

                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 20, fontWeight: 800, color: "#fff", marginBottom: 2 }}>YouTube</div>
                  <div style={{ fontSize: 13, color: "#d1d5db" }}>Search, browse & watch while you drive</div>
                  <div style={{
                    display: "inline-block", marginTop: 8,
                    padding: "4px 12px",
                    background: "rgba(255,0,0,0.15)", border: "1px solid rgba(255,0,0,0.3)",
                    borderRadius: 999, color: "#f87171",
                    fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em",
                  }}>
                    Works while driving
                  </div>
                </div>

                <svg width={28} height={28} viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth={2}>
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </div>

              {/* ===== ALL OTHER APPS ===== */}
              <div style={{ width: "100%" }}>
                <div style={{ color: "#4b5563", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.15em", marginBottom: 12, textAlign: "center" }}>
                  Streaming & Gaming
                </div>
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    justifyContent: "center",
                    gap: 10,
                  }}
                >
                  {otherApps.map((app, i) => {
                    const mode = getOpenMode(app.icon);
                    return (
                      <div
                        key={app.id}
                        className="press-effect"
                        onClick={() => handleAppClick(app)}
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          gap: 6,
                          padding: "12px 10px",
                          background: "#111827",
                          border: "1px solid rgba(34, 211, 238, 0.3)",
                          borderRadius: 14,
                          cursor: "pointer",
                          position: "relative",
                          transform: "translateZ(0)",
                          width: 100,
                        }}
                      >
                        {/* Favorite star */}
                        <button
                          onClick={(e) => { e.stopPropagation(); toggleFavorite(app.id); }}
                          style={{
                            position: "absolute", top: 6, right: 6,
                            width: 28, height: 28, minHeight: 28, minWidth: 28,
                            display: "flex", alignItems: "center", justifyContent: "center",
                            background: "transparent", border: "none", cursor: "pointer", padding: 0,
                          }}
                        >
                          <svg width={14} height={14} viewBox="0 0 24 24"
                            stroke={favorites.has(app.id) ? "var(--cyan)" : "#4b5563"}
                            strokeWidth={2}
                            fill={favorites.has(app.id) ? "var(--cyan)" : "none"}
                          >
                            <path d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
                          </svg>
                        </button>

                        <AppIcon icon={app.icon} size={48} />
                        <div style={{ textAlign: "center" }}>
                          <div style={{ color: "#e5e7eb", fontWeight: 600, fontSize: 13 }}>{app.name}</div>
                          <div style={{ color: "#6b7280", fontSize: 10, marginTop: 2, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                            {mode === "embed" ? "in player" : "browser"}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </>
  );
}
