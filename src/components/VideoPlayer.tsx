"use client";

import { useState, useRef } from "react";

export default function VideoPlayer() {
  const [url, setUrl] = useState("");
  const [isPlaying, setIsPlaying] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const getEmbedUrl = (input: string): string | null => {
    try {
      const u = new URL(input);
      // YouTube
      if (u.hostname.includes("youtube.com") || u.hostname.includes("youtu.be")) {
        const videoId = u.hostname.includes("youtu.be")
          ? u.pathname.slice(1)
          : u.searchParams.get("v");
        if (videoId) return `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1`;
      }
      // Twitch
      if (u.hostname.includes("twitch.tv")) {
        const channel = u.pathname.split("/").filter(Boolean)[0];
        if (channel)
          return `https://player.twitch.tv/?channel=${channel}&parent=${window.location.hostname}`;
      }
      // Direct video URL
      if (/\.(mp4|webm|ogv|ogg)(\?|$)/i.test(input)) {
        return input;
      }
      return input;
    } catch {
      return null;
    }
  };

  const handlePlay = () => {
    if (url.trim()) setIsPlaying(true);
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const embedUrl = isPlaying ? getEmbedUrl(url) : null;
  const isDirectVideo = embedUrl && /\.(mp4|webm|ogv|ogg)(\?|$)/i.test(embedUrl);

  return (
    <div ref={containerRef} className="w-full">
      {!isPlaying ? (
        <div className="bg-gray-900/60 backdrop-blur-sm border border-cyan-500/20 rounded-2xl p-6">
          <h2 className="text-cyan-400 font-semibold mb-4 flex items-center gap-2">
            <span className="text-lg">▶</span> Video Player
          </h2>
          <div className="flex gap-3">
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handlePlay()}
              placeholder="Paste a YouTube, Twitch, or video URL..."
              className="flex-1 bg-gray-800/80 border border-gray-700/50 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500/50 focus:shadow-[0_0_10px_rgba(0,255,255,0.1)] transition-all"
            />
            <button
              onClick={handlePlay}
              disabled={!url.trim()}
              className="px-6 py-3 bg-cyan-500/20 text-cyan-400 border border-cyan-500/50 rounded-xl font-medium hover:bg-cyan-500/30 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            >
              Play
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-gray-900/60 backdrop-blur-sm border border-cyan-500/20 rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2 border-b border-gray-800">
            <span className="text-gray-400 text-sm truncate max-w-md">{url}</span>
            <div className="flex gap-2">
              <button
                onClick={toggleFullscreen}
                className="text-gray-400 hover:text-cyan-400 transition-colors text-sm px-3 py-1"
              >
                {isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
              </button>
              <button
                onClick={() => {
                  setIsPlaying(false);
                  setUrl("");
                }}
                className="text-gray-400 hover:text-red-400 transition-colors text-sm px-3 py-1"
              >
                Close
              </button>
            </div>
          </div>
          <div className="aspect-video w-full bg-black">
            {isDirectVideo ? (
              <video src={embedUrl} controls autoPlay className="w-full h-full" />
            ) : (
              <iframe
                src={embedUrl || ""}
                className="w-full h-full"
                allow="autoplay; fullscreen; encrypted-media"
                allowFullScreen
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
