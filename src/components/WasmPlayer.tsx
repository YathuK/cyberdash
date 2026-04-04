"use client";

import { useEffect, useRef, useState, useCallback } from "react";

interface WasmPlayerProps {
  videoId: string;
  title: string;
  streamUrl: string;
  onClose: () => void;
}

export default function WasmPlayer({ videoId, title, streamUrl, onClose }: WasmPlayerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<{
    audioCtx: AudioContext | null;
    videoDecoder: VideoDecoder | null;
    audioDecoder: AudioDecoder | null;
    frameQueue: VideoFrame[];
    startTime: number;
    audioBaseTime: number;
    rafId: number;
    paused: boolean;
    pausedAt: number;
    totalDuration: number;
    cancelled: boolean;
  }>({
    audioCtx: null, videoDecoder: null, audioDecoder: null,
    frameQueue: [], startTime: 0, audioBaseTime: 0, rafId: 0,
    paused: false, pausedAt: 0, totalDuration: 0, cancelled: false,
  });

  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [downloaded, setDownloaded] = useState(0);

  const renderLoop = useCallback(() => {
    const s = stateRef.current;
    if (s.paused || s.cancelled) return;

    const canvas = canvasRef.current;
    if (!canvas) { s.rafId = requestAnimationFrame(renderLoop); return; }
    const ctx = canvas.getContext("2d");
    if (!ctx) { s.rafId = requestAnimationFrame(renderLoop); return; }

    const elapsed = (performance.now() - s.startTime) * 1000;

    while (s.frameQueue.length > 1 && s.frameQueue[0].timestamp < elapsed) {
      s.frameQueue.shift()!.close();
    }

    if (s.frameQueue.length > 0 && s.frameQueue[0].timestamp <= elapsed) {
      const frame = s.frameQueue.shift()!;
      if (canvas.width !== frame.displayWidth || canvas.height !== frame.displayHeight) {
        canvas.width = frame.displayWidth;
        canvas.height = frame.displayHeight;
      }
      ctx.drawImage(frame, 0, 0);
      frame.close();

      const timeSec = elapsed / 1_000_000;
      setCurrentTime(timeSec);
      if (s.totalDuration > 0) setProgress((timeSec / s.totalDuration) * 100);
    }

    s.rafId = requestAnimationFrame(renderLoop);
  }, []);

  useEffect(() => {
    const s = stateRef.current;
    s.cancelled = false;

    async function init() {
      try {
        if (typeof VideoDecoder === "undefined") {
          setError("WebCodecs not supported — need Chromium 94+");
          setLoading(false);
          return;
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const MP4Box = (await import("mp4box")) as any;

        // Set up video decoder
        s.videoDecoder = new VideoDecoder({
          output: (frame) => { if (!s.cancelled) s.frameQueue.push(frame); else frame.close(); },
          error: (e) => console.error("VideoDecoder:", e),
        });

        // Set up audio
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
              const playAt = audioData.timestamp / 1_000_000;
              if (s.audioBaseTime === 0) s.audioBaseTime = s.audioCtx.currentTime;
              src.start(s.audioBaseTime + playAt);
            } catch { /* audio error — non-fatal */ }
            audioData.close();
          },
          error: (e) => console.error("AudioDecoder:", e),
        });

        // Set up MP4 demuxer
        const mp4 = MP4Box.createFile();
        let playbackStarted = false;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        mp4.onReady = (info: any) => {
          if (s.cancelled) return;

          s.totalDuration = info.duration / info.timescale;
          setDuration(s.totalDuration);

          const vt = info.tracks.find((t: { type: string }) => t.type === "video");
          const at = info.tracks.find((t: { type: string }) => t.type === "audio");

          if (vt && s.videoDecoder) {
            let desc: Uint8Array | undefined;
            try {
              const trak = mp4.getTrackById(vt.id);
              for (const entry of trak.mdia.minf.stbl.stsd.entries) {
                const box = entry.avcC || entry.hvcC;
                if (box) {
                  const stream = new MP4Box.DataStream(undefined, 0, MP4Box.DataStream.BIG_ENDIAN);
                  box.write(stream);
                  desc = new Uint8Array(stream.buffer, 8);
                  break;
                }
              }
            } catch { /* no description */ }

            const cfg: VideoDecoderConfig = {
              codec: vt.codec,
              codedWidth: vt.video?.width,
              codedHeight: vt.video?.height,
            };
            if (desc) cfg.description = desc;
            s.videoDecoder.configure(cfg);
            mp4.setExtractionOptions(vt.id, "video", { nbSamples: 20 });
          }

          if (at && s.audioDecoder) {
            let audioDesc: Uint8Array | undefined;
            try {
              const trak = mp4.getTrackById(at.id);
              for (const entry of trak.mdia.minf.stbl.stsd.entries) {
                if (entry.esds) {
                  const stream = new MP4Box.DataStream(undefined, 0, MP4Box.DataStream.BIG_ENDIAN);
                  entry.esds.write(stream);
                  audioDesc = new Uint8Array(stream.buffer, 8);
                  break;
                }
              }
            } catch { /* no audio desc */ }

            try {
              const acfg: AudioDecoderConfig = {
                codec: at.codec,
                sampleRate: at.audio?.sample_rate || 44100,
                numberOfChannels: at.audio?.channel_count || 2,
              };
              if (audioDesc) acfg.description = audioDesc;
              s.audioDecoder.configure(acfg);
              mp4.setExtractionOptions(at.id, "audio", { nbSamples: 20 });
            } catch { /* audio not supported */ }
          }

          mp4.start();
        };

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        mp4.onSamples = (_id: number, type: string, samples: any[]) => {
          if (s.cancelled) return;

          for (const sample of samples) {
            const ts = (sample.cts * 1_000_000) / sample.timescale;
            const dur = (sample.duration * 1_000_000) / sample.timescale;

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
          }

          // Start playback as soon as we have some frames
          if (!playbackStarted && s.frameQueue.length > 2) {
            playbackStarted = true;
            s.startTime = performance.now();
            s.paused = false;
            s.audioCtx?.resume();
            setLoading(false);
            setPlaying(true);
            renderLoop();
          }
        };

        // STREAM the video — feed chunks to MP4Box as they arrive
        const res = await fetch(streamUrl, {
          headers: { "ngrok-skip-browser-warning": "true" },
        });

        if (!res.ok || !res.body) {
          throw new Error(`Fetch failed: ${res.status}`);
        }

        const reader = res.body.getReader();
        let offset = 0;

        while (true) {
          const { done, value } = await reader.read();
          if (done || s.cancelled) break;

          // Copy into an ArrayBuffer with fileStart for MP4Box
          const buf = value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength);
          (buf as ArrayBuffer & { fileStart: number }).fileStart = offset;
          offset += buf.byteLength;
          setDownloaded(Math.round(offset / 1024));

          mp4.appendBuffer(buf);
        }

        mp4.flush();

        // If playback never started (very short video), start now
        if (!playbackStarted && s.frameQueue.length > 0) {
          playbackStarted = true;
          s.startTime = performance.now();
          s.paused = false;
          s.audioCtx?.resume();
          setLoading(false);
          setPlaying(true);
          renderLoop();
        }
      } catch (err) {
        if (!s.cancelled) {
          console.error("WasmPlayer error:", err);
          setError(`Failed: ${err instanceof Error ? err.message : err}`);
          setLoading(false);
        }
      }
    }

    init();

    return () => {
      s.cancelled = true;
      cancelAnimationFrame(s.rafId);
      s.frameQueue.forEach((f) => f.close());
      s.frameQueue = [];
      try { s.videoDecoder?.close(); } catch {}
      try { s.audioDecoder?.close(); } catch {}
      try { s.audioCtx?.close(); } catch {}
    };
  }, [streamUrl, renderLoop]);

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

  const fmt = (sec: number) => {
    if (!isFinite(sec)) return "0:00";
    return `${Math.floor(sec / 60)}:${Math.floor(sec % 60).toString().padStart(2, "0")}`;
  };

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
            <div style={{ color: "var(--cyan)", fontSize: 18, fontWeight: 600, marginBottom: 8 }}>Loading video...</div>
            <div style={{ color: "#6b7280", fontSize: 13 }}>{downloaded > 0 ? `${downloaded} KB downloaded` : "Connecting..."}</div>
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
