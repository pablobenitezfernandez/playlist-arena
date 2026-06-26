"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { useAuth } from "@/lib/auth-context";
import {
  acceptFriendRequest,
  fetchFriendRatings,
  fetchFriendTournaments,
  fetchFriends,
  findUserByUsername,
  removeFriendship,
  sendFriendRequest,
  type FriendsData,
  type FriendTournament
} from "@/lib/friends";
import type { PlaylistSong } from "@/lib/types";

const EMPTY: FriendsData = { friends: [], incoming: [], outgoing: [] };

type TopItem = { entryId: string; title: string; artists: string[]; rating: number };

function formatTournamentDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("es-ES", {
      day: "numeric",
      month: "short"
    });
  } catch {
    return "";
  }
}

export function FriendsSection({
  songs = [],
  onIncomingCountChange
}: {
  songs?: PlaylistSong[];
  onIncomingCountChange?: (count: number) => void;
}) {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const [data, setData] = useState<FriendsData>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [addValue, setAddValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);
  const [openTopId, setOpenTopId] = useState<string | null>(null);
  const [topItems, setTopItems] = useState<TopItem[] | null>(null);
  const [friendTournaments, setFriendTournaments] = useState<FriendTournament[] | null>(null);
  const [topLoading, setTopLoading] = useState(false);

  const songById = useMemo(() => {
    const map = new Map<string, PlaylistSong>();
    for (const song of songs) {
      map.set(song.entryId, song);
    }
    return map;
  }, [songs]);

  const toggleTop = useCallback(
    async (friendshipId: string, friendId: string) => {
      if (openTopId === friendshipId) {
        setOpenTopId(null);
        setTopItems(null);
        setFriendTournaments(null);
        return;
      }
      setOpenTopId(friendshipId);
      setTopItems(null);
      setFriendTournaments(null);
      setTopLoading(true);
      try {
        const ratings = await fetchFriendRatings(friendId);
        const items: TopItem[] = [...ratings.entries()]
          .map(([entryId, rating]) => {
            const song = songById.get(entryId);
            return song
              ? { entryId, title: song.title, artists: song.artists, rating }
              : null;
          })
          .filter((item): item is TopItem => item !== null)
          .sort((a, b) => b.rating - a.rating || a.title.localeCompare(b.title))
          .slice(0, 10);
        setTopItems(items);
      } catch {
        setTopItems([]);
      } finally {
        setTopLoading(false);
      }

      // Los torneos son independientes: si fallan (p. ej. la tabla aún no
      // existe), el top 10 se sigue viendo igual.
      try {
        setFriendTournaments(await fetchFriendTournaments(friendId, 7));
      } catch {
        setFriendTournaments([]);
      }
    },
    [openTopId, songById]
  );

  const reload = useCallback(async () => {
    if (!userId) {
      return;
    }
    try {
      const next = await fetchFriends(userId);
      setData(next);
      // Mantiene el puntito del menú en sync al instante (aceptar/rechazar).
      onIncomingCountChange?.(next.incoming.length);
    } catch {
      // silencioso: una recarga fallida no rompe la vista
    } finally {
      setLoading(false);
    }
  }, [userId, onIncomingCountChange]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function handleAdd(event: FormEvent) {
    event.preventDefault();
    if (!userId) {
      return;
    }
    setNotice(null);
    setBusy(true);

    try {
      const target = await findUserByUsername(addValue);
      if (!target) {
        throw new Error("No existe nadie con ese @usuario.");
      }
      if (target.id === userId) {
        throw new Error("No puedes añadirte a ti mismo.");
      }
      await sendFriendRequest(userId, target.id);
      setNotice({ tone: "ok", text: `Solicitud enviada a @${target.username}.` });
      setAddValue("");
      await reload();
    } catch (caught) {
      setNotice({ tone: "error", text: caught instanceof Error ? caught.message : "No se pudo enviar." });
    } finally {
      setBusy(false);
    }
  }

  async function runAction(action: () => Promise<void>) {
    setBusy(true);
    setNotice(null);
    try {
      await action();
      await reload();
    } catch (caught) {
      setNotice({ tone: "error", text: caught instanceof Error ? caught.message : "No se pudo completar." });
    } finally {
      setBusy(false);
    }
  }

  function nameOf(p: { display_name: string; username: string | null }) {
    return (
      <span>
        <span className="font-semibold text-white">{p.display_name}</span>
        {p.username ? <span className="ml-1 text-white/45">@{p.username}</span> : null}
      </span>
    );
  }

  return (
    <section className="space-y-6">
      <div className="glass-panel rounded-[32px] p-6 sm:p-8">
        <p className="section-title text-[11px] text-glowSoft">Amigos</p>
        <h2 className="mt-3 text-3xl font-semibold text-white">Tus amigos</h2>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-white/65">
          Añade a gente por su @usuario. Cuando os aceptéis, podrás ver sus tops y sus
          torneos en su perfil.
        </p>

        <form onSubmit={handleAdd} className="mt-6 flex flex-wrap items-end gap-3">
          <label className="min-w-[220px] flex-1">
            <span className="section-title text-[11px] text-white/45">Añadir por @usuario</span>
            <div className="mt-2 flex items-center gap-2 rounded-[20px] border border-white/10 bg-black/20 px-4 py-3 transition focus-within:border-glow/50">
              <span className="text-white/45">@</span>
              <input
                type="text"
                value={addValue}
                onChange={(event) => setAddValue(event.target.value)}
                placeholder="usuario_de_tu_amigo"
                autoComplete="off"
                className="w-full bg-transparent text-sm text-white outline-none placeholder:text-white/35"
              />
            </div>
          </label>
          <button
            type="submit"
            disabled={busy || !addValue.trim()}
            className="rounded-full bg-glow px-5 py-3 text-sm font-semibold text-ink transition hover:bg-glowSoft disabled:cursor-not-allowed disabled:opacity-50"
          >
            Enviar solicitud
          </button>
        </form>

        {notice ? (
          <p
            className={`mt-3 rounded-xl border px-3 py-2 text-xs ${
              notice.tone === "ok"
                ? "border-glow/30 bg-glow/10 text-glowSoft"
                : "border-rose/40 bg-rose/10 text-rose"
            }`}
          >
            {notice.text}
          </p>
        ) : null}
      </div>

      {loading ? (
        <div className="rounded-[28px] border border-dashed border-white/12 bg-white/5 p-8 text-center text-sm text-white/55">
          Cargando amigos…
        </div>
      ) : (
        <>
          {data.incoming.length > 0 ? (
            <div className="glass-panel rounded-[28px] p-6">
              <p className="section-title text-[11px] text-glowSoft">Solicitudes recibidas</p>
              <div className="mt-4 space-y-3">
                {data.incoming.map((req) => (
                  <div
                    key={req.friendshipId}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-[20px] border border-white/10 bg-white/5 px-4 py-3 text-sm"
                  >
                    {nameOf(req.profile)}
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => runAction(() => acceptFriendRequest(req.friendshipId))}
                        className="rounded-full bg-glow px-4 py-2 text-xs font-semibold text-ink transition hover:bg-glowSoft disabled:opacity-50"
                      >
                        Aceptar
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => runAction(() => removeFriendship(req.friendshipId))}
                        className="rounded-full border border-white/12 px-4 py-2 text-xs font-semibold text-white/70 transition hover:border-white/25 hover:text-white disabled:opacity-50"
                      >
                        Rechazar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <div className="glass-panel rounded-[28px] p-6">
            <p className="section-title text-[11px] text-glowSoft">
              Amigos ({data.friends.length})
            </p>
            {data.friends.length === 0 ? (
              <p className="mt-4 text-sm text-white/55">
                Aún no tienes amigos aceptados. Añade a alguien por su @usuario.
              </p>
            ) : (
              <div className="mt-4 space-y-3">
                {data.friends.map((entry) => (
                  <div
                    key={entry.friendshipId}
                    className="rounded-[20px] border border-white/10 bg-white/5 px-4 py-3 text-sm"
                  >
                    {confirmRemoveId === entry.friendshipId ? (
                      <div className="space-y-3">
                        <p className="text-white/80">
                          ¿Seguro que quieres eliminar a{" "}
                          <span className="font-semibold text-white">
                            {entry.profile.username ? `@${entry.profile.username}` : entry.profile.display_name}
                          </span>
                          ? Tendrás que volver a mandar solicitud para volver a ver sus datos.
                        </p>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => {
                              setConfirmRemoveId(null);
                              void runAction(() => removeFriendship(entry.friendshipId));
                            }}
                            className="rounded-full bg-rose/80 px-4 py-2 text-xs font-semibold text-white transition hover:bg-rose disabled:opacity-50"
                          >
                            Sí, eliminar
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmRemoveId(null)}
                            className="rounded-full border border-white/12 px-4 py-2 text-xs font-semibold text-white/70 transition hover:border-white/25 hover:text-white"
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          {nameOf(entry.profile)}
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => toggleTop(entry.friendshipId, entry.profile.id)}
                              className={`rounded-full border px-4 py-2 text-xs font-semibold transition ${
                                openTopId === entry.friendshipId
                                  ? "border-glow/50 bg-glow/10 text-glowSoft"
                                  : "border-white/12 text-white/70 hover:border-white/25 hover:text-white"
                              }`}
                            >
                              {openTopId === entry.friendshipId ? "Ocultar perfil" : "Ver perfil"}
                            </button>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => setConfirmRemoveId(entry.friendshipId)}
                              className="rounded-full border border-rose/30 px-4 py-2 text-xs font-semibold text-rose transition hover:border-rose/50 hover:bg-rose/10 disabled:opacity-50"
                            >
                              Eliminar
                            </button>
                          </div>
                        </div>

                        {openTopId === entry.friendshipId ? (
                          <div className="space-y-3 rounded-[16px] border border-white/10 bg-black/20 p-4">
                            <div>
                              <p className="section-title text-[11px] text-glowSoft">
                                Top 10 de {entry.profile.username ? `@${entry.profile.username}` : entry.profile.display_name}
                              </p>
                              {topLoading ? (
                                <p className="mt-3 text-sm text-white/55">Cargando…</p>
                              ) : !topItems || topItems.length === 0 ? (
                                <p className="mt-3 text-sm text-white/55">
                                  Este amigo todavía no ha puntuado canciones.
                                </p>
                              ) : (
                                <ol className="mt-3 space-y-1.5">
                                  {topItems.map((item, index) => (
                                    <li
                                      key={item.entryId}
                                      className="flex items-center gap-3 text-sm"
                                    >
                                      <span className="w-5 shrink-0 text-right text-white/40">
                                        {index + 1}
                                      </span>
                                      <span className="min-w-0 flex-1 truncate text-white/85">
                                        {item.title}
                                        {item.artists.length > 0 ? (
                                          <span className="text-white/45"> · {item.artists.join(", ")}</span>
                                        ) : null}
                                      </span>
                                      <span className="shrink-0 font-semibold text-glowSoft">
                                        {item.rating.toFixed(1)}
                                      </span>
                                    </li>
                                  ))}
                                </ol>
                              )}
                            </div>

                            {!topLoading ? (
                              <div className="border-t border-white/10 pt-3">
                                <p className="section-title text-[11px] text-glowSoft">
                                  Torneos de esta semana
                                </p>
                                {!friendTournaments || friendTournaments.length === 0 ? (
                                  <p className="mt-3 text-sm text-white/55">
                                    No ha completado torneos esta semana.
                                  </p>
                                ) : (
                                  <div className="mt-3 space-y-3">
                                    {friendTournaments.map((tournament) => (
                                      <div
                                        key={tournament.id}
                                        className="rounded-[14px] border border-white/10 bg-white/[0.03] p-3"
                                      >
                                        <div className="flex items-center justify-between gap-2 text-xs text-white/45">
                                          <span className="uppercase tracking-[0.08em]">Torneo</span>
                                          <span>{formatTournamentDate(tournament.completedAt)}</span>
                                        </div>
                                        {tournament.podium.length > 0 ? (
                                          <ol className="mt-2 space-y-1">
                                            {tournament.podium.map((pod, index) => {
                                              const song = songById.get(pod.entryId);
                                              return (
                                                <li
                                                  key={pod.entryId}
                                                  className="flex items-center gap-2 text-sm"
                                                >
                                                  <span className="shrink-0">
                                                    {["🥇", "🥈", "🥉"][index] ?? `${index + 1}.`}
                                                  </span>
                                                  <span className="min-w-0 flex-1 truncate text-white/85">
                                                    {song ? song.title : "Canción"}
                                                    {song && song.artists.length > 0 ? (
                                                      <span className="text-white/45"> · {song.artists.join(", ")}</span>
                                                    ) : null}
                                                  </span>
                                                </li>
                                              );
                                            })}
                                          </ol>
                                        ) : null}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {data.outgoing.length > 0 ? (
            <div className="glass-panel rounded-[28px] p-6">
              <p className="section-title text-[11px] text-white/40">Solicitudes enviadas</p>
              <div className="mt-4 space-y-3">
                {data.outgoing.map((req) => (
                  <div
                    key={req.friendshipId}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-[20px] border border-white/10 bg-white/5 px-4 py-3 text-sm"
                  >
                    {nameOf(req.profile)}
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-white/40">pendiente</span>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => runAction(() => removeFriendship(req.friendshipId))}
                        className="rounded-full border border-white/12 px-4 py-2 text-xs font-semibold text-white/70 transition hover:border-white/25 hover:text-white disabled:opacity-50"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}
