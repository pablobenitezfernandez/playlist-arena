"use client";

import { useEffect, useRef } from "react";

type SpotifyEmbedProps = {
  // ID de la pista de Spotify (PlaylistSong.id).
  trackId: string;
  // compact = reproductor pequeño (80px); si no, el estándar (152px).
  compact?: boolean;
};

// ── Tipos mínimos de la IFrame API oficial de Spotify ───────────────────────
type SpotifyController = {
  play: () => void;
  pause: () => void;
  destroy: () => void;
  addListener: (
    event: "playback_update" | "ready" | "autoplay_failed",
    cb: (e: { data?: { isPaused?: boolean } }) => void
  ) => void;
};

type SpotifyIFrameApi = {
  createController: (
    element: HTMLElement,
    options: { uri: string; width?: string | number; height?: string | number },
    callback: (controller: SpotifyController) => void
  ) => void;
};

declare global {
  interface Window {
    onSpotifyIframeApiReady?: (api: SpotifyIFrameApi) => void;
    __spotifyIframeApi?: SpotifyIFrameApi;
  }
}

// ── Carga única del script de la IFrame API ─────────────────────────────────
let apiPromise: Promise<SpotifyIFrameApi> | null = null;

function loadIframeApi(): Promise<SpotifyIFrameApi> {
  if (apiPromise) {
    return apiPromise;
  }

  apiPromise = new Promise<SpotifyIFrameApi>((resolve) => {
    if (typeof window === "undefined") {
      return;
    }
    if (window.__spotifyIframeApi) {
      resolve(window.__spotifyIframeApi);
      return;
    }

    window.onSpotifyIframeApiReady = (api) => {
      window.__spotifyIframeApi = api;
      resolve(api);
    };

    const script = document.createElement("script");
    script.src = "https://open.spotify.com/embed/iframe-api/v1";
    script.async = true;
    document.body.appendChild(script);
  });

  return apiPromise;
}

// ── Coordinador: al darle play a uno, se pausan los demás ────────────────────
// Module-level: todos los reproductores de la página comparten este registro,
// así en el torneo (2 o 4 canciones) suena solo uno a la vez. En móvil esto
// evita que se solapen las previews de 30s.
const controllers = new Set<SpotifyController>();
let activeController: SpotifyController | null = null;

function registerController(controller: SpotifyController) {
  controllers.add(controller);
}

function unregisterController(controller: SpotifyController) {
  controllers.delete(controller);
  if (activeController === controller) {
    activeController = null;
  }
}

function pauseOthers(current: SpotifyController) {
  if (activeController === current) {
    return; // ya es el activo: no hagas nada (evita ping-pong)
  }
  activeController = current;
  controllers.forEach((controller) => {
    if (controller !== current) {
      try {
        controller.pause();
      } catch {
        // si un reproductor ya no existe, lo ignoramos
      }
    }
  });
}

/**
 * Reproductor oficial incrustado de Spotify (vía IFrame API). Sin login
 * reproduce una preview de 30 segundos (legal, no necesita la API de datos).
 * Si la persona tiene sesión de Spotify Premium en el navegador, suena entera.
 *
 * Coordinado: al empezar a sonar uno, se pausan los demás reproductores de la
 * página (clave en móvil, donde las previews se solapaban).
 */
export function SpotifyEmbed({ trackId, compact }: SpotifyEmbedProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!trackId || !wrapper) {
      return;
    }

    let cancelled = false;
    let controller: SpotifyController | null = null;

    // La IFrame API reemplaza el elemento que le pasamos por un <iframe>. Le
    // damos un hijo propio (no el que controla React) para evitar conflictos
    // de "removeChild" al desmontar.
    const target = document.createElement("div");
    wrapper.appendChild(target);

    loadIframeApi().then((api) => {
      if (cancelled) {
        return;
      }
      api.createController(
        target,
        {
          uri: `spotify:track:${trackId}`,
          width: "100%",
          height: compact ? 80 : 152
        },
        (createdController) => {
          if (cancelled) {
            try {
              createdController.destroy();
            } catch {
              // nada
            }
            return;
          }
          controller = createdController;
          registerController(createdController);
          createdController.addListener("playback_update", (event) => {
            if (event?.data?.isPaused === false) {
              pauseOthers(createdController);
            }
          });
        }
      );
    });

    return () => {
      cancelled = true;
      if (controller) {
        unregisterController(controller);
        try {
          controller.destroy();
        } catch {
          // nada
        }
      }
      // Limpia cualquier iframe que haya quedado dentro del wrapper.
      if (wrapper) {
        wrapper.innerHTML = "";
      }
    };
  }, [trackId, compact]);

  if (!trackId) {
    return (
      <p className="text-xs text-white/40">Preview no disponible para esta canción.</p>
    );
  }

  return <div ref={wrapperRef} style={{ borderRadius: 12, overflow: "hidden" }} />;
}
