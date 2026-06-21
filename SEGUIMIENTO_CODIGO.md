# Seguimiento de Código

Registro técnico: arquitectura, mapa de archivos y estado. Complementa a [FUNCIONALIDAD.md](FUNCIONALIDAD.md).

## Arquitectura
- **Frontend**: Next.js 15 (App Router) + React 19 + TypeScript + Tailwind. Casi todo en componentes cliente.
- **Backend/datos**: **Supabase** (Postgres + Auth + Realtime). El navegador habla directo con Supabase (`anon key`), protegido por **RLS**.
- **Auth**: email/contraseña. El dueño usa además OAuth PKCE de Spotify para sincronizar.
- **Hosting**: Vercel (`main` → deploy automático). En vivo: https://playlist-arena.vercel.app

## Base de datos (Supabase) — `supabase/schema.sql` (idempotente)
- `profiles` — perfil por usuario: `display_name`, **`username`** (único, minúsculas), `is_owner`. Trigger crea el perfil al registrarse; trigger `protect_is_owner` impide auto-ascenderse.
- `songs` — playlist compartida (solo dueño escribe).
- `ratings` — nota de cada persona por canción (todos leen → para la media).
- `tournament_song_wins` — victorias de torneo por persona/canción, con `created_at` (desempate global + top semanal).
- `playlist_meta` — datos de la playlist (1 fila).
- `friendships` — solicitudes/amigos: `requester_id`, `addressee_id`, `status` (pending|accepted). RLS: ves/gestionas solo las tuyas; solo el destinatario acepta; cualquiera borra.
- Realtime activo en `ratings` y `tournament_song_wins`.

## Mapa de archivos
### Rutas (`app/`)
- `layout.tsx` (envuelve en `AuthProvider`), `page.tsx` (`AuthGate` + `PlaylistArenaApp`), `dashboard/page.tsx`, `reset/page.tsx` (contraseña nueva), `callback/page.tsx` (OAuth Spotify).

### Componentes (`components/`)
- `playlist-arena-app.tsx` — componente central. Nav de 5 secciones (Canciones/Artistas/Torneo/Amigos/Estado), filtros, orden, ranking, novedades, torneo, sync. Derivaciones memoizadas (useMemo).
- `auth-gate.tsx` — pantalla de bienvenida ("BACHATA") + login/registro/recuperar + barra de cuenta (muestra @usuario). Gestiona el gate de @usuario.
- `username-gate.tsx` — "elige tu @usuario" (obligatorio si no tienes uno).
- `reset-password.tsx` — poner contraseña nueva.
- `dashboard.tsx` — estadísticas (lee de la BD) + top semanal por victorias.
- `song-library-item.tsx` — tarjeta de canción (nota + media + preview Spotify + abrir). **React.memo** (comparador song+expanded).
- `song-rating-flow.tsx` — flujo "Añadir puntuación" (canción sin puntuar AL AZAR).
- `song-card.tsx` — tarjeta de canción en el torneo (preview + abrir en Spotify).
- `artists-section.tsx` — apartado Artistas (media por artista, buscar, ordenar, abrir).
- `friends-section.tsx` — apartado Amigos (añadir por @usuario, solicitudes, lista).
- `spotify-embed.tsx` — reproductor oficial incrustado de Spotify (preview 30s).
- `spotify-callback-page.tsx` — resuelve el callback PKCE.

### Lógica/datos (`lib/`)
- `supabase.ts` (cliente, `detectSessionInUrl` true para el reset), `auth-context.tsx` (sesión, perfil, `isOwner`, `signIn/up/out`, `resetPassword`, `updatePassword`, `setUsername`).
- `db.ts` — `fetchSharedPlaylist`, `saveRatingToDb`, `deleteRatingFromDb`, `saveTournamentWins`, `fetchRecentTournamentWins`, `syncPlaylistToDb`, `deleteSongFromDb`.
- `friends.ts` — `findUserByUsername`, `sendFriendRequest`, `acceptFriendRequest`, `removeFriendship`, `fetchFriends`.
- `spotify.ts` (OAuth, sync), `storage.ts` (localStorage: torneo + overlay), `tournament.ts` (estrategias por edad al azar), `types.ts`, `constants.ts`, `utils.ts` (incluye `parseRatingInput`/`sanitizeRatingInput` para 1 decimal, `formatReleaseDateFull`).

## Estado por bloques
| Bloque | Estado |
|---|---|
| Auth email/contraseña + bienvenida + recuperar contraseña | ✅ desplegado |
| @usuario único (gate) | ✅ desplegado |
| Playlist compartida + sync solo dueño | ✅ |
| Notas: personal + media + realtime, 1 decimal | ✅ |
| Ranking doble + desempate global | ✅ |
| Artistas | ✅ desplegado |
| Torneos (estrategias por edad, aviso, Abrir en Spotify, preview) | ✅ |
| Dashboard + top semanal por victorias | ✅ desplegado |
| Amigos (solicitar/aceptar/rechazar) — Fase 1 | ✅ desplegado |
| Ver datos de amigos (top 10, torneos) + privacidad — Fase 2 | ⏳ pendiente |
| Optimización de rendimiento (memo) | ✅ |

## Flujo de trabajo (git)
- `main` = producción (Vercel). Mientras hay testers, **no se hace push directo**: ramas + desplegar cuando el dueño lo dice.
- **Ritual de deploy seguro**: tag+rama `estable-pre-X` desde main → push → merge feature → `npm run build` → push. (Rollback en GUIA.md §9.)
- Siempre `npm run build` antes de publicar (Next falla el build con errores de lint, p. ej. `<a>` interno).

## Pendientes
- **Fase 2 de Amigos** (privado entre amigos): ver top 10 + torneos de cada amigo. Requiere: notas individuales privadas (solo self+amigos) + media pública vía vista/función en servidor; y persistir torneos en la BD (ahora son locales).
- Tweaks UI pedidos: caja propia para "Añadir puntuación"; botón "Eliminar amigo" con confirmación.
- Email fiable (Gmail SMTP) para reactivar la confirmación.
- A futuro: trocear `playlist-arena-app.tsx`; paginar/virtualizar listas largas si hace falta.
