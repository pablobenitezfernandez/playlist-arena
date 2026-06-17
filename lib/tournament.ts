import { TOURNAMENT_SIZE_OPTIONS } from "@/lib/constants";
import type {
  ImportedPlaylist,
  PlaylistSong,
  TournamentArchiveEntry,
  TournamentMatch,
  TournamentMode,
  TournamentRound,
  TournamentSelectionStrategy,
  TournamentState,
  TournamentTopSong
} from "@/lib/types";
import { chunkArray, parseReleaseDate, shuffleArray } from "@/lib/utils";

function compareText(a: string, b: string): number {
  return a.localeCompare(b, undefined, { sensitivity: "base" });
}

function parseSortableDate(value: string): number {
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function sortSongs(
  songs: PlaylistSong[],
  strategy: TournamentSelectionStrategy
): PlaylistSong[] {
  const copy = [...songs];

  switch (strategy) {
    case "random":
      return shuffleArray(copy);
    case "release-newest":
      return copy.sort((a, b) => {
        return (
          parseReleaseDate(b.releaseDate) - parseReleaseDate(a.releaseDate) ||
          compareText(a.title, b.title)
        );
      });
    case "release-oldest":
      return copy.sort((a, b) => {
        return (
          parseReleaseDate(a.releaseDate) - parseReleaseDate(b.releaseDate) ||
          compareText(a.title, b.title)
        );
      });
    case "added-newest":
      return copy.sort((a, b) => {
        return parseSortableDate(b.addedAt) - parseSortableDate(a.addedAt) || compareText(a.title, b.title);
      });
    case "added-oldest":
      return copy.sort((a, b) => {
        return parseSortableDate(a.addedAt) - parseSortableDate(b.addedAt) || compareText(a.title, b.title);
      });
    default:
      return copy;
  }
}

function createRound(roundNumber: number, entrantIds: string[], groupSize: 2 | 4): TournamentRound {
  const matches: TournamentMatch[] = chunkArray(entrantIds, groupSize).map((songIds, index) => ({
    id: `round-${roundNumber}-match-${index + 1}`,
    round: roundNumber,
    matchNumber: index + 1,
    songIds
  }));

  return {
    round: roundNumber,
    entrantIds,
    matches
  };
}

export function createTournamentState(params: {
  playlist: ImportedPlaylist;
  mode: TournamentMode;
  size: number;
  strategy: TournamentSelectionStrategy;
}): TournamentState {
  const { playlist, mode, size, strategy } = params;
  const allowedSizes = TOURNAMENT_SIZE_OPTIONS[mode];

  if (!allowedSizes.includes(size)) {
    throw new Error("El tamano seleccionado no es valido para este modo de torneo.");
  }

  if (playlist.songs.length < size) {
    throw new Error("No hay suficientes canciones para el tamano de torneo seleccionado.");
  }

  const seededSongs = sortSongs(playlist.songs, strategy).slice(0, size);
  const groupSize = mode === "duel" ? 2 : 4;

  if (seededSongs.length < groupSize) {
    throw new Error("No hay suficientes canciones para crear el bracket.");
  }

  return {
    id: `tournament-${Date.now()}`,
    mode,
    size,
    groupSize,
    selectionStrategy: strategy,
    createdAt: new Date().toISOString(),
    sourcePlaylistId: playlist.playlistId,
    rounds: [createRound(1, seededSongs.map((song) => song.entryId), groupSize)],
    currentRoundIndex: 0,
    currentMatchIndex: 0,
    completed: false,
    matchHistory: []
  };
}

export function getCurrentRound(tournament: TournamentState): TournamentRound | undefined {
  return tournament.rounds[tournament.currentRoundIndex];
}

export function getCurrentMatch(tournament: TournamentState): TournamentMatch | undefined {
  const round = getCurrentRound(tournament);
  return round?.matches[tournament.currentMatchIndex];
}

export function getTournamentProgress(tournament: TournamentState): {
  completedMatches: number;
  totalMatches: number;
} {
  const completedMatches = tournament.matchHistory.length;
  const totalMatches = tournament.groupSize === 2 ? tournament.size - 1 : (tournament.size - 1) / 3;

  return {
    completedMatches,
    totalMatches
  };
}

export function getRemainingSongsCount(tournament: TournamentState): number {
  if (tournament.completed) {
    return 1;
  }

  const round = getCurrentRound(tournament);

  if (!round) {
    return 0;
  }

  const completedMatches = round.matches.filter((match) => Boolean(match.winnerId)).length;

  return round.entrantIds.length - completedMatches * (tournament.groupSize - 1);
}

export function advanceTournament(
  tournament: TournamentState,
  winnerId: string
): TournamentState {
  if (tournament.completed) {
    return tournament;
  }

  const currentRound = getCurrentRound(tournament);
  const currentMatch = getCurrentMatch(tournament);

  if (!currentRound || !currentMatch) {
    throw new Error("No hay ningun enfrentamiento activo disponible.");
  }

  if (!currentMatch.songIds.includes(winnerId)) {
    throw new Error("La ganadora seleccionada no forma parte del enfrentamiento actual.");
  }

  const rounds = tournament.rounds.map((round) => ({
    ...round,
    matches: round.matches.map((match) => ({ ...match }))
  }));
  const targetRound = rounds[tournament.currentRoundIndex];
  const targetMatch = targetRound.matches[tournament.currentMatchIndex];
  targetMatch.winnerId = winnerId;

  const matchHistory = [
    ...tournament.matchHistory,
    {
      id: `${targetMatch.id}-${Date.now()}`,
      round: targetMatch.round,
      matchNumber: targetMatch.matchNumber,
      songIds: targetMatch.songIds,
      winnerId,
      playedAt: new Date().toISOString()
    }
  ];

  const finishedRound = targetRound.matches.every((match) => Boolean(match.winnerId));

  if (!finishedRound) {
    return {
      ...tournament,
      rounds,
      currentMatchIndex: tournament.currentMatchIndex + 1,
      matchHistory
    };
  }

  const winners = targetRound.matches.map((match) => match.winnerId as string);

  if (winners.length === 1) {
    return {
      ...tournament,
      rounds,
      completed: true,
      championId: winners[0],
      matchHistory
    };
  }

  const nextRound = createRound(targetRound.round + 1, winners, tournament.groupSize);

  return {
    ...tournament,
    rounds: [...rounds.slice(0, tournament.currentRoundIndex + 1), nextRound],
    currentRoundIndex: tournament.currentRoundIndex + 1,
    currentMatchIndex: 0,
    matchHistory
  };
}

export function restartTournament(
  playlist: ImportedPlaylist,
  tournament: TournamentState
): TournamentState {
  return createTournamentState({
    playlist,
    mode: tournament.mode,
    size: tournament.size,
    strategy: tournament.selectionStrategy
  });
}

export function getTournamentWinCounts(
  tournament: TournamentState
): Map<string, number> {
  const winCounts = new Map<string, number>();

  tournament.matchHistory.forEach((entry) => {
    winCounts.set(entry.winnerId, (winCounts.get(entry.winnerId) ?? 0) + 1);
  });

  return winCounts;
}

export function buildTournamentArchiveEntry(params: {
  playlist: ImportedPlaylist;
  tournament: TournamentState;
}): TournamentArchiveEntry {
  const { playlist, tournament } = params;

  if (!tournament.completed || !tournament.championId) {
    throw new Error("Solo se puede archivar un torneo completado.");
  }

  const deepestRoundBySong = new Map<string, number>();

  tournament.rounds.forEach((round) => {
    round.entrantIds.forEach((entryId) => {
      deepestRoundBySong.set(
        entryId,
        Math.max(deepestRoundBySong.get(entryId) ?? 0, round.round)
      );
    });
  });

  const winCounts = getTournamentWinCounts(tournament);
  const seededSongs = playlist.songs.filter((song) =>
    deepestRoundBySong.has(song.entryId)
  );

  const topSongs: TournamentTopSong[] = seededSongs
    .map((song) => ({
      entryId: song.entryId,
      title: song.title,
      artists: song.artists,
      coverUrl: song.coverUrl,
      wins: winCounts.get(song.entryId) ?? 0,
      deepestRound: deepestRoundBySong.get(song.entryId) ?? 0
    }))
    .sort((a, b) => {
      if (a.entryId === tournament.championId) {
        return -1;
      }

      if (b.entryId === tournament.championId) {
        return 1;
      }

      return (
        b.deepestRound - a.deepestRound ||
        b.wins - a.wins ||
        a.title.localeCompare(b.title, undefined, { sensitivity: "base" })
      );
    })
    .slice(0, 3);

  return {
    id: `tournament-archive-${Date.now()}`,
    tournamentId: tournament.id,
    mode: tournament.mode,
    size: tournament.size,
    selectionStrategy: tournament.selectionStrategy,
    createdAt: tournament.createdAt,
    completedAt:
      tournament.matchHistory[tournament.matchHistory.length - 1]?.playedAt ??
      new Date().toISOString(),
    championId: tournament.championId,
    topSongs,
    sourcePlaylistId: playlist.playlistId,
    sourcePlaylistName: playlist.name
  };
}
