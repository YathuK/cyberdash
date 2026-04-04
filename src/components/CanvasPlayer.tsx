"use client";

import { useEffect, useRef, useState, useCallback } from "react";

interface CanvasPlayerProps {
  videoId: string;
  title: string;
  onClose: () => void;
}

const ERROR_CODES: Record<number, string> = {
  1: "Video loading aborted",
  2: "Network error while loading",
  3: "Video decoding failed",
  4: "Video format not supported",
};

export default function CanvasPlayer({ videoId, title, onClose }: CanvasPlayerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const animFrameRef = useRef<number>(0);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);

  const drawFrame = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    if (video.videoWidth && video.videoHeight) {
      if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
      }
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    }

    if (!video.paused && !video.ended) {
      animFrameRef.current = requestAnimationFrame(drawFrame);
    }
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onLoadedMetadata = () => {
      setDuration(video.duration);
      setLoading(false);
    };

    const onCanPlay = () => setLoading(false);

    const onTimeUpdate = () => {
      setCurrentTime(video.currentTime);
      if (video.duration && isFinite(video.duration)) {
        setProgress((video.currentTime / video.duration) * 100);
      }
    };

    const onPlay = () => {
      setPlaying(true);
      drawFrame();
    };

    const onPause = () => setPlaying(false);
    const onEnded = () => setPlaying(false);

    const onError = () => {
      const code = video.error?.code || 0;
      const msg = ERROR_CODES[code] || video.error?.message || "Unknown error";
      console.error("Video error:", code, msg, video.error);
      setError(`${msg} (code ${code})`);
      setLoading(false);
    };

    video.addEventListener("loadedmetadata", onLoadedMetadata);
    video.addEventListener("canplay", onCanPlay);
    video.addEventListener("timeupdate", onTimeUpdate);
    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    video.addEventListener("ended", onEnded);
    video.addEventListener("error", onError);

    video.src = `/api/youtube/stream?v=${videoId}`;
    video.load();

    const playTimer = setTimeout(() => {
      video.play().catch(() => setLoading(false));
    }, 300);

    return () => {
      clearTimeout(playTimer);
      cancelAnimationFrame(animFrameRef.current);
      video.removeEventListener("loadedmetadata", onLoadedMetadata);
      video.removeEventListener("canplay", onCanPlay);
      video.removeEventListener("timeupdate", onTimeUpdate);
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("ended", onEnded);
      video.removeEventListener("error", onError);
      video.pause();
      video.removeAttribute("src");
      video.load();
    };
  }, [videoId, drawFrame]);

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

    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    video.currentTime = pct * video.duration;
  };

  const retry = () => {
    setError(null);
    setLoading(true);
    const video = videoRef.current;
    if (video) {
      video.src = `/api/youtube/stream?v=${videoId}`;
      video.load();
      setTimeout(() => {
        video.play().catch(() => setLoading(false));
      }, 300);
    }
  };

  const formatTime = (seconds: number) => {
    if (!isFinite(seconds)) return "0:00";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        background: "#000",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Top bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "6px 16px",
          background: "rgba(3,7,18,0.95)",
          borderBottom: "1px solid rgba(34,211,238,0.15)",
          flexShrink: 0,
          height: 48,
          zIndex: 2,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12, overflow: "hidden", flex: 1 }}>
          <span style={{ color: "var(--cyan)", fontWeight: 700, fontSize: 14, flexShrink: 0 }}>CyberDash</span>
          <span style={{ color: "#6b7280", fontSize: 13 }}>/</span>
          <span style={{ color: "#e5e7eb", fontSize: 14, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {title}
          </span>
        </div>
        <button
          onClick={onClose}
          style={{
            padding: "8px 24px",
            background: "rgba(239,68,68,0.12)",
            color: "#f87171",
            border: "1px solid rgba(239,68,68,0.25)",
            borderRadius: 8,
            fontSize: 14,
            fontWeight: 600,
            cursor: "pointer",
            minHeight: 40,
            minWidth: 44,
            flexShrink: 0,
          }}
        >
          Close
        </button>
      </div>

      {/* Video area */}
      <div
        style={{ flex: 1, position: "relative", background: "#000", overflow: "hidden" }}
        onClick={togglePlay}
      >
        {/* The actual <video> element — visible so it definitely decodes.
            The canvas is layered on top to intercept Tesla's video blackout. */}
        <video
          ref={videoRef}
          playsInline
          preload="auto"
          style={{
            width: "100%",
            height: "100%",
            objectFit: "contain",
            position: "absolute",
            inset: 0,
          }}
        />

        {/* Canvas overlay — draws video frames on top.
            On Tesla in drive mode, the <video> gets blacked out but
            the canvas stays visible since Tesla doesn't target canvas elements. */}
        <canvas
          ref={canvasRef}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "contain",
            position: "absolute",
            inset: 0,
            zIndex: 1,
          }}
        />

        {loading && (
          <div style={{
            position: "absolute", inset: 0, zIndex: 2,
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            background: "rgba(0,0,0,0.85)",
          }}>
            <div style={{ color: "var(--cyan)", fontSize: 18, fontWeight: 600, marginBottom: 8 }}>
              Loading video...
            </div>
            <div style={{ color: "#6b7280", fontSize: 13 }}>
              Preparing your video...
            </div>
          </div>
        )}

        {error && (
          <div style={{
            position: "absolute", inset: 0, zIndex: 2,
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            background: "rgba(0,0,0,0.85)", gap: 12,
          }}>
            <div style={{ color: "#f87171", fontSize: 16, textAlign: "center", padding: "0 32px" }}>
              {error}
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); retry(); }}
              style={{
                padding: "10px 24px",
                background: "var(--cyan-dim)",
                color: "var(--cyan)",
                border: "1px solid var(--cyan-border)",
                borderRadius: 10,
                fontSize: 14,
                fontWeight: 600,
                cursor: "pointer",
                minHeight: 44,
              }}
            >
              Retry
            </button>
          </div>
        )}

        {!loading && !error && !playing && (
          <div style={{
            position: "absolute", inset: 0, zIndex: 2,
            display: "flex", alignItems: "center", justifyContent: "center",
            background: "rgba(0,0,0,0.3)",
          }}>
            <div style={{
              width: 80, height: 80, borderRadius: 999,
              background: "rgba(255,0,0,0.2)",
              border: "2px solid rgba(255,0,0,0.6)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <svg width={36} height={36} viewBox="0 0 24 24" fill="#FF0000">
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
          </div>
        )}
      </div>

      {/* Controls */}
      <div
        style={{
          padding: "8px 16px 12px",
          background: "rgba(3,7,18,0.95)",
          borderTop: "1px solid rgba(34,211,238,0.15)",
          flexShrink: 0,
        }}
      >
        <div
          onClick={seek}
          onTouchStart={seek}
          style={{
            width: "100%", height: 32,
            display: "flex", alignItems: "center",
            cursor: "pointer", touchAction: "none",
          }}
        >
          <div style={{
            width: "100%", height: 4, background: "rgba(75,85,99,0.5)",
            borderRadius: 2, position: "relative", overflow: "hidden",
          }}>
            <div style={{
              width: `${progress}%`, height: "100%",
              background: "#FF0000", borderRadius: 2,
              transition: "width 0.1s linear",
            }} />
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 4 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <button
              onClick={(e) => { e.stopPropagation(); togglePlay(); }}
              style={{
                width: 48, height: 48, minHeight: 48, minWidth: 48,
                display: "flex", alignItems: "center", justifyContent: "center",
                background: "rgba(255,0,0,0.12)", border: "1px solid rgba(255,0,0,0.3)",
                borderRadius: 999, cursor: "pointer",
              }}
            >
              {playing ? (
                <svg width={20} height={20} viewBox="0 0 24 24" fill="#FF0000">
                  <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                </svg>
              ) : (
                <svg width={20} height={20} viewBox="0 0 24 24" fill="#FF0000">
                  <path d="M8 5v14l11-7z" />
                </svg>
              )}
            </button>
            <span style={{ color: "#9ca3af", fontSize: 13, fontFamily: "monospace" }}>
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
