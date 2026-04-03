"use client";

const iconMap: Record<string, { bg: string; label: string; color: string }> = {
  youtube: { bg: "#FF0000", label: "YT", color: "#fff" },
  netflix: { bg: "#E50914", label: "N", color: "#fff" },
  disney: { bg: "#113CCF", label: "D+", color: "#fff" },
  twitch: { bg: "#9146FF", label: "Tw", color: "#fff" },
  plex: { bg: "#E5A00D", label: "Px", color: "#000" },
  spotify: { bg: "#1DB954", label: "Sp", color: "#000" },
  xbox: { bg: "#107C10", label: "Xb", color: "#fff" },
  nvidia: { bg: "#76B900", label: "GF", color: "#000" },
  luna: { bg: "#4B0082", label: "Ln", color: "#fff" },
  games: { bg: "#FF6B35", label: "CG", color: "#fff" },
  maps: { bg: "#4285F4", label: "Mp", color: "#fff" },
  reddit: { bg: "#FF4500", label: "Rd", color: "#fff" },
  twitter: { bg: "#000000", label: "X", color: "#fff" },
  weather: { bg: "#00BFFF", label: "Wx", color: "#fff" },
};

export default function AppIcon({ icon, size = 48 }: { icon: string; size?: number }) {
  const info = iconMap[icon] || { bg: "#333", label: icon.slice(0, 2).toUpperCase(), color: "#fff" };

  return (
    <div
      className="rounded-xl flex items-center justify-center font-bold shrink-0"
      style={{
        width: size,
        height: size,
        backgroundColor: info.bg,
        color: info.color,
        fontSize: size * 0.35,
      }}
    >
      {info.label}
    </div>
  );
}
