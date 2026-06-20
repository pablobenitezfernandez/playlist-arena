"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useAuth } from "@/lib/auth-context";
import {
  acceptFriendRequest,
  fetchFriends,
  findUserByUsername,
  removeFriendship,
  sendFriendRequest,
  type FriendsData
} from "@/lib/friends";

const EMPTY: FriendsData = { friends: [], incoming: [], outgoing: [] };

export function FriendsSection() {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const [data, setData] = useState<FriendsData>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [addValue, setAddValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  const reload = useCallback(async () => {
    if (!userId) {
      return;
    }
    try {
      setData(await fetchFriends(userId));
    } catch {
      // silencioso: una recarga fallida no rompe la vista
    } finally {
      setLoading(false);
    }
  }, [userId]);

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
          Añade a gente por su @usuario. Cuando os acepteis, pronto podras ver sus tops y sus
          torneos. (De momento, gestion de amistades.)
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
                {data.friends.map((friend) => (
                  <div
                    key={friend.id}
                    className="flex items-center justify-between gap-3 rounded-[20px] border border-white/10 bg-white/5 px-4 py-3 text-sm"
                  >
                    {nameOf(friend)}
                    <span className="text-xs text-white/40">amigo</span>
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
