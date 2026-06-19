"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";

export function ResetPassword() {
  const { loading, session, updatePassword } = useAuth();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    if (password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres.");
      return;
    }

    if (password !== confirm) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    setBusy(true);

    try {
      await updatePassword(password);
      setDone(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo cambiar la contraseña.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="glass-panel w-full max-w-sm rounded-[28px] p-7">
        <p className="section-title text-xs text-glowSoft">Playlist Arena</p>
        <h1 className="mt-2 font-display text-3xl font-semibold text-white">Nueva contraseña</h1>

        {loading ? (
          <p className="mt-4 text-sm text-white/55">Comprobando el enlace…</p>
        ) : done ? (
          <div className="mt-4 space-y-4">
            <p className="rounded-xl border border-glow/30 bg-glow/10 px-3 py-2 text-sm text-glowSoft">
              Contraseña actualizada. Ya puedes entrar con la nueva.
            </p>
            <Link
              href="/"
              className="block w-full rounded-2xl bg-glow/90 px-4 py-3 text-center text-sm font-semibold text-[#06210f] transition hover:bg-glow"
            >
              Ir a la app
            </Link>
          </div>
        ) : !session ? (
          <div className="mt-4 space-y-4">
            <p className="rounded-xl border border-rose/40 bg-rose/10 px-3 py-2 text-sm text-rose">
              El enlace no es válido o ha caducado. Pide uno nuevo desde la opción «¿Olvidaste tu
              contraseña?».
            </p>
            <Link
              href="/"
              className="block w-full rounded-2xl border border-white/12 bg-white/5 px-4 py-3 text-center text-sm font-semibold text-white transition hover:bg-white/10"
            >
              Volver al inicio
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-6 space-y-3">
            <p className="text-sm text-white/55">Escribe tu nueva contraseña dos veces.</p>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Nueva contraseña"
              autoComplete="new-password"
              required
              minLength={6}
              className="w-full rounded-2xl border border-white/12 bg-white/5 px-4 py-3 text-sm text-white outline-none placeholder:text-white/35 focus:border-glow/50"
            />
            <input
              type="password"
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
              placeholder="Repite la contraseña"
              autoComplete="new-password"
              required
              minLength={6}
              className="w-full rounded-2xl border border-white/12 bg-white/5 px-4 py-3 text-sm text-white outline-none placeholder:text-white/35 focus:border-glow/50"
            />

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
              {busy ? "Guardando…" : "Guardar contraseña"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
