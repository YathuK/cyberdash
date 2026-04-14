"use client";

import { useEffect, useRef, useState, useCallback } from "react";

interface WasmPlayerProps {
  videoId: string;
  title: string;
  streamUrl: string;
  audioStreamUrl?: string;
  onClose: () => void;
  onError?: () => void;
}

export default function WasmPlayer({ videoId, title, streamUrl, audioStreamUrl, onClose, onError }: WasmPlayerProps) {
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mp4File: null as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    MP4Box: null as any,
    videoTrackId: 0,
    videoConfig: null as VideoDecoderConfig | null,
    // Abort controller for the in-flight stream fetch — lets seekTo cancel
    // and re-fetch from a new offset without leaking the previous reader.
    fetchAbort: null as AbortController | null,
    // For stall detection: when did we last successfully draw a frame?
    lastFrameAt: 0,
    recovering: false,
  });

  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [status, setStatus] = useState("Connecting...");
  const [seeking, setSeeking] = useState(false);
  const seekBarRef = useRef<HTMLDivElement>(null);

  const renderLoop = useCallback(() => {
    const s = stateRef.current;
    if (s.paused || s.cancelled) return;

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) { s.rafId = requestAnimationFrame(renderLoop); return; }

    // Sync to audio element time — this keeps audio and video locked together
    const audio = audioRef.current;
    let elapsedUs: number;

    if (audio && audio.currentTime > 0 && !audio.paused) {
      elapsedUs = audio.currentTime * 1_000_000;
    } else {
      // Fallback to wall clock if audio not playing yet
      elapsedUs = (performance.now() - s.startTime) * 1000;
    }

    // Drop frames that are too late (more than 200ms behind)
    while (s.frameQueue.length > 1 && s.frameQueue[0].timestamp < elapsedUs - 200000) {
      s.frameQueue.shift()!.close();
    }

    // Draw the next frame if it's time
    if (s.frameQueue.length > 0 && s.frameQueue[0].timestamp <= elapsedUs) {
      const frame = s.frameQueue.shift()!;
      if (canvas.width !== frame.displayWidth) canvas.width = frame.displayWidth;
      if (canvas.height !== frame.displayHeight) canvas.height = frame.displayHeight;
      ctx.drawImage(frame, 0, 0);
      frame.close();
      s.framesDrawn++;
      s.lastFrameAt = performance.now();

      const sec = elapsedUs / 1_000_000;
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

    setLoading(false);
    setPlaying(true);

    // Start render loop, then audio (with a small delay so the canvas has
    // a frame ready before audio kicks in — avoids audio playing over a black canvas).
    renderLoop();

    setTimeout(() => {
      const audio = audioRef.current;
      if (audio) {
        audio.currentTime = 0;
        audio.play().catch(() => {});
      }
    }, 150);
  }, [renderLoop]);

  // Reload the stream and resume playback at targetTime. Used for both
  // user-initiated seeks AND auto-recovery when the player stalls.
  const restartFromTime = useCallback((targetTime: number) => {
    const s = stateRef.current;
    const audio = audioRef.current;
    if (!s.videoConfig || !s.MP4Box || !s.totalDuration) return;

    if (audio && isFinite(targetTime)) audio.currentTime = targetTime;
    s.startTime = performance.now() - targetTime * 1000;

    while (s.frameQueue.length > 0) {
      s.frameQueue.shift()!.close();
    }

    try { s.fetchAbort?.abort(); } catch {}
    try { s.videoDecoder?.reset(); } catch {}
    try { s.videoDecoder?.configure(s.videoConfig); } catch {}

    const mp4 = s.MP4Box.createFile();
    s.mp4File = mp4;
    const targetUs = targetTime * 1_000_000;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mp4.onReady = (info: any) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const vt = info.tracks.find((t: any) => t.type === "video");
      if (vt) {
        mp4.setExtractionOptions(vt.id, "video", { nbSamples: 100 });
        mp4.seek(targetTime, true);
        mp4.start();
      }
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mp4.onSamples = (_id: number, type: string, samples: any[]) => {
      if (type !== "video" || !s.videoDecoder || s.videoDecoder.state !== "configured") return;
      for (const sample of samples) {
        const ts = (sample.cts * 1_000_000) / sample.timescale;
        if (ts < targetUs - 1_000_000) continue;
        try {
          s.videoDecoder.decode(new EncodedVideoChunk({
            type: sample.is_sync ? "key" : "delta",
            timestamp: ts,
            duration: (sample.duration * 1_000_000) / sample.timescale,
            data: sample.data,
          }));
        } catch { /* decode error */ }
      }
    };

    // Refetch the stream with the same streaming approach as the initial load
    // (small ~16 KB pieces via reader.read()) so mp4box stays fed continuously
    // and the render loop isn't blocked. Reconnects on failure.
    (async () => {
      const MAX_RETRIES = 6;
      let offset = 0;
      let retries = 0;
      try {
        s.fetchAbort = new AbortController();
        while (!s.cancelled) {
          try {
            const r: Response = await fetch(streamUrl, {
              signal: s.fetchAbort.signal,
              headers: { Range: `bytes=${offset}-` },
            });
            if (!r.ok && r.status !== 200 && r.status !== 206) throw new Error("HTTP " + r.status);
            if (!r.body) throw new Error("No body");
            retries = 0;
            const reader = r.body.getReader();
            while (true) {
              const { done, value } = await reader.read();
              if (done || s.cancelled) break;
              const buf = value.buffer.slice(
                value.byteOffset, value.byteOffset + value.byteLength
              ) as ArrayBuffer & { fileStart: number };
              buf.fileStart = offset;
              offset += buf.byteLength;
              try { mp4.appendBuffer(buf); } catch {}
            }
            break; // stream ended normally
          } catch (err) {
            if (s.cancelled || (err instanceof DOMException && err.name === "AbortError")) return;
            retries++;
            if (retries > MAX_RETRIES) return;
            await new Promise((res) => setTimeout(res, Math.min(8000, 500 * Math.pow(2, retries - 1))));
          }
        }
        try { mp4.flush(); } catch {}
      } catch {
        /* aborted — fine */
      }
    })();
  }, [streamUrl]);

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
        s.MP4Box = MP4Box;

        let totalFrames = 0;
        s.videoDecoder = new VideoDecoder({
          output: (frame) => {
            if (s.cancelled) { frame.close(); return; }
            totalFrames++;
            
            s.frameQueue.push(frame);
            // Start after 5 frames decoded
            if (s.frameQueue.length >= 5 && !s.started) {
              startPlayback();
            }
          },
          error: (e) => {
          },
        });

        const mp4 = MP4Box.createFile();
        s.mp4File = mp4;

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
              s.videoConfig = cfg;
            } catch {
              try {
                delete cfg.description;
                s.videoDecoder.configure(cfg);
              } catch (e2) {
              }
            }

            s.videoTrackId = vt.id;
            mp4.setExtractionOptions(vt.id, "video", { nbSamples: 100 });
          } else {
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


        // Set audio source — use separate audio URL if provided, otherwise same stream.
        // For DASH-split YouTube, audioStreamUrl is a small audio-only m4a,
        // which is much smaller than the muxed video file.
        const audio = audioRef.current;
        if (audio) {
          audio.src = audioStreamUrl || streamUrl;
          audio.load();
        }

        // Streaming Range fetch with auto-reconnect. Streams the response body
        // in small ~16 KB pieces (just like the browser's native ReadableStream)
        // so mp4box never blocks the main thread for long. If the connection drops
        // (cell dead zone, tunnel restart), we reconnect from the last byte offset
        // with a fresh Range request — no need to restart the whole video.
        setStatus("Connecting...");
        s.fetchAbort = new AbortController();
        const MAX_RETRIES = 6;
        let offset = 0;
        let totalLength: number | null = null;
        let firstChunkTime = 0;
        let retryCount = 0;

        while (!s.cancelled) {
          try {
            const fetchHeaders: Record<string, string> = {};
            // Always use a Range header so the proxy returns Content-Range with
            // the total file size (needed for progress display).
            if (offset > 0 || totalLength == null) {
              fetchHeaders["Range"] = `bytes=${offset}-`;
            }

            const r: Response = await fetch(streamUrl, {
              signal: s.fetchAbort.signal,
              headers: fetchHeaders,
            });
            if (!r.ok && r.status !== 200 && r.status !== 206) {
              throw new Error(`HTTP ${r.status}`);
            }

            // Read total file size from Content-Range on first successful response.
            if (totalLength == null) {
              const cr = r.headers.get("content-range");
              const m = cr && cr.match(/\/(\d+)/);
              if (m) totalLength = parseInt(m[1]);
              else if (r.status === 200 && r.headers.get("content-length")) {
                totalLength = parseInt(r.headers.get("content-length") || "0") || null;
              }
            }

            retryCount = 0; // successful connection — reset retries

            if (!r.body) throw new Error("No response body");
            const reader = r.body.getReader();

            while (true) {
              const { done, value } = await reader.read();
              if (done || s.cancelled) break;

              if (!firstChunkTime) {
                firstChunkTime = Date.now();
                setStatus("Receiving video...");
              }

              // Feed each small piece (~16 KB) to mp4box immediately so the main
              // thread stays responsive and the render loop keeps firing smoothly.
              const buf = value.buffer.slice(
                value.byteOffset, value.byteOffset + value.byteLength
              ) as ArrayBuffer & { fileStart: number };
              buf.fileStart = offset;
              offset += buf.byteLength;

              const mb = (offset / 1024 / 1024).toFixed(1);
              const pct = totalLength != null && totalLength > 0
                ? ` (${Math.round((offset / totalLength) * 100)}%)`
                : "";
              if (!s.started) setStatus(`Buffering... ${mb} MB${pct}`);

              try { mp4.appendBuffer(buf); } catch (e) {
                console.warn("[WasmPlayer] appendBuffer error:", e);
              }

              // Free decoded samples we've already drawn so mp4box's internal
              // buffer doesn't grow unbounded across long playback sessions.
              try { mp4.releaseUsedSamples?.(s.videoTrackId, s.framesDrawn); } catch {}
            }

            // Stream ended normally (EOF) — we're done.
            break;

          } catch (err) {
            if (s.cancelled || (err instanceof DOMException && err.name === "AbortError")) break;
            retryCount++;
            if (retryCount > MAX_RETRIES) {
              throw new Error(`Stream failed after ${MAX_RETRIES} retries at ${Math.round(offset / 1024)}KB: ${err instanceof Error ? err.message : err}`);
            }
            const backoff = Math.min(8000, 500 * Math.pow(2, retryCount - 1));
            setStatus(`Network hiccup — reconnecting from ${(offset / 1024 / 1024).toFixed(1)} MB (try ${retryCount})`);
            await new Promise((resolve) => setTimeout(resolve, backoff));
            // Loop back to the top — reconnects with Range: bytes=offset-
          }
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

    // Stall watchdog: if playback has started but the frame queue stays empty
    // and audio keeps advancing, we know the network died (cell drop, tunnel
    // restart, expired URL). Soft-reload from the current playhead so the user
    // doesn't have to do anything.
    const stallCheckId = setInterval(() => {
      if (s.cancelled || !s.started || s.paused || s.recovering) return;
      const audio = audioRef.current;
      if (!audio || audio.paused) return;
      if (s.frameQueue.length > 0) return;
      const sinceLastFrame = performance.now() - (s.lastFrameAt || s.startTime);
      if (sinceLastFrame < 8000) return;

      console.warn(`[WasmPlayer] stall detected (${Math.round(sinceLastFrame / 1000)}s without a frame), recovering`);
      s.recovering = true;
      setStatus("Reconnecting...");
      restartFromTime(audio.currentTime);
      // 12s cooldown so we don't fire again while the recovery is still loading.
      setTimeout(() => { s.recovering = false; }, 12000);
    }, 1000);

    return () => {
      s.cancelled = true;
      clearInterval(stallCheckId);
      try { s.fetchAbort?.abort(); } catch {}
      cancelAnimationFrame(s.rafId);
      s.frameQueue.forEach((f) => { try { f.close(); } catch {} });
      s.frameQueue = [];
      try { s.videoDecoder?.close(); } catch {}
    };
  }, [streamUrl, audioStreamUrl, renderLoop, startPlayback, onError, restartFromTime]);

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
    const s = stateRef.current;
    if (!bar || !s.totalDuration) return;
    const rect = bar.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const targetTime = pct * s.totalDuration;
    restartFromTime(targetTime);
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
