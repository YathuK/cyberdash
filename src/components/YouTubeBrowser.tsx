"use client";

import { useState, useEffect } from "react";
import { searchYouTube } from "@/lib/youtubeClient";

const PROXY_URL = "https://yavik-proxy.ineffableconstruction.ca";

interface Video {
  id: string;
  title: string;
  thumbnail: string;
  author: string;
  duration: string;
  views: string;
}

interface Channel {
  id: string;
  title: string;
  thumbnail: string;
  description?: string;
}

interface YouTubeBrowserProps {
  onPlay: (videoId: string, title: string) => void;
  onClose: () => void;
}

export default function YouTubeBrowser({ onPlay, onClose }: YouTubeBrowserProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Video[]>([]);
  const [channelResults, setChannelResults] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [searchType, setSearchType] = useState<"video" | "channel">("video");

  // Auth
  const [ytLoggedIn, setYtLoggedIn] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [authCode, setAuthCode] = useState("");
  const [authUrl, setAuthUrl] = useState("");
  const [authPolling, setAuthPolling] = useState(false);

  // Feed & subscriptions
  const [feedVideos, setFeedVideos] = useState<Video[]>([]);
  const [subVideos, setSubVideos] = useState<Video[]>([]);
  const [subscriptions, setSubscriptions] = useState<Channel[]>([]);
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
  const [channelVideos, setChannelVideos] = useState<Video[]>([]);
  const [loadingChannel, setLoadingChannel] = useState(false);
  const [tab, setTab] = useState<"home" | "subscriptions">("home");

  useEffect(() => {
    fetch(`${PROXY_URL}/yt/auth/status`).then(r => r.json()).then(d => {
      setYtLoggedIn(d.loggedIn);
      if (d.loggedIn) { loadFeed(); loadSubscriptions(); }
    }).catch(() => {});
  }, []);

  const loadFeed = async () => {
    try {
      const res = await fetch(`${PROXY_URL}/yt/feed`);
      const data = await res.json();
      if (data.videos?.length > 0) setFeedVideos(data.videos);
    } catch {}
  };

  const loadSubscriptions = async () => {
    try {
      const res = await fetch(`${PROXY_URL}/yt/subscriptions`);
      const data = await res.json();
      if (data.videos?.length > 0) setSubVideos(data.videos);
    } catch {}
  };

  const openChannel = async (channel: Channel) => {
    setSelectedChannel(channel);
    setLoadingChannel(true);
    try {
      const res = await fetch(`${PROXY_URL}/yt/channel?id=${channel.id}`);
      const data = await res.json();
      setChannelVideos(data.videos || []);
    } catch {
      setChannelVideos([]);
    }
    setLoadingChannel(false);
  };

  const startAuth = async () => {
    if (authPolling) return;
    setShowLogin(true);
    setAuthCode("");
    try {
      const res = await fetch(`${PROXY_URL}/yt/auth/start`);
      const data = await res.json();
      if (data.error) { setAuthCode("ERROR"); return; }
      setAuthCode(data.userCode);
      setAuthUrl(data.verificationUrl);
      setAuthPolling(true);
      const poll = setInterval(async () => {
        try {
          const r = await fetch(`${PROXY_URL}/yt/auth/poll`);
          const d = await r.json();
          if (d.success) {
            clearInterval(poll);
            setYtLoggedIn(true);
            setShowLogin(false);
            setAuthPolling(false);
            setAuthCode("");
            loadFeed();
            loadSubscriptions();
          }
        } catch {}
      }, 3000);
      setTimeout(() => clearInterval(poll), 360000);
    } catch { setAuthCode("ERROR"); }
  };

  const handleSearch = async () => {
    const input = query.trim();
    if (!input) return;

    // Direct URL or video ID
    let videoId: string | null = null;
    try {
      const u = new URL(input);
      if (u.hostname.includes("youtu.be")) videoId = u.pathname.slice(1).split("/")[0];
      else if (u.hostname.includes("youtube.com")) videoId = u.searchParams.get("v");
    } catch {
      if (/^[a-zA-Z0-9_-]{11}$/.test(input)) videoId = input;
    }
    if (videoId) { onPlay(videoId, "YouTube Video"); return; }

    setLoading(true);
    setSearched(true);
    setSelectedChannel(null);

    if (searchType === "channel") {
      try {
        const res = await fetch(`${PROXY_URL}/search?q=${encodeURIComponent(input)}&type=channel`);
        const data = await res.json();
        setChannelResults(data.channels || []);
        setResults([]);
      } catch { setChannelResults([]); }
    } else {
      try {
        const videos = await searchYouTube(input);
        setResults(videos);
        setChannelResults([]);
      } catch { setResults([]); }
    }
    setLoading(false);
  };

  // Video grid component
  const VideoGrid = ({ videos }: { videos: Video[] }) => (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
      {videos.map(video => (
        <div key={video.id} onClick={() => onPlay(video.id, video.title)}
          style={{ background: "rgba(17,24,39,0.7)", border: "1px solid rgba(75,85,99,0.3)", borderRadius: 14, overflow: "hidden", cursor: "pointer" }}>
          <div style={{ position: "relative", width: "100%", paddingTop: "56.25%", background: "#111827" }}>
            {video.thumbnail && <img src={video.thumbnail} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />}
            {video.duration && <span style={{ position: "absolute", bottom: 6, right: 6, background: "rgba(0,0,0,0.8)", color: "#fff", fontSize: 12, fontWeight: 600, padding: "2px 6px", borderRadius: 4 }}>{video.duration}</span>}
          </div>
          <div style={{ padding: "10px 12px" }}>
            <div style={{ color: "#fff", fontSize: 14, fontWeight: 600, lineHeight: 1.3, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{video.title}</div>
            <div style={{ color: "#9ca3af", fontSize: 12, marginTop: 4 }}>{video.author}{video.views && ` · ${video.views}`}</div>
          </div>
        </div>
      ))}
    </div>
  );

  // Channel grid
  const ChannelGrid = ({ channels, onSelect }: { channels: Channel[]; onSelect: (ch: Channel) => void }) => (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12 }}>
      {channels.map(ch => (
        <div key={ch.id} onClick={() => onSelect(ch)}
          style={{ display: "flex", alignItems: "center", gap: 12, padding: 14, background: "rgba(17,24,39,0.7)", border: "1px solid rgba(75,85,99,0.3)", borderRadius: 14, cursor: "pointer" }}>
          {ch.thumbnail && <img src={ch.thumbnail} alt="" style={{ width: 48, height: 48, borderRadius: 999, objectFit: "cover" }} />}
          <div style={{ flex: 1, overflow: "hidden" }}>
            <div style={{ color: "#fff", fontSize: 14, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ch.title}</div>
            {ch.description && <div style={{ color: "#6b7280", fontSize: 11, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ch.description}</div>}
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 100, background: "#030712", display: "flex", flexDirection: "column" }}>
      {/* Login overlay */}
      {showLogin && (
        <div style={{ position: "fixed", inset: 0, zIndex: 50, background: "rgba(0,0,0,0.95)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
          <h2 style={{ color: "#fff", fontSize: 28, fontWeight: 700, marginBottom: 24 }}>Sign in to YouTube</h2>
          {authCode && authCode !== "ERROR" ? (
            <div style={{ textAlign: "center" }}>
              <p style={{ color: "#9ca3af", fontSize: 16, marginBottom: 16 }}>On your phone, go to:</p>
              <div style={{ background: "rgba(255,255,255,0.1)", padding: "16px 32px", borderRadius: 14, marginBottom: 24 }}>
                <span style={{ color: "#22d3ee", fontSize: 22, fontWeight: 700 }}>{authUrl}</span>
              </div>
              <p style={{ color: "#9ca3af", fontSize: 16, marginBottom: 12 }}>Enter this code:</p>
              <div style={{ background: "rgba(255,0,0,0.15)", border: "3px solid rgba(255,0,0,0.4)", padding: "20px 40px", borderRadius: 20, marginBottom: 20 }}>
                <span style={{ color: "#fff", fontSize: 40, fontWeight: 800, letterSpacing: "0.25em" }}>{authCode}</span>
              </div>
              <p style={{ color: "#22c55e", fontSize: 15, fontWeight: 600 }}>Waiting for you to approve...</p>
            </div>
          ) : authCode === "ERROR" ? (
            <p style={{ color: "#f87171", fontSize: 16 }}>Failed to start. Try again.</p>
          ) : (
            <p style={{ color: "#6b7280", fontSize: 16 }}>Getting your sign-in code...</p>
          )}
          <button onClick={() => { setShowLogin(false); setAuthPolling(false); }} style={{
            marginTop: 24, padding: "12px 32px", background: "rgba(239,68,68,0.12)", color: "#f87171",
            border: "1px solid rgba(239,68,68,0.25)", borderRadius: 10, fontSize: 16, fontWeight: 600, cursor: "pointer", minHeight: 48,
          }}>Cancel</button>
        </div>
      )}

      {/* Channel view */}
      {selectedChannel && (
        <div style={{ position: "fixed", inset: 0, zIndex: 40, background: "#030712", display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 20px", borderBottom: "1px solid rgba(75,85,99,0.3)", flexShrink: 0 }}>
            <button onClick={() => setSelectedChannel(null)} style={{
              padding: "8px 16px", background: "rgba(255,255,255,0.1)", color: "#fff",
              border: "none", borderRadius: 8, fontSize: 14, cursor: "pointer", minHeight: 40,
            }}>Back</button>
            {selectedChannel.thumbnail && <img src={selectedChannel.thumbnail} alt="" style={{ width: 36, height: 36, borderRadius: 999 }} />}
            <span style={{ color: "#fff", fontWeight: 700, fontSize: 18 }}>{selectedChannel.title}</span>
          </div>
          <div className="scroll-area" style={{ flex: 1, padding: "16px 20px" }}>
            {loadingChannel ? (
              <div style={{ textAlign: "center", padding: "40px 0", color: "#FF0000" }}>Loading videos...</div>
            ) : channelVideos.length === 0 ? (
              <div style={{ textAlign: "center", padding: "40px 0", color: "#6b7280" }}>No videos found</div>
            ) : (
              <VideoGrid videos={channelVideos} />
            )}
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 20px", borderBottom: "1px solid rgba(255,0,0,0.2)", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: "#FF0000", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width={18} height={18} viewBox="0 0 24 24" fill="#fff"><path d="M8 5v14l11-7z" /></svg>
          </div>
          <span style={{ color: "#fff", fontWeight: 700, fontSize: 16 }}>YouTube</span>
        </div>

        {/* Search type toggle */}
        <div style={{ display: "flex", gap: 4, background: "rgba(31,41,55,0.5)", borderRadius: 8, padding: 3, flexShrink: 0 }}>
          <button onClick={() => setSearchType("video")} style={{
            padding: "6px 12px", borderRadius: 6, border: "none", fontSize: 12, fontWeight: 600, cursor: "pointer", minHeight: 32, minWidth: 32,
            background: searchType === "video" ? "#FF0000" : "transparent", color: searchType === "video" ? "#fff" : "#9ca3af",
          }}>Videos</button>
          <button onClick={() => setSearchType("channel")} style={{
            padding: "6px 12px", borderRadius: 6, border: "none", fontSize: 12, fontWeight: 600, cursor: "pointer", minHeight: 32, minWidth: 32,
            background: searchType === "channel" ? "#FF0000" : "transparent", color: searchType === "channel" ? "#fff" : "#9ca3af",
          }}>Channels</button>
        </div>

        {/* Search */}
        <div style={{ flex: 1, display: "flex", gap: 10 }}>
          <input type="text" value={query} onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleSearch()}
            placeholder={searchType === "channel" ? "Search channels..." : "Search videos or paste URL..."}
            style={{ flex: 1, background: "rgba(31,41,55,0.6)", border: "1px solid rgba(75,85,99,0.5)", borderRadius: 12, padding: "10px 16px", color: "#fff", fontSize: 15, outline: "none", minHeight: 48 }} />
          <button onClick={handleSearch} disabled={!query.trim() || loading}
            style={{ padding: "10px 24px", background: query.trim() && !loading ? "#FF0000" : "rgba(31,41,55,0.4)", color: "#fff", border: "none", borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: query.trim() ? "pointer" : "default", minHeight: 48 }}>
            {loading ? "..." : "Search"}
          </button>
        </div>

        <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
          {!ytLoggedIn ? (
            <button onClick={startAuth} style={{ padding: "8px 16px", background: "rgba(255,255,255,0.1)", color: "#fff", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer", minHeight: 40 }}>Sign In</button>
          ) : (
            <span style={{ color: "#22c55e", fontSize: 12, fontWeight: 600, display: "flex", alignItems: "center" }}>Signed In</span>
          )}
          <button onClick={onClose} style={{ padding: "8px 20px", background: "rgba(239,68,68,0.12)", color: "#f87171", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer", minHeight: 40 }}>Close</button>
        </div>
      </div>

      {/* Tabs for logged in users */}
      {ytLoggedIn && !searched && (
        <div style={{ display: "flex", gap: 4, padding: "8px 20px", flexShrink: 0 }}>
          <button onClick={() => setTab("home")} style={{
            padding: "8px 20px", borderRadius: 8, border: "none", fontSize: 14, fontWeight: 600, cursor: "pointer", minHeight: 40,
            background: tab === "home" ? "rgba(255,0,0,0.15)" : "transparent", color: tab === "home" ? "#FF0000" : "#9ca3af",
          }}>Home Feed</button>
          <button onClick={() => setTab("subscriptions")} style={{
            padding: "8px 20px", borderRadius: 8, border: "none", fontSize: 14, fontWeight: 600, cursor: "pointer", minHeight: 40,
            background: tab === "subscriptions" ? "rgba(255,0,0,0.15)" : "transparent", color: tab === "subscriptions" ? "#FF0000" : "#9ca3af",
          }}>Subscriptions</button>
        </div>
      )}

      {/* Content */}
      <div className="scroll-area" style={{ flex: 1, padding: "16px 20px", minHeight: 0 }}>
        {/* Search results */}
        {searched ? (
          <>
            {loading && <div style={{ textAlign: "center", padding: "60px 0", color: "#FF0000" }}>Searching...</div>}
            {!loading && searchType === "channel" && channelResults.length > 0 && (
              <ChannelGrid channels={channelResults} onSelect={openChannel} />
            )}
            {!loading && searchType === "video" && results.length > 0 && (
              <VideoGrid videos={results} />
            )}
            {!loading && results.length === 0 && channelResults.length === 0 && (
              <div style={{ textAlign: "center", padding: "60px 0", color: "#6b7280" }}>No results found</div>
            )}
          </>
        ) : ytLoggedIn && tab === "subscriptions" ? (
          /* Subscriptions feed */
          subVideos.length > 0 ? (
            <VideoGrid videos={subVideos} />
          ) : (
            <div style={{ textAlign: "center", padding: "40px 0", color: "#6b7280" }}>Loading subscriptions...</div>
          )
        ) : ytLoggedIn && tab === "home" ? (
          /* Home feed */
          feedVideos.length > 0 ? (
            <VideoGrid videos={feedVideos} />
          ) : (
            <div style={{ textAlign: "center", padding: "40px 0", color: "#6b7280" }}>Loading your feed...</div>
          )
        ) : (
          /* Not logged in */
          <div style={{ textAlign: "center", padding: "80px 0" }}>
            <p style={{ color: "#6b7280", fontSize: 16, margin: "0 0 8px" }}>Search for videos or channels</p>
            <p style={{ color: "#4b5563", fontSize: 13 }}>Sign in to see your subscriptions and feed</p>
          </div>
        )}
      </div>
    </div>
  );
}
