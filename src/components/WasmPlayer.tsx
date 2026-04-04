"use client";

import { useEffect, useRef, useState, useCallback } from "react";

interface WasmPlayerProps {
  videoId: string;
  title: string;
  streamUrl: string;
  onClose: () => void;
  onError?: () => void;
}

export default function WasmPlayer({ videoId, title, streamUrl, onClose, onError }: WasmPlayerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  // Draw video frames to canvas — this is what Tesla can't block
  const drawFrame = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.paused || video.ended) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    if (video.videoWidth && video.videoHeight) {
      if (canvas.width !== video.videoWidth) canvas.width = video.videoWidth;
      if (canvas.height !== video.videoHeight) canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0);
    }

    rafRef.current = requestAnimationFrame(drawFrame);
  }, []);

  useEffect(() => {
    // Create a completely detached video element — NOT in the DOM at all
    // Tesla scans the DOM for <video> elements, so we keep it detached
    const video = document.createElement("video");
    video.playsInline = true;
    video.preload = "auto";
    video.crossOrigin = ""; // empty string = anonymous but less strict

    // DO NOT append to DOM — keep it fully detached
    // The browser will still decode it, but Tesla can't find it in the DOM
    videoRef.current = video;

    video.onloadedmetadata = () => {
      setDuration(video.duration);
      setLoading(false);
    };

    video.oncanplay = () => setLoading(false);

    video.ontimeupdate = () => {
      setCurrentTime(video.currentTime);
      if (video.duration && isFinite(video.duration)) {
        setProgress((video.currentTime / video.duration) * 100);
      }
    };

    video.onplay = () => {
      setPlaying(true);
      drawFrame();
    };

    video.onpause = () => setPlaying(false);
    video.onended = () => setPlaying(false);

    video.onerror = () => {
      const code = video.error?.code || 0;
      const msg = video.error?.message || "Unknown error";
      console.error("[WasmPlayer] Video error:", code, msg);
      setError(`Playback error: ${msg}`);
      setLoading(false);
      onError?.();
    };

    // Load the direct YouTube CDN URL — browser fetches directly, fast & smooth
    video.src = streamUrl;
    video.load();

    // Auto-play after brief delay
    setTimeout(() => {
      video.play().catch(() => setLoading(false));
    }, 500);

    return () => {
      cancelAnimationFrame(rafRef.current);
      video.pause();
      video.removeAttribute("src");
      video.load();
      videoRef.current = null;
    };
  }, [streamUrl, drawFrame, onError]);

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play().then(() => drawFrame()).catch(() => {});
    } else {
      video.pause();
    }
  };

  const seek = (e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
    const video = videoRef.current;
    if (!video || !video.duration || !isFinite(video.duration)) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    video.currentTime = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width)) * video.duration;
  };

  const fmt = (s: number) => !isFinite(s) ? "0:00" : `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, "0")}`;

  return (
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
          <span style={{ color: "#22c55e", fontSize: 10, fontWeight: 700, textTransform: "uppercase", flexShrink: 0 }}>Drive Safe</span>
        </div>
        <button onClick={onClose} style={{
          padding: "8px 24px", background: "rgba(239,68,68,0.12)", color: "#f87171",
          border: "1px solid rgba(239,68,68,0.25)", borderRadius: 8,
          fontSize: 14, fontWeight: 600, cursor: "pointer", minHeight: 40,
        }}>Close</button>
      </div>

      {/* Only a canvas — no video element in the DOM */}
      <div style={{ flex: 1, position: "relative", background: "#000", overflow: "hidden" }} onClick={togglePlay}>
        <canvas ref={canvasRef} style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }} />

        {loading && (
          <div style={{ position: "absolute", inset: 0, zIndex: 2, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.85)" }}>
            <div style={{ color: "var(--cyan)", fontSize: 18, fontWeight: 600 }}>Loading...</div>
          </div>
        )}

        {error && (
          <div style={{ position: "absolute", inset: 0, zIndex: 2, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.85)", gap: 12 }}>
            <div style={{ color: "#f87171", fontSize: 16, textAlign: "center", padding: "0 32px" }}>{error}</div>
          </div>
        )}

        {!loading && !error && !playing && (
          <div style={{ position: "absolute", inset: 0, zIndex: 2, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.3)" }}>
            <div style={{ width: 80, height: 80, borderRadius: 999, background: "rgba(255,0,0,0.2)", border: "2px solid rgba(255,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width={36} height={36} viewBox="0 0 24 24" fill="#FF0000"><path d="M8 5v14l11-7z" /></svg>
            </div>
          </div>
        )}
      </div>

      <div style={{ padding: "8px 16px 12px", background: "rgba(3,7,18,0.95)", borderTop: "1px solid rgba(34,211,238,0.15)", flexShrink: 0 }}>
        <div onClick={seek} onTouchStart={seek} style={{ width: "100%", height: 32, display: "flex", alignItems: "center", cursor: "pointer", touchAction: "none" }}>
          <div style={{ width: "100%", height: 4, background: "rgba(75,85,99,0.5)", borderRadius: 2, position: "relative", overflow: "hidden" }}>
            <div style={{ width: `${progress}%`, height: "100%", background: "#FF0000", borderRadius: 2 }} />
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 4 }}>
          <button onClick={(e) => { e.stopPropagation(); togglePlay(); }} style={{
            width: 48, height: 48, minHeight: 48, minWidth: 48, display: "flex", alignItems: "center", justifyContent: "center",
            background: "rgba(255,0,0,0.12)", border: "1px solid rgba(255,0,0,0.3)", borderRadius: 999, cursor: "pointer",
          }}>
            {playing
              ? <svg width={20} height={20} viewBox="0 0 24 24" fill="#FF0000"><path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" /></svg>
              : <svg width={20} height={20} viewBox="0 0 24 24" fill="#FF0000"><path d="M8 5v14l11-7z" /></svg>}
          </button>
          <span style={{ color: "#9ca3af", fontSize: 13, fontFamily: "monospace" }}>{fmt(currentTime)} / {fmt(duration)}</span>
        </div>
      </div>
    </div>
  );
}
