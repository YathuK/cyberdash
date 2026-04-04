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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const stateRef = useRef<{
    audioCtx: AudioContext | null;
    videoDecoder: VideoDecoder | null;
    audioDecoder: AudioDecoder | null;
    frameQueue: VideoFrame[];
    startTime: number;
    audioStartTime: number;
    rafId: number;
    paused: boolean;
    pausedAt: number;
    totalDuration: number;
  }>({
    audioCtx: null,
    videoDecoder: null,
    audioDecoder: null,
    frameQueue: [],
    startTime: 0,
    audioStartTime: 0,
    rafId: 0,
    paused: false,
    pausedAt: 0,
    totalDuration: 0,
  });

  const renderLoop = useCallback(() => {
    const s = stateRef.current;
    if (s.paused) return;

    const canvas = canvasRef.current;
    if (!canvas) { s.rafId = requestAnimationFrame(renderLoop); return; }

    const ctx = canvas.getContext("2d");
    if (!ctx) { s.rafId = requestAnimationFrame(renderLoop); return; }

    const elapsed = (performance.now() - s.startTime) * 1000; // microseconds

    // Drop late frames, draw current
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

      // Update progress
      const timeSec = elapsed / 1_000_000;
      setCurrentTime(timeSec);
      if (s.totalDuration > 0) setProgress((timeSec / s.totalDuration) * 100);
    }

    s.rafId = requestAnimationFrame(renderLoop);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const s = stateRef.current;

    async function init() {
      try {
        // Check WebCodecs support
        if (typeof VideoDecoder === "undefined") {
          setError("WebCodecs not supported in this browser");
          setLoading(false);
          return;
        }

        // Dynamically import mp4box
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const MP4Box = (await import("mp4box")) as any;

        // Fetch the video
        const res = await fetch(streamUrl, {
          headers: { "ngrok-skip-browser-warning": "true" },
        });
        if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
        const arrayBuffer = await res.arrayBuffer();
        if (cancelled) return;

        // Set up decoders
        s.videoDecoder = new VideoDecoder({
          output: (frame) => {
            s.frameQueue.push(frame);
          },
          error: (e) => console.error("VideoDecoder error:", e),
        });

        // Audio context (needs user gesture on Tesla)
        s.audioCtx = new AudioContext();
        s.audioStartTime = 0;

        s.audioDecoder = new AudioDecoder({
          output: (audioData) => {
            if (!s.audioCtx) { audioData.close(); return; }

            try {
              const buffer = s.audioCtx.createBuffer(
                audioData.numberOfChannels,
                audioData.numberOfFrames,
                audioData.sampleRate
              );

              for (let ch = 0; ch < audioData.numberOfChannels; ch++) {
                const channelData = new Float32Array(audioData.numberOfFrames);
                audioData.copyTo(channelData, { planeIndex: ch, format: "f32-planar" });
                buffer.copyToChannel(channelData, ch);
              }

              const source = s.audioCtx.createBufferSource();
              source.buffer = buffer;
              source.connect(s.audioCtx.destination);

              const playAt = audioData.timestamp / 1_000_000;
              if (s.audioStartTime === 0) s.audioStartTime = s.audioCtx.currentTime;
              source.start(s.audioStartTime + playAt);
            } catch {
              // Audio scheduling error — non-fatal
            }

            audioData.close();
          },
          error: (e) => console.error("AudioDecoder error:", e),
        });

        // Demux MP4
        const mp4boxFile = MP4Box.createFile();

        mp4boxFile.onReady = (info: {
          duration: number;
          timescale: number;
          tracks: Array<{
            id: number;
            type: string;
            codec: string;
            video?: { width: number; height: number };
            audio?: { sample_rate: number; channel_count: number };
          }>;
        }) => {
          if (cancelled) return;

          s.totalDuration = info.duration / info.timescale;
          setDuration(s.totalDuration);

          const videoTrack = info.tracks.find((t) => t.type === "video");
          const audioTrack = info.tracks.find((t) => t.type === "audio");

          if (videoTrack && s.videoDecoder) {
            // Get avcC description
            const trak = mp4boxFile.getTrackById(videoTrack.id);
            let description: Uint8Array | undefined;

            try {
              for (const entry of trak.mdia.minf.stbl.stsd.entries) {
                const box = entry.avcC || entry.hvcC;
                if (box) {
                  const stream = new MP4Box.DataStream(undefined, 0, MP4Box.DataStream.BIG_ENDIAN);
                  box.write(stream);
                  description = new Uint8Array(stream.buffer, 8);
                  break;
                }
              }
            } catch {
              // description extraction failed
            }

            const config: VideoDecoderConfig = {
              codec: videoTrack.codec,
              codedWidth: videoTrack.video?.width,
              codedHeight: videoTrack.video?.height,
            };
            if (description) config.description = description;

            s.videoDecoder.configure(config);
            mp4boxFile.setExtractionOptions(videoTrack.id, "video", { nbSamples: 50 });
          }

          if (audioTrack && s.audioDecoder) {
            // Get esds/audio description
            const trak = mp4boxFile.getTrackById(audioTrack.id);
            let audioDesc: Uint8Array | undefined;

            try {
              for (const entry of trak.mdia.minf.stbl.stsd.entries) {
                const box = entry.esds;
                if (box) {
                  const stream = new MP4Box.DataStream(undefined, 0, MP4Box.DataStream.BIG_ENDIAN);
                  box.write(stream);
                  audioDesc = new Uint8Array(stream.buffer, 8);
                  break;
                }
              }
            } catch {
              // audio description extraction failed
            }

            const audioConfig: AudioDecoderConfig = {
              codec: audioTrack.codec,
              sampleRate: audioTrack.audio?.sample_rate || 44100,
              numberOfChannels: audioTrack.audio?.channel_count || 2,
            };
            if (audioDesc) audioConfig.description = audioDesc;

            try {
              s.audioDecoder.configure(audioConfig);
              mp4boxFile.setExtractionOptions(audioTrack.id, "audio", { nbSamples: 50 });
            } catch {
              // Audio decode not supported — video only
            }
          }

          mp4boxFile.start();
        };

        mp4boxFile.onSamples = (_trackId: number, type: string, samples: Array<{
          is_sync: boolean;
          cts: number;
          duration: number;
          timescale: number;
          data: ArrayBuffer;
        }>) => {
          if (cancelled) return;

          for (const sample of samples) {
            const timestamp = (sample.cts * 1_000_000) / sample.timescale;
            const dur = (sample.duration * 1_000_000) / sample.timescale;

            if (type === "video" && s.videoDecoder?.state === "configured") {
              s.videoDecoder.decode(new EncodedVideoChunk({
                type: sample.is_sync ? "key" : "delta",
                timestamp,
                duration: dur,
                data: sample.data,
              }));
            } else if (type === "audio" && s.audioDecoder?.state === "configured") {
              s.audioDecoder.decode(new EncodedAudioChunk({
                type: "key",
                timestamp,
                data: sample.data,
              }));
            }
          }
        };

        // Feed the buffer to MP4Box
        (arrayBuffer as ArrayBuffer & { fileStart: number }).fileStart = 0;
        mp4boxFile.appendBuffer(arrayBuffer);
        mp4boxFile.flush();

        // Start playback
        setLoading(false);
        setPlaying(true);
        s.startTime = performance.now();
        s.paused = false;

        // Resume audio context (needs user gesture, but try)
        s.audioCtx.resume().catch(() => {});

        renderLoop();
      } catch (err) {
        if (!cancelled) {
          setError(`Failed: ${err instanceof Error ? err.message : err}`);
          setLoading(false);
        }
      }
    }

    init();

    return () => {
      cancelled = true;
      cancelAnimationFrame(s.rafId);
      s.frameQueue.forEach((f) => f.close());
      s.frameQueue = [];
      try { s.videoDecoder?.close(); } catch {}
      try { s.audioDecoder?.close(); } catch {}
      try { s.audioCtx?.close(); } catch {}
      s.videoDecoder = null;
      s.audioDecoder = null;
      s.audioCtx = null;
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

  const formatTime = (sec: number) => {
    if (!isFinite(sec)) return "0:00";
    return `${Math.floor(sec / 60)}:${Math.floor(sec % 60).toString().padStart(2, "0")}`;
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 100, background: "#000", display: "flex", flexDirection: "column" }}>
      {/* Top bar */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "6px 16px", background: "rgba(3,7,18,0.95)",
        borderBottom: "1px solid rgba(34,211,238,0.15)", flexShrink: 0, height: 48,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, overflow: "hidden", flex: 1 }}>
          <span style={{ color: "var(--cyan)", fontWeight: 700, fontSize: 14, flexShrink: 0 }}>YaVik</span>
          <span style={{ color: "#6b7280" }}>/</span>
          <span style={{ color: "#e5e7eb", fontSize: 14, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title}</span>
          <span style={{ color: "#22c55e", fontSize: 10, fontWeight: 700, textTransform: "uppercase", flexShrink: 0 }}>
            Drive Safe
          </span>
        </div>
        <button onClick={onClose} style={{
          padding: "8px 24px", background: "rgba(239,68,68,0.12)", color: "#f87171",
          border: "1px solid rgba(239,68,68,0.25)", borderRadius: 8,
          fontSize: 14, fontWeight: 600, cursor: "pointer", minHeight: 40,
        }}>Close</button>
      </div>

      {/* Canvas — pure software decode, no <video> element anywhere */}
      <div style={{ flex: 1, position: "relative", background: "#000", overflow: "hidden" }} onClick={togglePlay}>
        <canvas ref={canvasRef} style={{
          width: "100%", height: "100%", objectFit: "contain", display: "block",
        }} />

        {loading && (
          <div style={{ position: "absolute", inset: 0, zIndex: 2, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.85)" }}>
            <div style={{ color: "var(--cyan)", fontSize: 18, fontWeight: 600, marginBottom: 8 }}>Loading video...</div>
            <div style={{ color: "#6b7280", fontSize: 13 }}>Downloading and decoding</div>
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

      {/* Controls */}
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
          <span style={{ color: "#9ca3af", fontSize: 13, fontFamily: "monospace" }}>{formatTime(currentTime)} / {formatTime(duration)}</span>
        </div>
      </div>
    </div>
  );
}
