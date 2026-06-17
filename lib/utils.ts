export function extractSpotifyPlaylistId(input: string): string | null {
  const value = input.trim();

  if (!value) {
    return null;
  }

  const uriMatch = value.match(/^spotify:playlist:([a-zA-Z0-9]+)$/);

  if (uriMatch) {
    return uriMatch[1];
  }

  try {
    const url = new URL(value);

    if (!url.hostname.includes("spotify.com")) {
      return null;
    }

    const parts = url.pathname.split("/").filter(Boolean);

    if (parts.length >= 2 && parts[0] === "playlist") {
      return parts[1];
    }

    return null;
  } catch {
    return null;
  }
}

export function formatDuration(durationMs: number): string {
  const totalSeconds = Math.max(0, Math.floor(durationMs / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes.toString().padStart(2, "0")}m`;
  }

  return `${minutes}m ${seconds.toString().padStart(2, "0")}s`;
}

export function formatDate(value: string): string {
  if (!value) {
    return "Desconocida";
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric"
  });
}

export function formatDateTime(value: string): string {
  if (!value) {
    return "Desconocida";
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

export function formatRating(value: number | null): string {
  if (value === null) {
    return "Sin puntuacion";
  }

  return value.toFixed(1);
}

export function getReleaseYear(releaseDate: string): string {
  if (!releaseDate) {
    return "Desconocido";
  }

  return releaseDate.slice(0, 4);
}

export function parseReleaseDate(releaseDate: string): number {
  if (!releaseDate) {
    return 0;
  }

  const parts = releaseDate.split("-");
  const year = Number(parts[0]);
  const month = Number(parts[1] ?? "1");
  const day = Number(parts[2] ?? "1");
  const parsed = new Date(Date.UTC(year, Math.max(month - 1, 0), day));

  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
}

export function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
}

export function shuffleArray<T>(items: T[]): T[] {
  const next = [...items];

  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
  }

  return next;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
