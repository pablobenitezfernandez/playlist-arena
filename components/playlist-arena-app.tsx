"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { SongCard } from "@/components/song-card";
import { SongLibraryItem } from "@/components/song-library-item";
import { SongRatingFlow } from "@/components/song-rating-flow";
import {
  MODE_LABELS,
  SESSION_STORAGE_KEYS,
  STRATEGY_OPTIONS,
  TOURNAMENT_SIZE_OPTIONS
} from "@/lib/constants";
import { createPkceSession } from "@/lib/pkce";
import {
  buildSpotifyAuthorizeUrl,
  SpotifyApiError,
  syncPlaylistFromSpotify
} from "@/lib/spotify";
import {
  authStorage,
  pkceStorage,
  playlistStorage,
  syncHistoryStorage,
  tournamentArchiveStorage,
  tournamentStorage
} from "@/lib/storage";
import {
  advanceTournament,
  buildTournamentArchiveEntry,
  createTournamentState,
  getCurrentMatch,
  getCurrentRound,
  getRemainingSongsCount,
  getTournamentProgress,
  getTournamentWinCounts,
  restartTournament
} from "@/lib/tournament";
import type {
  ImportedPlaylist,
  PlaylistSong,
  SpotifyAuthSession,
  SyncHistoryEntry,
  TournamentArchiveEntry,
  TournamentMode,
  TournamentSelectionStrategy,
  TournamentState
} from "@/lib/types";
import { formatDate, formatDateTime, formatRating } from "@/lib/utils";

type Notice = {
  tone: "success" | "error" | "info";
  message: string;
};

type ErrorDialog = {
  title: string;
  message: string;
};

type SyncOptions = {
  playlistUrlOverride?: string;
};

type AppSection = "songs" | "tournament" | "updates";
type SongsSection = "search" | "ranking" | "latest-update" | "duplicates";
type RatingFilterMode = "all" | "rated" | "unrated";

type DuplicateGroup = {
  key: string;
  label: string;
  songs: PlaylistSong[];
};

function getSongById(playlist: ImportedPlaylist | null, songId: string): PlaylistSong | undefined {
  return playlist?.songs.find((song) => song.entryId === songId);
}

function getTotalRounds(tournament: TournamentState): number {
  return Math.round(Math.log(tournament.size) / Math.log(tournament.groupSize));
}

function getNoticeStyles(tone: Notice["tone"]): string {
  if (tone === "success") {
    return "border-glow/30 bg-glow/10 text-glowSoft";
  }

  if (tone === "info") {
    return "border-white/10 bg-white/5 text-white/75";
  }

  return "border-rose/30 bg-rose/10 text-rose";
}

function normalizeSongText(value: string): string {
  return value.trim().toLowerCase();
}

function compareSongsAlphabetically(a: PlaylistSong, b: PlaylistSong): number {
  return (
    a.title.localeCompare(b.title, undefined, { sensitivity: "base" }) ||
    a.artists.join(", ").localeCompare(b.artists.join(", "), undefined, {
      sensitivity: "base"
    })
  );
}

function compareSongsByRanking(a: PlaylistSong, b: PlaylistSong): number {
  if (a.userRating === null && b.userRating === null) {
    return b.tournamentWins - a.tournamentWins || compareSongsAlphabetically(a, b);
  }

  if (a.userRating === null) {
    return 1;
  }

  if (b.userRating === null) {
    return -1;
  }

  return (
    b.userRating - a.userRating ||
    b.tournamentWins - a.tournamentWins ||
    compareSongsAlphabetically(a, b)
  );
}

function getStrategyLabel(strategy: TournamentSelectionStrategy): string {
  return STRATEGY_OPTIONS.find((option) => option.value === strategy)?.label ?? strategy;
}

function parseOptionalRating(value: string): number | null {
  if (!value.trim()) {
    return null;
  }

  const parsed = Number(value);

  if (Number.isNaN(parsed)) {
    return null;
  }

  return Math.min(Math.max(parsed, 0), 10);
}

function buildDuplicateGroups(songs: PlaylistSong[]): DuplicateGroup[] {
  const groups = new Map<string, PlaylistSong[]>();

  songs.forEach((song) => {
    const primaryArtist = normalizeSongText(song.artists[0] ?? "");
    const key = `${normalizeSongText(song.title)}::${primaryArtist}`;
    const currentGroup = groups.get(key) ?? [];

    currentGroup.push(song);
    groups.set(key, currentGroup);
  });

  return [...groups.entries()]
    .filter(([, groupedSongs]) => groupedSongs.length > 1)
    .map(([key, groupedSongs]) => ({
      key,
      label: `${groupedSongs[0]?.title ?? "Cancion"} - ${groupedSongs[0]?.artists[0] ?? "Autor"}`,
      songs: [...groupedSongs].sort(compareSongsAlphabetically)
    }))
    .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: "base" }));
}

function tournamentReferencesSong(
  tournament: TournamentState | null,
  entryId: string
): boolean {
  if (!tournament) {
    return false;
  }

  return (
    tournament.championId === entryId ||
    tournament.rounds.some((round) => round.entrantIds.includes(entryId)) ||
    tournament.matchHistory.some(
      (entry) => entry.winnerId === entryId || entry.songIds.includes(entryId)
    )
  );
}

export function PlaylistArenaApp() {
  const [isHydrated, setIsHydrated] = useState(false);
  const [activeSection, setActiveSection] = useState<AppSection>("songs");
  const [songsSection, setSongsSection] = useState<SongsSection>("search");
  const [auth, setAuth] = useState<SpotifyAuthSession | null>(null);
  const [playlist, setPlaylist] = useState<ImportedPlaylist | null>(null);
  const [tournament, setTournament] = useState<TournamentState | null>(null);
  const [tournamentArchive, setTournamentArchive] = useState<TournamentArchiveEntry[]>([]);
  const [syncHistory, setSyncHistory] = useState<SyncHistoryEntry[]>([]);
  const [playlistUrl, setPlaylistUrl] = useState("");
  const [mode, setMode] = useState<TournamentMode>("duel");
  const [size, setSize] = useState(16);
  const [strategy, setStrategy] =
    useState<TournamentSelectionStrategy>("random");
  const [songSearch, setSongSearch] = useState("");
  const [ratingFilterMode, setRatingFilterMode] =
    useState<RatingFilterMode>("all");
  const [minRating, setMinRating] = useState("");
  const [maxRating, setMaxRating] = useState("");
  const [onlyRepeatedFilter, setOnlyRepeatedFilter] = useState(false);
  const [onlyLatestUpdateFilter, setOnlyLatestUpdateFilter] = useState(false);
  const [expandedSongId, setExpandedSongId] = useState<string | null>(null);
  const [ratingFlowOpen, setRatingFlowOpen] = useState(false);
  const [busyAction, setBusyAction] = useState<"auth" | "playlist" | "tournament" | null>(
    null
  );
  const [notice, setNotice] = useState<Notice | null>(null);
  const [errorDialog, setErrorDialog] = useState<ErrorDialog | null>(null);
  const [clearDialogOpen, setClearDialogOpen] = useState(false);
  const [clearConfirmationText, setClearConfirmationText] = useState("");

  useEffect(() => {
    const storedAuth = authStorage.read();
    const storedPlaylist = playlistStorage.read();
    const storedTournament = tournamentStorage.read();
    const storedTournamentArchive = tournamentArchiveStorage.read();
    const storedSyncHistory = syncHistoryStorage.read();

    setAuth(storedAuth);
    setPlaylist(storedPlaylist);
    setPlaylistUrl(storedPlaylist?.playlistUrl ?? "");
    setTournamentArchive(storedTournamentArchive);
    setSyncHistory(storedSyncHistory);

    if (
      storedTournament &&
      storedPlaylist &&
      storedTournament.sourcePlaylistId === storedPlaylist.playlistId
    ) {
      setTournament(storedTournament);
      setMode(storedTournament.mode);
      setSize(storedTournament.size);
      setStrategy(storedTournament.selectionStrategy);
    } else {
      tournamentStorage.clear();
      setTournament(null);
    }

    if (typeof window !== "undefined") {
      const pendingSpotifyError = window.sessionStorage.getItem(
        SESSION_STORAGE_KEYS.spotifyPopupError
      );

      if (pendingSpotifyError) {
        window.sessionStorage.removeItem(SESSION_STORAGE_KEYS.spotifyPopupError);
        setErrorDialog({
          title: "No se pudo conectar con Spotify",
          message: pendingSpotifyError
        });
      }
    }

    if (!storedPlaylist) {
      setActiveSection("updates");
    }

    setIsHydrated(true);
  }, []);

  useEffect(() => {
    const options = TOURNAMENT_SIZE_OPTIONS[mode];
    const hasPlaylist = Boolean(playlist);
    const defaultSize =
      options.find((option) => !hasPlaylist || option <= (playlist?.songs.length ?? 0)) ??
      options[0];

    if (!options.includes(size) || (playlist && size > playlist.songs.length)) {
      setSize(defaultSize);
    }
  }, [mode, playlist, size]);

  useEffect(() => {
    if (!playlist) {
      setExpandedSongId(null);
      setRatingFlowOpen(false);
    }
  }, [playlist]);

  function persistAuth(nextAuth: SpotifyAuthSession | null) {
    setAuth(nextAuth);

    if (nextAuth) {
      authStorage.write(nextAuth);
      return;
    }

    authStorage.clear();
  }

  function persistPlaylist(nextPlaylist: ImportedPlaylist | null) {
    setPlaylist(nextPlaylist);

    if (nextPlaylist) {
      playlistStorage.write(nextPlaylist);
      return;
    }

    playlistStorage.clear();
  }

  function persistTournament(nextTournament: TournamentState | null) {
    setTournament(nextTournament);

    if (nextTournament) {
      tournamentStorage.write(nextTournament);
      return;
    }

    tournamentStorage.clear();
  }

  function persistTournamentArchive(nextTournamentArchive: TournamentArchiveEntry[]) {
    setTournamentArchive(nextTournamentArchive);
    tournamentArchiveStorage.write(nextTournamentArchive);
  }

  function persistSyncHistory(nextSyncHistory: SyncHistoryEntry[]) {
    setSyncHistory(nextSyncHistory);
    syncHistoryStorage.write(nextSyncHistory);
  }

  function showSpotifyError(title: string, message: string) {
    setErrorDialog({ title, message });
  }

  function updateSong(entryId: string, updater: (song: PlaylistSong) => PlaylistSong) {
    if (!playlist) {
      return;
    }

    const nextSongs = playlist.songs.map((song) =>
      song.entryId === entryId ? updater(song) : song
    );
    const nextPlaylist: ImportedPlaylist = {
      ...playlist,
      songs: nextSongs,
      totalSongs: nextSongs.length,
      totalDurationMs: nextSongs.reduce((sum, song) => sum + song.durationMs, 0)
    };

    persistPlaylist(nextPlaylist);
  }

  function resetSongFilters() {
    setSongSearch("");
    setRatingFilterMode("all");
    setMinRating("");
    setMaxRating("");
    setOnlyRepeatedFilter(false);
    setOnlyLatestUpdateFilter(false);
  }

  async function handleConnectSpotify() {
    setBusyAction("auth");
    setNotice(null);

    try {
      const pkce = await createPkceSession();
      pkceStorage.write({
        verifier: pkce.verifier,
        state: pkce.state,
        createdAt: Date.now()
      });
      window.location.assign(
        buildSpotifyAuthorizeUrl({
          challenge: pkce.challenge,
          state: pkce.state
        })
      );
    } catch (errorValue) {
      showSpotifyError(
        "No se pudo conectar con Spotify",
        errorValue instanceof Error
          ? errorValue.message
          : "No se pudo iniciar el login de Spotify."
      );
      setBusyAction(null);
    }
  }

  async function handleSyncPlaylist(options: SyncOptions = {}) {
    const targetPlaylistUrl =
      (options.playlistUrlOverride ?? playlistUrl).trim() || playlist?.playlistUrl || "";

    if (!auth) {
      showSpotifyError(
        "No se pudo actualizar la playlist",
        "Conecta Spotify antes de importar o actualizar la playlist."
      );
      return;
    }

    if (!targetPlaylistUrl) {
      showSpotifyError(
        "No se pudo actualizar la playlist",
        "Pega la URL de la playlist antes de actualizar los datos."
      );
      return;
    }

    setBusyAction("playlist");
    setNotice(null);

    try {
      const response = await syncPlaylistFromSpotify(targetPlaylistUrl, auth, playlist, (session) => {
        persistAuth(session);
      });

      const addedSongs = response.addedSongEntryIds
        .map((entryId) => response.playlist.songs.find((song) => song.entryId === entryId))
        .filter((song): song is PlaylistSong => Boolean(song));

      const nextHistoryEntry: SyncHistoryEntry = {
        id: `sync-${Date.now()}`,
        playlistName: response.playlist.name,
        addedSongs,
        replacedPlaylist: response.replacedPlaylist,
        syncedAt: new Date().toISOString()
      };
      const nextSyncHistory = [nextHistoryEntry, ...syncHistory];

      persistSyncHistory(nextSyncHistory);
      persistAuth(response.session);
      persistPlaylist(response.playlist);
      setPlaylistUrl(response.playlist.playlistUrl);
      setActiveSection("updates");

      if (response.addedSongs > 0) {
        setNotice({
          tone: "success",
          message: `Total de Canciones Nuevas: ${response.addedSongs} canciones.`
        });
      } else {
        setNotice({
          tone: "info",
          message: "Total de Canciones Nuevas: 0 canciones."
        });
      }
    } catch (errorValue) {
      if (errorValue instanceof SpotifyApiError && errorValue.status === 401) {
        persistAuth(null);
      }

      showSpotifyError(
        "No se pudo actualizar la playlist",
        errorValue instanceof Error
          ? errorValue.message
          : "No se pudo actualizar la playlist."
      );
    } finally {
      setBusyAction(null);
    }
  }

  function handleSaveSongRating(entryId: string, rating: number) {
    updateSong(entryId, (song) => ({
      ...song,
      userRating: Math.round(Math.min(Math.max(rating, 0), 10) * 10) / 10
    }));
  }

  function handleClearSongRating(entryId: string) {
    updateSong(entryId, (song) => ({
      ...song,
      userRating: null
    }));
  }

  function handleDeleteRemovedSong(entryId: string) {
    if (!playlist) {
      return;
    }

    const targetSong = playlist.songs.find((song) => song.entryId === entryId);

    if (!targetSong || targetSong.isInActivePlaylist) {
      return;
    }

    const nextSongs = playlist.songs.filter((song) => song.entryId !== entryId);
    const nextPlaylist: ImportedPlaylist = {
      ...playlist,
      songs: nextSongs,
      totalSongs: nextSongs.length,
      totalDurationMs: nextSongs.reduce((sum, song) => sum + song.durationMs, 0)
    };

    persistPlaylist(nextPlaylist);
    setExpandedSongId((current) => (current === entryId ? null : current));

    if (tournamentReferencesSong(tournament, entryId)) {
      persistTournament(null);
      setNotice({
        tone: "info",
        message:
          "La cancion eliminada estaba ligada al torneo actual, asi que el torneo se ha limpiado para evitar inconsistencias."
      });
      return;
    }

    setNotice({
      tone: "info",
      message: `Se ha eliminado de la app la cancion "${targetSong.title}".`
    });
  }

  function handleCreateTournament() {
    if (!playlist) {
      setNotice({
        tone: "error",
        message: "Primero necesitas canciones locales antes de empezar un torneo."
      });
      return;
    }

    setBusyAction("tournament");
    setNotice(null);

    try {
      const nextTournament = createTournamentState({
        playlist,
        mode,
        size,
        strategy
      });

      persistTournament(nextTournament);
      setNotice({
        tone: "success",
        message: `${MODE_LABELS[mode]} creado con ${size} canciones.`
      });
    } catch (errorValue) {
      setNotice({
        tone: "error",
        message:
          errorValue instanceof Error
            ? errorValue.message
            : "No se pudo crear el torneo."
      });
    } finally {
      setBusyAction(null);
    }
  }

  function applyCompletedTournamentResults(nextTournament: TournamentState) {
    if (!playlist || !nextTournament.completed || !nextTournament.championId) {
      return null;
    }

    const winCounts = getTournamentWinCounts(nextTournament);
    const nextSongs = playlist.songs.map((song) => ({
      ...song,
      tournamentWins: song.tournamentWins + (winCounts.get(song.entryId) ?? 0)
    }));
    const nextPlaylist: ImportedPlaylist = {
      ...playlist,
      songs: nextSongs,
      totalSongs: nextSongs.length,
      totalDurationMs: nextSongs.reduce((sum, song) => sum + song.durationMs, 0)
    };
    const archiveEntry = buildTournamentArchiveEntry({
      playlist: nextPlaylist,
      tournament: nextTournament
    });

    persistPlaylist(nextPlaylist);
    persistTournamentArchive([archiveEntry, ...tournamentArchive]);

    return nextPlaylist.songs.find((song) => song.entryId === nextTournament.championId) ?? null;
  }

  function handlePickWinner(songId: string) {
    if (!tournament) {
      return;
    }

    try {
      const nextTournament = advanceTournament(tournament, songId);

      if (nextTournament.completed) {
        const champion = applyCompletedTournamentResults(nextTournament);
        persistTournament(nextTournament);
        setNotice({
          tone: "success",
          message: `${champion?.title ?? "Una cancion"} ha ganado el torneo y sus victorias internas ya se han sumado al ranking.`
        });
      } else {
        persistTournament(nextTournament);
        setNotice(null);
      }
    } catch (errorValue) {
      setNotice({
        tone: "error",
        message:
          errorValue instanceof Error
            ? errorValue.message
            : "No se pudo guardar la ganadora."
      });
    }
  }

  function handleRestartTournament() {
    if (!playlist || !tournament) {
      return;
    }

    try {
      const nextTournament = restartTournament(playlist, tournament);
      persistTournament(nextTournament);
      setNotice({
        tone: "info",
        message: tournament.completed
          ? "El torneo se ha reiniciado desde cero."
          : "El torneo se ha reiniciado sin registrar victorias internas ni guardar ese intento en el historial."
      });
    } catch (errorValue) {
      setNotice({
        tone: "error",
        message:
          errorValue instanceof Error
            ? errorValue.message
            : "No se pudo reiniciar el torneo."
      });
    }
  }

  function handleLeaveTournament() {
    if (!tournament) {
      return;
    }

    const shouldExplainNoRegister = !tournament.completed && tournament.matchHistory.length > 0;

    persistTournament(null);
    setNotice({
      tone: "info",
      message: shouldExplainNoRegister
        ? "Has salido del torneo actual. Como no estaba terminado, no se ha registrado ninguna victoria interna ni se ha guardado en el historial de torneos."
        : "Has salido del torneo actual."
    });
  }

  function handleExportLocalData() {
    const exportedAt = new Date().toISOString();
    const payload = {
      exportedAt,
      app: "Playlist Arena",
      version: 1,
      playlist,
      tournament,
      tournamentArchive,
      syncHistory
    };
    const fileDate = exportedAt.slice(0, 10);
    const playlistName = playlist?.name
      ?.toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    const filename = `playlist-arena-${playlistName || "backup"}-${fileDate}.json`;
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json"
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);

    setNotice({
      tone: "success",
      message: "Se ha exportado una copia JSON de tus datos locales."
    });
  }

  function handleClearImportedData() {
    persistPlaylist(null);
    persistTournament(null);
    persistTournamentArchive([]);
    persistSyncHistory([]);
    setPlaylistUrl("");
    setActiveSection("updates");
    setSongsSection("search");
    setExpandedSongId(null);
    setRatingFlowOpen(false);
    setClearDialogOpen(false);
    setClearConfirmationText("");
    resetSongFilters();
    setNotice({
      tone: "info",
      message: "Se han borrado los datos locales de la playlist, del historial de updates, del torneo actual y del historial de torneos."
    });
  }

  const allSongs = playlist?.songs ?? [];
  const latestSync = syncHistory[0] ?? null;
  const latestSyncSongs = (latestSync?.addedSongs ?? []).map(
    (song) => getSongById(playlist, song.entryId) ?? song
  );
  const latestUpdateEntryIds = new Set(
    (latestSync?.addedSongs ?? []).map((song) => song.entryId)
  );
  const duplicateGroups = buildDuplicateGroups(allSongs);
  const repeatedEntryIds = new Set(
    duplicateGroups.flatMap((group) => group.songs.map((song) => song.entryId))
  );
  const availableSongs = allSongs.length;
  const ratedSongsCount = allSongs.filter((song) => song.userRating !== null).length;
  const unratedSongsCount = availableSongs - ratedSongsCount;
  const removedSongsCount = allSongs.filter((song) => !song.isInActivePlaylist).length;
  const averageRating =
    ratedSongsCount > 0
      ? allSongs
          .filter((song) => song.userRating !== null)
          .reduce((sum, song) => sum + (song.userRating ?? 0), 0) / ratedSongsCount
      : null;
  const parsedMinRating = parseOptionalRating(minRating);
  const parsedMaxRating = parseOptionalRating(maxRating);
  const normalizedSongSearch = songSearch.trim().toLowerCase();

  const filteredSongs = allSongs.filter((song) => {
    const matchesSearch =
      !normalizedSongSearch ||
      [song.title, song.artists.join(" "), song.album, song.releaseYear]
        .join(" ")
        .toLowerCase()
        .includes(normalizedSongSearch);

    const matchesRatingMode =
      ratingFilterMode === "all" ||
      (ratingFilterMode === "rated" && song.userRating !== null) ||
      (ratingFilterMode === "unrated" && song.userRating === null);

    const matchesMinRating =
      parsedMinRating === null ||
      (song.userRating !== null && song.userRating >= parsedMinRating);

    const matchesMaxRating =
      parsedMaxRating === null ||
      (song.userRating !== null && song.userRating <= parsedMaxRating);

    const matchesRepeated = !onlyRepeatedFilter || repeatedEntryIds.has(song.entryId);
    const matchesLatestUpdate =
      !onlyLatestUpdateFilter || latestUpdateEntryIds.has(song.entryId);

    return (
      matchesSearch &&
      matchesRatingMode &&
      matchesMinRating &&
      matchesMaxRating &&
      matchesRepeated &&
      matchesLatestUpdate
    );
  });

  const searchSongs = [...filteredSongs].sort(compareSongsAlphabetically);
  const rankingSongs = [...filteredSongs].sort(compareSongsByRanking);
  const sizeOptions = TOURNAMENT_SIZE_OPTIONS[mode];
  const currentRound = tournament ? getCurrentRound(tournament) : undefined;
  const currentMatch = tournament ? getCurrentMatch(tournament) : undefined;
  const currentMatchSongs =
    currentMatch?.songIds
      .map((songId) => getSongById(playlist, songId))
      .filter((song): song is PlaylistSong => Boolean(song)) ?? [];
  const tournamentProgress = tournament
    ? getTournamentProgress(tournament)
    : { completedMatches: 0, totalMatches: 0 };
  const currentTournamentWinCounts = tournament ? getTournamentWinCounts(tournament) : new Map();
  const remainingSongs = tournament ? getRemainingSongsCount(tournament) : 0;
  const champion = tournament?.championId
    ? getSongById(playlist, tournament.championId)
    : undefined;
  const playlistActionLabel =
    busyAction === "playlist"
      ? "Actualizando datos..."
      : playlist
        ? "Actualizar datos"
        : "Importar playlist";

  function renderSongFilters() {
    return (
      <div className="grid gap-4 xl:grid-cols-[1.2fr,220px,220px,220px]">
        <label className="block">
          <span className="section-title text-[11px] text-white/45">Buscar canciones</span>
          <input
            type="text"
            value={songSearch}
            onChange={(event) => setSongSearch(event.target.value)}
            placeholder="Buscar por titulo, artista, album..."
            className="mt-2 w-full rounded-[20px] border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition focus:border-glow/50 focus:ring-2 focus:ring-glow/20"
          />
        </label>

        <label className="block">
          <span className="section-title text-[11px] text-white/45">Estado de nota</span>
          <select
            value={ratingFilterMode}
            onChange={(event) => setRatingFilterMode(event.target.value as RatingFilterMode)}
            className="mt-2 w-full rounded-[20px] border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition focus:border-glow/50 focus:ring-2 focus:ring-glow/20"
          >
            <option value="all">Todas</option>
            <option value="rated">Solo puntuadas</option>
            <option value="unrated">Solo sin puntuar</option>
          </select>
        </label>

        <label className="block">
          <span className="section-title text-[11px] text-white/45">Nota minima</span>
          <input
            type="number"
            min="0"
            max="10"
            step="0.1"
            value={minRating}
            onChange={(event) => setMinRating(event.target.value)}
            placeholder="0.0"
            className="mt-2 w-full rounded-[20px] border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition focus:border-glow/50 focus:ring-2 focus:ring-glow/20"
          />
        </label>

        <label className="block">
          <span className="section-title text-[11px] text-white/45">Nota maxima</span>
          <input
            type="number"
            min="0"
            max="10"
            step="0.1"
            value={maxRating}
            onChange={(event) => setMaxRating(event.target.value)}
            placeholder="10.0"
            className="mt-2 w-full rounded-[20px] border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition focus:border-glow/50 focus:ring-2 focus:ring-glow/20"
          />
        </label>

        <label className="flex items-center gap-3 rounded-[22px] border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/72">
          <input
            type="checkbox"
            checked={onlyRepeatedFilter}
            onChange={(event) => setOnlyRepeatedFilter(event.target.checked)}
            className="h-4 w-4 accent-green-500"
          />
          Solo repetidas
        </label>

        <label className="flex items-center gap-3 rounded-[22px] border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/72">
          <input
            type="checkbox"
            checked={onlyLatestUpdateFilter}
            onChange={(event) => setOnlyLatestUpdateFilter(event.target.checked)}
            className="h-4 w-4 accent-green-500"
          />
          Solo de ultima actualizacion
        </label>

        <div className="flex items-end">
          <button
            type="button"
            onClick={resetSongFilters}
            className="w-full rounded-full border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-white transition hover:border-white/20 hover:bg-white/10"
          >
            Limpiar filtros
          </button>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-8">
        <section className="glass-panel relative overflow-hidden rounded-[36px] px-6 py-8 sm:px-8 lg:px-10">
          <div className="absolute -left-16 top-10 h-44 w-44 rounded-full bg-glow/15 blur-3xl" />
          <div className="absolute right-0 top-0 h-60 w-60 animate-drift rounded-full bg-rose/10 blur-3xl" />

          <div className="relative space-y-8">
            <div className="max-w-3xl space-y-4">
              <p className="section-title text-xs text-glowSoft">Playlist Arena</p>
              <h1 className="font-display text-4xl font-semibold tracking-[0.02em] text-white sm:text-5xl">
                Tu playlist, tus notas, tus torneos.
              </h1>
              <p className="text-base leading-7 text-white/72 sm:text-lg">
                La app guarda tus canciones en local, te deja puntuar, detectar repetidas, revisar
                las ultimas actualizaciones y ordenar el ranking por nota con desempate por victorias
                internas de torneo.
              </p>
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
              <button
                type="button"
                onClick={() => setActiveSection("songs")}
                className={`rounded-[28px] border p-5 text-left transition ${
                  activeSection === "songs"
                    ? "border-glow/35 bg-glow/12"
                    : "border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10"
                }`}
              >
                <p className="section-title text-[11px] text-glowSoft">Opcion 1</p>
                <h2 className="mt-3 text-2xl font-semibold text-white">Canciones</h2>
                <p className="mt-3 text-sm leading-6 text-white/62">
                  Busqueda, ranking, canciones de la ultima actualizacion y canciones repetidas.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setActiveSection("tournament")}
                className={`rounded-[28px] border p-5 text-left transition ${
                  activeSection === "tournament"
                    ? "border-glow/35 bg-glow/12"
                    : "border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10"
                }`}
              >
                <p className="section-title text-[11px] text-glowSoft">Opcion 2</p>
                <h2 className="mt-3 text-2xl font-semibold text-white">Torneo</h2>
                <p className="mt-3 text-sm leading-6 text-white/62">
                  Enfrentamientos 1v1 o de 4 canciones con progreso guardado y victorias acumuladas.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setActiveSection("updates")}
                className={`rounded-[28px] border p-5 text-left transition ${
                  activeSection === "updates"
                    ? "border-glow/35 bg-glow/12"
                    : "border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10"
                }`}
              >
                <p className="section-title text-[11px] text-glowSoft">Opcion 3</p>
                <h2 className="mt-3 text-2xl font-semibold text-white">Actualizar datos</h2>
                <p className="mt-3 text-sm leading-6 text-white/62">
                  Sincroniza tu playlist unica, anade canciones nuevas y revisa el historial de updates.
                </p>
              </button>
            </div>
          </div>
        </section>

        {notice ? (
          <div
            className={`rounded-[24px] border px-5 py-4 text-sm ${getNoticeStyles(notice.tone)}`}
          >
            {notice.message}
          </div>
        ) : null}

        {activeSection === "songs" ? (
          <section className="space-y-6">
            <div className="glass-panel rounded-[32px] p-6 sm:p-8">
              <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="section-title text-[11px] text-glowSoft">Canciones</p>
                  <h2 className="mt-3 text-3xl font-semibold text-white">Libreria local</h2>
                  <p className="mt-3 max-w-2xl text-sm leading-6 text-white/65">
                    Esta seccion esta organizada en cuatro apartados para que puedas buscar,
                    puntuar, revisar la ultima sync y detectar duplicados sin perder nada.
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-4">
                  <div className="rounded-[22px] border border-white/10 bg-white/5 p-4">
                    <p className="section-title text-[11px] text-white/40">Totales</p>
                    <p className="mt-2 text-2xl font-semibold text-white">{availableSongs}</p>
                  </div>
                  <div className="rounded-[22px] border border-white/10 bg-white/5 p-4">
                    <p className="section-title text-[11px] text-white/40">Puntuadas</p>
                    <p className="mt-2 text-2xl font-semibold text-white">{ratedSongsCount}</p>
                  </div>
                  <div className="rounded-[22px] border border-white/10 bg-white/5 p-4">
                    <p className="section-title text-[11px] text-white/40">Fuera playlist</p>
                    <p className="mt-2 text-2xl font-semibold text-white">{removedSongsCount}</p>
                  </div>
                  <div className="rounded-[22px] border border-white/10 bg-white/5 p-4">
                    <p className="section-title text-[11px] text-white/40">Media</p>
                    <p className="mt-2 text-2xl font-semibold text-white">
                      {averageRating === null ? "Sin datos" : formatRating(averageRating)}
                    </p>
                  </div>
                </div>
              </div>

              {!playlist ? (
                <div className="mt-8 rounded-[28px] border border-dashed border-white/12 bg-white/5 p-8 text-center">
                  <p className="text-xl font-semibold text-white">Todavia no hay canciones locales</p>
                  <p className="mt-3 text-sm leading-6 text-white/60">
                    Primero entra en `Actualizar datos`, conecta Spotify y sincroniza tu playlist.
                  </p>
                  <button
                    type="button"
                    onClick={() => setActiveSection("updates")}
                    className="mt-5 rounded-full bg-glow px-5 py-3 text-sm font-semibold text-ink transition hover:bg-glowSoft"
                  >
                    Ir a Actualizar datos
                  </button>
                </div>
              ) : (
                <div className="mt-8 space-y-6">
                  <div className="grid gap-3 md:grid-cols-4">
                    <button
                      type="button"
                      onClick={() => setSongsSection("search")}
                      className={`rounded-[22px] border px-4 py-3 text-sm font-semibold transition ${
                        songsSection === "search"
                          ? "border-glow/35 bg-glow/12 text-white"
                          : "border-white/10 bg-white/5 text-white/72 hover:border-white/20 hover:bg-white/10"
                      }`}
                    >
                      Busqueda
                    </button>
                    <button
                      type="button"
                      onClick={() => setSongsSection("ranking")}
                      className={`rounded-[22px] border px-4 py-3 text-sm font-semibold transition ${
                        songsSection === "ranking"
                          ? "border-glow/35 bg-glow/12 text-white"
                          : "border-white/10 bg-white/5 text-white/72 hover:border-white/20 hover:bg-white/10"
                      }`}
                    >
                      Ranking
                    </button>
                    <button
                      type="button"
                      onClick={() => setSongsSection("latest-update")}
                      className={`rounded-[22px] border px-4 py-3 text-sm font-semibold transition ${
                        songsSection === "latest-update"
                          ? "border-glow/35 bg-glow/12 text-white"
                          : "border-white/10 bg-white/5 text-white/72 hover:border-white/20 hover:bg-white/10"
                      }`}
                    >
                      Canciones de la ultima actualizacion
                    </button>
                    <button
                      type="button"
                      onClick={() => setSongsSection("duplicates")}
                      className={`rounded-[22px] border px-4 py-3 text-sm font-semibold transition ${
                        songsSection === "duplicates"
                          ? "border-glow/35 bg-glow/12 text-white"
                          : "border-white/10 bg-white/5 text-white/72 hover:border-white/20 hover:bg-white/10"
                      }`}
                    >
                      Canciones repetidas
                    </button>
                  </div>

                  {songsSection === "search" ? (
                    <div className="space-y-6">
                      {renderSongFilters()}
                      <div className="flex flex-wrap gap-3">
                        <button
                          type="button"
                          onClick={() => setRatingFlowOpen((current) => !current)}
                          className="rounded-full bg-glow px-5 py-3 text-sm font-semibold text-ink transition hover:bg-glowSoft"
                        >
                          {ratingFlowOpen ? "Cerrar puntuacion" : "Anadir puntuacion"}
                        </button>
                      </div>
                      <div className="rounded-[24px] border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/66">
                        Sin puntuacion: <span className="font-semibold text-white">{unratedSongsCount}</span>.
                        Si una cancion ya no esta en Spotify seguira aqui con un icono y solo tu podras borrarla manualmente.
                      </div>
                      {ratingFlowOpen ? (
                        <SongRatingFlow
                          songs={[...allSongs].sort(
                            (a, b) => Date.parse(b.addedAt) - Date.parse(a.addedAt)
                          )}
                          onSaveRating={handleSaveSongRating}
                          onClose={() => setRatingFlowOpen(false)}
                        />
                      ) : null}
                      {searchSongs.length ? (
                        <div className="space-y-4">
                          {searchSongs.map((song) => (
                            <SongLibraryItem
                              key={song.entryId}
                              song={song}
                              expanded={expandedSongId === song.entryId}
                              onToggle={() =>
                                setExpandedSongId((current) =>
                                  current === song.entryId ? null : song.entryId
                                )
                              }
                              onSaveRating={handleSaveSongRating}
                              onClearRating={handleClearSongRating}
                              onDeleteArchived={handleDeleteRemovedSong}
                            />
                          ))}
                        </div>
                      ) : (
                        <div className="rounded-[28px] border border-dashed border-white/12 bg-white/5 p-8 text-center text-sm text-white/58">
                          No hay canciones que coincidan con la busqueda.
                        </div>
                      )}
                    </div>
                  ) : null}

                  {songsSection === "ranking" ? (
                    <div className="space-y-6">
                      {renderSongFilters()}
                      <div className="rounded-[24px] border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/66">
                        El ranking se ordena por nota, luego por victorias acumuladas en torneos y,
                        si sigue habiendo empate, por orden alfabetico.
                      </div>
                      {rankingSongs.length ? (
                        <div className="space-y-4">
                          {rankingSongs.map((song, index) => (
                            <div key={song.entryId} className="space-y-2">
                              <div className="flex items-center justify-between px-2 text-xs uppercase tracking-[0.2em] text-white/40">
                                <span>Posicion #{index + 1}</span>
                                <span>
                                  Nota {formatRating(song.userRating)} | Victorias {song.tournamentWins}
                                </span>
                              </div>
                              <SongLibraryItem
                                song={song}
                                expanded={expandedSongId === song.entryId}
                                onToggle={() =>
                                  setExpandedSongId((current) =>
                                    current === song.entryId ? null : song.entryId
                                  )
                                }
                                onSaveRating={handleSaveSongRating}
                                onClearRating={handleClearSongRating}
                                onDeleteArchived={handleDeleteRemovedSong}
                              />
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="rounded-[28px] border border-dashed border-white/12 bg-white/5 p-8 text-center text-sm text-white/58">
                          No hay canciones que cumplan los filtros del ranking.
                        </div>
                      )}
                    </div>
                  ) : null}

                  {songsSection === "latest-update" ? (
                    <div className="space-y-6">
                      {latestSync ? (
                        <div className="space-y-6">
                          <div className="rounded-[26px] border border-white/10 bg-white/5 p-5">
                            <p className="section-title text-[11px] text-glowSoft">Ultima actualizacion</p>
                            <h3 className="mt-3 text-2xl font-semibold text-white">
                              {latestSync.playlistName}
                            </h3>
                            <p className="mt-3 text-sm text-white/68">
                              Fecha: {formatDate(latestSync.syncedAt)}
                            </p>
                            <p className="mt-2 text-sm text-white/68">
                              Total de Canciones Nuevas: {latestSync.addedSongs.length} canciones
                            </p>
                          </div>

                          {latestSyncSongs.length ? (
                            <div className="space-y-4">
                              {latestSyncSongs.map((song) => (
                                <SongLibraryItem
                                  key={song.entryId}
                                  song={song}
                                  expanded={expandedSongId === song.entryId}
                                  onToggle={() =>
                                    setExpandedSongId((current) =>
                                      current === song.entryId ? null : song.entryId
                                    )
                                  }
                                  onSaveRating={handleSaveSongRating}
                                  onClearRating={handleClearSongRating}
                                  onDeleteArchived={handleDeleteRemovedSong}
                                />
                              ))}
                            </div>
                          ) : (
                            <div className="rounded-[28px] border border-dashed border-white/12 bg-white/5 p-8 text-center text-sm text-white/58">
                              La ultima actualizacion no anadio canciones nuevas.
                            </div>
                          )}

                          <div className="space-y-4">
                            <p className="section-title text-[11px] text-white/40">Historial de actualizaciones</p>
                            {syncHistory.map((entry) => (
                              <div
                                key={entry.id}
                                className="rounded-[24px] border border-white/10 bg-white/5 p-5"
                              >
                                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                  <div>
                                    <p className="text-lg font-semibold text-white">{entry.playlistName}</p>
                                    <p className="mt-1 text-sm text-white/60">
                                      {formatDate(entry.syncedAt)}
                                    </p>
                                  </div>
                                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/62">
                                    {entry.addedSongs.length} nuevas
                                  </span>
                                </div>
                                {entry.addedSongs.length ? (
                                  <div className="mt-4 text-sm leading-6 text-white/64">
                                    {entry.addedSongs.map((song) => song.title).join("  |  ")}
                                  </div>
                                ) : (
                                  <div className="mt-4 text-sm leading-6 text-white/50">
                                    Sin canciones nuevas en esta actualizacion.
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="rounded-[28px] border border-dashed border-white/12 bg-white/5 p-8 text-center text-sm text-white/58">
                          Todavia no hay historial de actualizaciones.
                        </div>
                      )}
                    </div>
                  ) : null}

                  {songsSection === "duplicates" ? (
                    <div className="space-y-6">
                      <div className="rounded-[24px] border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/66">
                        Las repetidas se detectan por mismo titulo y mismo autor principal.
                      </div>
                      {duplicateGroups.length ? (
                        <div className="space-y-6">
                          {duplicateGroups.map((group) => (
                            <div key={group.key} className="space-y-4">
                              <div className="rounded-[24px] border border-white/10 bg-white/5 px-4 py-3">
                                <p className="text-lg font-semibold text-white">{group.label}</p>
                                <p className="mt-1 text-sm text-white/58">
                                  {group.songs.length} entradas detectadas
                                </p>
                              </div>
                              {group.songs.map((song) => (
                                <SongLibraryItem
                                  key={song.entryId}
                                  song={song}
                                  expanded={expandedSongId === song.entryId}
                                  onToggle={() =>
                                    setExpandedSongId((current) =>
                                      current === song.entryId ? null : song.entryId
                                    )
                                  }
                                  onSaveRating={handleSaveSongRating}
                                  onClearRating={handleClearSongRating}
                                  onDeleteArchived={handleDeleteRemovedSong}
                                />
                              ))}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="rounded-[28px] border border-dashed border-white/12 bg-white/5 p-8 text-center text-sm text-white/58">
                          No se han detectado canciones repetidas.
                        </div>
                      )}
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          </section>
        ) : null}

        {activeSection === "tournament" ? (
          <section className="grid gap-8 xl:grid-cols-[360px,1fr]">
            <aside className="space-y-6">
              <section className="glass-panel rounded-[32px] p-6">
                <p className="section-title text-[11px] text-glowSoft">Torneo</p>
                <h2 className="mt-3 text-2xl font-semibold text-white">Configurar bracket</h2>

                {!playlist ? (
                  <p className="mt-6 rounded-[24px] border border-dashed border-white/12 bg-white/5 p-5 text-sm leading-6 text-white/58">
                    Necesitas canciones en local. Ve a `Actualizar datos` para importar tu playlist.
                  </p>
                ) : (
                  <div className="mt-6 space-y-6">
                    <div className="space-y-3">
                      <p className="section-title text-[11px] text-white/45">Modo</p>
                      <div className="grid gap-3">
                        {(["duel", "battle"] as TournamentMode[]).map((option) => (
                          <button
                            key={option}
                            type="button"
                            onClick={() => setMode(option)}
                            className={`rounded-[22px] border px-4 py-3 text-left transition ${
                              mode === option
                                ? "border-glow/35 bg-glow/12 text-white"
                                : "border-white/10 bg-white/5 text-white/70 hover:border-white/20 hover:bg-white/10"
                            }`}
                          >
                            <div className="font-semibold">{MODE_LABELS[option]}</div>
                            <div className="mt-1 text-sm text-white/55">
                              {option === "duel"
                                ? "Dos canciones, una ganadora."
                                : "Cuatro canciones a la vez y eliges solo una."}
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-3">
                      <p className="section-title text-[11px] text-white/45">Tamano del torneo</p>
                      <div className="flex flex-wrap gap-2">
                        {sizeOptions.map((option) => {
                          const disabled = option > availableSongs;

                          return (
                            <button
                              key={option}
                              type="button"
                              onClick={() => setSize(option)}
                              disabled={disabled}
                              className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                                size === option
                                  ? "border border-glow/35 bg-glow/12 text-white"
                                  : "border border-white/10 bg-white/5 text-white/72"
                              } disabled:cursor-not-allowed disabled:opacity-30`}
                            >
                              {option}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <label className="block space-y-2">
                      <span className="section-title text-[11px] text-white/45">
                        Estrategia de seleccion
                      </span>
                      <select
                        value={strategy}
                        onChange={(event) =>
                          setStrategy(event.target.value as TournamentSelectionStrategy)
                        }
                        className="w-full rounded-[20px] border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition focus:border-glow/50 focus:ring-2 focus:ring-glow/20"
                      >
                        {STRATEGY_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>

                    <div className="grid gap-3">
                      <button
                        type="button"
                        onClick={handleCreateTournament}
                        disabled={busyAction === "tournament" || availableSongs < size}
                        className="inline-flex items-center justify-center rounded-full bg-glow px-5 py-3 text-sm font-semibold text-ink transition hover:bg-glowSoft disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {busyAction === "tournament" ? "Creando torneo..." : "Empezar torneo"}
                      </button>

                      <button
                        type="button"
                        onClick={handleRestartTournament}
                        disabled={!tournament}
                        className="inline-flex items-center justify-center rounded-full border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-white transition hover:border-white/20 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        Reiniciar torneo
                      </button>

                      <button
                        type="button"
                        onClick={handleLeaveTournament}
                        disabled={!tournament}
                        className="inline-flex items-center justify-center rounded-full border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-white transition hover:border-white/20 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        Salir del torneo
                      </button>
                    </div>

                    <p className="text-sm leading-6 text-white/58">
                      Canciones disponibles en local: {availableSongs}. Las victorias internas solo
                      se suman al ranking cuando el torneo termina. Si sales o reinicias antes, no
                      se registra nada.
                    </p>
                  </div>
                )}
              </section>
            </aside>

            <section className="space-y-6">
              <div className="glass-panel rounded-[32px] p-6 sm:p-8">
                <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <p className="section-title text-[11px] text-glowSoft">Arena</p>
                    <h2 className="mt-3 text-3xl font-semibold text-white">Torneo actual</h2>
                    <p className="mt-3 max-w-2xl text-sm leading-6 text-white/65">
                      {tournament
                        ? tournament.completed
                          ? "Ya hay campeona. Puedes revisar el historial o reiniciar el bracket."
                          : "Elige una ganadora en cada enfrentamiento. El progreso se guarda automaticamente, pero las victorias internas solo se aplican cuando terminas el torneo."
                        : "Crea un torneo cuando ya tengas canciones sincronizadas."}
                    </p>
                  </div>

                  {tournament ? (
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="rounded-[22px] border border-white/10 bg-white/5 p-4">
                        <p className="section-title text-[11px] text-white/40">Ronda</p>
                        <p className="mt-2 text-2xl font-semibold text-white">
                          {tournament.completed
                            ? "Final"
                            : `${currentRound?.round ?? 1}/${getTotalRounds(tournament)}`}
                        </p>
                      </div>
                      <div className="rounded-[22px] border border-white/10 bg-white/5 p-4">
                        <p className="section-title text-[11px] text-white/40">Progreso</p>
                        <p className="mt-2 text-2xl font-semibold text-white">
                          {tournamentProgress.completedMatches}/{tournamentProgress.totalMatches}
                        </p>
                      </div>
                      <div className="rounded-[22px] border border-white/10 bg-white/5 p-4">
                        <p className="section-title text-[11px] text-white/40">Restantes</p>
                        <p className="mt-2 text-2xl font-semibold text-white">{remainingSongs}</p>
                      </div>
                    </div>
                  ) : null}
                </div>

                {!isHydrated ? (
                  <div className="mt-8 rounded-[28px] border border-white/10 bg-white/5 p-8 text-center text-sm text-white/60">
                    Cargando datos locales...
                  </div>
                ) : null}

                {isHydrated && playlist && !tournament ? (
                  <div className="mt-8 rounded-[28px] border border-dashed border-white/12 bg-white/5 p-8">
                    <p className="text-xl font-semibold text-white">Listo para empezar</p>
                    <p className="mt-3 text-sm leading-6 text-white/60">
                      Elige modo, tamano y estrategia de seleccion desde el panel izquierdo.
                    </p>
                  </div>
                ) : null}

                {isHydrated && tournament && !tournament.completed && currentMatch ? (
                  <div className="mt-8 space-y-6">
                    <div className="rounded-[26px] border border-white/10 bg-white/5 p-5">
                      <p className="section-title text-[11px] text-glowSoft">
                        {MODE_LABELS[tournament.mode]}
                      </p>
                      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                        <div>
                          <h3 className="text-2xl font-semibold text-white">
                            Ronda {currentRound?.round}, Enfrentamiento {currentMatch.matchNumber}
                          </h3>
                          <p className="mt-2 text-sm text-white/62">
                            {tournament.groupSize === 2
                              ? "Elige una cancion para avanzar."
                              : "Elige solo una ganadora entre las cuatro."}
                          </p>
                        </div>
                        <div className="text-sm text-white/58">
                          {currentMatch.matchNumber}/{currentRound?.matches.length ?? 1} en esta ronda
                        </div>
                      </div>
                    </div>

                    <div className="grid gap-5 md:grid-cols-2">
                      {currentMatchSongs.map((song, index) => (
                        <SongCard
                          key={song.entryId}
                          song={song}
                          onSelect={() => handlePickWinner(song.entryId)}
                          accentLabel={
                            tournament.groupSize === 2
                              ? index === 0
                                ? "Contendiente izquierda"
                                : "Contendiente derecha"
                              : `Posicion ${index + 1}`
                          }
                        />
                      ))}
                    </div>
                  </div>
                ) : null}

                {isHydrated && tournament?.completed && champion ? (
                  <div className="mt-8 space-y-6">
                    <div className="grid gap-6 lg:grid-cols-[320px,1fr]">
                      <div className="relative aspect-square overflow-hidden rounded-[30px] border border-glow/20 bg-white/5">
                        {champion.coverUrl ? (
                          <Image
                            src={champion.coverUrl}
                            alt={`${champion.title} cover`}
                            fill
                            sizes="(max-width: 1024px) 100vw, 320px"
                            className="object-cover"
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center text-sm text-white/45">
                            Sin portada
                          </div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                        <div className="absolute inset-x-0 bottom-0 p-6">
                          <p className="section-title text-[11px] text-glowSoft">Campeona</p>
                          <h3 className="mt-2 text-3xl font-semibold text-white">{champion.title}</h3>
                          <p className="mt-2 text-sm text-white/70">{champion.artists.join(", ")}</p>
                        </div>
                      </div>

                      <div className="rounded-[30px] border border-white/10 bg-white/5 p-6">
                        <p className="section-title text-[11px] text-white/40">Detalles</p>
                        <dl className="mt-5 grid gap-4 sm:grid-cols-2">
                          <div>
                            <dt className="text-[11px] uppercase tracking-[0.2em] text-white/35">Album</dt>
                            <dd className="mt-1 text-lg text-white">{champion.album}</dd>
                          </div>
                          <div>
                            <dt className="text-[11px] uppercase tracking-[0.2em] text-white/35">Ano</dt>
                            <dd className="mt-1 text-lg text-white">{champion.releaseYear}</dd>
                          </div>
                          <div>
                            <dt className="text-[11px] uppercase tracking-[0.2em] text-white/35">Anadida</dt>
                            <dd className="mt-1 text-lg text-white">{formatDate(champion.addedAt)}</dd>
                          </div>
                          <div>
                            <dt className="text-[11px] uppercase tracking-[0.2em] text-white/35">Victorias</dt>
                            <dd className="mt-1 text-lg text-white">{champion.tournamentWins}</dd>
                          </div>
                          <div>
                            <dt className="text-[11px] uppercase tracking-[0.2em] text-white/35">
                              Ganadas aqui
                            </dt>
                            <dd className="mt-1 text-lg text-white">
                              {currentTournamentWinCounts.get(champion.entryId) ?? 0}
                            </dd>
                          </div>
                        </dl>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="glass-panel rounded-[32px] p-6 sm:p-8">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <p className="section-title text-[11px] text-glowSoft">Historial</p>
                    <h2 className="mt-3 text-3xl font-semibold text-white">
                      Enfrentamientos del torneo actual
                    </h2>
                  </div>
                </div>

                {tournament?.matchHistory.length ? (
                  <div className="mt-8 space-y-4">
                    {[...tournament.matchHistory].reverse().map((entry) => {
                      const winner = getSongById(playlist, entry.winnerId);
                      const contenders = entry.songIds
                        .map((songId) => getSongById(playlist, songId))
                        .filter((song): song is PlaylistSong => Boolean(song));

                      return (
                        <div
                          key={entry.id}
                          className="rounded-[24px] border border-white/10 bg-white/5 p-5"
                        >
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                              <p className="section-title text-[11px] text-white/40">
                                Ronda {entry.round} Enfrentamiento {entry.matchNumber}
                              </p>
                              <p className="mt-2 text-lg font-semibold text-white">
                                Ganadora: {winner?.title ?? "Cancion desconocida"}
                              </p>
                              <p className="mt-1 text-sm text-white/58">
                                {winner?.artists.join(", ") ?? "Artista desconocido"}
                              </p>
                            </div>
                            <p className="text-sm text-white/50">{formatDate(entry.playedAt)}</p>
                          </div>
                          <div className="mt-4 text-sm leading-6 text-white/60">
                            {contenders.map((song) => song.title).join("  |  ")}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="mt-8 rounded-[28px] border border-dashed border-white/12 bg-white/5 p-8 text-center text-sm text-white/58">
                    No hay enfrentamientos jugados todavia.
                  </div>
                )}
              </div>

              <div className="glass-panel rounded-[32px] p-6 sm:p-8">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <p className="section-title text-[11px] text-glowSoft">Archivo</p>
                    <h2 className="mt-3 text-3xl font-semibold text-white">
                      Historial de torneos
                    </h2>
                    <p className="mt-3 max-w-2xl text-sm leading-6 text-white/65">
                      Aqui se guardan solo los torneos completados. Si sales o reinicias uno a
                      medias, no se registra en este historial ni suma victorias internas.
                    </p>
                  </div>
                </div>

                {tournamentArchive.length ? (
                  <div className="mt-8 space-y-4">
                    {tournamentArchive.map((entry) => (
                      <div
                        key={entry.id}
                        className="rounded-[24px] border border-white/10 bg-white/5 p-5"
                      >
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                          <div>
                            <p className="section-title text-[11px] text-white/40">
                              {entry.sourcePlaylistName}
                            </p>
                            <h3 className="mt-2 text-2xl font-semibold text-white">
                              {MODE_LABELS[entry.mode]} de {entry.size} canciones
                            </h3>
                            <p className="mt-2 text-sm text-white/58">
                              Inicio: {formatDateTime(entry.createdAt)}
                            </p>
                            <p className="mt-1 text-sm text-white/58">
                              Final: {formatDateTime(entry.completedAt)}
                            </p>
                          </div>

                          <div className="flex flex-wrap gap-2">
                            <span className="rounded-full border border-glow/25 bg-glow/10 px-3 py-1 text-xs text-glowSoft">
                              {MODE_LABELS[entry.mode]}
                            </span>
                            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/70">
                              Tamano {entry.size}
                            </span>
                            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/70">
                              {getStrategyLabel(entry.selectionStrategy)}
                            </span>
                          </div>
                        </div>

                        <div className="mt-5">
                          <p className="section-title text-[11px] text-white/40">Top 3</p>
                          <div className="mt-4 grid gap-3 md:grid-cols-3">
                            {entry.topSongs.map((song, index) => (
                              <div
                                key={`${entry.id}-${song.entryId}`}
                                className="rounded-[20px] border border-white/10 bg-black/20 p-4"
                              >
                                <div className="flex items-center gap-3">
                                  <div className="relative h-14 w-14 overflow-hidden rounded-[16px] bg-white/5">
                                    {song.coverUrl ? (
                                      <Image
                                        src={song.coverUrl}
                                        alt={`${song.title} cover`}
                                        fill
                                        sizes="56px"
                                        className="object-cover"
                                      />
                                    ) : (
                                      <div className="flex h-full items-center justify-center text-[10px] text-white/40">
                                        Sin portada
                                      </div>
                                    )}
                                  </div>

                                  <div className="min-w-0 flex-1">
                                    <p className="section-title text-[11px] text-glowSoft">
                                      Top {index + 1}
                                    </p>
                                    <p className="truncate text-base font-semibold text-white">
                                      {song.title}
                                    </p>
                                    <p className="truncate text-sm text-white/60">
                                      {song.artists.join(", ")}
                                    </p>
                                  </div>
                                </div>

                                <div className="mt-3 flex flex-wrap gap-2 text-xs text-white/58">
                                  <span>Victorias: {song.wins}</span>
                                  <span>Ronda maxima: {song.deepestRound}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="mt-8 rounded-[28px] border border-dashed border-white/12 bg-white/5 p-8 text-center text-sm text-white/58">
                    Todavia no hay torneos completados guardados.
                  </div>
                )}
              </div>
            </section>
          </section>
        ) : null}

        {activeSection === "updates" ? (
          <section className="grid gap-8 xl:grid-cols-[360px,1fr]">
            <aside className="space-y-6">
              <section className="glass-panel rounded-[32px] p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="section-title text-[11px] text-glowSoft">Spotify</p>
                    <h2 className="mt-3 text-2xl font-semibold text-white">Actualizar datos</h2>
                  </div>
                  <span
                    className={`rounded-full px-3 py-1 text-[11px] uppercase tracking-[0.22em] ${
                      auth
                        ? "border border-glow/35 bg-glow/10 text-glowSoft"
                        : "border border-white/10 bg-white/5 text-white/50"
                    }`}
                  >
                    {auth ? "Conectado" : "Sin login"}
                  </span>
                </div>

                <div className="mt-6 space-y-4">
                  <button
                    type="button"
                    onClick={handleConnectSpotify}
                    disabled={busyAction === "auth"}
                    className="inline-flex w-full items-center justify-center rounded-full bg-glow px-5 py-3 text-sm font-semibold text-ink transition hover:bg-glowSoft disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {busyAction === "auth" ? "Redirigiendo a Spotify..." : "Conectar Spotify"}
                  </button>

                  <label className="block space-y-2">
                    <span className="section-title text-[11px] text-white/45">
                      URL de la playlist
                    </span>
                    <input
                      type="text"
                      value={playlistUrl}
                      onChange={(event) => setPlaylistUrl(event.target.value)}
                      placeholder="https://open.spotify.com/playlist/..."
                      className="w-full rounded-[20px] border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition focus:border-glow/50 focus:ring-2 focus:ring-glow/20"
                    />
                  </label>

                  <button
                    type="button"
                    onClick={() => void handleSyncPlaylist()}
                    disabled={busyAction === "playlist" || (!playlistUrl.trim() && !playlist?.playlistUrl)}
                    className="inline-flex w-full items-center justify-center rounded-full border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-white transition hover:border-white/20 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {playlistActionLabel}
                  </button>

                  <p className="text-sm leading-6 text-white/60">
                    La app solo trabaja con una playlist. Si introduces otra distinta, se mostrara un
                    popup y no se sustituiran tus datos.
                  </p>
                </div>
              </section>

              <section className="glass-panel rounded-[32px] p-6">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="section-title text-[11px] text-glowSoft">Datos locales</p>
                    <h2 className="mt-3 text-2xl font-semibold text-white">Estado</h2>
                  </div>
                  {playlist ? (
                    <div className="flex flex-wrap justify-end gap-2">
                      <button
                        type="button"
                        onClick={handleExportLocalData}
                        className="rounded-full border border-glow/30 bg-glow/10 px-4 py-2 text-xs uppercase tracking-[0.2em] text-glowSoft transition hover:border-glow/45 hover:bg-glow/15"
                      >
                        Exportar
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setClearConfirmationText("");
                          setClearDialogOpen(true);
                        }}
                        className="rounded-full border border-rose/40 bg-rose/12 px-4 py-2 text-xs uppercase tracking-[0.2em] text-rose transition hover:border-rose/60 hover:bg-rose/18"
                      >
                        Limpiar
                      </button>
                    </div>
                  ) : null}
                </div>

                {playlist ? (
                  <div className="mt-6 space-y-5">
                    <div className="relative aspect-square overflow-hidden rounded-[28px]">
                      {playlist.coverUrl ? (
                        <Image
                          src={playlist.coverUrl}
                          alt={`${playlist.name} cover`}
                          fill
                          sizes="(max-width: 1280px) 100vw, 360px"
                          className="object-cover"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center bg-white/5 text-sm text-white/45">
                          Sin portada
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                      <div className="absolute inset-x-0 bottom-0 p-5">
                        <p className="section-title text-[11px] text-white/50">Playlist sincronizada</p>
                        <h3 className="mt-2 text-3xl font-semibold text-white">{playlist.name}</h3>
                      </div>
                    </div>

                    <dl className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-[22px] border border-white/10 bg-white/5 p-4">
                        <dt className="section-title text-[11px] text-white/40">Guardadas</dt>
                        <dd className="mt-2 text-2xl font-semibold text-white">{playlist.totalSongs}</dd>
                      </div>
                      <div className="rounded-[22px] border border-white/10 bg-white/5 p-4">
                        <dt className="section-title text-[11px] text-white/40">Spotify actual</dt>
                        <dd className="mt-2 text-2xl font-semibold text-white">
                          {playlist.spotifyTrackCount}
                        </dd>
                      </div>
                      <div className="rounded-[22px] border border-white/10 bg-white/5 p-4">
                        <dt className="section-title text-[11px] text-white/40">
                          Ultima actualizacion
                        </dt>
                        <dd className="mt-2 text-sm text-white/75">
                          {formatDate(playlist.lastSyncedAt)}
                        </dd>
                      </div>
                      <div className="rounded-[22px] border border-white/10 bg-white/5 p-4">
                        <dt className="section-title text-[11px] text-white/40">Fuera playlist</dt>
                        <dd className="mt-2 text-2xl font-semibold text-white">
                          {removedSongsCount}
                        </dd>
                      </div>
                    </dl>
                  </div>
                ) : (
                  <p className="mt-6 rounded-[24px] border border-dashed border-white/12 bg-white/5 p-5 text-sm leading-6 text-white/58">
                    Aun no has sincronizado ninguna playlist. Cuando lo hagas, aqui veras el resumen
                    local y los datos basicos importados.
                  </p>
                )}
              </section>
            </aside>

            <section className="space-y-6">
              <div className="glass-panel rounded-[32px] p-6 sm:p-8">
                <p className="section-title text-[11px] text-glowSoft">Novedades</p>
                <h2 className="mt-3 text-3xl font-semibold text-white">Historial de actualizaciones</h2>

                {syncHistory.length ? (
                  <div className="mt-8 space-y-4">
                    {syncHistory.map((entry, index) => (
                      <div
                        key={entry.id}
                        className="rounded-[24px] border border-white/10 bg-white/5 p-5"
                      >
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <p className="section-title text-[11px] text-white/40">
                              {index === 0 ? "Ultima actualizacion" : "Actualizacion anterior"}
                            </p>
                            <p className="mt-2 text-lg font-semibold text-white">{entry.playlistName}</p>
                            <p className="mt-1 text-sm text-white/58">{formatDate(entry.syncedAt)}</p>
                          </div>
                          <span className="rounded-full border border-glow/25 bg-glow/10 px-4 py-2 text-sm font-semibold text-glowSoft">
                            Total de Canciones Nuevas: {entry.addedSongs.length} canciones
                          </span>
                        </div>

                        {entry.addedSongs.length ? (
                          <div className="mt-4 grid gap-4 md:grid-cols-2">
                            {entry.addedSongs.map((song) => (
                              <div
                                key={`${entry.id}-${song.entryId}`}
                                className="rounded-[20px] border border-white/10 bg-black/20 p-4"
                              >
                                <div className="flex items-center gap-4">
                                  <div className="relative h-16 w-16 overflow-hidden rounded-[18px] bg-white/5">
                                    {song.coverUrl ? (
                                      <Image
                                        src={song.coverUrl}
                                        alt={`${song.title} cover`}
                                        fill
                                        sizes="64px"
                                        className="object-cover"
                                      />
                                      ) : (
                                      <div className="flex h-full items-center justify-center text-xs text-white/40">
                                        Sin portada
                                      </div>
                                    )}
                                  </div>
                                  <div className="min-w-0">
                                    <p className="truncate text-lg font-semibold text-white">{song.title}</p>
                                    <p className="truncate text-sm text-white/62">{song.artists.join(", ")}</p>
                                    <p className="mt-1 text-xs text-white/42">{song.album}</p>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="mt-4 text-sm text-white/58">
                            En esta actualizacion no entraron canciones nuevas.
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="mt-8 rounded-[28px] border border-dashed border-white/12 bg-white/5 p-8 text-center text-sm text-white/58">
                    Todavia no hay historial de actualizaciones guardado.
                  </div>
                )}
              </div>
            </section>
          </section>
        ) : null}
      </div>

      {clearDialogOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 px-4">
          <div className="glass-panel max-w-lg rounded-[30px] p-6 sm:p-8">
            <p className="section-title text-[11px] text-rose">Borrado local</p>
            <h2 className="mt-3 text-2xl font-semibold text-white">Confirmar limpieza</h2>
            <p className="mt-4 text-sm leading-6 text-white/72">
              Esto borrara de este navegador la playlist importada, notas, torneo actual,
              historial de actualizaciones e historial de torneos. Antes de limpiar, puedes usar
              `Exportar` para guardar una copia JSON.
            </p>

            <label className="mt-5 block space-y-2">
              <span className="text-[11px] uppercase tracking-[0.2em] text-white/38">
                Escribe BORRAR para confirmar
              </span>
              <input
                type="text"
                value={clearConfirmationText}
                onChange={(event) => setClearConfirmationText(event.target.value)}
                className="w-full rounded-[18px] border border-rose/25 bg-black/20 px-4 py-3 text-sm text-white outline-none transition focus:border-rose/50 focus:ring-2 focus:ring-rose/20"
              />
            </label>

            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => {
                  setClearDialogOpen(false);
                  setClearConfirmationText("");
                }}
                className="rounded-full border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-white transition hover:border-white/20 hover:bg-white/10"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleClearImportedData}
                disabled={clearConfirmationText !== "BORRAR"}
                className="rounded-full border border-rose/40 bg-rose/15 px-5 py-3 text-sm font-semibold text-rose transition hover:border-rose/60 hover:bg-rose/20 disabled:cursor-not-allowed disabled:opacity-45"
              >
                Borrar datos
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {errorDialog ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 px-4">
          <div className="glass-panel max-w-lg rounded-[30px] p-6 sm:p-8">
            <p className="section-title text-[11px] text-rose">Error</p>
            <h2 className="mt-3 text-2xl font-semibold text-white">{errorDialog.title}</h2>
            <p className="mt-4 text-sm leading-6 text-white/72">{errorDialog.message}</p>
            <button
              type="button"
              onClick={() => setErrorDialog(null)}
              className="mt-6 rounded-full bg-glow px-5 py-3 text-sm font-semibold text-ink transition hover:bg-glowSoft"
            >
              Cerrar
            </button>
          </div>
        </div>
      ) : null}
    </main>
  );
}
