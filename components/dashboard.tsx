"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { tournamentArchiveStorage, tournamentStorage } from "@/lib/storage";
import { useAuth } from "@/lib/auth-context";
import { fetchSharedPlaylist } from "@/lib/db";
import type {
  ImportedPlaylist,
  TournamentArchiveEntry,
  TournamentState,
  PlaylistSong
} from "@/lib/types";

// ─── helpers ────────────────────────────────────────────────────────────────

function fmtDuration(ms: number) {
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
}

function strategyLabel(s: string) {
  const map: Record<string, string> = {
    random: "Aleatorio",
    "release-newest": "Más nuevas (lanzamiento)",
    "release-oldest": "Más antiguas (lanzamiento)",
    "added-newest": "Más nuevas (añadidas)",
    "added-oldest": "Más antiguas (añadidas)"
  };
  return map[s] ?? s;
}

// ─── sub-components ─────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  accent
}: {
  label: string;
  value: string | number;
  sub?: string;
  accent?: string;
}) {
  return (
    <div className="glass-panel rounded-xl p-5 flex flex-col gap-1">
      <span
        className="section-title text-[10px] tracking-widest"
        style={{ color: "rgba(30,215,96,0.65)" }}
      >
        {label}
      </span>
      <span
        className="text-3xl font-bold"
        style={{ fontFamily: "var(--font-display)", color: accent ?? "#f2fff7" }}
      >
        {value}
      </span>
      {sub && (
        <span className="text-xs" style={{ color: "rgba(242,255,247,0.45)" }}>
          {sub}
        </span>
      )}
    </div>
  );
}

function RatingBar({ rating, count, max }: { rating: number; count: number; max: number }) {
  const pct = max > 0 ? (count / max) * 100 : 0;
  const color =
    rating >= 8
      ? "#1ed760"
      : rating >= 6
      ? "#a8e6c0"
      : rating >= 4
      ? "#f2a65a"
      : "#e05252";

  return (
    <div className="flex items-center gap-2 text-xs">
      <span
        className="w-6 text-right tabular-nums"
        style={{ color: "rgba(242,255,247,0.6)" }}
      >
        {rating}
      </span>
      <div
        className="flex-1 rounded-full overflow-hidden"
        style={{ background: "rgba(255,255,255,0.07)", height: 10 }}
      >
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
      <span className="w-5 tabular-nums" style={{ color: "rgba(242,255,247,0.5)" }}>
        {count}
      </span>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2
      className="section-title text-xs tracking-widest mb-4"
      style={{ color: "rgba(30,215,96,0.7)" }}
    >
      {children}
    </h2>
  );
}

// ─── main component ──────────────────────────────────────────────────────────

export function Dashboard() {
  const { user, loading: authLoading } = useAuth();
  const userId = user?.id ?? null;
  const [playlist, setPlaylist] = useState<ImportedPlaylist | null>(null);
  const [archive, setArchive] = useState<TournamentArchiveEntry[]>([]);
  const [activeTournament, setActiveTournament] = useState<TournamentState | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!userId) {
      return;
    }

    let active = true;

    // Torneo e historial siguen siendo locales por persona.
    setArchive(tournamentArchiveStorage.read());
    setActiveTournament(tournamentStorage.read());

    // La playlist y las notas (personal + media) vienen de la base de datos.
    fetchSharedPlaylist(userId)
      .then((dbPlaylist) => {
        if (active) {
          setPlaylist(dbPlaylist);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (active) {
          setLoaded(true);
        }
      });

    return () => {
      active = false;
    };
  }, [userId]);

  if (authLoading || (!loaded && userId)) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <span style={{ color: "rgba(242,255,247,0.4)" }}>Cargando…</span>
      </div>
    );
  }

  if (!userId) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4 px-6 text-center">
        <span className="text-5xl">🔒</span>
        <p className="text-lg font-semibold" style={{ fontFamily: "var(--font-display)" }}>
          Inicia sesión
        </p>
        <p style={{ color: "rgba(242,255,247,0.5)" }} className="text-sm">
          Entra en{" "}
          <Link href="/" className="underline" style={{ color: "#1ed760" }}>
            Playlist Arena
          </Link>{" "}
          para ver el dashboard.
        </p>
      </div>
    );
  }

  if (!playlist) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4 px-6 text-center">
        <span className="text-5xl">🎵</span>
        <p
          className="text-lg font-semibold"
          style={{ fontFamily: "var(--font-display)" }}
        >
          Aún no hay playlist
        </p>
        <p style={{ color: "rgba(242,255,247,0.5)" }} className="text-sm">
          El dueño todavía no ha sincronizado la playlist. Vuelve a{" "}
          <Link href="/" className="underline" style={{ color: "#1ed760" }}>
            Playlist Arena
          </Link>{" "}
          en un rato.
        </p>
      </div>
    );
  }

  const songs = playlist.songs;
  const rated = songs.filter((s) => s.userRating !== null);
  const unrated = songs.filter((s) => s.userRating === null);
  const active = songs.filter((s) => s.isInActivePlaylist);
  const inactive = songs.filter((s) => !s.isInActivePlaylist);

  // Rating distribution (0–10 integers)
  const ratingBuckets: Record<number, number> = {};
  for (let i = 0; i <= 10; i++) ratingBuckets[i] = 0;
  for (const s of rated) {
    const bucket = Math.round(s.userRating!);
    ratingBuckets[bucket] = (ratingBuckets[bucket] ?? 0) + 1;
  }
  const maxBucket = Math.max(...Object.values(ratingBuckets));

  // Avg rating (personal)
  const avgRating =
    rated.length > 0
      ? (rated.reduce((sum, s) => sum + s.userRating!, 0) / rated.length).toFixed(2)
      : "—";

  // Community: media de las puntuaciones de todas las personas
  const communityRated = songs.filter((s) => s.communityRating !== null);
  const communityAvg =
    communityRated.length > 0
      ? (
          communityRated.reduce((sum, s) => sum + (s.communityRating ?? 0), 0) /
          communityRated.length
        ).toFixed(2)
      : "—";
  const communityTop = [...communityRated]
    .sort(
      (a, b) =>
        (b.communityRating ?? 0) - (a.communityRating ?? 0) ||
        b.tournamentWins - a.tournamentWins
    )
    .slice(0, 10);

  // Top 10 songs by rating then tournament wins
  const topSongs = [...rated]
    .sort((a, b) => {
      const dr = b.userRating! - a.userRating!;
      if (dr !== 0) return dr;
      return b.tournamentWins - a.tournamentWins;
    })
    .slice(0, 10);

  // Most tournament wins
  const topWinners = [...songs]
    .filter((s) => s.tournamentWins > 0)
    .sort((a, b) => b.tournamentWins - a.tournamentWins)
    .slice(0, 10);

  // Tournament stats
  const totalTournaments = archive.length;
  const duels = archive.filter((t) => t.mode === "duel").length;
  const battles = archive.filter((t) => t.mode === "battle").length;

  // Champions repeated?
  const champCount: Record<string, { song: PlaylistSong | undefined; count: number; name: string }> = {};
  for (const t of archive) {
    const song = songs.find((s) => s.entryId === t.championId);
    const name = t.topSongs[0]?.title ?? t.championId;
    if (!champCount[t.championId]) {
      champCount[t.championId] = { song, count: 0, name };
    }
    champCount[t.championId].count++;
  }
  const topChampions = Object.values(champCount)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // Active tournament progress
  let activePct = 0;
  let activeMatchesDone = 0;
  let activeTotalMatches = 0;
  if (activeTournament && !activeTournament.completed) {
    activeTotalMatches = activeTournament.rounds.reduce(
      (s, r) => s + r.matches.length,
      0
    );
    activeMatchesDone = activeTournament.matchHistory.length;
    activePct =
      activeTotalMatches > 0 ? (activeMatchesDone / activeTotalMatches) * 100 : 0;
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-10 space-y-10">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-3">
          {playlist.coverUrl && (
            <img
              src={playlist.coverUrl}
              alt=""
              className="w-14 h-14 rounded-lg object-cover"
              style={{ border: "1px solid rgba(255,255,255,0.1)" }}
            />
          )}
          <div>
            <h1
              className="text-2xl font-bold"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {playlist.name}
            </h1>
            <p className="text-sm" style={{ color: "rgba(242,255,247,0.45)" }}>
              Dashboard · última sync {fmtDate(playlist.lastSyncedAt)}
            </p>
          </div>
        </div>
      </div>

      {/* ── KPIs ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <StatCard
          label="Canciones"
          value={songs.length}
          sub={`${active.length} activas · ${inactive.length} eliminadas`}
        />
        <StatCard
          label="Mis puntuadas"
          value={rated.length}
          sub={`${unrated.length} sin puntuar`}
          accent="#1ed760"
        />
        <StatCard
          label="Duración total"
          value={fmtDuration(playlist.totalDurationMs)}
          sub={`~${(playlist.totalDurationMs / songs.length / 60_000).toFixed(1)} min/canción`}
        />
        <StatCard
          label="Mi nota media"
          value={avgRating}
          sub={rated.length > 0 ? `sobre ${rated.length} mías` : "sin datos aún"}
          accent="#a8e6c0"
        />
        <StatCard
          label="Media de todos"
          value={communityAvg}
          sub={
            communityRated.length > 0
              ? `${communityRated.length} canciones con notas`
              : "sin datos aún"
          }
          accent="#1ed760"
        />
      </div>

      {/* ── Active tournament ── */}
      {activeTournament && !activeTournament.completed && (
        <div className="glass-panel rounded-xl p-5">
          <SectionTitle>Torneo en curso</SectionTitle>
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between text-sm">
              <span>
                <span
                  className="font-semibold"
                  style={{ color: "#1ed760" }}
                >
                  {activeTournament.mode === "duel" ? "1v1" : "4-way"}
                </span>{" "}
                · {activeTournament.size} canciones ·{" "}
                {strategyLabel(activeTournament.selectionStrategy)}
              </span>
              <span style={{ color: "rgba(242,255,247,0.5)" }}>
                {activeMatchesDone}/{activeTotalMatches} partidos
              </span>
            </div>
            <div
              className="w-full rounded-full overflow-hidden"
              style={{ background: "rgba(255,255,255,0.07)", height: 8 }}
            >
              <div
                className="h-full rounded-full"
                style={{
                  width: `${activePct}%`,
                  background: "linear-gradient(90deg,#1ed760,#a8e6c0)"
                }}
              />
            </div>
            <p className="text-xs" style={{ color: "rgba(242,255,247,0.4)" }}>
              Ronda {activeTournament.currentRoundIndex + 1} de{" "}
              {activeTournament.rounds.length} · partido{" "}
              {activeTournament.currentMatchIndex + 1}
            </p>
          </div>
        </div>
      )}

      {/* ── Two columns: rating dist + top songs ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Rating distribution */}
        <div className="glass-panel rounded-xl p-5">
          <SectionTitle>Distribución de notas</SectionTitle>
          {rated.length === 0 ? (
            <p className="text-sm" style={{ color: "rgba(242,255,247,0.4)" }}>
              Sin canciones puntuadas todavía.
            </p>
          ) : (
            <div className="flex flex-col gap-1.5">
              {[10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0].map((r) => (
                <RatingBar
                  key={r}
                  rating={r}
                  count={ratingBuckets[r] ?? 0}
                  max={maxBucket}
                />
              ))}
            </div>
          )}
        </div>

        {/* Top 10 songs (personal) */}
        <div className="glass-panel rounded-xl p-5">
          <SectionTitle>Top 10 · mi nota</SectionTitle>
          {topSongs.length === 0 ? (
            <p className="text-sm" style={{ color: "rgba(242,255,247,0.4)" }}>
              Sin canciones puntuadas todavía.
            </p>
          ) : (
            <ol className="flex flex-col gap-2">
              {topSongs.map((s, i) => (
                <li key={s.entryId} className="flex items-center gap-3 min-w-0">
                  <span
                    className="w-5 text-right text-xs shrink-0 tabular-nums"
                    style={{ color: "rgba(242,255,247,0.35)" }}
                  >
                    {i + 1}
                  </span>
                  {s.coverUrl && (
                    <img
                      src={s.coverUrl}
                      alt=""
                      className="w-8 h-8 rounded shrink-0 object-cover"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate font-medium">{s.title}</p>
                    <p
                      className="text-xs truncate"
                      style={{ color: "rgba(242,255,247,0.45)" }}
                    >
                      {s.artists.join(", ")}
                    </p>
                  </div>
                  <span
                    className="text-sm font-bold shrink-0 tabular-nums"
                    style={{ color: "#1ed760" }}
                  >
                    {s.userRating?.toFixed(1)}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>

      {/* ── Top por media de todos ── */}
      <div className="glass-panel rounded-xl p-5">
        <SectionTitle>Top 10 · media de todos</SectionTitle>
        {communityTop.length === 0 ? (
          <p className="text-sm" style={{ color: "rgba(242,255,247,0.4)" }}>
            Nadie ha puntuado canciones todavía.
          </p>
        ) : (
          <ol className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
            {communityTop.map((s, i) => (
              <li key={s.entryId} className="flex items-center gap-3 min-w-0">
                <span
                  className="w-5 text-right text-xs shrink-0 tabular-nums"
                  style={{ color: "rgba(242,255,247,0.35)" }}
                >
                  {i + 1}
                </span>
                {s.coverUrl && (
                  <img src={s.coverUrl} alt="" className="w-8 h-8 rounded shrink-0 object-cover" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate font-medium">{s.title}</p>
                  <p className="text-xs truncate" style={{ color: "rgba(242,255,247,0.45)" }}>
                    {s.artists.join(", ")}
                  </p>
                </div>
                <span className="text-right shrink-0">
                  <span className="text-sm font-bold tabular-nums" style={{ color: "#1ed760" }}>
                    {s.communityRating?.toFixed(1)}
                  </span>
                  <span className="text-xs ml-1" style={{ color: "rgba(242,255,247,0.4)" }}>
                    ({s.communityRatingCount})
                  </span>
                </span>
              </li>
            ))}
          </ol>
        )}
      </div>

      {/* ── Tournament stats + Champions ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Tournament stats */}
        <div className="glass-panel rounded-xl p-5">
          <SectionTitle>Estadísticas de torneos</SectionTitle>
          {totalTournaments === 0 ? (
            <p className="text-sm" style={{ color: "rgba(242,255,247,0.4)" }}>
              Ningún torneo completado todavía.
            </p>
          ) : (
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="text-center">
                  <p
                    className="text-2xl font-bold"
                    style={{ fontFamily: "var(--font-display)", color: "#1ed760" }}
                  >
                    {totalTournaments}
                  </p>
                  <p className="text-xs" style={{ color: "rgba(242,255,247,0.45)" }}>
                    totales
                  </p>
                </div>
                <div className="text-center">
                  <p
                    className="text-2xl font-bold"
                    style={{ fontFamily: "var(--font-display)" }}
                  >
                    {duels}
                  </p>
                  <p className="text-xs" style={{ color: "rgba(242,255,247,0.45)" }}>
                    1v1
                  </p>
                </div>
                <div className="text-center">
                  <p
                    className="text-2xl font-bold"
                    style={{ fontFamily: "var(--font-display)" }}
                  >
                    {battles}
                  </p>
                  <p className="text-xs" style={{ color: "rgba(242,255,247,0.45)" }}>
                    4-way
                  </p>
                </div>
              </div>

              <div>
                <p
                  className="text-xs mb-2"
                  style={{ color: "rgba(242,255,247,0.4)" }}
                >
                  Últimos torneos
                </p>
                <div className="flex flex-col gap-1.5">
                  {archive
                    .slice()
                    .sort(
                      (a, b) =>
                        new Date(b.completedAt).getTime() -
                        new Date(a.completedAt).getTime()
                    )
                    .slice(0, 5)
                    .map((t) => (
                      <div
                        key={t.id}
                        className="flex items-center justify-between text-xs"
                      >
                        <span style={{ color: "rgba(242,255,247,0.65)" }}>
                          {t.mode === "duel" ? "1v1" : "4-way"} · {t.size}
                        </span>
                        <span style={{ color: "rgba(242,255,247,0.4)" }}>
                          {fmtDate(t.completedAt)}
                        </span>
                        <span
                          className="truncate max-w-[140px] text-right"
                          style={{ color: "#1ed760" }}
                        >
                          🏆 {t.topSongs[0]?.title ?? "—"}
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Most wins */}
        <div className="glass-panel rounded-xl p-5">
          <SectionTitle>Más victorias en torneos</SectionTitle>
          {topWinners.length === 0 ? (
            <p className="text-sm" style={{ color: "rgba(242,255,247,0.4)" }}>
              Ningún torneo completado todavía.
            </p>
          ) : (
            <ol className="flex flex-col gap-2">
              {topWinners.map((s, i) => (
                <li key={s.entryId} className="flex items-center gap-3 min-w-0">
                  <span
                    className="w-5 text-right text-xs shrink-0 tabular-nums"
                    style={{ color: "rgba(242,255,247,0.35)" }}
                  >
                    {i + 1}
                  </span>
                  {s.coverUrl && (
                    <img
                      src={s.coverUrl}
                      alt=""
                      className="w-8 h-8 rounded shrink-0 object-cover"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate font-medium">{s.title}</p>
                    <p
                      className="text-xs truncate"
                      style={{ color: "rgba(242,255,247,0.45)" }}
                    >
                      {s.artists.join(", ")}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <span
                      className="text-sm font-bold tabular-nums"
                      style={{ color: "#f2a65a" }}
                    >
                      {s.tournamentWins}
                    </span>
                    <span
                      className="text-xs ml-1"
                      style={{ color: "rgba(242,255,247,0.4)" }}
                    >
                      wins
                    </span>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>

      {/* ── Campeones repetidos ── */}
      {topChampions.length > 0 && (
        <div className="glass-panel rounded-xl p-5">
          <SectionTitle>Campeones recurrentes</SectionTitle>
          <div className="flex flex-wrap gap-3">
            {topChampions.map((c) => {
              const song = c.song;
              return (
                <div
                  key={c.name}
                  className="flex items-center gap-2 rounded-lg px-3 py-2"
                  style={{ background: "rgba(30,215,96,0.08)", border: "1px solid rgba(30,215,96,0.15)" }}
                >
                  {song?.coverUrl && (
                    <img
                      src={song.coverUrl}
                      alt=""
                      className="w-8 h-8 rounded object-cover"
                    />
                  )}
                  <div>
                    <p className="text-sm font-medium">{c.name}</p>
                    <p className="text-xs" style={{ color: "rgba(242,255,247,0.45)" }}>
                      🏆 ×{c.count}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Footer nav */}
      <div className="text-center pb-6">
        <Link
          href="/"
          className="text-sm underline"
          style={{ color: "rgba(30,215,96,0.7)" }}
        >
          ← Volver a Playlist Arena
        </Link>
      </div>
    </div>
  );
}
