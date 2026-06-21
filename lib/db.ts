import { getSupabaseClient } from "@/lib/supabase";
import type { ImportedPlaylist, PlaylistSong, TournamentArchiveEntry } from "@/lib/types";

// ── filas de la base de datos ───────────────────────────────────────────────
type SongRow = {
  entry_id: string;
  spotify_id: string;
  spotify_uri: string;
  title: string;
  artists: string[] | null;
  album: string;
  cover_url: string;
  spotify_url: string;
  release_date: string;
  release_year: string;
  added_at: string;
  duration_ms: number;
  is_in_active_playlist: boolean;
};

type PlaylistMetaRow = {
  id: number;
  playlist_id: string | null;
  playlist_url: string | null;
  name: string | null;
  cover_url: string | null;
  total_songs: number;
  total_duration_ms: number;
  spotify_track_count: number;
  last_synced_at: string | null;
};

// ── conversiones fila <-> modelo de la app ──────────────────────────────────
type SongAggregates = {
  userRating: number | null;
  communityRating: number | null;
  communityRatingCount: number;
  tournamentWins: number;
};

function rowToSong(row: SongRow, aggregates: SongAggregates): PlaylistSong {
  return {
    entryId: row.entry_id,
    id: row.spotify_id,
    spotifyUri: row.spotify_uri,
    title: row.title,
    artists: row.artists ?? [],
    album: row.album,
    coverUrl: row.cover_url,
    spotifyUrl: row.spotify_url,
    releaseDate: row.release_date,
    releaseYear: row.release_year,
    addedAt: row.added_at,
    durationMs: row.duration_ms,
    userRating: aggregates.userRating,
    isInActivePlaylist: row.is_in_active_playlist,
    tournamentWins: aggregates.tournamentWins,
    communityRating: aggregates.communityRating,
    communityRatingCount: aggregates.communityRatingCount
  };
}

function songToRow(song: PlaylistSong): SongRow {
  return {
    entry_id: song.entryId,
    spotify_id: song.id,
    spotify_uri: song.spotifyUri,
    title: song.title,
    artists: song.artists,
    album: song.album,
    cover_url: song.coverUrl,
    spotify_url: song.spotifyUrl,
    release_date: song.releaseDate,
    release_year: song.releaseYear,
    added_at: song.addedAt,
    duration_ms: song.durationMs,
    is_in_active_playlist: song.isInActivePlaylist
  };
}

/**
 * Lee la playlist compartida desde la base de datos y le pega las notas del
 * usuario actual. Devuelve null si el dueño todavia no ha sincronizado nada.
 */
export async function fetchSharedPlaylist(
  userId: string
): Promise<ImportedPlaylist | null> {
  const supabase = getSupabaseClient();

  const [songsResult, metaResult, ratingsResult, winsResult] = await Promise.all([
    supabase.from("songs").select("*").order("added_at", { ascending: true }),
    supabase.from("playlist_meta").select("*").eq("id", 1).maybeSingle(),
    supabase.from("ratings").select("user_id, song_entry_id, rating"),
    supabase.from("tournament_song_wins").select("song_entry_id, wins")
  ]);

  if (songsResult.error) {
    throw new Error(`No se pudieron leer las canciones: ${songsResult.error.message}`);
  }

  const songRows = (songsResult.data ?? []) as SongRow[];

  if (songRows.length === 0) {
    return null;
  }

  // Notas: la del usuario actual + agregados (suma y conteo) para la media.
  const userRatingMap = new Map<string, number>();
  const communitySum = new Map<string, number>();
  const communityCount = new Map<string, number>();

  for (const row of (ratingsResult.data ?? []) as Array<{
    user_id: string;
    song_entry_id: string;
    rating: number;
  }>) {
    const rating = Number(row.rating);
    communitySum.set(row.song_entry_id, (communitySum.get(row.song_entry_id) ?? 0) + rating);
    communityCount.set(row.song_entry_id, (communityCount.get(row.song_entry_id) ?? 0) + 1);

    if (row.user_id === userId) {
      userRatingMap.set(row.song_entry_id, rating);
    }
  }

  // Victorias de torneo globales: suma de todas las personas por cancion.
  const winsMap = new Map<string, number>();
  for (const row of (winsResult.data ?? []) as Array<{
    song_entry_id: string;
    wins: number;
  }>) {
    winsMap.set(row.song_entry_id, (winsMap.get(row.song_entry_id) ?? 0) + Number(row.wins));
  }

  const songs = songRows.map((row) => {
    const count = communityCount.get(row.entry_id) ?? 0;
    const sum = communitySum.get(row.entry_id) ?? 0;
    const communityRating = count > 0 ? Math.round((sum / count) * 10) / 10 : null;

    return rowToSong(row, {
      userRating: userRatingMap.get(row.entry_id) ?? null,
      communityRating,
      communityRatingCount: count,
      tournamentWins: winsMap.get(row.entry_id) ?? 0
    });
  });
  const meta = metaResult.data as PlaylistMetaRow | null;
  const totalDurationMs = songs.reduce((sum, song) => sum + song.durationMs, 0);
  const syncedAt = meta?.last_synced_at ?? new Date().toISOString();

  return {
    playlistId: meta?.playlist_id ?? "",
    playlistUrl: meta?.playlist_url ?? "",
    name: meta?.name ?? "Playlist",
    coverUrl: meta?.cover_url ?? songs[0]?.coverUrl ?? "",
    totalSongs: songs.length,
    totalDurationMs,
    importedAt: syncedAt,
    lastSyncedAt: syncedAt,
    spotifyTrackCount: meta?.spotify_track_count ?? songs.length,
    songs
  };
}

/** Guarda (o actualiza) la nota del usuario actual para una cancion. */
export async function saveRatingToDb(
  userId: string,
  entryId: string,
  rating: number
): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from("ratings").upsert(
    {
      user_id: userId,
      song_entry_id: entryId,
      rating,
      updated_at: new Date().toISOString()
    },
    { onConflict: "user_id,song_entry_id" }
  );

  if (error) {
    throw new Error(`No se pudo guardar la nota: ${error.message}`);
  }
}

/** Borra la nota del usuario actual para una cancion. */
export async function deleteRatingFromDb(
  userId: string,
  entryId: string
): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from("ratings")
    .delete()
    .eq("user_id", userId)
    .eq("song_entry_id", entryId);

  if (error) {
    throw new Error(`No se pudo borrar la nota: ${error.message}`);
  }
}

/**
 * Suma de victorias de torneo por canción en los últimos `days` días (de toda
 * la gente). Sirve para el "top semanal por victorias" del dashboard.
 * Devuelve un mapa entryId -> victorias en la ventana.
 */
export async function fetchRecentTournamentWins(days = 7): Promise<Map<string, number>> {
  const supabase = getSupabaseClient();
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from("tournament_song_wins")
    .select("song_entry_id, wins")
    .gte("created_at", since);

  if (error) {
    throw new Error(`No se pudieron leer las victorias recientes: ${error.message}`);
  }

  const map = new Map<string, number>();
  for (const row of (data ?? []) as Array<{ song_entry_id: string; wins: number }>) {
    map.set(row.song_entry_id, (map.get(row.song_entry_id) ?? 0) + Number(row.wins));
  }
  return map;
}

/**
 * (Solo dueño) Vuelca la playlist sincronizada de Spotify a la base de datos
 * compartida: canciones + metadatos. Las politicas RLS rechazan esta operacion
 * si quien la ejecuta no es dueño.
 */
export async function syncPlaylistToDb(playlist: ImportedPlaylist): Promise<void> {
  const supabase = getSupabaseClient();

  const rows = playlist.songs.map(songToRow);

  const { error: songsError } = await supabase
    .from("songs")
    .upsert(rows, { onConflict: "entry_id" });

  if (songsError) {
    throw new Error(`No se pudieron guardar las canciones: ${songsError.message}`);
  }

  const { error: metaError } = await supabase.from("playlist_meta").upsert(
    {
      id: 1,
      playlist_id: playlist.playlistId,
      playlist_url: playlist.playlistUrl,
      name: playlist.name,
      cover_url: playlist.coverUrl,
      total_songs: playlist.totalSongs,
      total_duration_ms: playlist.totalDurationMs,
      spotify_track_count: playlist.spotifyTrackCount,
      last_synced_at: new Date().toISOString()
    },
    { onConflict: "id" }
  );

  if (metaError) {
    throw new Error(`No se pudieron guardar los datos de la playlist: ${metaError.message}`);
  }
}

/**
 * Registra en la base de datos compartida las victorias que el usuario actual
 * dio a cada cancion en un torneo completado. Estas victorias suman al
 * desempate global del ranking (cuenta los torneos de todas las personas).
 */
export async function saveTournamentWins(
  userId: string,
  tournamentId: string,
  winCounts: Map<string, number>
): Promise<void> {
  const rows = [...winCounts.entries()]
    .filter(([, wins]) => wins > 0)
    .map(([entryId, wins]) => ({
      user_id: userId,
      song_entry_id: entryId,
      tournament_id: tournamentId,
      wins
    }));

  if (rows.length === 0) {
    return;
  }

  const supabase = getSupabaseClient();
  const { error } = await supabase.from("tournament_song_wins").insert(rows);

  if (error) {
    throw new Error(`No se pudieron guardar las victorias del torneo: ${error.message}`);
  }
}

/**
 * Guarda el RESULTADO FINAL de un torneo completado del usuario actual
 * (campeón + top 3 con posiciones), para que sus amigos puedan verlo.
 * Solo el resultado: no guarda el bracket completo. Idempotente por torneo.
 */
export async function saveTournamentResult(
  userId: string,
  entry: TournamentArchiveEntry
): Promise<void> {
  const supabase = getSupabaseClient();
  const topThree = entry.topSongs.slice(0, 3).map((song) => ({
    entryId: song.entryId,
    title: song.title,
    artists: song.artists,
    wins: song.wins
  }));

  // El resultado de un torneo es FINAL: se inserta una vez. Si por lo que sea
  // se reintenta el mismo torneo (doble disparo), el conflicto de clave única
  // (23505) se ignora en silencio, sin necesitar permiso de UPDATE en la RLS.
  const { error } = await supabase.from("tournament_results").insert({
    user_id: userId,
    tournament_id: entry.tournamentId,
    mode: entry.mode,
    size: entry.size,
    selection_strategy: entry.selectionStrategy,
    champion_entry_id: entry.championId,
    top_songs: topThree,
    completed_at: entry.completedAt
  });

  if (error && error.code !== "23505") {
    throw new Error(`No se pudo guardar el resultado del torneo: ${error.message}`);
  }
}

/** (Solo dueño) Elimina una cancion de la playlist compartida. */
export async function deleteSongFromDb(entryId: string): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from("songs").delete().eq("entry_id", entryId);

  if (error) {
    throw new Error(`No se pudo eliminar la cancion: ${error.message}`);
  }
}
