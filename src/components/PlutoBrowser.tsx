"use client";

import { useState, useEffect } from "react";

const PROXY_URL = "https://yavik-proxy.ineffableconstruction.ca";

interface Movie {
  id: string;
  title: string;
  thumbnail: string;
  description?: string;
  duration?: string;
  rating?: string;
}

interface Category {
  name: string;
  items: Movie[];
}

interface PlutoBrowserProps {
  onPlay: (id: string, title: string, streamUrl: string) => void;
  onClose: () => void;
}

export default function PlutoBrowser({ onPlay, onClose }: PlutoBrowserProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Movie[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [loadingItem, setLoadingItem] = useState<string | null>(null);
  const [loadingCats, setLoadingCats] = useState(true);

  useEffect(() => {
    fetch(`${PROXY_URL}/pluto/categories`).then(r => r.json()).then(d => {
      setCategories(d.categories || []);
      setLoadingCats(false);
    }).catch(() => setLoadingCats(false));
  }, []);

  const handleSearch = async () => {
    const q = query.trim();
    if (!q) return;
    setSearching(true);
    setSearched(true);
    try {
      const res = await fetch(`${PROXY_URL}/pluto/search?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      setResults(data.results || []);
    } catch { setResults([]); }
    setSearching(false);
  };

  const handlePlay = async (movie: Movie) => {
    setLoadingItem(movie.id);
    try {
      const res = await fetch(`${PROXY_URL}/pluto/stream?id=${movie.id}`);
      const data = await res.json();
      if (data.url) {
        // Proxy the HLS through our server for CORS
        const proxiedUrl = `${PROXY_URL}/pluto/proxy?url=${encodeURIComponent(data.url)}`;
        onPlay(movie.id, movie.title, proxiedUrl);
      }
    } catch {}
    setLoadingItem(null);
  };

  const MovieCard = ({ movie }: { movie: Movie }) => (
    <div onClick={() => handlePlay(movie)}
      style={{ background: "rgba(17,24,39,0.7)", border: "1px solid rgba(75,85,99,0.3)", borderRadius: 14, overflow: "hidden", cursor: "pointer", flexShrink: 0, width: 180 }}>
      <div style={{ position: "relative", width: "100%", paddingTop: "150%", background: "#111827" }}>
        {movie.thumbnail && <img src={movie.thumbnail} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />}
        {loadingItem === movie.id && (
          <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ color: "#6366f1", fontWeight: 600 }}>Loading...</span>
          </div>
        )}
        {movie.rating && (
          <span style={{ position: "absolute", top: 6, right: 6, background: "rgba(0,0,0,0.8)", color: "#fff", fontSize: 10, fontWeight: 600, padding: "2px 6px", borderRadius: 4 }}>{movie.rating}</span>
        )}
      </div>
      <div style={{ padding: "8px 10px" }}>
        <div style={{ color: "#fff", fontSize: 13, fontWeight: 600, lineHeight: 1.3, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{movie.title}</div>
        {movie.duration && <div style={{ color: "#6b7280", fontSize: 11, marginTop: 2 }}>{movie.duration}</div>}
      </div>
    </div>
  );

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 100, background: "#030712", display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 20px", borderBottom: "1px solid rgba(99,102,241,0.2)", flexShrink: 0 }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: "linear-gradient(135deg, #6366f1, #8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <span style={{ color: "#fff", fontWeight: 800, fontSize: 14 }}>P</span>
        </div>
        <span style={{ color: "#fff", fontWeight: 700, fontSize: 16, flexShrink: 0 }}>Pluto TV</span>

        <div style={{ flex: 1, display: "flex", gap: 10 }}>
          <input type="text" value={query} onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleSearch()}
            placeholder="Search movies & shows..."
            style={{ flex: 1, background: "rgba(31,41,55,0.6)", border: "1px solid rgba(75,85,99,0.5)", borderRadius: 12, padding: "10px 16px", color: "#fff", fontSize: 15, outline: "none", minHeight: 48 }} />
          <button onClick={handleSearch} disabled={!query.trim() || searching}
            style={{ padding: "10px 24px", background: query.trim() && !searching ? "#6366f1" : "rgba(31,41,55,0.4)", color: "#fff", border: "none", borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: query.trim() ? "pointer" : "default", minHeight: 48 }}>
            {searching ? "..." : "Search"}
          </button>
        </div>

        <button onClick={onClose} style={{ padding: "8px 20px", background: "rgba(239,68,68,0.12)", color: "#f87171", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer", minHeight: 40 }}>Close</button>
      </div>

      {/* Content */}
      <div className="scroll-area" style={{ flex: 1, padding: "16px 20px", minHeight: 0 }}>
        {searched ? (
          <>
            {searching && <div style={{ textAlign: "center", padding: "60px 0", color: "#6366f1" }}>Searching...</div>}
            {!searching && results.length === 0 && <div style={{ textAlign: "center", padding: "60px 0", color: "#6b7280" }}>No results found</div>}
            {!searching && results.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 16, justifyContent: "center" }}>
                {results.map(m => <MovieCard key={m.id} movie={m} />)}
              </div>
            )}
          </>
        ) : loadingCats ? (
          <div style={{ textAlign: "center", padding: "60px 0", color: "#6366f1" }}>Loading catalog...</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            {categories.map(cat => (
              <div key={cat.name}>
                <h3 style={{ color: "#e5e7eb", fontSize: 16, fontWeight: 700, marginBottom: 12 }}>{cat.name}</h3>
                <div style={{ display: "flex", gap: 12, overflowX: "auto", paddingBottom: 8 }} className="scroll-area">
                  {cat.items.map(m => <MovieCard key={m.id} movie={m} />)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
