import { useState } from "react";

export function AddInstrumentPicker({ instruments, existingIds, onAdd }) {
  const [open, setOpen] = useState(false);
  const available = instruments.filter((i) => !existingIds.has(i.id));

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-sm text-pine hover:text-paper transition-colors px-4 py-3"
      >
        + Add instrument
      </button>
    );
  }

  return (
    <div className="px-4 py-3 border-t border-stone/20">
      {available.length === 0 ? (
        <p className="text-sm text-stone">Every instrument is already on this list.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {available.map((inst) => (
            <button
              key={inst.id}
              onClick={() => {
                onAdd(inst.id);
                setOpen(false);
              }}
              className="text-xs font-mono border border-stone/40 rounded px-2 py-1 text-paper hover:border-pine hover:text-pine transition-colors"
            >
              {inst.symbol}
            </button>
          ))}
        </div>
      )}
      <button onClick={() => setOpen(false)} className="text-xs text-stone mt-2 hover:text-paper">
        Cancel
      </button>
    </div>
  );
}
