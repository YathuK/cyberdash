"use client";

import AppIcon from "./AppIcon";
import { getOpenMode } from "@/lib/appConfig";

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
  onEmbed,
}: {
  app: App;
  isFavorite: boolean;
  onToggleFavorite: (appId: string) => void;
  onEmbed: (app: App) => void;
}) {
  const mode = getOpenMode(app.icon);

  const handleClick = () => {
    if (mode === "embed") {
      onEmbed(app);
    } else {
      // Navigate directly — leaves CyberDash but works on Tesla in drive mode
      window.location.href = app.url;
    }
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 8,
        padding: 16,
        background: "rgba(17, 24, 39, 0.7)",
        border: "1px solid var(--cyan-border)",
        borderRadius: 16,
        position: "relative",
        transform: "translateZ(0)",
        cursor: "pointer",
      }}
      onClick={handleClick}
    >
      {/* Favorite button */}
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onToggleFavorite(app.id);
        }}
        style={{
          position: "absolute",
          top: 8,
          right: 8,
          width: 36,
          height: 36,
          minHeight: 36,
          minWidth: 36,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "transparent",
          border: "none",
          cursor: "pointer",
          padding: 0,
          zIndex: 2,
        }}
        aria-label={isFavorite ? "Remove from favorites" : "Add to favorites"}
      >
        <svg
          width={20}
          height={20}
          viewBox="0 0 24 24"
          stroke={isFavorite ? "var(--cyan)" : "#6b7280"}
          strokeWidth={2}
          fill={isFavorite ? "var(--cyan)" : "none"}
        >
          <path d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
        </svg>
      </button>

      <AppIcon icon={app.icon} size={56} />
      <div style={{ textAlign: "center" }}>
        <div style={{ color: "#fff", fontWeight: 600, fontSize: 14 }}>{app.name}</div>
        {app.description && (
          <div style={{ color: "#9ca3af", fontSize: 12, marginTop: 4 }}>
            {app.description}
          </div>
        )}
        {/* Visual indicator for how app opens */}
        <div style={{ color: mode === "embed" ? "var(--cyan)" : "#6b7280", fontSize: 10, marginTop: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>
          {mode === "embed" ? "opens in player" : "opens in browser"}
        </div>
      </div>
    </div>
  );
}
