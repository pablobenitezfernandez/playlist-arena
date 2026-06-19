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

/**
 * Formatea la fecha de lanzamiento mostrando dia y mes cuando Spotify los da.
 * Spotify devuelve "YYYY-MM-DD", "YYYY-MM" o solo "YYYY" segun la precision.
 */
export function formatReleaseDateFull(releaseDate: string): string {
  if (!releaseDate) {
    return "Desconocida";
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(releaseDate)) {
    return formatDate(releaseDate);
  }

  if (/^\d{4}-\d{2}$/.test(releaseDate)) {
    const parsed = new Date(`${releaseDate}-01T00:00:00`);

    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toLocaleDateString(undefined, { month: "short", year: "numeric" });
    }
  }

  return releaseDate.slice(0, 4);
}

/**
 * Limpia lo que se escribe en el campo de nota mientras se teclea: solo dígitos
 * y como máximo UN decimal. Así no se puede llegar a poner "9.23" (el segundo
 * decimal se descarta al escribir). Admite estados intermedios como "9.".
 */
export function sanitizeRatingInput(value: string): string {
  const normalized = value.replace(",", ".");
  const match = normalized.match(/^\d{0,2}(\.\d?)?/);
  return match ? match[0] : "";
}

/**
 * Valida una nota escrita por el usuario: de 0 a 10 con UN decimal como máximo.
 * Devuelve null si no es válida (p. ej. "9.23", vacío, fuera de rango).
 */
export function parseRatingInput(value: string): number | null {
  const trimmed = value.trim().replace(",", ".");

  if (!/^\d{1,2}(\.\d)?$/.test(trimmed)) {
    return null;
  }

  const parsed = Number(trimmed);

  if (Number.isNaN(parsed) || parsed < 0 || parsed > 10) {
    return null;
  }

  return Math.round(parsed * 10) / 10;
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
