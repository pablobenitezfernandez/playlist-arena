"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { SESSION_STORAGE_KEYS } from "@/lib/constants";
import { exchangeCodeForSpotifyToken, SpotifyApiError } from "@/lib/spotify";
import { authStorage, pkceStorage } from "@/lib/storage";

type CallbackStatus = { message: string };

export function SpotifyCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status] = useState<CallbackStatus>({
    message: "Terminando la conexión con Spotify..."
  });

  useEffect(() => {
    let cancelled = false;

    function redirectWithError(message: string) {
      if (typeof window !== "undefined") {
        window.sessionStorage.setItem(SESSION_STORAGE_KEYS.spotifyPopupError, message);
      }

      router.replace("/");
    }

    async function finishAuth() {
      const error = searchParams.get("error");
      const code = searchParams.get("code");
      const state = searchParams.get("state");
      const pkce = pkceStorage.read();

      if (error) {
        pkceStorage.clear();
        redirectWithError(`Spotify devolvió este error durante el login: ${error}.`);
        return;
      }

      if (!code || !state || !pkce || pkce.state !== state) {
        pkceStorage.clear();
        redirectWithError(
          "El callback de Spotify no coincide con la sesión PKCE guardada. Vuelve a intentarlo."
        );
        return;
      }

      try {
        const session = await exchangeCodeForSpotifyToken(code, pkce.verifier);

        if (cancelled) {
          return;
        }

        authStorage.write(session);
        pkceStorage.clear();
        router.replace("/");
      } catch (errorValue) {
        if (cancelled) {
          return;
        }

        pkceStorage.clear();
        redirectWithError(
          errorValue instanceof SpotifyApiError
            ? errorValue.message
            : "No se pudo completar el login con Spotify. Vuelve a intentarlo."
        );
      }
    }

    void finishAuth();

    return () => {
      cancelled = true;
    };
  }, [router, searchParams]);

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-12">
      <div className="glass-panel max-w-xl rounded-[32px] p-8 text-center">
        <p className="section-title text-xs text-glowSoft">Spotify</p>
        <h1 className="mt-3 text-3xl font-semibold text-white">Playlist Arena</h1>
        <p className="mt-5 text-white/75">{status.message}</p>
      </div>
    </main>
  );
}
