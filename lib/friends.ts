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
  title: string;
  artists: string[];
  wins: number;
};

export type FriendTournament = {
  id: string;
  mode: string;
  size: number;
  completedAt: string;
  podium: FriendTournamentPodiumSong[]; // top 3, en orden
};

/**
 * Lee los torneos completados de un amigo en los últimos `days` días
 * (resultado final: campeón + top 3). La RLS solo deja leer esto si sois
 * amigos aceptados.
 */
export async function fetchFriendTournaments(
  friendId: string,
  days = 7
): Promise<FriendTournament[]> {
  const supabase = getSupabaseClient();
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from("tournament_results")
    .select("id, mode, size, completed_at, top_songs")
    .eq("user_id", friendId)
    .gte("completed_at", since)
    .order("completed_at", { ascending: false });

  if (error) {
    throw new Error(`No se pudieron leer los torneos de tu amigo: ${error.message}`);
  }

  return ((data ?? []) as Array<{
    id: string;
    mode: string;
    size: number;
    completed_at: string;
    top_songs: FriendTournamentPodiumSong[] | null;
  }>).map((row) => ({
    id: row.id,
    mode: row.mode,
    size: row.size,
    completedAt: row.completed_at,
    podium: Array.isArray(row.top_songs) ? row.top_songs : []
  }));
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
