"use client";

import { useEffect, useState, useCallback } from "react";
import Logo from "./Logo";
import AppViewer from "./AppViewer";
import CanvasPlayer from "./CanvasPlayer";
import YouTubeBrowser from "./YouTubeBrowser";
import EinthusanBrowser from "./EinthusanBrowser";
import PlutoBrowser from "./PlutoBrowser";
import WasmPlayerDirect from "./WasmPlayerDirect";
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
  | { type: "youtube-browse" }
  | { type: "einthusan-browse" }
  | { type: "einthusan-play"; title: string; streamUrl: string }
  | { type: "pluto-browse" }
  | { type: "pluto-play"; title: string; streamUrl: string };

export default function Dashboard() {
  const [apps, setApps] = useState<App[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewer, setViewer] = useState<ViewerState | null>(null);

  const fetchApps = useCallback(async () => {
    try {
      const res = await fetch("/api/apps");
      const data = await res.json();
      setApps(data);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { fetchApps(); }, [fetchApps]);

  const otherApps = apps.filter((a) => a.icon !== "youtube" && a.icon !== "einthusan");

  return (
    <>
      {/* Overlays */}
      {viewer?.type === "iframe" && (
        <AppViewer name={viewer.name} url={viewer.url} onClose={() => setViewer(null)} />
      )}
      {viewer?.type === "youtube" && (
        <CanvasPlayer videoId={viewer.videoId} title={viewer.title} onClose={() => setViewer({ type: "youtube-browse" })} />
      )}
      {viewer?.type === "youtube-browse" && (
        <YouTubeBrowser onPlay={(videoId, title) => setViewer({ type: "youtube", videoId, title })} onClose={() => setViewer(null)} />
      )}
      {viewer?.type === "einthusan-browse" && (
        <EinthusanBrowser onPlay={(_id, title, url) => setViewer({ type: "einthusan-play", title, streamUrl: url })} onClose={() => setViewer(null)} />
      )}
      {viewer?.type === "einthusan-play" && (
        <WasmPlayerDirect title={viewer.title} streamUrl={viewer.streamUrl} onClose={() => setViewer({ type: "einthusan-browse" })} />
      )}
      {viewer?.type === "pluto-browse" && (
        <PlutoBrowser onPlay={(_id, title, url) => setViewer({ type: "pluto-play", title, streamUrl: url })} onClose={() => setViewer(null)} />
      )}
      {viewer?.type === "pluto-play" && (
        <WasmPlayerDirect title={viewer.title} streamUrl={viewer.streamUrl} onClose={() => setViewer({ type: "pluto-browse" })} />
      )}

      <div className="noise" style={{ width: "100vw", height: "100vh", overflow: "hidden", display: "flex", flexDirection: "column", position: "relative" }}>
        {/* Animated background orbs */}
        <div className="bg-orb bg-orb-1" />
        <div className="bg-orb bg-orb-2" />
        <div className="bg-orb bg-orb-3" />

        {/* Grid + scan line */}
        <div className="cyber-grid scan-line" style={{ position: "fixed", inset: 0, opacity: 0.6, pointerEvents: "none", zIndex: 0 }} />

        {/* Header */}
        <header style={{ position: "relative", zIndex: 10, padding: "16px 28px", flexShrink: 0 }}>
          <div className="float" style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <Logo size={48} />
            <div>
              <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800, color: "#fff", letterSpacing: "-0.03em" }}>
                Ya<span className="gradient-text">Vik</span>
              </h1>
              <p style={{ margin: 0, fontSize: 11, color: "rgba(148,163,184,0.6)", letterSpacing: "0.2em", textTransform: "uppercase" }}>
                Drive. Watch. Explore.
              </p>
            </div>
          </div>
        </header>

        {/* Main content */}
        <main className="scroll-area" style={{ flex: 1, position: "relative", zIndex: 10, padding: "0 28px 28px", minHeight: 0 }}>
          {loading ? (
            <div style={{ textAlign: "center", padding: "80px 0", color: "var(--cyan)", fontSize: 16 }}>Loading...</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 20, maxWidth: 900, margin: "0 auto" }}>

              {/* ===== YOUTUBE ===== */}
              <div
                className="yt-card press-effect"
                onClick={() => setViewer({ type: "youtube-browse" })}
                style={{
                  display: "flex", alignItems: "center", gap: 28, padding: "36px 40px",
                  background: "linear-gradient(135deg, rgba(255,0,0,0.08) 0%, rgba(15,23,42,0.7) 40%, rgba(255,0,0,0.05) 100%)",
                  border: "1px solid rgba(255,0,0,0.2)",
                  borderRadius: 24, cursor: "pointer", width: "100%",
                  position: "relative", overflow: "hidden", transform: "translateZ(0)",
                }}
              >
                {/* Corner lines */}
                <div style={{ position: "absolute", top: 0, left: 0, width: 60, height: 60, borderTop: "2px solid rgba(255,0,0,0.3)", borderLeft: "2px solid rgba(255,0,0,0.3)", borderRadius: "24px 0 0 0" }} />
                <div style={{ position: "absolute", bottom: 0, right: 0, width: 60, height: 60, borderBottom: "2px solid rgba(255,0,0,0.3)", borderRight: "2px solid rgba(255,0,0,0.3)", borderRadius: "0 0 24px 0" }} />
                {/* Gradient line at bottom */}
                <div style={{ position: "absolute", bottom: 0, left: "10%", right: "10%", height: 1, background: "linear-gradient(90deg, transparent, rgba(255,0,0,0.3), transparent)" }} />

                <div style={{ width: 76, height: 76, borderRadius: 20, background: "linear-gradient(135deg, #FF0000, #CC0000)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <svg width={38} height={38} viewBox="0 0 24 24" fill="#fff"><path d="M8 5v14l11-7z" /></svg>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 30, fontWeight: 800, color: "#fff", marginBottom: 4, letterSpacing: "-0.02em" }}>YouTube</div>
                  <div style={{ fontSize: 15, color: "rgba(209,213,219,0.8)" }}>Search, browse & watch while you drive</div>
                  <div style={{
                    display: "inline-block", marginTop: 10, padding: "5px 14px",
                    background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.25)",
                    borderRadius: 999, color: "#22c55e", fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em",
                  }}>Works while driving</div>
                </div>
                <svg width={28} height={28} viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth={2}><path d="M9 18l6-6-6-6" /></svg>
              </div>

              {/* ===== EINTHUSAN ===== */}
              <div
                className="ein-card press-effect"
                onClick={() => setViewer({ type: "einthusan-browse" })}
                style={{
                  display: "flex", alignItems: "center", gap: 28, padding: "36px 40px",
                  background: "linear-gradient(135deg, rgba(234,179,8,0.06) 0%, rgba(15,23,42,0.7) 40%, rgba(234,179,8,0.04) 100%)",
                  border: "1px solid rgba(234,179,8,0.2)",
                  borderRadius: 24, cursor: "pointer", width: "100%",
                  position: "relative", overflow: "hidden", transform: "translateZ(0)",
                }}
              >
                <div style={{ position: "absolute", top: 0, left: 0, width: 60, height: 60, borderTop: "2px solid rgba(234,179,8,0.3)", borderLeft: "2px solid rgba(234,179,8,0.3)", borderRadius: "24px 0 0 0" }} />
                <div style={{ position: "absolute", bottom: 0, right: 0, width: 60, height: 60, borderBottom: "2px solid rgba(234,179,8,0.3)", borderRight: "2px solid rgba(234,179,8,0.3)", borderRadius: "0 0 24px 0" }} />
                <div style={{ position: "absolute", bottom: 0, left: "10%", right: "10%", height: 1, background: "linear-gradient(90deg, transparent, rgba(234,179,8,0.3), transparent)" }} />

                <div style={{ width: 76, height: 76, borderRadius: 20, background: "linear-gradient(135deg, #eab308, #ca8a04)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <span style={{ color: "#000", fontWeight: 800, fontSize: 30 }}>E</span>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 30, fontWeight: 800, color: "#fff", marginBottom: 4, letterSpacing: "-0.02em" }}>Einthusan</div>
                  <div style={{ fontSize: 15, color: "rgba(209,213,219,0.8)" }}>Tamil, Hindi, Telugu & more movies</div>
                  <div style={{
                    display: "inline-block", marginTop: 10, padding: "5px 14px",
                    background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.25)",
                    borderRadius: 999, color: "#22c55e", fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em",
                  }}>Works while driving</div>
                </div>
                <svg width={28} height={28} viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth={2}><path d="M9 18l6-6-6-6" /></svg>
              </div>

              {/* ===== PLUTO TV ===== */}
              <div
                className="press-effect"
                onClick={() => setViewer({ type: "pluto-browse" })}
                style={{
                  display: "flex", alignItems: "center", gap: 28, padding: "36px 40px",
                  background: "linear-gradient(135deg, rgba(99,102,241,0.06) 0%, rgba(15,23,42,0.7) 40%, rgba(99,102,241,0.04) 100%)",
                  border: "1px solid rgba(99,102,241,0.2)",
                  borderRadius: 24, cursor: "pointer", width: "100%",
                  position: "relative", overflow: "hidden", transform: "translateZ(0)",
                }}
              >
                <div style={{ position: "absolute", top: 0, left: 0, width: 60, height: 60, borderTop: "2px solid rgba(99,102,241,0.3)", borderLeft: "2px solid rgba(99,102,241,0.3)", borderRadius: "24px 0 0 0" }} />
                <div style={{ position: "absolute", bottom: 0, right: 0, width: 60, height: 60, borderBottom: "2px solid rgba(99,102,241,0.3)", borderRight: "2px solid rgba(99,102,241,0.3)", borderRadius: "0 0 24px 0" }} />

                <div style={{ width: 76, height: 76, borderRadius: 20, background: "linear-gradient(135deg, #6366f1, #8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <span style={{ color: "#fff", fontWeight: 800, fontSize: 28 }}>P</span>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 30, fontWeight: 800, color: "#fff", marginBottom: 4, letterSpacing: "-0.02em" }}>Pluto TV</div>
                  <div style={{ fontSize: 15, color: "rgba(209,213,219,0.8)" }}>Free movies & TV shows — no login needed</div>
                  <div style={{
                    display: "inline-block", marginTop: 10, padding: "5px 14px",
                    background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.25)",
                    borderRadius: 999, color: "#22c55e", fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em",
                  }}>Works while driving</div>
                </div>
                <svg width={28} height={28} viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth={2}><path d="M9 18l6-6-6-6" /></svg>
              </div>

              {/* ===== OTHER APPS ===== */}
              {otherApps.length > 0 && (
                <div style={{ width: "100%", marginTop: 8 }}>
                  <div style={{ color: "rgba(148,163,184,0.4)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.2em", marginBottom: 12, textAlign: "center" }}>
                    More apps — available when parked
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 10 }}>
                    {otherApps.map((app) => (
                      <div
                        key={app.id}
                        className="glass press-effect"
                        onClick={() => window.location.href = app.url}
                        style={{
                          display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
                          padding: "14px 12px", borderRadius: 14, cursor: "pointer", width: 100,
                          transform: "translateZ(0)",
                        }}
                      >
                        <div style={{
                          width: 48, height: 48, borderRadius: 12,
                          background: app.icon === "netflix" ? "#E50914" : app.icon === "prime" ? "#00A8E1" : app.icon === "disney" ? "#0D1C46" : app.icon === "twitch" ? "#9146FF" : app.icon === "plex" ? "#E5A00D" : app.icon === "xbox" ? "#107C10" : app.icon === "nvidia" ? "#76B900" : app.icon === "luna" ? "#4B0082" : app.icon === "games" ? "#FF6B35" : "#333",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          overflow: "hidden",
                        }}>
                          {/* Netflix N */}
                          {app.icon === "netflix" && (
                            <svg width={24} height={24} viewBox="0 0 24 24" fill="#fff">
                              <path d="M5.398 0v.006c3.028 8.556 5.37 15.175 8.348 23.596 2.344.058 4.85.398 4.854.398-2.8-7.924-5.923-16.747-8.487-24h-4.715zm8.489 0v9.63L18.6 24c.105-.003 4.783-.37 4.8-.37-.002-10.806-.014-12.635-.014-23.63h-4.705v9.636L13.887 0H5.398z"/>
                            </svg>
                          )}
                          {/* Amazon Prime */}
                          {app.icon === "prime" && (
                            <svg width={26} height={26} viewBox="0 0 24 24" fill="#fff">
                              <path d="M8 6l4 8 4-8M4 14l2-4M20 14l-2-4M2 18h20"/>
                            </svg>
                          )}
                          {/* Disney+ */}
                          {app.icon === "disney" && (
                            <span style={{ color: "#fff", fontWeight: 800, fontSize: 11, letterSpacing: "-0.02em" }}>Disney+</span>
                          )}
                          {/* Twitch */}
                          {app.icon === "twitch" && (
                            <svg width={22} height={22} viewBox="0 0 24 24" fill="#fff">
                              <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z"/>
                            </svg>
                          )}
                          {/* Plex */}
                          {app.icon === "plex" && (
                            <span style={{ color: "#000", fontWeight: 800, fontSize: 14 }}>PLEX</span>
                          )}
                          {/* Xbox */}
                          {app.icon === "xbox" && (
                            <svg width={22} height={22} viewBox="0 0 24 24" fill="#fff">
                              <path d="M4.102 21.033C6.211 22.881 8.977 24 12 24s5.789-1.119 7.898-2.967c-1.083-.842-2.186-1.744-4.005-3.778-1.098 1.267-2.449 2.667-3.893 2.667s-2.795-1.4-3.893-2.667c-1.819 2.034-2.922 2.936-4.005 3.778zM12 0C8.57 0 5.508 1.477 3.378 3.838c.562.5 1.181 1.058 1.891 1.724 2.062-1.857 4.224-2.91 6.731-2.91s4.669 1.053 6.731 2.91c.71-.666 1.329-1.224 1.891-1.724C18.492 1.477 15.43 0 12 0z"/>
                            </svg>
                          )}
                          {/* GeForce NOW */}
                          {app.icon === "nvidia" && (
                            <span style={{ color: "#000", fontWeight: 800, fontSize: 10 }}>GFN</span>
                          )}
                          {/* Luna */}
                          {app.icon === "luna" && (
                            <svg width={20} height={20} viewBox="0 0 24 24" fill="#fff">
                              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                            </svg>
                          )}
                          {/* CrazyGames */}
                          {app.icon === "games" && (
                            <svg width={20} height={20} viewBox="0 0 24 24" fill="#fff">
                              <path d="M21 6H3c-1.1 0-2 .9-2 2v8c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-10 7H8v3H6v-3H3v-2h3V8h2v3h3v2zm4.5 2c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm4-3c-.83 0-1.5-.67-1.5-1.5S18.67 9 19.5 9s1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/>
                            </svg>
                          )}
                        </div>
                        <div style={{ color: "#e5e7eb", fontWeight: 600, fontSize: 11 }}>{app.name}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    </>
  );
}
