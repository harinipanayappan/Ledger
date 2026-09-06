import { useState } from "react";

export function Sidebar({ watchlists, activeId, onSelect, onCreate, onDelete }) {
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");

  function submitCreate(e) {
    e.preventDefault();
    if (!name.trim()) return;
    onCreate(name.trim());
    setName("");
    setCreating(false);
  }

  return (
    <aside className="w-56 shrink-0 border-r border-stone/20 pr-4 flex flex-col gap-1">
      {watchlists.map((wl) => (
        <div key={wl.id} className="group flex items-center">
          <button
            onClick={() => onSelect(wl.id)}
            className={`flex-1 text-left text-sm px-3 py-2 rounded transition-colors ${
              wl.id === activeId ? "bg-paper-dim/10 text-paper" : "text-stone hover:text-paper"
            }`}
          >
            {wl.name}
          </button>
          <button
            onClick={() => onDelete(wl.id)}
            className="opacity-0 group-hover:opacity-100 text-stone hover:text-rust text-xs px-1"
            title="Delete watchlist"
          >
            ✕
          </button>
        </div>
      ))}

      {creating ? (
        <form onSubmit={submitCreate} className="px-3 py-2">
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => !name && setCreating(false)}
            placeholder="List name"
            className="w-full bg-transparent border-b border-pine text-sm text-paper focus:outline-none py-1"
          />
        </form>
      ) : (
        <button
          onClick={() => setCreating(true)}
          className="text-left text-sm text-pine hover:text-paper px-3 py-2 transition-colors"
        >
          + New watchlist
        </button>
      )}
    </aside>
  );
}
