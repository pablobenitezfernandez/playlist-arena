import type { TournamentMode, TournamentSelectionStrategy } from "@/lib/types";

export const SPOTIFY_SCOPES = [
  "playlist-read-private",
  "playlist-read-collaborative"
];

export const LOCAL_STORAGE_KEYS = {
  auth: "playlist-arena.spotify-auth",
  pkce: "playlist-arena.pkce",
  playlist: "playlist-arena.playlist",
  tournament: "playlist-arena.tournament",
  tournamentArchive: "playlist-arena.tournament-archive",
  lastSyncSummary: "playlist-arena.last-sync-summary",
  syncHistory: "playlist-arena.sync-history",
  songWins: "playlist-arena.song-wins"
} as const;

export const SESSION_STORAGE_KEYS = {
  spotifyPopupError: "playlist-arena.spotify-popup-error"
} as const;

export const TOURNAMENT_SIZE_OPTIONS: Record<TournamentMode, number[]> = {
  duel: [16, 32, 64, 128, 256],
  battle: [16, 64, 256]
};

export const MODE_LABELS: Record<TournamentMode, string> = {
  duel: "1v1",
  battle: "2v2 / 4-way battle"
};

// Umbral (en años) que separa canciones "antiguas" de "nuevas" por lanzamiento.
export const TOURNAMENT_AGE_THRESHOLD_YEARS = 6;

export const STRATEGY_OPTIONS: Array<{
  value: TournamentSelectionStrategy;
  label: string;
}> = [
  { value: "random", label: "Aleatorio" },
  {
    value: "release-newest",
    label: `Nuevas (ultimos ${TOURNAMENT_AGE_THRESHOLD_YEARS} anos), al azar`
  },
  {
    value: "release-oldest",
    label: `Antiguas (mas de ${TOURNAMENT_AGE_THRESHOLD_YEARS} anos), al azar`
  }
];
