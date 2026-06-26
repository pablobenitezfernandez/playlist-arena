import { getSupabaseClient } from "@/lib/supabase";

export type FriendProfile = {
  id: string;
  display_name: string;
  username: string | null;
};

type FriendshipRow = {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: "pending" | "accepted";
  created_at: string;
};

export type FriendEntry = {
  friendshipId: string;
  profile: FriendProfile;
};

export type FriendsData = {
  friends: FriendEntry[]; // amistades aceptadas
  incoming: FriendEntry[]; // solicitudes que me han enviado
  outgoing: FriendEntry[]; // solicitudes que yo he enviado
};

/** Busca un perfil por su @usuario exacto (sin la @). */
export async function findUserByUsername(rawUsername: string): Promise<FriendProfile | null> {
  const username = rawUsername.trim().toLowerCase().replace(/^@/, "");

  if (!username) {
    return null;
  }

  const supabase = getSupabaseClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, display_name, username")
    .eq("username", username)
    .maybeSingle();

  return (data as FriendProfile) ?? null;
}

/** Envía una solicitud de amistad (de mí a otra persona). */
export async function sendFriendRequest(myId: string, addresseeId: string): Promise<void> {
  if (myId === addresseeId) {
    throw new Error("No puedes añadirte a ti mismo.");
  }

  const supabase = getSupabaseClient();

  // ¿Ya hay solicitud o amistad en cualquier dirección?
  const { data: existing } = await supabase
    .from("friendships")
    .select("id")
    .or(
      `and(requester_id.eq.${myId},addressee_id.eq.${addresseeId}),and(requester_id.eq.${addresseeId},addressee_id.eq.${myId})`
    );

  if (existing && existing.length > 0) {
    throw new Error("Ya hay una solicitud o amistad con esa persona.");
  }

  const { error } = await supabase
    .from("friendships")
    .insert({ requester_id: myId, addressee_id: addresseeId, status: "pending" });

  if (error) {
    throw new Error(`No se pudo enviar la solicitud: ${error.message}`);
  }
}

/** Acepta una solicitud recibida. */
export async function acceptFriendRequest(friendshipId: string): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from("friendships")
    .update({ status: "accepted" })
    .eq("id", friendshipId);

  if (error) {
    throw new Error(`No se pudo aceptar la solicitud: ${error.message}`);
  }
}

/** Borra una amistad/solicitud (rechazar, cancelar o dejar de ser amigos). */
export async function removeFriendship(friendshipId: string): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from("friendships").delete().eq("id", friendshipId);

  if (error) {
    throw new Error(`No se pudo completar la acción: ${error.message}`);
  }
}

/**
 * Lee las notas de un amigo (entryId -> nota). Sirve para mostrar su top.
 * Privacidad "blanda": la app solo construye esta vista para tus amigos
 * aceptados; la media global del ranking sigue siendo de todos (sin cambios).
 */
export async function fetchFriendRatings(friendId: string): Promise<Map<string, number>> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("ratings")
    .select("song_entry_id, rating")
    .eq("user_id", friendId);

  if (error) {
    throw new Error(`No se pudieron leer las notas de tu amigo: ${error.message}`);
  }

  const map = new Map<string, number>();
  for (const row of (data ?? []) as Array<{ song_entry_id: string; rating: number }>) {
    map.set(row.song_entry_id, Number(row.rating));
  }
  return map;
}

export type FriendTournamentPodiumSong = {
  entryId: string;
  wins: number;
};

export type FriendTournament = {
  id: string;
  completedAt: string;
  podium: FriendTournamentPodiumSong[]; // top 3 por victorias (el título se resuelve en la UI)
};

/**
 * Lee los torneos completados de un amigo en los últimos `days` días y
 * reconstruye su podio (top 3) a partir de las **victorias** de cada canción.
 *
 * Se lee de `tournament_song_wins` (no de `tournament_results`) porque las
 * victorias se guardan SIEMPRE al completar un torneo y existen desde el
 * principio; así se ven también los torneos anteriores a la vista de amigos y
 * no depende de una segunda escritura. (Lectura global por RLS; la app solo
 * construye esta vista para amigos aceptados.)
 */
export async function fetchFriendTournaments(
  friendId: string,
  days = 7
): Promise<FriendTournament[]> {
  const supabase = getSupabaseClient();
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from("tournament_song_wins")
    .select("tournament_id, song_entry_id, wins, created_at")
    .eq("user_id", friendId)
    .gte("created_at", since);

  if (error) {
    throw new Error(`No se pudieron leer los torneos de tu amigo: ${error.message}`);
  }

  // Agrupa las victorias por torneo y arma el podio de cada uno.
  const byTournament = new Map<
    string,
    { createdAt: string; songs: FriendTournamentPodiumSong[] }
  >();

  for (const row of (data ?? []) as Array<{
    tournament_id: string;
    song_entry_id: string;
    wins: number;
    created_at: string;
  }>) {
    const group = byTournament.get(row.tournament_id) ?? {
      createdAt: row.created_at,
      songs: []
    };
    group.songs.push({ entryId: row.song_entry_id, wins: Number(row.wins) });
    if (row.created_at < group.createdAt) {
      group.createdAt = row.created_at;
    }
    byTournament.set(row.tournament_id, group);
  }

  return [...byTournament.entries()]
    .map(([id, group]) => ({
      id,
      completedAt: group.createdAt,
      podium: group.songs.sort((a, b) => b.wins - a.wins).slice(0, 3)
    }))
    .sort((a, b) => b.completedAt.localeCompare(a.completedAt))
    .slice(0, 10); // como mucho, los 10 torneos más recientes de la ventana
}

/**
 * Cuenta cuántas solicitudes de amistad pendientes tengo recibidas. Consulta
 * ligera (sin traer perfiles) para el aviso/puntito del menú.
 */
export async function fetchIncomingRequestCount(myId: string): Promise<number> {
  const supabase = getSupabaseClient();
  const { count, error } = await supabase
    .from("friendships")
    .select("id", { count: "exact", head: true })
    .eq("addressee_id", myId)
    .eq("status", "pending");

  if (error) {
    return 0; // silencioso: el puntito no debe romper nada
  }
  return count ?? 0;
}

/** Carga mis amigos y solicitudes (entrantes y salientes), con sus perfiles. */
export async function fetchFriends(myId: string): Promise<FriendsData> {
  const supabase = getSupabaseClient();

  // RLS limita a las amistades en las que participo.
  const { data, error } = await supabase.from("friendships").select("*");

  if (error) {
    throw new Error(`No se pudieron leer las amistades: ${error.message}`);
  }

  const rows = (data ?? []) as FriendshipRow[];
  const accepted = rows.filter((f) => f.status === "accepted");
  const incoming = rows.filter((f) => f.status === "pending" && f.addressee_id === myId);
  const outgoing = rows.filter((f) => f.status === "pending" && f.requester_id === myId);

  const otherIds = new Set<string>();
  for (const f of accepted) {
    otherIds.add(f.requester_id === myId ? f.addressee_id : f.requester_id);
  }
  for (const f of incoming) {
    otherIds.add(f.requester_id);
  }
  for (const f of outgoing) {
    otherIds.add(f.addressee_id);
  }

  const profileMap = new Map<string, FriendProfile>();
  if (otherIds.size > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, display_name, username")
      .in("id", [...otherIds]);

    for (const p of (profiles ?? []) as FriendProfile[]) {
      profileMap.set(p.id, p);
    }
  }

  const toEntry = (f: FriendshipRow, otherId: string): FriendEntry | null => {
    const profile = profileMap.get(otherId);
    return profile ? { friendshipId: f.id, profile } : null;
  };

  return {
    friends: accepted
      .map((f) => toEntry(f, f.requester_id === myId ? f.addressee_id : f.requester_id))
      .filter((e): e is FriendEntry => Boolean(e)),
    incoming: incoming
      .map((f) => toEntry(f, f.requester_id))
      .filter((e): e is FriendEntry => Boolean(e)),
    outgoing: outgoing
      .map((f) => toEntry(f, f.addressee_id))
      .filter((e): e is FriendEntry => Boolean(e))
  };
}
