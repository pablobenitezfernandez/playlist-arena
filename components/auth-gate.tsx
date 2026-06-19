"use client";

import { useState, type FormEvent } from "react";
import { useAuth } from "@/lib/auth-context";

type Mode = "signin" | "signup" | "forgot";

export function AuthGate({ children }: { children: React.ReactNode }) {
  const { loading, session } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <span className="text-white/40">Cargando…</span>
      </div>
    );
  }

  if (!session) {
    return <AuthScreen />;
  }

  return (
    <>
      <AccountBar />
      {children}
    </>
  );
}

function AccountBar() {
  const { profile, user, isOwner, signOut } = useAuth();
  const name = profile?.display_name ?? user?.email ?? "Tu cuenta";

  return (
    <div className="sticky top-0 z-50 flex items-center justify-end gap-3 border-b border-white/8 bg-ink/70 px-4 py-2 backdrop-blur">
      <span className="text-xs text-white/55">
        {name}
        {isOwner ? <span className="ml-1 text-glowSoft">· dueño</span> : null}
      </span>
      <button
        type="button"
        onClick={() => void signOut()}
        className="rounded-full border border-white/12 px-3 py-1 text-xs text-white/70 transition hover:border-white/25 hover:text-white"
      >
        Salir
      </button>
    </div>
  );
}

function AuthScreen() {
  const { signIn, signUp, resetPassword } = useAuth();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setInfo(null);
    setBusy(true);

    try {
      if (mode === "signin") {
        await signIn(email.trim(), password);
      } else if (mode === "forgot") {
        await resetPassword(email.trim());
        setInfo(
          "Si existe una cuenta con ese email, te hemos enviado un enlace para poner una contraseña nueva. Revisa tu correo (y la carpeta de spam)."
        );
        setMode("signin");
      } else {
        if (displayName.trim().length < 2) {
          throw new Error("Pon un nombre de al menos 2 caracteres.");
        }
        await signUp(email.trim(), password, displayName.trim());
        setInfo(
          "Cuenta creada. Revisa tu correo y confirma tu email antes de iniciar sesión."
        );
        setMode("signin");
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Algo ha fallado.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="glass-panel w-full max-w-sm rounded-[28px] p-7">
        <p className="section-title text-xs text-glowSoft">Playlist Arena</p>
        <h1 className="mt-2 font-display text-3xl font-semibold text-white">
          {mode === "signin"
            ? "Iniciar sesión"
            : mode === "forgot"
            ? "Recuperar contraseña"
            : "Crear cuenta"}
        </h1>
        <p className="mt-2 text-sm text-white/55">
          {mode === "signin"
            ? "Entra con tu email y contraseña para puntuar y ver el ranking de todos."
            : mode === "forgot"
            ? "Pon tu email y te enviaremos un enlace para crear una contraseña nueva."
            : "Regístrate para empezar a puntuar canciones."}
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-3">
          {mode === "signup" ? (
            <input
              type="text"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              placeholder="Tu nombre"
              autoComplete="nickname"
              className="w-full rounded-2xl border border-white/12 bg-white/5 px-4 py-3 text-sm text-white outline-none placeholder:text-white/35 focus:border-glow/50"
            />
          ) : null}

          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="email@ejemplo.com"
            autoComplete="email"
            required
            className="w-full rounded-2xl border border-white/12 bg-white/5 px-4 py-3 text-sm text-white outline-none placeholder:text-white/35 focus:border-glow/50"
          />

          {mode !== "forgot" ? (
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Contraseña"
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              required
              minLength={6}
              className="w-full rounded-2xl border border-white/12 bg-white/5 px-4 py-3 text-sm text-white outline-none placeholder:text-white/35 focus:border-glow/50"
            />
          ) : null}

          {error ? (
            <p className="rounded-xl border border-rose/40 bg-rose/10 px-3 py-2 text-xs text-rose">
              {error}
            </p>
          ) : null}

          {info ? (
            <p className="rounded-xl border border-glow/30 bg-glow/10 px-3 py-2 text-xs text-glowSoft">
              {info}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-2xl bg-glow/90 px-4 py-3 text-sm font-semibold text-[#06210f] transition hover:bg-glow disabled:opacity-50"
          >
            {busy
              ? "Un momento…"
              : mode === "signin"
              ? "Entrar"
              : mode === "forgot"
              ? "Enviar enlace"
              : "Crear cuenta"}
          </button>
        </form>

        {mode === "signin" ? (
          <button
            type="button"
            onClick={() => {
              setMode("forgot");
              setError(null);
              setInfo(null);
            }}
            className="mt-3 w-full text-center text-xs text-white/45 underline transition hover:text-white/75"
          >
            ¿Olvidaste tu contraseña?
          </button>
        ) : null}

        <button
          type="button"
          onClick={() => {
            setMode(mode === "signin" ? "signup" : "signin");
            setError(null);
            setInfo(null);
          }}
          className="mt-4 w-full text-center text-xs text-white/50 underline transition hover:text-white/80"
        >
          {mode === "signin"
            ? "¿No tienes cuenta? Crea una"
            : mode === "forgot"
            ? "← Volver a iniciar sesión"
            : "¿Ya tienes cuenta? Inicia sesión"}
        </button>
      </div>
    </div>
  );
}
