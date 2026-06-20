"use client";

import { useState, type FormEvent } from "react";
import { useAuth } from "@/lib/auth-context";

export function UsernameSetup() {
  const { setUsername, profile } = useAuth();
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);

    try {
      await setUsername(value);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo guardar el usuario.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="glass-panel w-full max-w-sm rounded-[28px] p-7">
        <p className="section-title text-xs text-glowSoft">Playlist Arena</p>
        <h1 className="mt-2 font-display text-3xl font-semibold text-white">Elige tu @usuario</h1>
        <p className="mt-2 text-sm text-white/55">
          {profile?.display_name ? `Hola, ${profile.display_name}. ` : ""}
          Necesitas un @usuario único para que tus amigos puedan encontrarte. Se elige una sola vez.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-3">
          <div className="flex items-center gap-2 rounded-2xl border border-white/12 bg-white/5 px-4 py-3 transition focus-within:border-glow/50">
            <span className="text-white/45">@</span>
            <input
              type="text"
              value={value}
              onChange={(event) => setValue(event.target.value)}
              placeholder="tu_usuario"
              autoComplete="off"
              autoFocus
              className="w-full bg-transparent text-sm text-white outline-none placeholder:text-white/35"
            />
          </div>
          <p className="text-[11px] text-white/40">
            3-20 caracteres: minúsculas, números, punto o guión bajo.
          </p>

          {error ? (
            <p className="rounded-xl border border-rose/40 bg-rose/10 px-3 py-2 text-xs text-rose">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-2xl bg-glow/90 px-4 py-3 text-sm font-semibold text-[#06210f] transition hover:bg-glow disabled:opacity-50"
          >
            {busy ? "Guardando…" : "Continuar"}
          </button>
        </form>
      </div>
    </div>
  );
}
