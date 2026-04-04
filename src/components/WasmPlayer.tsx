"use client";

import { useEffect, useRef, useState, useCallback } from "react";
// mp4box imported dynamically in useEffect to avoid SSR issues

interface WasmPlayerProps {
  videoId: string;
  title: string;
  streamUrl: string;
  onClose: () => void;
  onError?: () => void;
}

export default function WasmPlayer({ videoId, title, streamUrl, onClose, onError }: WasmPlayerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef({
    audioCtx: null as AudioContext | null,
    videoDecoder: null as VideoDecoder | null,
    audioDecoder: null as AudioDecoder | null,
    frameQueue: [] as VideoFrame[],
    startTime: 0,
    audioBaseTime: 0,
    rafId: 0,
    paused: false,
    pausedAt: 0,
    totalDuration: 0,
    cancelled: false,
    started: false,
  });

  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [status, setStatus] = useState("Connecting...");

  const renderLoop = useCallback(() => {
    const s = stateRef.current;
    if (s.paused || s.cancelled) return;

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) { s.rafId = requestAnimationFrame(renderLoop); return; }

    const elapsed = (performance.now() - s.startTime) * 1000; // microseconds

    // Drop late frames
    while (s.frameQueue.length > 1 && s.frameQueue[0].timestamp < elapsed) {
      s.frameQueue.shift()!.close();
    }

    if (s.frameQueue.length > 0 && s.frameQueue[0].timestamp <= elapsed) {
      const frame = s.frameQueue.shift()!;
      if (canvas.width !== frame.displayWidth) canvas.width = frame.displayWidth;
      if (canvas.height !== frame.displayHeight) canvas.height = frame.displayHeight;
      ctx.drawImage(frame, 0, 0);
      frame.close();

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
    s.audioCtx?.resume();
    setLoading(false);
    setPlaying(true);
    renderLoop();
  }, [renderLoop]);

  useEffect(() => {
    const s = stateRef.current;
    s.cancelled = false;
    s.started = false;

    async function init() {
      try {
        if (typeof VideoDecoder === "undefined") {
          setError("Your browser doesn't support WebCodecs (need Chrome 94+)");
          setLoading(false);
          return;
        }

        setStatus("Setting up decoders...");

        // Dynamic import mp4box (can't be top-level in Next.js)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const mp4boxModule = (await import("mp4box")) as any;
        const MP4Box = mp4boxModule.default || mp4boxModule;
        console.log("[WasmPlayer] MP4Box loaded, createFile:", typeof MP4Box.createFile, "DataStream:", typeof MP4Box.DataStream);

        // Video decoder
        s.videoDecoder = new VideoDecoder({
          output: (frame) => {
            if (s.cancelled) { frame.close(); return; }
            s.frameQueue.push(frame);
            // Start playing as soon as we have a few frames
            if (s.frameQueue.length >= 3 && !s.started) startPlayback();
          },
          error: (e) => console.error("[WasmPlayer] VideoDecoder error:", e),
        });

        // Audio
        s.audioCtx = new AudioContext();
        s.audioBaseTime = 0;

        s.audioDecoder = new AudioDecoder({
          output: (audioData) => {
            if (s.cancelled || !s.audioCtx) { audioData.close(); return; }
            try {
              const buf = s.audioCtx.createBuffer(audioData.numberOfChannels, audioData.numberOfFrames, audioData.sampleRate);
              for (let ch = 0; ch < audioData.numberOfChannels; ch++) {
                const cd = new Float32Array(audioData.numberOfFrames);
                audioData.copyTo(cd, { planeIndex: ch, format: "f32-planar" });
                buf.copyToChannel(cd, ch);
              }
              const src = s.audioCtx.createBufferSource();
              src.buffer = buf;
              src.connect(s.audioCtx.destination);
              if (s.audioBaseTime === 0) s.audioBaseTime = s.audioCtx.currentTime;
              src.start(s.audioBaseTime + audioData.timestamp / 1_000_000);
            } catch { /* non-fatal */ }
            audioData.close();
          },
          error: (e) => console.error("[WasmPlayer] AudioDecoder error:", e),
        });

        // MP4 demuxer
        const mp4 = MP4Box.createFile();

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        mp4.onReady = (info: any) => {
          if (s.cancelled) return;
          console.log("[WasmPlayer] MP4 ready, tracks:", info.tracks.length);

          s.totalDuration = info.duration / info.timescale;
          setDuration(s.totalDuration);

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const vt = info.tracks.find((t: any) => t.type === "video");
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const at = info.tracks.find((t: any) => t.type === "audio");

          if (vt && s.videoDecoder) {
            console.log("[WasmPlayer] Video:", vt.codec, vt.video?.width, "x", vt.video?.height);

            // Try to get avcC description
            let desc: Uint8Array | undefined;
            try {
              const trak = mp4.getTrackById(vt.id);
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              for (const entry of trak.mdia.minf.stbl.stsd.entries) {
                const avcC = entry.avcC || entry.hvcC;
                if (avcC) {
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  const ds = new (MP4Box as any).DataStream(undefined, 0, (MP4Box as any).DataStream.BIG_ENDIAN);
                  avcC.write(ds);
                  desc = new Uint8Array(ds.buffer, 8);
                  break;
                }
              }
            } catch (e) {
              console.warn("[WasmPlayer] Could not extract avcC:", e);
            }

            const cfg: VideoDecoderConfig = {
              codec: vt.codec,
              codedWidth: vt.video?.width || 640,
              codedHeight: vt.video?.height || 360,
            };
            if (desc) cfg.description = desc;

            try {
              s.videoDecoder.configure(cfg);
              console.log("[WasmPlayer] VideoDecoder configured");
            } catch (e) {
              console.error("[WasmPlayer] VideoDecoder configure failed:", e);
              // Try without description
              try {
                s.videoDecoder.configure({ codec: vt.codec, codedWidth: vt.video?.width || 640, codedHeight: vt.video?.height || 360 });
              } catch (e2) {
                console.error("[WasmPlayer] VideoDecoder configure failed again:", e2);
              }
            }

            mp4.setExtractionOptions(vt.id, "video", { nbSamples: 20 });
          }

          if (at && s.audioDecoder) {
            console.log("[WasmPlayer] Audio:", at.codec);
            try {
              const acfg: AudioDecoderConfig = {
                codec: at.codec,
                sampleRate: at.audio?.sample_rate || 44100,
                numberOfChannels: at.audio?.channel_count || 2,
              };

              // Try to get audio description (esds)
              try {
                const trak = mp4.getTrackById(at.id);
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                for (const entry of trak.mdia.minf.stbl.stsd.entries) {
                  if (entry.esds) {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const ds = new (MP4Box as any).DataStream(undefined, 0, (MP4Box as any).DataStream.BIG_ENDIAN);
                    entry.esds.write(ds);
                    acfg.description = new Uint8Array(ds.buffer, 8);
                    break;
                  }
                }
              } catch { /* no audio desc */ }

              s.audioDecoder.configure(acfg);
              mp4.setExtractionOptions(at.id, "audio", { nbSamples: 20 });
            } catch (e) {
              console.warn("[WasmPlayer] AudioDecoder setup failed:", e);
            }
          }

          mp4.start();
        };

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        mp4.onSamples = (_id: number, type: string, samples: any[]) => {
          if (s.cancelled) return;

          for (const sample of samples) {
            const ts = (sample.cts * 1_000_000) / sample.timescale;
            const dur = (sample.duration * 1_000_000) / sample.timescale;

            try {
              if (type === "video" && s.videoDecoder?.state === "configured") {
                s.videoDecoder.decode(new EncodedVideoChunk({
                  type: sample.is_sync ? "key" : "delta",
                  timestamp: ts, duration: dur, data: sample.data,
                }));
              } else if (type === "audio" && s.audioDecoder?.state === "configured") {
                s.audioDecoder.decode(new EncodedAudioChunk({
                  type: "key", timestamp: ts, data: sample.data,
                }));
              }
            } catch (e) {
              console.warn("[WasmPlayer] Decode error:", e);
            }
          }
        };

        mp4.onError = (e: string) => {
          console.error("[WasmPlayer] MP4Box error:", e);
        };

        // Stream the video — feed chunks as they arrive
        setStatus("Downloading...");
        const res = await fetch(streamUrl, {
          headers: { "ngrok-skip-browser-warning": "true" },
        });

        if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

        const reader = res.body.getReader();
        let offset = 0;

        while (true) {
          const { done, value } = await reader.read();
          if (done || s.cancelled) break;

          const buf = value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength) as ArrayBuffer & { fileStart: number };
          buf.fileStart = offset;
          offset += buf.byteLength;
          setStatus(`Buffering... ${Math.round(offset / 1024)} KB`);

          try {
            mp4.appendBuffer(buf);
          } catch (e) {
            console.warn("[WasmPlayer] appendBuffer error:", e);
          }
        }

        try { mp4.flush(); } catch { /* flush error */ }

        // If playback never started, start now
        if (!s.started && s.frameQueue.length > 0) startPlayback();

        // If we still have no frames at all
        if (!s.started) {
          setError("Could not decode video frames");
          setLoading(false);
        }
      } catch (err) {
        if (!s.cancelled) {
          console.error("[WasmPlayer] Fatal error:", err);
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
      try { s.videoDecoder?.close(); } catch {}
      try { s.audioDecoder?.close(); } catch {}
      try { s.audioCtx?.close(); } catch {}
    };
  }, [streamUrl, renderLoop, startPlayback]);

  const togglePlay = () => {
    const s = stateRef.current;
    if (s.paused) {
      s.paused = false;
      s.startTime += performance.now() - s.pausedAt;
      s.audioCtx?.resume();
      setPlaying(true);
      renderLoop();
    } else {
      s.paused = true;
      s.pausedAt = performance.now();
      s.audioCtx?.suspend();
      setPlaying(false);
    }
  };

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
        <div style={{ width: "100%", height: 4, background: "rgba(75,85,99,0.5)", borderRadius: 2, overflow: "hidden" }}>
          <div style={{ width: `${progress}%`, height: "100%", background: "#FF0000", borderRadius: 2 }} />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 8 }}>
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
