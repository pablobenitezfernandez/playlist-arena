"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import type { PlaylistSong } from "@/lib/types";
import {
  formatDate,
  formatDuration,
  formatRating,
  formatReleaseDateFull,
  parseRatingInput,
  sanitizeRatingInput
} from "@/lib/utils";

type SongLibraryItemProps = {
  song: PlaylistSong;
  expanded: boolean;
  onToggle: () => void;
  onSaveRating: (entryId: string, rating: number) => void;
  onClearRating: (entryId: string) => void;
  onDeleteArchived?: (entryId: string) => void;
};

export function SongLibraryItem({
  song,
  expanded,
  onToggle,
  onSaveRating,
  onClearRating,
  onDeleteArchived
}: SongLibraryItemProps) {
  const [draftRating, setDraftRating] = useState(
    song.userRating === null ? "" : song.userRating.toFixed(1)
  );

  useEffect(() => {
    setDraftRating(song.userRating === null ? "" : song.userRating.toFixed(1));
  }, [song.entryId, song.userRating]);

  const parsedRating = parseRatingInput(draftRating);
  const canSave = parsedRating !== null;
  const showRatingHint = draftRating.trim() !== "" && parsedRating === null;

  return (
    <article
      className={`glass-panel overflow-hidden rounded-[28px] ${
        song.userRating === null ? "bg-white/[0.035]" : ""
      }`}
    >
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-4 px-4 py-4 text-left transition hover:bg-white/5"
      >
        <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-[20px] bg-white/5">
          {song.coverUrl ? (
            <Image
              src={song.coverUrl}
              alt={`${song.title} cover`}
              fill
              sizes="80px"
              className="object-cover"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-xs text-white/40">
              Sin portada
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="truncate text-lg font-semibold text-white">{song.title}</h3>
                {!song.isInActivePlaylist ? (
                  <span className="rounded-full border border-amber-400/30 bg-amber-300/10 px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-amber-200">
                    Fuera de playlist
                  </span>
                ) : null}
              </div>
              <p className="mt-1 truncate text-sm text-white/68">{song.artists.join(", ")}</p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
              <span
                className={`rounded-full px-3 py-1 text-xs font-medium ${
                  song.userRating === null
                    ? "border border-white/10 bg-white/5 text-white/50"
                    : "border border-glow/35 bg-glow/10 text-glowSoft"
                }`}
              >
                {song.userRating === null
                  ? "Sin nota tuya"
                  : `Tu nota ${formatRating(song.userRating)}`}
              </span>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-white/60">
                {song.communityRating === null
                  ? "Media —"
                  : `Media ${formatRating(song.communityRating)} (${song.communityRatingCount})`}
              </span>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-sm text-white/48">
            <span>{song.album}</span>
            <span>{formatReleaseDateFull(song.releaseDate)}</span>
            <span>{formatDuration(song.durationMs)}</span>
            <span>{song.tournamentWins} victorias</span>
          </div>
        </div>

        <span className="shrink-0 text-xs uppercase tracking-[0.2em] text-white/42">
          {expanded ? "Cerrar" : "Abrir"}
        </span>
      </button>

      {expanded ? (
        <div className="border-t border-white/8 px-4 py-5">
          <div className="grid gap-4 text-sm text-white/72 sm:grid-cols-2 xl:grid-cols-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.2em] text-white/38">Album</p>
              <p className="mt-1">{song.album}</p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-[0.2em] text-white/38">Artistas</p>
              <p className="mt-1">{song.artists.join(", ")}</p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-[0.2em] text-white/38">Añadida</p>
              <p className="mt-1">{formatDate(song.addedAt)}</p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-[0.2em] text-white/38">Lanzamiento</p>
              <p className="mt-1">{formatReleaseDateFull(song.releaseDate)}</p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-[0.2em] text-white/38">Duracion</p>
              <p className="mt-1">{formatDuration(song.durationMs)}</p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-[0.2em] text-white/38">
                Media de todos
              </p>
              <p className="mt-1">
                {song.communityRating === null
                  ? "Sin notas todavia"
                  : `${formatRating(song.communityRating)} (${song.communityRatingCount} ${
                      song.communityRatingCount === 1 ? "voto" : "votos"
                    })`}
              </p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-[0.2em] text-white/38">
                Victorias (todos)
              </p>
              <p className="mt-1">{song.tournamentWins}</p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-[0.2em] text-white/38">Estado</p>
              <p className="mt-1">
                {song.isInActivePlaylist ? "Sigue en la playlist" : "Ya no esta en la playlist"}
              </p>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-end gap-3">
            <label className="min-w-[190px] flex-1">
              <span className="text-[11px] uppercase tracking-[0.2em] text-white/38">
                Puntuacion personal
              </span>
              <input
                type="text"
                inputMode="decimal"
                value={draftRating}
                onChange={(event) => setDraftRating(sanitizeRatingInput(event.target.value))}
                placeholder="0 a 10 (un decimal)"
                className="mt-2 w-full rounded-[18px] border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition focus:border-glow/50 focus:ring-2 focus:ring-glow/20"
              />
              {showRatingHint ? (
                <span className="mt-1 block text-[11px] text-rose">
                  Nota no valida: usa 0-10 con un solo decimal.
                </span>
              ) : null}
            </label>

            <button
              type="button"
              onClick={() => {
                if (parsedRating !== null) {
                  onSaveRating(song.entryId, parsedRating);
                }
              }}
              disabled={!canSave}
              className="rounded-full bg-glow px-5 py-3 text-sm font-semibold text-ink transition hover:bg-glowSoft disabled:cursor-not-allowed disabled:opacity-45"
            >
              Guardar nota
            </button>

            <button
              type="button"
              onClick={() => onClearRating(song.entryId)}
              className="rounded-full border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-white transition hover:border-white/20 hover:bg-white/10"
            >
              Quitar nota
            </button>

            {song.spotifyUrl ? (
              <a
                href={song.spotifyUrl}
                target="_blank"
                rel="noreferrer"
                className="rounded-full border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-white transition hover:border-white/20 hover:bg-white/10"
              >
                Abrir en Spotify
              </a>
            ) : null}

            {!song.isInActivePlaylist && onDeleteArchived ? (
              <button
                type="button"
                onClick={() => onDeleteArchived(song.entryId)}
                className="rounded-full border border-rose/30 bg-rose/10 px-5 py-3 text-sm font-semibold text-rose transition hover:bg-rose/15"
              >
                Eliminar de la app
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </article>
  );
}
