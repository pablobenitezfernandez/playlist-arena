import { SPOTIFY_SCOPES } from "@/lib/constants";
import type {
  ImportedPlaylist,
  PlaylistSong,
  PlaylistSyncResult,
  SpotifyAuthSession
} from "@/lib/types";
import { extractSpotifyPlaylistId, getReleaseYear } from "@/lib/utils";

const SPOTIFY_API_BASE_URL = "https://api.spotify.com/v1";
const SPOTIFY_ACCOUNTS_URL = "https://accounts.spotify.com";

type SpotifyImage = {
  url: string;
};

type SpotifyPlaylistResponse = {
  id: string;
  name: string;
  external_urls?: {
    spotify?: string;
  };
  images?: SpotifyImage[];
  items?: {
    total: number;
  };
  tracks?: {
    total: number;
  };
};

type SpotifyTrackItem = {
  added_at: string | null;
  item?: SpotifyTrackObject | null;
  track?: SpotifyTrackObject | null;
};

type SpotifyTrackObject = {
    id: string;
    uri: string;
    name: string;
    duration_ms: number;
    external_urls?: {
      spotify?: string;
    };
    album: {
      name: string;
      release_date: string;
      images?: SpotifyImage[];
    };
    artists: Array<{
      name: string;
    }>;
};

type SpotifyTracksPage = {
  items: SpotifyTrackItem[];
  next: string | null;
  total: number;
};

type SpotifyTokenResponse = {
  access_token: string;
  token_type: string;
  scope: string;
  expires_in: number;
  refresh_token?: string;
};

type PlaylistSnapshot = {
  playlistId: string;
  playlistUrl: string;
  name: string;
  coverUrl: string;
  spotifyTrackCount: number;
  songs: PlaylistSong[];
};

export class SpotifyApiError extends Error {
  status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = "SpotifyApiError";
    this.status = status;
  }
}

function getClientId(): string {
  const clientId = process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID;

  if (!clientId) {
    throw new SpotifyApiError(
      "Falta NEXT_PUBLIC_SPOTIFY_CLIENT_ID. Crea tu .env.local antes de conectar Spotify."
    );
  }

  return clientId;
}

function getRedirectUri(): string {
  const redirectUri = process.env.NEXT_PUBLIC_SPOTIFY_REDIRECT_URI;

  if (!redirectUri) {
    throw new SpotifyApiError(
      "Falta NEXT_PUBLIC_SPOTIFY_REDIRECT_URI. Crea tu .env.local antes de conectar Spotify."
    );
  }

  return redirectUri;
}

function toAuthSession(token: SpotifyTokenResponse, refreshToken?: string): SpotifyAuthSession {
  return {
    accessToken: token.access_token,
    refreshToken: token.refresh_token ?? refreshToken,
    expiresAt: Date.now() + Math.max(token.expires_in - 30, 0) * 1000,
    tokenType: token.token_type,
    scope: token.scope
  };
}

async function parseErrorMessage(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as {
      error?: string | { message?: string };
      error_description?: string;
      message?: string;
    };

    if (typeof payload.error === "string" && payload.error_description) {
      return payload.error_description;
    }

    if (typeof payload.error === "object" && payload.error?.message) {
      return payload.error.message;
    }

    if (payload.message) {
      return payload.message;
    }
  } catch {
    return response.statusText;
  }

  return response.statusText;
}

export function buildSpotifyAuthorizeUrl(params: {
  challenge: string;
  state: string;
}): string {
  const query = new URLSearchParams({
    client_id: getClientId(),
    response_type: "code",
    redirect_uri: getRedirectUri(),
    code_challenge_method: "S256",
    code_challenge: params.challenge,
    state: params.state,
    scope: SPOTIFY_SCOPES.join(" ")
  });

  return `${SPOTIFY_ACCOUNTS_URL}/authorize?${query.toString()}`;
}

export async function exchangeCodeForSpotifyToken(
  code: string,
  verifier: string
): Promise<SpotifyAuthSession> {
  const response = await fetch(`${SPOTIFY_ACCOUNTS_URL}/api/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      client_id: getClientId(),
      grant_type: "authorization_code",
      code,
      redirect_uri: getRedirectUri(),
      code_verifier: verifier
    })
  });

  if (!response.ok) {
    throw new SpotifyApiError(
      `Fallo en el login de Spotify: ${await parseErrorMessage(response)}`,
      response.status
    );
  }

  const token = (await response.json()) as SpotifyTokenResponse;
  return toAuthSession(token);
}

export async function refreshSpotifyToken(
  session: SpotifyAuthSession
): Promise<SpotifyAuthSession> {
  if (!session.refreshToken) {
    throw new SpotifyApiError(
      "La sesion de Spotify ha caducado y no hay refresh token disponible. Vuelve a conectar."
    );
  }

  const response = await fetch(`${SPOTIFY_ACCOUNTS_URL}/api/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      client_id: getClientId(),
      grant_type: "refresh_token",
      refresh_token: session.refreshToken
    })
  });

  if (!response.ok) {
    throw new SpotifyApiError(
      `No se pudo refrescar el token de Spotify: ${await parseErrorMessage(response)}`,
      response.status
    );
  }

  const token = (await response.json()) as SpotifyTokenResponse;
  return toAuthSession(token, session.refreshToken);
}

async function ensureValidSession(
  session: SpotifyAuthSession,
  onSessionUpdate?: (session: SpotifyAuthSession) => void | Promise<void>
): Promise<SpotifyAuthSession> {
  if (session.expiresAt > Date.now()) {
    return session;
  }

  const refreshed = await refreshSpotifyToken(session);
  await onSessionUpdate?.(refreshed);
  return refreshed;
}

async function spotifyRequest<T>(
  path: string,
  session: SpotifyAuthSession,
  onSessionUpdate?: (session: SpotifyAuthSession) => void | Promise<void>,
  allowRetry = true
): Promise<{ data: T; session: SpotifyAuthSession }> {
  const activeSession = await ensureValidSession(session, onSessionUpdate);
  const endpoint = path.startsWith("http")
    ? path.replace(SPOTIFY_API_BASE_URL, "")
    : path;
  const response = await fetch(`${SPOTIFY_API_BASE_URL}${endpoint}`, {
    headers: {
      Authorization: `${activeSession.tokenType} ${activeSession.accessToken}`
    }
  });

  if (response.status === 401) {
    if (!allowRetry) {
      throw new SpotifyApiError("Spotify 401: tu sesion ha caducado.", 401);
    }

    const refreshedSession = await refreshSpotifyToken(activeSession);
    await onSessionUpdate?.(refreshedSession);
    return spotifyRequest<T>(endpoint, refreshedSession, onSessionUpdate, false);
  }

  if (response.status === 403) {
    const spotifyMessage = await parseErrorMessage(response);
    throw new SpotifyApiError(
      `Spotify 403: ${spotifyMessage}. Revisa que la app de Spotify tenga Web API activada, que tu usuario este permitido en modo desarrollo y que la playlist sea accesible con esta cuenta.`,
      403
    );
  }

  if (!response.ok) {
    throw new SpotifyApiError(
      `Fallo en la peticion a Spotify: ${await parseErrorMessage(response)}`,
      response.status
    );
  }

  const data = (await response.json()) as T;

  return {
    data,
    session: activeSession
  };
}

function mapTrackToSong(item: SpotifyTrackItem, sequence: number): PlaylistSong | null {
  const track = item.item ?? item.track;

  if (!track?.id) {
    return null;
  }

  const addedAt = item.added_at ?? "";
  const entryId = addedAt
    ? `${track.id}:${addedAt}`
    : `${track.id}:playlist-entry-${sequence}`;

  return {
    entryId,
    id: track.id,
    spotifyUri: track.uri,
    title: track.name,
    artists: track.artists.map((artist) => artist.name),
    album: track.album.name,
    coverUrl: track.album.images?.[0]?.url ?? "",
    spotifyUrl: track.external_urls?.spotify ?? "",
    releaseDate: track.album.release_date,
    releaseYear: getReleaseYear(track.album.release_date),
    addedAt,
    durationMs: track.duration_ms,
    userRating: null,
    isInActivePlaylist: true,
    tournamentWins: 0
  };
}

async function fetchPlaylistSnapshotFromSpotify(
  playlistUrl: string,
  session: SpotifyAuthSession,
  onSessionUpdate?: (session: SpotifyAuthSession) => void | Promise<void>
): Promise<{ snapshot: PlaylistSnapshot; session: SpotifyAuthSession }> {
  const playlistId = extractSpotifyPlaylistId(playlistUrl);

  if (!playlistId) {
    throw new SpotifyApiError(
      "La URL de la playlist no es valida. Pega un enlace de playlist de Spotify."
    );
  }

  const playlistResponse = await spotifyRequest<SpotifyPlaylistResponse>(
    `/playlists/${playlistId}?fields=id,name,external_urls,images,items(total),tracks(total)`,
    session,
    onSessionUpdate
  );

  const songs: PlaylistSong[] = [];
  let nextPage:
    | string
    | null = `/playlists/${playlistId}/items?limit=50&offset=0&fields=items(added_at,item(id,uri,name,duration_ms,external_urls,album(name,release_date,images),artists(name)),track(id,uri,name,duration_ms,external_urls,album(name,release_date,images),artists(name))),next,total`;
  let activeSession = playlistResponse.session;

  while (nextPage) {
    const pageResponse: { data: SpotifyTracksPage; session: SpotifyAuthSession } =
      await spotifyRequest<SpotifyTracksPage>(
      nextPage,
      activeSession,
      onSessionUpdate
    );

    activeSession = pageResponse.session;

    pageResponse.data.items.forEach((item) => {
      const mapped = mapTrackToSong(item, songs.length);

      if (mapped) {
        songs.push(mapped);
      }
    });

    nextPage = pageResponse.data.next;
  }

  return {
    snapshot: {
      playlistId: playlistResponse.data.id,
      playlistUrl: playlistResponse.data.external_urls?.spotify ?? playlistUrl,
      name: playlistResponse.data.name,
      coverUrl: playlistResponse.data.images?.[0]?.url ?? songs[0]?.coverUrl ?? "",
      spotifyTrackCount:
        playlistResponse.data.items?.total ?? playlistResponse.data.tracks?.total ?? songs.length,
      songs
    },
    session: activeSession
  };
}

function buildImportedPlaylistFromSnapshot(snapshot: PlaylistSnapshot): ImportedPlaylist {
  if (snapshot.songs.length === 0) {
    throw new SpotifyApiError("La playlist esta vacia o no tiene canciones reproducibles.");
  }

  const timestamp = new Date().toISOString();
  const totalDurationMs = snapshot.songs.reduce((sum, song) => sum + song.durationMs, 0);

  return {
    playlistId: snapshot.playlistId,
    playlistUrl: snapshot.playlistUrl,
    name: snapshot.name,
    coverUrl: snapshot.coverUrl,
    totalSongs: snapshot.songs.length,
    totalDurationMs,
    importedAt: timestamp,
    lastSyncedAt: timestamp,
    spotifyTrackCount: snapshot.spotifyTrackCount,
    songs: snapshot.songs
  };
}

function mergeImportedPlaylist(
  currentPlaylist: ImportedPlaylist,
  snapshot: PlaylistSnapshot
): { playlist: ImportedPlaylist; addedSongs: number; addedSongEntryIds: string[] } {
  const activeEntryIds = new Set(snapshot.songs.map((song) => song.entryId));
  const currentSongMap = new Map(
    currentPlaylist.songs.map((song, index) => [song.entryId, { song, index }])
  );
  const mergedSongs = currentPlaylist.songs.map((song) => ({
    ...song,
    isInActivePlaylist: activeEntryIds.has(song.entryId)
  }));
  let addedSongs = 0;
  const addedSongEntryIds: string[] = [];

  snapshot.songs.forEach((song) => {
    const currentEntry = currentSongMap.get(song.entryId);

    if (!currentEntry) {
      mergedSongs.push(song);
      addedSongs += 1;
      addedSongEntryIds.push(song.entryId);
      return;
    }

    mergedSongs[currentEntry.index] = {
      ...currentEntry.song,
      ...song,
      userRating: currentEntry.song.userRating,
      isInActivePlaylist: true,
      tournamentWins: currentEntry.song.tournamentWins
    };
  });

  const totalDurationMs = mergedSongs.reduce((sum, song) => sum + song.durationMs, 0);

  return {
    playlist: {
      ...currentPlaylist,
      playlistId: snapshot.playlistId,
      playlistUrl: snapshot.playlistUrl,
      name: snapshot.name,
      coverUrl: snapshot.coverUrl || currentPlaylist.coverUrl,
      totalSongs: mergedSongs.length,
      totalDurationMs,
      lastSyncedAt: new Date().toISOString(),
      spotifyTrackCount: snapshot.spotifyTrackCount,
      songs: mergedSongs
    },
    addedSongs,
    addedSongEntryIds
  };
}

export async function syncPlaylistFromSpotify(
  playlistUrl: string,
  session: SpotifyAuthSession,
  currentPlaylist: ImportedPlaylist | null,
  onSessionUpdate?: (session: SpotifyAuthSession) => void | Promise<void>
): Promise<PlaylistSyncResult> {
  const { snapshot, session: activeSession } = await fetchPlaylistSnapshotFromSpotify(
    playlistUrl,
    session,
    onSessionUpdate
  );

  if (currentPlaylist && currentPlaylist.playlistId !== snapshot.playlistId) {
    throw new SpotifyApiError(
      `Esta aplicacion esta bloqueada a tu playlist actual "${currentPlaylist.name}". Si Spotify ha cambiado el link, usa el de esa misma playlist; si es otra distinta, no se puede sustituir automaticamente.`
    );
  }

  if (!currentPlaylist) {
    const playlist = buildImportedPlaylistFromSnapshot(snapshot);

    return {
      playlist,
      session: activeSession,
      addedSongs: playlist.totalSongs,
      addedSongEntryIds: playlist.songs.map((song) => song.entryId),
      replacedPlaylist: false
    };
  }

  const { playlist, addedSongs, addedSongEntryIds } = mergeImportedPlaylist(
    currentPlaylist,
    snapshot
  );

  return {
    playlist,
    session: activeSession,
    addedSongs,
    addedSongEntryIds,
    replacedPlaylist: false
  };
}
