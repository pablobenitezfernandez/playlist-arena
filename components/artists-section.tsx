"use client";

import { useMemo, useState } from "react";
import { SongLibraryItem } from "@/components/song-library-item";
import { formatRating } from "@/lib/utils";
import type { PlaylistSong } from "@/lib/types";

type ArtistsSectionProps = {
  songs: PlaylistSong[];
  isOwner: boolean;
  onSaveRating: (entryId: string, rating: number) => void;
  onClearRating: (entryId: string) => void;
  onDeleteArchived: (entryId: string) => void;
};

type ArtistSummary = {
  name: string;
  songs: PlaylistSong[];
  personalAvg: number | null;
  personalCount: number;
  communityAvg: number | null;
  communityCount: number;
};

type ArtistSort = "personal" | "community" | "alpha" | "songs";

function average(values: number[]): number | null {
  if (values.length === 0) {
    return null;
  }
  return Math.round((values.reduce((sum, v) => sum + v, 0) / values.length) * 10) / 10;
}

// Agrupa las canciones por cada artista que aparece (incluye colaboraciones) y
// calcula la media (personal y de la comunidad) según las canciones del artista.
function buildArtists(songs: PlaylistSong[]): ArtistSummary[] {
  const map = new Map<string, PlaylistSong[]>();

  for (const song of songs) {
    for (const rawName of song.artists) {
      const name = rawName.trim();
      if (!name) {
        continue;
      }
      const list = map.get(name) ?? [];
      list.push(song);
      map.set(name, list);
    }
  }

  return [...map.entries()].map(([name, artistSongs]) => {
    const personalNotes = artistSongs
      .filter((s) => s.userRating !== null)
      .map((s) => s.userRating as number);
    const communityNotes = artistSongs
      .filter((s) => s.communityRating !== null)
      .map((s) => s.communityRating as number);

    return {
      name,
      songs: artistSongs,
      personalAvg: average(personalNotes),
      personalCount: personalNotes.length,
      communityAvg: average(communityNotes),
      communityCount: communityNotes.length
    };
  });
}

function compareNullableDesc(a: number | null, b: number | null): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return b - a;
}

export function ArtistsSection({
  songs,
  isOwner,
  onSaveRating,
  onClearRating,
  onDeleteArchived
}: ArtistsSectionProps) {
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<ArtistSort>("personal");
  const [expandedArtist, setExpandedArtist] = useState<string | null>(null);
  const [expandedSongId, setExpandedSongId] = useState<string | null>(null);

  const artists = useMemo(() => buildArtists(songs), [songs]);

  const sorted = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    const filtered = artists.filter(
      (a) => !normalizedSearch || a.name.toLowerCase().includes(normalizedSearch)
    );

    return [...filtered].sort((a, b) => {
      const byName = a.name.localeCompare(b.name, undefined, { sensitivity: "base" });

      if (sort === "alpha") {
        return byName;
      }
      if (sort === "songs") {
        return b.songs.length - a.songs.length || byName;
      }

      const av = sort === "community" ? a.communityAvg : a.personalAvg;
      const bv = sort === "community" ? b.communityAvg : b.personalAvg;
      return compareNullableDesc(av, bv) || byName;
    });
  }, [artists, search, sort]);

  return (
    <section className="space-y-6">
      <div className="glass-panel rounded-[32px] p-6 sm:p-8">
        <p className="section-title text-[11px] text-glowSoft">Artistas</p>
        <h2 className="mt-3 text-3xl font-semibold text-white">Por artista</h2>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-white/65">
          La nota media de cada artista según sus canciones de la playlist (tu nota y la media de
          todos). Ábrelo para ver y puntuar sus canciones.
        </p>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="section-title text-[11px] text-white/45">Buscar artista</span>
            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Nombre del artista..."
              className="mt-2 w-full rounded-[20px] border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition focus:border-glow/50 focus:ring-2 focus:ring-glow/20"
            />
          </label>
          <label className="block">
            <span className="section-title text-[11px] text-white/45">Ordenar por</span>
            <select
              value={sort}
              onChange={(event) => setSort(event.target.value as ArtistSort)}
              className="mt-2 w-full rounded-[20px] border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition focus:border-glow/50 focus:ring-2 focus:ring-glow/20"
            >
              <option value="personal">Tu nota media (mayor)</option>
              <option value="community">Media de todos (mayor)</option>
              <option value="alpha">Orden alfabético</option>
              <option value="songs">Número de canciones</option>
            </select>
          </label>
        </div>
      </div>

      {sorted.length === 0 ? (
        <div className="rounded-[28px] border border-dashed border-white/12 bg-white/5 p-8 text-center text-sm text-white/58">
          No hay artistas que cumplan la búsqueda.
        </div>
      ) : (
        <div className="space-y-4">
          {sorted.map((artist) => {
            const open = expandedArtist === artist.name;

            return (
              <div key={artist.name} className="glass-panel overflow-hidden rounded-[28px]">
                <button
                  type="button"
                  onClick={() => {
                    setExpandedArtist(open ? null : artist.name);
                    setExpandedSongId(null);
                  }}
                  className="flex w-full items-center gap-4 px-5 py-4 text-left transition hover:bg-white/5"
                >
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-lg font-semibold text-white">{artist.name}</h3>
                    <p className="mt-1 text-sm text-white/55">
                      {artist.songs.length}{" "}
                      {artist.songs.length === 1 ? "canción" : "canciones"}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className="rounded-full border border-glow/35 bg-glow/10 px-3 py-1 text-xs font-medium text-glowSoft">
                      Tu media{" "}
                      {artist.personalAvg === null
                        ? "—"
                        : `${formatRating(artist.personalAvg)} (${artist.personalCount})`}
                    </span>
                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-white/60">
                      Media{" "}
                      {artist.communityAvg === null
                        ? "—"
                        : `${formatRating(artist.communityAvg)} (${artist.communityCount})`}
                    </span>
                  </div>
                  <span className="shrink-0 text-xs uppercase tracking-[0.2em] text-white/42">
                    {open ? "Cerrar" : "Abrir"}
                  </span>
                </button>

                {open ? (
                  <div className="space-y-3 border-t border-white/8 px-4 py-4">
                    {[...artist.songs]
                      .sort((a, b) => (b.userRating ?? -1) - (a.userRating ?? -1))
                      .map((song) => (
                        <SongLibraryItem
                          key={song.entryId}
                          song={song}
                          expanded={expandedSongId === song.entryId}
                          onToggle={() =>
                            setExpandedSongId((current) =>
                              current === song.entryId ? null : song.entryId
                            )
                          }
                          onSaveRating={onSaveRating}
                          onClearRating={onClearRating}
                          onDeleteArchived={isOwner ? onDeleteArchived : undefined}
                        />
                      ))}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
