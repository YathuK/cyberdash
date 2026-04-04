"use client";

import { useEffect, useState } from "react";
import { getYouTubeStream } from "@/lib/youtubeClient";
import WasmPlayer from "./WasmPlayer";
import ErrorBoundary from "./ErrorBoundary";

interface CanvasPlayerProps {
  videoId: string;
  title: string;
  onClose: () => void;
}

export default function CanvasPlayer({ videoId, title, onClose }: CanvasPlayerProps) {
  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [embedUrl, setEmbedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [wasmCrashed, setWasmCrashed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const result = await getYouTubeStream(videoId);
        if (cancelled) return;

        if (result.stream) {
          setStreamUrl(result.stream.url);
          setAudioUrl(result.stream.audioUrl || result.stream.url);
          setEmbedUrl(result.embedUrl);
        } else {
          setEmbedUrl(result.embedUrl);
        }
      } catch {
        setEmbedUrl(`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&playsinline=1&rel=0`);
      }
      setLoading(false);
    }

    load();
    return () => { cancelled = true; };
  }, [videoId]);

  if (loading) {
    return (
      <div style={{ position: "fixed", inset: 0, zIndex: 100, background: "#000", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ color: "var(--cyan)", fontSize: 18, fontWeight: 600 }}>Loading video...</div>
      </div>
    );
  }

  const embedPlayer = (
    <div style={{ position: "fixed", inset: 0, zIndex: 100, background: "#000", display: "flex", flexDirection: "column" }}>
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "6px 16px", background: "rgba(3,7,18,0.95)",
        borderBottom: "1px solid rgba(34,211,238,0.15)", flexShrink: 0, height: 48,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, overflow: "hidden", flex: 1 }}>
          <span style={{ color: "var(--cyan)", fontWeight: 700, fontSize: 14, flexShrink: 0 }}>YaVik</span>
          <span style={{ color: "#6b7280" }}>/</span>
          <span style={{ color: "#e5e7eb", fontSize: 14, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title}</span>
        </div>
        <button onClick={onClose} style={{
          padding: "8px 24px", background: "rgba(239,68,68,0.12)", color: "#f87171",
          border: "1px solid rgba(239,68,68,0.25)", borderRadius: 8,
          fontSize: 14, fontWeight: 600, cursor: "pointer", minHeight: 40,
        }}>Close</button>
      </div>
      <div style={{ flex: 1 }}>
        <iframe src={embedUrl || `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&playsinline=1&rel=0`}
          style={{ width: "100%", height: "100%", border: "none" }}
          allow="autoplay; fullscreen; encrypted-media" allowFullScreen />
      </div>
    </div>
  );

  if (streamUrl && !wasmCrashed) {
    return (
      <ErrorBoundary fallback={embedPlayer}>
        <WasmPlayer
          videoId={videoId}
          title={title}
          streamUrl={streamUrl}
          audioStreamUrl={audioUrl || streamUrl}
          onClose={onClose}
          onError={() => setWasmCrashed(true)}
        />
      </ErrorBoundary>
    );
  }

  return embedPlayer;
}
