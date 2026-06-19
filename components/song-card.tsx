"use client";

import Image from "next/image";
import type { PlaylistSong } from "@/lib/types";
import { formatDate, formatReleaseDateFull } from "@/lib/utils";

type SongCardProps = {
  song: PlaylistSong;
  onSelect: () => void;
  accentLabel?: string;
};

export function SongCard({ song, onSelect, accentLabel }: SongCardProps) {
  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        onClick={onSelect}
        className="group glass-panel relative overflow-hidden rounded-[30px] p-4 text-left transition duration-300 hover:-translate-y-1 hover:border-white/20 hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-glow/60"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-transparent opacity-70" />
        <div className="relative flex h-full flex-col gap-4">
          <div className="flex items-center justify-between">
            <span className="rounded-full border border-glow/40 bg-glow/10 px-3 py-1 text-[11px] uppercase tracking-[0.24em] text-glowSoft">
              {accentLabel ?? "Elegir ganadora"}
            </span>
            <span className="text-xs uppercase tracking-[0.2em] text-white/45">
              {formatReleaseDateFull(song.releaseDate)}
            </span>
          </div>
          <div className="relative aspect-square overflow-hidden rounded-[24px]">
            {song.coverUrl ? (
              <Image
                src={song.coverUrl}
                alt={`${song.title} cover`}
                fill
                sizes="(max-width: 768px) 100vw, 33vw"
                className="object-cover transition duration-500 group-hover:scale-105"
              />
            ) : (
              <div className="flex h-full items-center justify-center bg-white/5 text-sm text-white/40">
                Sin portada
              </div>
            )}
            <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-black/60 to-transparent" />
          </div>
          <div className="space-y-2">
            <h3 className="font-display text-xl font-semibold tracking-wide text-white">
              {song.title}
            </h3>
            <p className="text-sm text-white/70">{song.artists.join(", ")}</p>
          </div>
          <dl className="grid gap-3 text-sm text-white/65 sm:grid-cols-2">
            <div>
              <dt className="text-[11px] uppercase tracking-[0.2em] text-white/35">Album</dt>
              <dd className="mt-1">{song.album}</dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-[0.2em] text-white/35">Anadida</dt>
              <dd className="mt-1">{formatDate(song.addedAt)}</dd>
            </div>
          </dl>
        </div>
      </button>

      {song.spotifyUrl ? (
        <a
          href={song.spotifyUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center justify-center gap-2 rounded-full border border-glow/30 bg-glow/10 px-4 py-2.5 text-sm font-semibold text-glowSoft transition hover:border-glow/50 hover:bg-glow/15"
        >
          <span aria-hidden="true">▶</span> Abrir en Spotify
        </a>
      ) : null}
    </div>
  );
}
