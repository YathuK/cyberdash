"use client";

import { useEffect, useState, useCallback } from "react";
import AppCard from "./AppCard";
import CategoryNav from "./CategoryNav";
import VideoPlayer from "./VideoPlayer";
import { getSessionId } from "@/lib/session";

interface App {
  id: string;
  name: string;
  url: string;
  icon: string;
  category: string;
  description: string | null;
}

export default function Dashboard() {
  const [apps, setApps] = useState<App[]>([]);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [category, setCategory] = useState("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const fetchApps = useCallback(async () => {
    const res = await fetch("/api/apps");
    const data = await res.json();
    setApps(data);
    setLoading(false);
  }, []);

  const fetchFavorites = useCallback(async () => {
    const sessionId = getSessionId();
    if (!sessionId) return;
    const res = await fetch(`/api/favorites?sessionId=${sessionId}`);
    const data = await res.json();
    setFavorites(new Set(data.map((f: { appId: string }) => f.appId)));
  }, []);

  useEffect(() => {
    fetchApps();
    fetchFavorites();
  }, [fetchApps, fetchFavorites]);

  const toggleFavorite = async (appId: string) => {
    const sessionId = getSessionId();
    await fetch("/api/favorites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ appId, sessionId }),
    });
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(appId)) next.delete(appId);
      else next.add(appId);
      return next;
    });
  };

  const filtered = apps.filter((app) => {
    if (category === "favorites") return favorites.has(app.id);
    if (category !== "all" && app.category !== category) return false;
    if (search && !app.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950">
      {/* Cyber grid background */}
      <div className="fixed inset-0 opacity-5 pointer-events-none"
        style={{
          backgroundImage: `linear-gradient(rgba(0,255,255,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(0,255,255,0.3) 1px, transparent 1px)`,
          backgroundSize: "60px 60px",
        }}
      />

      <div className="relative z-10 max-w-7xl mx-auto px-4 py-6">
        {/* Header */}
        <header className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center">
                <span className="text-cyan-400 font-bold text-lg">C</span>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white tracking-tight">
                  Cyber<span className="text-cyan-400">Dash</span>
                </h1>
                <p className="text-gray-500 text-xs tracking-widest uppercase">
                  Drive. Watch. Explore.
                </p>
              </div>
            </div>

            {/* Search */}
            <div className="relative w-72">
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search apps..."
                className="w-full bg-gray-800/50 border border-gray-700/50 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500/50 transition-all"
              />
            </div>
          </div>

          <CategoryNav active={category} onChange={setCategory} />
        </header>

        {/* Video Player */}
        <section className="mb-8">
          <VideoPlayer />
        </section>

        {/* App Grid */}
        <section>
          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="bg-gray-900/40 border border-gray-800/50 rounded-2xl p-4 h-32 animate-pulse"
                />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-gray-500 text-lg">
                {category === "favorites"
                  ? "No favorites yet. Star an app to add it here."
                  : "No apps found."}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {filtered.map((app) => (
                <AppCard
                  key={app.id}
                  app={app}
                  isFavorite={favorites.has(app.id)}
                  onToggleFavorite={toggleFavorite}
                />
              ))}
            </div>
          )}
        </section>

        {/* Footer */}
        <footer className="mt-12 py-6 border-t border-gray-800/50 text-center">
          <p className="text-gray-600 text-xs">
            CyberDash &mdash; Optimized for Tesla Browser
          </p>
        </footer>
      </div>
    </div>
  );
}
