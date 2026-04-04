"use client";

import { useState, useEffect } from "react";

const PROXY_URL = "https://yavik-proxy.ineffableconstruction.ca";

const LANGUAGES = [
  { code: "tamil", label: "Tamil" },
  { code: "hindi", label: "Hindi" },
  { code: "telugu", label: "Telugu" },
  { code: "malayalam", label: "Malayalam" },
  { code: "kannada", label: "Kannada" },
  { code: "bengali", label: "Bengali" },
  { code: "marathi", label: "Marathi" },
  { code: "punjabi", label: "Punjabi" },
];

interface Movie {
  id: string;
  title: string;
  thumbnail: string;
  year: string;
}

interface EinthusanBrowserProps {
  onPlay: (movieId: string, title: string, streamUrl: string) => void;
  onClose: () => void;
}

export default function EinthusanBrowser({ onPlay, onClose }: EinthusanBrowserProps) {
  const [loggedIn, setLoggedIn] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);

  const [query, setQuery] = useState("");
  const [lang, setLang] = useState("tamil");
  const [results, setResults] = useState<Movie[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [loadingMovie, setLoadingMovie] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${PROXY_URL}/ein/status`).then(r => r.json()).then(d => {
      setLoggedIn(d.loggedIn);
      if (!d.loggedIn) setShowLogin(true);
    }).catch(() => setShowLogin(true));
  }, []);

  const handleLogin = async () => {
    setLoginLoading(true);
    setLoginError("");
    try {
      const res = await fetch(`${PROXY_URL}/ein/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (data.success) {
        setLoggedIn(true);
        setShowLogin(false);
      } else {
        setLoginError(data.error || "Login failed — check email and password");
      }
    } catch {
      setLoginError("Could not connect to proxy");
    }
    setLoginLoading(false);
  };

  const handleSearch = async () => {
    const q = query.trim();
    if (!q) return;
    setSearching(true);
    setSearched(true);
    try {
      const res = await fetch(`${PROXY_URL}/ein/search?q=${encodeURIComponent(q)}&lang=${lang}`);
      const data = await res.json();
      setResults(data.movies || []);
    } catch {
      setResults([]);
    }
    setSearching(false);
  };

  const handlePlay = async (movie: Movie) => {
    setLoadingMovie(movie.id);
    try {
      const res = await fetch(`${PROXY_URL}/ein/stream?id=${movie.id}`);
      const data = await res.json();
      if (data.url) {
        const fullUrl = data.url.startsWith("/") ? `${PROXY_URL}${data.url}` : data.url;
        onPlay(movie.id, data.title || movie.title, fullUrl);
      } else if (data.error?.includes("Login required")) {
        setShowLogin(true);
      } else {
        alert(data.error || "Could not load movie");
      }
    } catch {
      alert("Failed to load movie");
    }
    setLoadingMovie(null);
  };

  // Login screen
  if (showLogin) {
    return (
      <div style={{ position: "fixed", inset: 0, zIndex: 100, background: "#030712", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <button onClick={onClose} style={{ position: "absolute", top: 16, right: 16, padding: "8px 24px", background: "rgba(239,68,68,0.12)", color: "#f87171", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer", minHeight: 44 }}>Close</button>

        <div style={{ maxWidth: 400, width: "100%", padding: "0 24px" }}>
          <div style={{ textAlign: "center", marginBottom: 32 }}>
            <div style={{ width: 64, height: 64, borderRadius: 16, background: "#E50914", display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
              <span style={{ color: "#fff", fontWeight: 800, fontSize: 24 }}>E</span>
            </div>
            <h2 style={{ color: "#fff", fontSize: 24, fontWeight: 700, margin: "0 0 4px" }}>Einthusan</h2>
            <p style={{ color: "#9ca3af", fontSize: 14, margin: 0 }}>Sign in to watch movies</p>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" autoFocus
              style={{ background: "rgba(31,41,55,0.6)", border: "1px solid rgba(75,85,99,0.5)", borderRadius: 12, padding: "14px 16px", color: "#fff", fontSize: 15, outline: "none", minHeight: 48 }} />
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Password"
              onKeyDown={e => e.key === "Enter" && handleLogin()}
              style={{ background: "rgba(31,41,55,0.6)", border: "1px solid rgba(75,85,99,0.5)", borderRadius: 12, padding: "14px 16px", color: "#fff", fontSize: 15, outline: "none", minHeight: 48 }} />

            {loginError && <div style={{ color: "#f87171", fontSize: 13 }}>{loginError}</div>}

            <button onClick={handleLogin} disabled={loginLoading || !email || !password}
              style={{ padding: "14px", background: email && password && !loginLoading ? "#E50914" : "rgba(31,41,55,0.4)", color: "#fff", border: "none", borderRadius: 12, fontSize: 16, fontWeight: 700, cursor: email && password ? "pointer" : "default", minHeight: 48 }}>
              {loginLoading ? "Signing in..." : "Sign In"}
            </button>

            <button onClick={() => { setShowLogin(false); }}
              style={{ padding: "10px", background: "transparent", color: "#6b7280", border: "none", fontSize: 13, cursor: "pointer", minHeight: 44 }}>
              Skip — browse without account
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 100, background: "#030712", display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 20px", borderBottom: "1px solid rgba(229,9,20,0.2)", flexShrink: 0 }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: "#E50914", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <span style={{ color: "#fff", fontWeight: 800, fontSize: 16 }}>E</span>
        </div>
        <span style={{ color: "#fff", fontWeight: 700, fontSize: 16, flexShrink: 0 }}>Einthusan</span>

        {/* Language selector */}
        <select value={lang} onChange={e => setLang(e.target.value)}
          style={{ background: "rgba(31,41,55,0.6)", border: "1px solid rgba(75,85,99,0.4)", borderRadius: 8, padding: "8px 12px", color: "#fff", fontSize: 13, outline: "none", minHeight: 40 }}>
          {LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
        </select>

        {/* Search */}
        <div style={{ flex: 1, display: "flex", gap: 10 }}>
          <input type="text" value={query} onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleSearch()}
            placeholder="Search movies..."
            style={{ flex: 1, background: "rgba(31,41,55,0.6)", border: "1px solid rgba(75,85,99,0.5)", borderRadius: 12, padding: "10px 16px", color: "#fff", fontSize: 15, outline: "none", minHeight: 48 }} />
          <button onClick={handleSearch} disabled={!query.trim() || searching}
            style={{ padding: "10px 24px", background: query.trim() && !searching ? "#E50914" : "rgba(31,41,55,0.4)", color: "#fff", border: "none", borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: query.trim() ? "pointer" : "default", minHeight: 48 }}>
            {searching ? "..." : "Search"}
          </button>
        </div>

        <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
          {!loggedIn && <button onClick={() => setShowLogin(true)} style={{ padding: "8px 16px", background: "rgba(229,9,20,0.15)", color: "#E50914", border: "1px solid rgba(229,9,20,0.3)", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer", minHeight: 40 }}>Sign In</button>}
          <button onClick={onClose} style={{ padding: "8px 20px", background: "rgba(239,68,68,0.12)", color: "#f87171", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer", minHeight: 40 }}>Close</button>
        </div>
      </div>

      {/* Results */}
      <div className="scroll-area" style={{ flex: 1, padding: "16px 20px", minHeight: 0 }}>
        {!searched && (
          <div style={{ textAlign: "center", padding: "80px 0" }}>
            <p style={{ color: "#6b7280", fontSize: 16 }}>Search for a movie to watch</p>
          </div>
        )}

        {searching && (
          <div style={{ textAlign: "center", padding: "60px 0" }}>
            <p style={{ color: "#E50914", fontSize: 16 }}>Searching...</p>
          </div>
        )}

        {searched && !searching && results.length === 0 && (
          <div style={{ textAlign: "center", padding: "60px 0" }}>
            <p style={{ color: "#6b7280", fontSize: 16 }}>No movies found</p>
          </div>
        )}

        {results.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 16 }}>
            {results.map(movie => (
              <div key={movie.id} onClick={() => handlePlay(movie)}
                style={{ background: "rgba(17,24,39,0.7)", border: "1px solid rgba(75,85,99,0.3)", borderRadius: 14, overflow: "hidden", cursor: "pointer" }}>
                <div style={{ position: "relative", width: "100%", paddingTop: "150%", background: "#111827" }}>
                  {movie.thumbnail && <img src={movie.thumbnail} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />}
                  {loadingMovie === movie.id && (
                    <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <span style={{ color: "#E50914", fontWeight: 600 }}>Loading...</span>
                    </div>
                  )}
                </div>
                <div style={{ padding: "8px 10px" }}>
                  <div style={{ color: "#fff", fontSize: 13, fontWeight: 600, lineHeight: 1.3, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{movie.title}</div>
                  {movie.year && <div style={{ color: "#6b7280", fontSize: 11, marginTop: 2 }}>{movie.year}</div>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
