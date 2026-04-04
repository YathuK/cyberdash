"use client";

interface AppViewerProps {
  name: string;
  url: string;
  onClose: () => void;
}

export default function AppViewer({ name, url, onClose }: AppViewerProps) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        background: "#000",
        display: "flex",
        flexDirection: "column",
        transform: "translateZ(0)",
      }}
    >
      {/* Top bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "6px 16px",
          background: "rgba(3,7,18,0.95)",
          borderBottom: "1px solid rgba(34,211,238,0.15)",
          flexShrink: 0,
          height: 48,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ color: "var(--cyan)", fontWeight: 700, fontSize: 14 }}>YaVik</span>
          <span style={{ color: "#6b7280", fontSize: 13 }}>/</span>
          <span style={{ color: "#e5e7eb", fontSize: 14, fontWeight: 500 }}>{name}</span>
        </div>
        <button
          onClick={onClose}
          style={{
            padding: "8px 24px",
            background: "rgba(239,68,68,0.12)",
            color: "#f87171",
            border: "1px solid rgba(239,68,68,0.25)",
            borderRadius: 8,
            fontSize: 14,
            fontWeight: 600,
            cursor: "pointer",
            minHeight: 40,
            minWidth: 44,
          }}
        >
          Close
        </button>
      </div>

      {/* Iframe - fills remaining space */}
      <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
        <iframe
          src={url}
          style={{
            width: "100%",
            height: "100%",
            border: "none",
            position: "absolute",
            inset: 0,
          }}
          allow="autoplay; fullscreen; encrypted-media; picture-in-picture; web-share"
          allowFullScreen
          sandbox="allow-same-origin allow-scripts allow-popups allow-forms allow-presentation allow-modals allow-popups-to-escape-sandbox"
        />
      </div>
    </div>
  );
}
