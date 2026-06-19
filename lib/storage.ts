import { LOCAL_STORAGE_KEYS } from "@/lib/constants";
import type {
  ImportedPlaylist,
  LastSyncSummary,
  PlaylistSong,
  PkceSession,
  SpotifyAuthSession,
  SyncHistoryEntry,
  TournamentArchiveEntry,
  TournamentTopSong,
  TournamentState
} from "@/lib/types";

function normalizeTournamentSelectionStrategy(
  strategy:
    | TournamentState["selectionStrategy"]
    | "popularity-most"
    | "popularity-least"
    | "added-newest"
    | "added-oldest"
): TournamentState["selectionStrategy"] {
  // Estrategias antiguas ya retiradas: las tratamos como aleatorias.
  if (
    strategy === "popularity-most" ||
    strategy === "popularity-least" ||
    strategy === "added-newest" ||
    strategy === "added-oldest"
  ) {
    return "random";
  }

  return strategy;
}

function readJson<T>(key: string): T | null {
  if (typeof window === "undefined") {
    return null;
  }

  const rawValue = window.localStorage.getItem(key);

  if (!rawValue) {
    return null;
  }

  try {
    return JSON.parse(rawValue) as T;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(key, JSON.stringify(value));
}

function clearValue(key: string) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(key);
}

export const authStorage = {
  read: () => readJson<SpotifyAuthSession>(LOCAL_STORAGE_KEYS.auth),
  write: (value: SpotifyAuthSession) => writeJson(LOCAL_STORAGE_KEYS.auth, value),
  clear: () => clearValue(LOCAL_STORAGE_KEYS.auth)
};

export const pkceStorage = {
  read: () => readJson<PkceSession>(LOCAL_STORAGE_KEYS.pkce),
  write: (value: PkceSession) => writeJson(LOCAL_STORAGE_KEYS.pkce, value),
  clear: () => clearValue(LOCAL_STORAGE_KEYS.pkce)
};

function normalizePlaylistSong(song: PlaylistSong): PlaylistSong {
  return {
    ...song,
    userRating: song.userRating ?? null,
    isInActivePlaylist: song.isInActivePlaylist ?? true,
    tournamentWins: song.tournamentWins ?? 0,
    communityRating: song.communityRating ?? null,
    communityRatingCount: song.communityRatingCount ?? 0
  };
}

function normalizeImportedPlaylist(
  playlist: ImportedPlaylist | null
): ImportedPlaylist | null {
  if (!playlist) {
    return null;
  }

  const songs = (playlist.songs ?? []).map(normalizePlaylistSong);
  const totalDurationMs =
    playlist.totalDurationMs ?? songs.reduce((sum, song) => sum + song.durationMs, 0);

  return {
    ...playlist,
    songs,
    totalSongs: playlist.totalSongs ?? songs.length,
    totalDurationMs,
    lastSyncedAt: playlist.lastSyncedAt ?? playlist.importedAt,
    spotifyTrackCount: playlist.spotifyTrackCount ?? playlist.totalSongs ?? songs.length
  };
}

export const playlistStorage = {
  read: () => normalizeImportedPlaylist(readJson<ImportedPlaylist>(LOCAL_STORAGE_KEYS.playlist)),
  write: (value: ImportedPlaylist) => writeJson(LOCAL_STORAGE_KEYS.playlist, value),
  clear: () => clearValue(LOCAL_STORAGE_KEYS.playlist)
};

/**
 * Victorias de torneo por cancion, guardadas SOLO en local (por usuario/navegador).
 * La playlist es compartida en la base de datos, pero los torneos siguen siendo
 * de cada persona, asi que estas victorias son un overlay local sobre las
 * canciones compartidas. Mapa entryId -> numero de victorias.
 */
export const songWinsStorage = {
  read: () => readJson<Record<string, number>>(LOCAL_STORAGE_KEYS.songWins) ?? {},
  write: (value: Record<string, number>) => writeJson(LOCAL_STORAGE_KEYS.songWins, value),
  clear: () => clearValue(LOCAL_STORAGE_KEYS.songWins)
};

export const tournamentStorage = {
  read: () => {
    const tournament = readJson<TournamentState>(LOCAL_STORAGE_KEYS.tournament);

    if (!tournament) {
      return null;
    }

    return {
      ...tournament,
      selectionStrategy: normalizeTournamentSelectionStrategy(
        tournament.selectionStrategy
      )
    };
  },
  write: (value: TournamentState) =>
    writeJson(LOCAL_STORAGE_KEYS.tournament, value),
  clear: () => clearValue(LOCAL_STORAGE_KEYS.tournament)
};

function normalizeTournamentTopSong(song: TournamentTopSong): TournamentTopSong {
  return {
    ...song,
    artists: song.artists ?? [],
    coverUrl: song.coverUrl ?? "",
    wins: song.wins ?? 0,
    deepestRound: song.deepestRound ?? 0
  };
}

function normalizeTournamentArchiveEntry(
  entry: TournamentArchiveEntry
): TournamentArchiveEntry {
  return {
    ...entry,
    selectionStrategy: normalizeTournamentSelectionStrategy(entry.selectionStrategy),
    topSongs: (entry.topSongs ?? []).map(normalizeTournamentTopSong)
  };
}

export const tournamentArchiveStorage = {
  read: () =>
    (readJson<TournamentArchiveEntry[]>(LOCAL_STORAGE_KEYS.tournamentArchive) ?? []).map(
      normalizeTournamentArchiveEntry
    ),
  write: (value: TournamentArchiveEntry[]) =>
    writeJson(LOCAL_STORAGE_KEYS.tournamentArchive, value),
  clear: () => clearValue(LOCAL_STORAGE_KEYS.tournamentArchive)
};

function normalizeLastSyncSummary(
  summary: LastSyncSummary | null
): LastSyncSummary | null {
  if (!summary) {
    return null;
  }

  return {
    ...summary,
    addedSongs: (summary.addedSongs ?? []).map(normalizePlaylistSong)
  };
}

function normalizeSyncHistoryEntry(
  entry: SyncHistoryEntry
): SyncHistoryEntry {
  return {
    ...entry,
    addedSongs: (entry.addedSongs ?? []).map(normalizePlaylistSong)
  };
}

export const syncHistoryStorage = {
  read: () => {
    const currentValue = readJson<SyncHistoryEntry[]>(LOCAL_STORAGE_KEYS.syncHistory);

    if (currentValue) {
      return currentValue.map(normalizeSyncHistoryEntry);
    }

    const legacyValue = normalizeLastSyncSummary(
      readJson<LastSyncSummary>(LOCAL_STORAGE_KEYS.lastSyncSummary)
    );

    if (!legacyValue) {
      return [] as SyncHistoryEntry[];
    }

    return [
      {
        ...legacyValue,
        id: `sync-${legacyValue.syncedAt}`
      }
    ];
  },
  write: (value: SyncHistoryEntry[]) =>
    writeJson(LOCAL_STORAGE_KEYS.syncHistory, value),
  clear: () => {
    clearValue(LOCAL_STORAGE_KEYS.syncHistory);
    clearValue(LOCAL_STORAGE_KEYS.lastSyncSummary);
  }
};
