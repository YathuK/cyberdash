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
  const audioRef = useRef<HTMLAudioElement>(null);
  const stateRef = useRef({
    videoDecoder: null as VideoDecoder | null,
    frameQueue: [] as VideoFrame[],
    startTime: 0,
    rafId: 0,
    paused: false,
    pausedAt: 0,
    totalDuration: 0,
    cancelled: false,
    started: false,
    framesDrawn: 0,
  });

  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [status, setStatus] = useState("Connecting...");
  const [frameCount, setFrameCount] = useState(0);
  const [drawnCount, setDrawnCount] = useState(0);
  const [decoderState, setDecoderState] = useState("init");
  const [seeking, setSeeking] = useState(false);
  const seekBarRef = useRef<HTMLDivElement>(null);

  const renderLoop = useCallback(() => {
    const s = stateRef.current;
    if (s.paused || s.cancelled) return;

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) { s.rafId = requestAnimationFrame(renderLoop); return; }

    // Simple wall clock timing — microseconds since playback started
    const elapsed = (performance.now() - s.startTime) * 1000;

    // Drop frames that are too late
    while (s.frameQueue.length > 1 && s.frameQueue[0].timestamp < elapsed - 100000) {
      s.frameQueue.shift()!.close();
    }

    // Draw the next frame if it's time
    if (s.frameQueue.length > 0 && s.frameQueue[0].timestamp <= elapsed) {
      const frame = s.frameQueue.shift()!;
      if (canvas.width !== frame.displayWidth) canvas.width = frame.displayWidth;
      if (canvas.height !== frame.displayHeight) canvas.height = frame.displayHeight;
      ctx.drawImage(frame, 0, 0);
      frame.close();
      s.framesDrawn++;
      setDrawnCount(s.framesDrawn);

      const sec = elapsed / 1_000_000;
      setCurrentTime(sec);
      if (s.totalDuration > 0) setProgress((sec / s.totalDuration) * 100);
    }

    s.rafId = requestAnimationFrame(renderLoop);
  }, []);

  const startPlayback = useCallback(() => {
    const s = stateRef.current;
    if (s.started || s.cancelled) return;
    s.started = true;
    s.startTime = performance.now();
    s.paused = false;

    // Start audio
    const audio = audioRef.current;
    if (audio) {
      audio.currentTime = 0;
      audio.play().catch(() => {});
    }

    setLoading(false);
    setPlaying(true);
    setDecoderState(prev => prev + " | PLAYING");
    renderLoop();
  }, [renderLoop]);

  useEffect(() => {
    const s = stateRef.current;
    s.cancelled = false;
    s.started = false;
    s.framesDrawn = 0;

    async function init() {
      try {
        if (typeof VideoDecoder === "undefined") {
          setError("WebCodecs not supported — need Chrome 94+");
          setLoading(false);
          onError?.();
          return;
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const mp4module = (await import("mp4box")) as any;
        const MP4Box = mp4module.default || mp4module;

        let totalFrames = 0;
        s.videoDecoder = new VideoDecoder({
          output: (frame) => {
            if (s.cancelled) { frame.close(); return; }
            totalFrames++;
            setFrameCount(totalFrames);
            s.frameQueue.push(frame);
            // Start after 5 frames decoded
            if (s.frameQueue.length >= 5 && !s.started) {
              startPlayback();
            }
          },
          error: (e) => {
            setDecoderState(`DECODE ERROR: ${e}`);
          },
        });

        const mp4 = MP4Box.createFile();

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        mp4.onReady = (info: any) => {
          if (s.cancelled) return;
          s.totalDuration = info.duration / info.timescale;
          setDuration(s.totalDuration);

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const vt = info.tracks.find((t: any) => t.type === "video");

          if (vt && s.videoDecoder) {
            let desc: Uint8Array | undefined;
            try {
              const trak = mp4.getTrackById(vt.id);
              for (const entry of trak.mdia.minf.stbl.stsd.entries) {
                const avcC = entry.avcC || entry.hvcC;
                if (avcC) {
                  const ds = new MP4Box.DataStream(undefined, 0, MP4Box.DataStream.BIG_ENDIAN);
                  avcC.write(ds);
                  desc = new Uint8Array(ds.buffer, 8);
                  break;
                }
              }
            } catch { /* no desc */ }

            const cfg: VideoDecoderConfig = {
              codec: vt.codec,
              codedWidth: vt.video?.width || 640,
              codedHeight: vt.video?.height || 360,
            };
            if (desc) cfg.description = desc;

            try {
              s.videoDecoder.configure(cfg);
              setDecoderState(`OK: ${vt.codec} ${vt.video?.width}x${vt.video?.height}`);
            } catch {
              try {
                delete cfg.description;
                s.videoDecoder.configure(cfg);
                setDecoderState(`OK (no desc): ${vt.codec}`);
              } catch (e2) {
                setDecoderState(`FAIL: ${e2}`);
              }
            }

            mp4.setExtractionOptions(vt.id, "video", { nbSamples: 100 });
          } else {
            setDecoderState("NO VIDEO TRACK");
          }

          mp4.start();
        };

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        mp4.onSamples = (_id: number, type: string, samples: any[]) => {
          if (s.cancelled || type !== "video") return;
          for (const sample of samples) {
            try {
              if (s.videoDecoder?.state === "configured") {
                s.videoDecoder.decode(new EncodedVideoChunk({
                  type: sample.is_sync ? "key" : "delta",
                  timestamp: (sample.cts * 1_000_000) / sample.timescale,
                  duration: (sample.duration * 1_000_000) / sample.timescale,
                  data: sample.data,
                }));
              }
            } catch { /* decode error */ }
          }
        };

        mp4.onError = (e: string) => setDecoderState(`MP4 ERROR: ${e}`);

        // Stream and play — feed chunks to MP4Box as they arrive
        // Also set audio src to stream URL so it plays in parallel
        const audio = audioRef.current;
        if (audio) {
          audio.src = streamUrl;
          audio.load();
        }

        setStatus("Buffering...");
        const res = await fetch(streamUrl);
        if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

        const reader = res.body.getReader();
        let offset = 0;
        const contentLength = parseInt(res.headers.get("content-length") || "0");

        while (true) {
          const { done, value } = await reader.read();
          if (done || s.cancelled) break;

          const buf = value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength) as ArrayBuffer & { fileStart: number };
          buf.fileStart = offset;
          offset += buf.byteLength;

          const pct = contentLength > 0 ? Math.round((offset / contentLength) * 100) : 0;
          if (!s.started) setStatus(`Buffering... ${pct}%`);

          try { mp4.appendBuffer(buf); } catch {}
        }

        try { mp4.flush(); } catch {}

        if (!s.started && s.frameQueue.length > 0) startPlayback();
        if (!s.started) {
          setError("Could not decode video");
          setLoading(false);
          onError?.();
        }
      } catch (err) {
        if (!s.cancelled) {
          setError(`Failed: ${err instanceof Error ? err.message : err}`);
          setLoading(false);
          onError?.();
        }
      }
    }

    init();

    return () => {
      s.cancelled = true;
      cancelAnimationFrame(s.rafId);
      s.frameQueue.forEach((f) => { try { f.close(); } catch {} });
      s.frameQueue = [];
      try { s.videoDecoder?.close(); } catch {};
    };
  }, [streamUrl, renderLoop, startPlayback, onError]);

  const togglePlay = () => {
    const s = stateRef.current;
    const audio = audioRef.current;
    if (s.paused) {
      s.paused = false;
      s.startTime += performance.now() - s.pausedAt;
      audio?.play();
      setPlaying(true);
      renderLoop();
    } else {
      s.paused = true;
      s.pausedAt = performance.now();
      audio?.pause();
      setPlaying(false);
    }
  };

  const seekTo = (clientX: number) => {
    const bar = seekBarRef.current;
    const audio = audioRef.current;
    const s = stateRef.current;
    if (!bar || !s.totalDuration) return;
    const rect = bar.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const targetTime = pct * s.totalDuration;
    const targetUs = targetTime * 1_000_000;

    // Seek audio
    if (audio && isFinite(targetTime)) audio.currentTime = targetTime;

    // Reset video timing
    s.startTime = performance.now() - targetTime * 1000;

    // Flush frames that are before the seek target (seeking forward)
    // or ALL frames if seeking backward (they're all ahead of us)
    const currentElapsed = (performance.now() - s.startTime) * 1000;
    while (s.frameQueue.length > 0) {
      const frameTs = s.frameQueue[0].timestamp;
      // Keep frames that are near or after the target
      if (frameTs >= targetUs - 500000) break; // within 0.5s of target
      s.frameQueue.shift()!.close();
    }

    // If we have a frame near the target, draw it immediately
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (canvas && ctx && s.frameQueue.length > 0) {
      const frame = s.frameQueue[0];
      if (canvas.width !== frame.displayWidth) canvas.width = frame.displayWidth;
      if (canvas.height !== frame.displayHeight) canvas.height = frame.displayHeight;
      ctx.drawImage(frame, 0, 0);
    }

    setProgress(pct * 100);
    setCurrentTime(targetTime);
  };

  const onSeekStart = (e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    setSeeking(true);
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    seekTo(clientX);
  };
  const onSeekMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!seeking) return;
    e.stopPropagation();
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    seekTo(clientX);
  };
  const onSeekEnd = (e: React.MouseEvent | React.TouchEvent) => { e.stopPropagation(); setSeeking(false); };

  const fmt = (sec: number) => !isFinite(sec) ? "0:00" : `${Math.floor(sec / 60)}:${Math.floor(sec % 60).toString().padStart(2, "0")}`;

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

      <audio ref={audioRef} preload="auto" style={{ display: "none" }} />

      {/* Debug */}
      <div style={{
        padding: "2px 12px", background: "rgba(0,0,0,0.9)", color: "#facc15",
        fontSize: 10, fontFamily: "monospace", flexShrink: 0,
      }}>
        {decoderState} | decoded={frameCount} drawn={drawnCount} queue={stateRef.current.frameQueue.length}
      </div>

      <div style={{ flex: 1, position: "relative", background: "#000", overflow: "hidden" }} onClick={togglePlay}>
        <canvas ref={canvasRef} style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }} />

        {loading && (
          <div style={{ position: "absolute", inset: 0, zIndex: 2, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.85)" }}>
            <div style={{ color: "var(--cyan)", fontSize: 18, fontWeight: 600, marginBottom: 8 }}>Loading...</div>
            <div style={{ color: "#6b7280", fontSize: 13 }}>{status}</div>
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
        <div ref={seekBarRef} onMouseDown={onSeekStart} onMouseMove={onSeekMove} onMouseUp={onSeekEnd} onMouseLeave={onSeekEnd}
          onTouchStart={onSeekStart} onTouchMove={onSeekMove} onTouchEnd={onSeekEnd}
          style={{ width: "100%", height: 44, display: "flex", alignItems: "center", cursor: "pointer", touchAction: "none", position: "relative" }}>
          <div style={{ width: "100%", height: 6, background: "rgba(75,85,99,0.5)", borderRadius: 3, position: "relative", overflow: "visible" }}>
            <div style={{ width: `${progress}%`, height: "100%", background: "#FF0000", borderRadius: 3 }} />
            <div style={{
              position: "absolute", top: "50%", left: `${progress}%`, transform: "translate(-50%, -50%)",
              width: seeking ? 20 : 14, height: seeking ? 20 : 14,
              borderRadius: 999, background: "#FF0000", border: "2px solid #fff",
            }} />
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
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
