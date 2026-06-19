export type SpotifyAuthSession = {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
  tokenType: string;
  scope: string;
};

export type PlaylistSong = {
  entryId: string;
  id: string;
  spotifyUri: string;
  title: string;
  artists: string[];
  album: string;
  coverUrl: string;
  spotifyUrl: string;
  releaseDate: string;
  releaseYear: string;
  addedAt: string;
  durationMs: number;
  userRating: number | null;
  isInActivePlaylist: boolean;
  // tournamentWins es GLOBAL: suma de victorias de todas las personas.
  tournamentWins: number;
  // Nota media de la comunidad (media de todas las puntuaciones) y cuantas personas la han puntuado.
  communityRating: number | null;
  communityRatingCount: number;
};

export type ImportedPlaylist = {
  playlistId: string;
  playlistUrl: string;
  name: string;
  coverUrl: string;
  totalSongs: number;
  totalDurationMs: number;
  importedAt: string;
  lastSyncedAt: string;
  spotifyTrackCount: number;
  songs: PlaylistSong[];
};

export type LastSyncSummary = {
  playlistName: string;
  addedSongs: PlaylistSong[];
  replacedPlaylist: boolean;
  syncedAt: string;
};

export type SyncHistoryEntry = LastSyncSummary & {
  id: string;
};

export type PlaylistSyncResult = {
  playlist: ImportedPlaylist;
  session: SpotifyAuthSession;
  addedSongs: number;
  addedSongEntryIds: string[];
  replacedPlaylist: boolean;
};

export type TournamentMode = "duel" | "battle";

export type TournamentSelectionStrategy =
  | "random"
  | "release-newest"
  | "release-oldest";

export type TournamentMatch = {
  id: string;
  round: number;
  matchNumber: number;
  songIds: string[];
  winnerId?: string;
};

export type TournamentRound = {
  round: number;
  entrantIds: string[];
  matches: TournamentMatch[];
};

export type TournamentHistoryEntry = {
  id: string;
  round: number;
  matchNumber: number;
  songIds: string[];
  winnerId: string;
  playedAt: string;
};

export type TournamentTopSong = {
  entryId: string;
  title: string;
  artists: string[];
  coverUrl: string;
  wins: number;
  deepestRound: number;
};

export type TournamentArchiveEntry = {
  id: string;
  tournamentId: string;
  mode: TournamentMode;
  size: number;
  selectionStrategy: TournamentSelectionStrategy;
  createdAt: string;
  completedAt: string;
  championId: string;
  topSongs: TournamentTopSong[];
  sourcePlaylistId: string;
  sourcePlaylistName: string;
};

export type TournamentState = {
  id: string;
  mode: TournamentMode;
  size: number;
  groupSize: 2 | 4;
  selectionStrategy: TournamentSelectionStrategy;
  createdAt: string;
  sourcePlaylistId: string;
  rounds: TournamentRound[];
  currentRoundIndex: number;
  currentMatchIndex: number;
  championId?: string;
  completed: boolean;
  matchHistory: TournamentHistoryEntry[];
};

export type PkceSession = {
  verifier: string;
  state: string;
  createdAt: number;
};
