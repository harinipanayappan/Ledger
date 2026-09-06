import { useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { api } from "./api";
import { useAuth } from "./AuthContext";
import { Sidebar } from "./Sidebar";
import { WatchlistView } from "./WatchlistView";

export function Dashboard() {
  const { session, logout } = useAuth();
  const qc = useQueryClient();
  const [activeId, setActiveId] = useState(null);

  const watchlistsQuery = useQuery({
    queryKey: ["watchlists"],
    queryFn: () => api.getWatchlists(session.token),
  });

  const feedStatusQuery = useQuery({
    queryKey: ["feedStatus"],
    queryFn: () => api.feedStatus(session.token),
    refetchInterval: 4000,
  });

  const createWatchlist = useMutation({
    mutationFn: (name) => api.createWatchlist(session.token, name),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["watchlists"] });
      setActiveId(data.watchlist.id);
    },
  });

  const deleteWatchlist = useMutation({
    mutationFn: (id) => api.deleteWatchlist(session.token, id),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: ["watchlists"] });
      if (activeId === id) setActiveId(null);
    },
  });

  const toggleFeed = useMutation({
    mutationFn: () =>
      feedStatusQuery.data?.feed_killed ? api.resumeFeed(session.token) : api.killFeed(session.token),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["feedStatus"] }),
  });

  const watchlists = watchlistsQuery.data?.watchlists ?? [];
  const currentId = activeId ?? watchlists[0]?.id ?? null;

  return (
    <div className="min-h-screen px-6 py-8 max-w-5xl mx-auto">
      <header className="flex items-center justify-between mb-10">
        <div>
          <h1 className="font-display text-2xl text-paper">Ledger</h1>
          <p className="text-stone text-xs">{session.user.email}</p>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={() => toggleFeed.mutate()}
            className={`text-xs border rounded px-2.5 py-1.5 transition-colors ${
              feedStatusQuery.data?.feed_killed
                ? "border-rust text-rust"
                : "border-stone/40 text-stone hover:text-paper"
            }`}
            title="Demo control: simulate the market feed going down"
          >
            {feedStatusQuery.data?.feed_killed ? "Feed offline — resume" : "Simulate feed outage"}
          </button>
          <button onClick={logout} className="text-xs text-stone hover:text-paper transition-colors">
            Log out
          </button>
        </div>
      </header>

      <div className="flex gap-8">
        <Sidebar
          watchlists={watchlists}
          activeId={currentId}
          onSelect={setActiveId}
          onCreate={(name) => createWatchlist.mutate(name)}
          onDelete={(id) => deleteWatchlist.mutate(id)}
        />

        {currentId ? (
          <WatchlistView watchlistId={currentId} />
        ) : (
          <p className="text-stone text-sm">Create a watchlist to get started.</p>
        )}
      </div>
    </div>
  );
}
