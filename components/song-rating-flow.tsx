"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import type { PlaylistSong } from "@/lib/types";
import { formatRating } from "@/lib/utils";

type SongRatingFlowProps = {
  songs: PlaylistSong[];
  onSaveRating: (entryId: string, rating: number) => void;
  onClose: () => void;
};

function normalizeRating(value: string): number | null {
  if (!value.trim()) {
    return null;
  }

  const parsed = Number(value);

  if (Number.isNaN(parsed) || parsed < 0 || parsed > 10) {
    return null;
  }

  return Math.round(parsed * 10) / 10;
}

export function SongRatingFlow({
  songs,
  onSaveRating,
  onClose
}: SongRatingFlowProps) {
  const unratedSongs = songs.filter((song) => song.userRating === null);
  const currentSong = unratedSongs[0];
  const [draftRating, setDraftRating] = useState("");

  useEffect(() => {
    setDraftRating(currentSong?.userRating?.toFixed(1) ?? "");
  }, [currentSong?.entryId, currentSong?.userRating]);

  const parsedRating = normalizeRating(draftRating);

  if (!currentSong) {
    return (
      <div className="rounded-[28px] border border-glow/25 bg-glow/10 p-6 text-white">
        <p className="section-title text-[11px] text-glowSoft">Anadir puntuacion</p>
        <h3 className="mt-3 text-2xl font-semibold">Todas las canciones tienen nota</h3>
        <p className="mt-3 text-sm leading-6 text-white/72">
          Ya no quedan canciones pendientes. Puedes cambiar cualquier nota desde el listado.
        </p>
        <button
          type="button"
          onClick={onClose}
          className="mt-5 rounded-full border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-white transition hover:border-white/20 hover:bg-white/10"
        >
          Cerrar
        </button>
      </div>
    );
  }

  return (
    <div className="glass-panel overflow-hidden rounded-[30px]">
      <div className="grid gap-6 p-6 lg:grid-cols-[220px,1fr]">
        <div className="relative aspect-square overflow-hidden rounded-[24px] bg-white/5">
          {currentSong.coverUrl ? (
            <Image
              src={currentSong.coverUrl}
              alt={`${currentSong.title} cover`}
              fill
              sizes="220px"
              className="object-cover"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-white/40">
              Sin portada
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="section-title text-[11px] text-glowSoft">Anadir puntuacion</p>
              <h3 className="mt-2 text-3xl font-semibold text-white">{currentSong.title}</h3>
              <p className="mt-2 text-sm text-white/68">{currentSong.artists.join(", ")}</p>
            </div>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/62">
              Pendientes: {unratedSongs.length}
            </span>
          </div>

          <p className="text-sm leading-6 text-white/62">
            Introduce una nota de `0.0` a `10.0`. Al guardar, la app te llevara automaticamente a
            la siguiente cancion sin puntuar.
          </p>

          <label className="block max-w-xs">
            <span className="text-[11px] uppercase tracking-[0.2em] text-white/38">Nota</span>
            <input
              type="number"
              min="0"
              max="10"
              step="0.1"
              value={draftRating}
              onChange={(event) => setDraftRating(event.target.value)}
              placeholder="Ej. 8.7"
              className="mt-2 w-full rounded-[18px] border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition focus:border-glow/50 focus:ring-2 focus:ring-glow/20"
            />
          </label>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => {
                if (parsedRating !== null) {
                  onSaveRating(currentSong.entryId, parsedRating);
                }
              }}
              disabled={parsedRating === null}
              className="rounded-full bg-glow px-5 py-3 text-sm font-semibold text-ink transition hover:bg-glowSoft disabled:cursor-not-allowed disabled:opacity-45"
            >
              Guardar y siguiente
            </button>

            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-white transition hover:border-white/20 hover:bg-white/10"
            >
              Salir
            </button>
          </div>

          <div className="rounded-[20px] border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/68">
            Nota actual:{" "}
            <span className="font-semibold text-white">
              {formatRating(currentSong.userRating)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
