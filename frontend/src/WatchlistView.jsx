import { useEffect, useRef } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { api } from "./api";
import { useAuth } from "./AuthContext";
import { InstrumentRow } from "./InstrumentRow";
import { AddInstrumentPicker } from "./AddInstrumentPicker";
import { useLiveChanges } from "./useLiveChanges";

const VIEW_DELAY_MS = 2500; // let the person actually see the diff before we mark it "seen"

export function WatchlistView({ watchlistId }) {
  const { session } = useAuth();
  const qc = useQueryClient();
  const viewTimers = useRef(new Map());

  const watchlistQuery = useQuery({
    queryKey: ["watchlist", watchlistId],
    queryFn: () => api.getWatchlist(session.token, watchlistId),
    enabled: !!watchlistId,
    refetchInterval: 5000,
  });

  const instrumentsQuery = useQuery({
    queryKey: ["instruments"],
    queryFn: () => api.getInstruments(session.token),
  });

  const addItem = useMutation({
    mutationFn: (instrumentId) => api.addItem(session.token, watchlistId, instrumentId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["watchlist", watchlistId] }),
  });

  const removeItem = useMutation({
    mutationFn: (itemId) => api.removeItem(session.token, watchlistId, itemId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["watchlist", watchlistId] }),
  });

  const markViewed = useMutation({
    mutationFn: (instrumentId) => api.markViewed(session.token, watchlistId, instrumentId),
  });

  // Live push: on a reconnect the socket does not replay a backlog, so we
  // just invalidate and let the next poll/refetch pull full fresh state.
  useLiveChanges(session?.token, (payload) => {
    if (!watchlistQuery.data) return;
    const stillOnThisList = watchlistQuery.data.items.some(
      (i) => i.instrument_id === payload.instrument_id
    );
    if (stillOnThisList) qc.invalidateQueries({ queryKey: ["watchlist", watchlistId] });
  });

  // After the person has had a moment to see the current diff, record that
  // they've now viewed each instrument at its current price. This is what
  // moves the "last seen" goalpost — never a raw poll or tick.
  useEffect(() => {
    if (!watchlistQuery.data) return;
    const timers = viewTimers.current;

    for (const item of watchlistQuery.data.items) {
      if (item.current_price === null) continue;
      const key = item.instrument_id;
      if (timers.has(key)) clearTimeout(timers.get(key));

      const timer = setTimeout(() => {
        markViewed.mutate(item.instrument_id, {
          onSuccess: () => qc.invalidateQueries({ queryKey: ["watchlist", watchlistId] }),
        });
      }, VIEW_DELAY_MS);
      timers.set(key, timer);
    }

    return () => {
      for (const t of timers.values()) clearTimeout(t);
      timers.clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchlistQuery.data?.items?.map((i) => `${i.instrument_id}:${i.current_price}`).join(",")]);

  if (watchlistQuery.isLoading) return <p className="text-stone text-sm px-4">Loading…</p>;
  if (watchlistQuery.isError)
    return <p className="text-rust text-sm px-4">{watchlistQuery.error.message}</p>;

  const { watchlist, items } = watchlistQuery.data;
  const existingIds = new Set(items.map((i) => i.instrument_id));

  return (
    <div className="flex-1 min-w-0">
      <h2 className="font-display text-2xl text-paper mb-4 px-4">{watchlist.name}</h2>

      {items.length === 0 ? (
        <p className="text-stone text-sm px-4 mb-3">
          This list is empty. Add an instrument to start tracking it.
        </p>
      ) : (
        <div className="divide-y divide-stone/10 border-y border-stone/10">
          {items.map((item) => (
            <InstrumentRow
              key={item.item_id}
              item={item}
              onRemove={() => removeItem.mutate(item.item_id)}
            />
          ))}
        </div>
      )}

      {instrumentsQuery.data && (
        <AddInstrumentPicker
          instruments={instrumentsQuery.data.instruments}
          existingIds={existingIds}
          onAdd={(id) => addItem.mutate(id)}
        />
      )}
    </div>
  );
}
