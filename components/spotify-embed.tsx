"use client";

type SpotifyEmbedProps = {
  // ID de la pista de Spotify (PlaylistSong.id).
  trackId: string;
  // compact = reproductor pequeño (80px); si no, el estándar (152px).
  compact?: boolean;
};

/**
 * Reproductor oficial incrustado de Spotify. Sin login reproduce una preview
 * de 30 segundos (legal, no necesita la API). Si la persona tiene sesión de
 * Spotify Premium en el navegador, suena la canción entera.
 */
export function SpotifyEmbed({ trackId, compact }: SpotifyEmbedProps) {
  if (!trackId) {
    return (
      <p className="text-xs text-white/40">Preview no disponible para esta canción.</p>
    );
  }

  return (
    <iframe
      title="Reproductor de Spotify"
      src={`https://open.spotify.com/embed/track/${trackId}`}
      width="100%"
      height={compact ? 80 : 152}
      style={{ border: 0, borderRadius: 12 }}
      allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
      loading="lazy"
    />
  );
}
