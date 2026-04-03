"use client";

const categories = [
  { id: "all", label: "All", icon: "⬡" },
  { id: "streaming", label: "Streaming", icon: "▶" },
  { id: "gaming", label: "Gaming", icon: "◆" },
  { id: "apps", label: "Apps", icon: "◈" },
  { id: "favorites", label: "Favorites", icon: "★" },
];

export default function CategoryNav({
  active,
  onChange,
}: {
  active: string;
  onChange: (category: string) => void;
}) {
  return (
    <nav className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
      {categories.map((cat) => (
        <button
          key={cat.id}
          onClick={() => onChange(cat.id)}
          className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all duration-300 ${
            active === cat.id
              ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/50 shadow-[0_0_10px_rgba(0,255,255,0.2)]"
              : "bg-gray-800/50 text-gray-400 border border-gray-700/50 hover:text-gray-200 hover:border-gray-600"
          }`}
        >
          <span className="text-xs">{cat.icon}</span>
          {cat.label}
        </button>
      ))}
    </nav>
  );
}
