"use client";

const categories = [
  { id: "all", label: "All" },
  { id: "streaming", label: "Streaming" },
  { id: "gaming", label: "Gaming" },
  { id: "apps", label: "Apps" },
  { id: "favorites", label: "Favorites" },
];

export default function CategoryNav({
  active,
  onChange,
}: {
  active: string;
  onChange: (category: string) => void;
}) {
  return (
    <nav style={{ display: "flex", gap: 8, overflow: "hidden" }}>
      {categories.map((cat) => {
        const isActive = active === cat.id;
        return (
          <button
            key={cat.id}
            onClick={() => onChange(cat.id)}
            style={{
              padding: "10px 20px",
              borderRadius: 999,
              fontSize: 14,
              fontWeight: 600,
              whiteSpace: "nowrap",
              border: isActive ? "1px solid var(--cyan)" : "1px solid rgba(75,85,99,0.4)",
              background: isActive ? "var(--cyan-dim)" : "rgba(31,41,55,0.5)",
              color: isActive ? "var(--cyan)" : "#9ca3af",
              cursor: "pointer",
              minHeight: 44,
              minWidth: 44,
              transition: "background 0.15s, color 0.15s, border-color 0.15s",
            }}
          >
            {cat.label}
          </button>
        );
      })}
    </nav>
  );
}
