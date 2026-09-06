function formatPrice(p) {
  if (p === null || p === undefined) return "—";
  return `₹${p.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function InstrumentRow({ item, onRemove }) {
  const isUp = item.delta !== null && item.delta > 0;
  const isDown = item.delta !== null && item.delta < 0;

  return (
    <div
      className={`group flex items-center justify-between py-3.5 px-4 border-l-2 transition-colors ${
        item.changed ? "border-rust bg-rust-dim/[0.06]" : "border-transparent"
      }`}
    >
      <div className="flex items-baseline gap-3 min-w-0">
        <span className="font-mono text-sm text-paper font-medium tracking-wide w-16 shrink-0">
          {item.symbol}
        </span>
        <span className="text-stone text-sm truncate hidden sm:inline">{item.name}</span>
      </div>

      <div className="flex items-center gap-4 shrink-0">
        {item.stale && (
          <span className="text-[10px] tracking-wide text-stone border border-stone/40 rounded px-1.5 py-0.5">
            delayed
          </span>
        )}

        {item.changed && (
          <span
            className="text-[10px] tracking-wide text-rust border border-rust/50 rounded px-1.5 py-0.5"
            title={`z-score ${item.z_score} — reason: ${item.reason}`}
          >
            {item.reason === "large_move" ? "big move" : "notable move"}
          </span>
        )}

        <div className="text-right w-28">
          <div className="font-display text-lg text-paper leading-none">
            {formatPrice(item.current_price)}
          </div>
          {item.delta !== null && (
            <div
              className={`text-xs mt-0.5 ${
                isUp ? "text-moss" : isDown ? "text-rust" : "text-stone"
              }`}
            >
              {isUp ? "+" : ""}
              {item.delta_pct}% since you last checked
            </div>
          )}
          {item.delta === null && (
            <div className="text-xs mt-0.5 text-stone">first time viewing</div>
          )}
        </div>

        <button
          onClick={onRemove}
          className="opacity-0 group-hover:opacity-100 text-stone hover:text-rust text-xs transition-opacity"
          title="Remove from watchlist"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
