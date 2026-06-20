# Seguimiento de Código

Registro técnico del proyecto: arquitectura, mapa de archivos y estado. Complementa a [FUNCIONALIDAD.md](FUNCIONALIDAD.md) (qué hace) con el "dónde y cómo está hecho".

## Arquitectura

- **Frontend**: Next.js 15 (App Router) + React 19 + TypeScript + Tailwind. App casi 100% en componentes cliente.
- **Backend / datos**: **Supabase** (Postgres + Auth + Realtime). Sin servidor propio: el navegador habla directo con Supabase usando la `anon key`, protegido por **RLS**.
- **Auth**: email/contraseña (Supabase Auth). El dueño además usa OAuth PKCE de Spotify para sincronizar.
- **Hosting**: Vercel (rama `main` → deploy automático).

## Base de datos (Supabase)

Esquema en [`supabase/schema.sql`](supabase/schema.sql) (idempotente). Tablas:

- `profiles` — perfil por usuario (`display_name`, `is_owner`). Se crea solo al registrarse (trigger). `is_owner` está protegido para que nadie se autoascienda (trigger `protect_is_owner`).
- `songs` — la playlist compartida (una copia para todos). Solo el dueño escribe (RLS).
- `ratings` — nota de cada persona por canción. Todos leen (para la media); cada uno solo edita las suyas.
- `tournament_song_wins` — victorias de torneo por persona/canción. Todos leen (desempate global).
- `playlist_meta` — datos generales de la playlist (1 fila).

RLS en todas. Realtime activado en `ratings` y `tournament_song_wins`.

## Mapa de archivos

### Rutas (`app/`)
- `app/layout.tsx` — envuelve todo en `AuthProvider`.
- `app/page.tsx` — `AuthGate` + `PlaylistArenaApp` (la app, protegida por login).
- `app/dashboard/page.tsx` — dashboard.
- `app/reset/page.tsx` — poner contraseña nueva tras el email de recuperación.
- `app/callback/page.tsx` — callback OAuth de Spotify (solo dueño).

### Componentes (`components/`)
- `playlist-arena-app.tsx` — componente central (Canciones, Torneo, Administrar playlist). Filtros, orden, ranking, novedades, creación de torneo, sincronización.
- `auth-gate.tsx` — pantalla de login/registro/recuperar y barra de cuenta; bloquea la app sin sesión.
- `reset-password.tsx` — formulario de contraseña nueva.
- `dashboard.tsx` — estadísticas (lee de la base de datos).
- `song-library-item.tsx` — tarjeta desplegable de canción (tu nota + media + abrir en Spotify).
- `song-rating-flow.tsx` — flujo "Añadir puntuación" (canción sin puntuar **al azar**).
- `song-card.tsx` — tarjeta de canción en el torneo (con "Abrir en Spotify").
- `spotify-callback-page.tsx` — resuelve el callback PKCE.

### Lógica y datos (`lib/`)
- `supabase.ts` — cliente de Supabase (sesión en localStorage, `detectSessionInUrl` para el enlace de recuperación).
- `auth-context.tsx` — contexto de sesión: `signIn`, `signUp`, `signOut`, `resetPassword`, `updatePassword`, perfil, `isOwner`.
- `db.ts` — capa de datos: `fetchSharedPlaylist` (canciones + tu nota + media + victorias globales), `saveRatingToDb`, `deleteRatingFromDb`, `saveTournamentWins`, `syncPlaylistToDb` (dueño), `deleteSongFromDb` (dueño).
- `spotify.ts` — OAuth PKCE, refresh, paginación `/playlists/{id}/items`, merge sin borrado.
- `storage.ts` — `localStorage` para lo que sigue siendo local (torneo actual, archivo de torneos, historial de sync). Normaliza estrategias antiguas → `random`.
- `tournament.ts` — crear torneo (selección por edad **al azar**, con error si no hay suficientes), avanzar rondas, victorias, archivo.
- `types.ts` — tipos del dominio (incluye `userRating`, `communityRating`, `communityRatingCount`, `tournamentWins`).
- `constants.ts` — claves, tamaños y estrategias de torneo, `TOURNAMENT_AGE_THRESHOLD_YEARS`.
- `utils.ts` — helpers de fecha/duración/rating (incluye `parseRatingInput`/`sanitizeRatingInput` para 1 decimal y `formatReleaseDateFull`).

### Lanzador
- `Abrir Playlist Arena.bat` — arranca el dev en `http://127.0.0.1:3000` en Windows. Solo necesario para tocar código (el uso diario es la web).

## Estado por bloques

| Bloque | Estado |
|---|---|
| Auth email/contraseña + recuperar contraseña | Implementado |
| Playlist compartida en BD + sync solo dueño | Implementado |
| Notas compartidas: personal + media + realtime | Implementado |
| Ranking doble + desempate global por torneos | Implementado |
| Torneos (estrategias por edad al azar, aviso, Abrir en Spotify) | Implementado |
| Dashboard desde BD | Implementado |
| Preview de Spotify integrada | **Pendiente** (rama `preview-spotify`) |

## Flujo de trabajo (git)

- `main` = lo que está en producción (Vercel). Mientras haya gente probando, **no se hace push directo**: se trabaja en ramas y se publica cuando el dueño lo dice (merge a `main` + push).
- Antes de publicar: `npm run build` siempre (Next falla el build con errores de lint, p. ej. `<a>` interno en vez de `<Link>`).

## Pendientes técnicos

- Preview de Spotify con reproductor incrustado oficial (detalle de canción, flujo de puntuación y torneo). `preview_url` está deprecado por Spotify, así que se usará el embed.
- Email fiable (SMTP propio) para reactivar la confirmación de email sin límites.
- A futuro: mover los torneos a la base de datos (ahora son locales por persona) y trocear `playlist-arena-app.tsx`.
