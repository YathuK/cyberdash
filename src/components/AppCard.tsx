"use client";

import AppIcon from "./AppIcon";

interface App {
  id: string;
  name: string;
  url: string;
  icon: string;
  category: string;
  description: string | null;
}

export default function AppCard({
  app,
  isFavorite,
  onToggleFavorite,
}: {
  app: App;
  isFavorite: boolean;
  onToggleFavorite: (appId: string) => void;
}) {
  return (
    <div className="group relative bg-gray-900/60 backdrop-blur-sm border border-cyan-500/20 rounded-2xl p-4 hover:border-cyan-400/50 hover:bg-gray-900/80 transition-all duration-300 hover:shadow-[0_0_20px_rgba(0,255,255,0.1)]">
      <button
        onClick={() => onToggleFavorite(app.id)}
        className="absolute top-3 right-3 z-10 opacity-0 group-hover:opacity-100 transition-opacity"
        title={isFavorite ? "Remove from favorites" : "Add to favorites"}
      >
        <svg
          className={`w-5 h-5 ${isFavorite ? "text-cyan-400 fill-cyan-400" : "text-gray-500 hover:text-cyan-400"}`}
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
          fill={isFavorite ? "currentColor" : "none"}
        >
          <path d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
        </svg>
      </button>

      <a
        href={app.url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex flex-col items-center gap-3 text-center"
      >
        <AppIcon icon={app.icon} size={56} />
        <div>
          <h3 className="text-white font-semibold text-sm">{app.name}</h3>
          {app.description && (
            <p className="text-gray-400 text-xs mt-1 line-clamp-2">{app.description}</p>
          )}
        </div>
      </a>
    </div>
  );
}
