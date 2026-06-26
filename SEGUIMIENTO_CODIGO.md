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
- `tournament_results` — resultado FINAL de cada torneo (campeón + top 3 jsonb). Se sigue escribiendo al completar un torneo, pero **ya NO se lee** para la vista de amigos (ver abajo): la vista de torneos de amigos se reconstruye desde `tournament_song_wins`, que es más fiable. Queda como dato/posible uso futuro.
- Realtime activo en `ratings` y `tournament_song_wins`.

## Mapa de archivos
### Rutas (`app/`)
- `layout.tsx` (envuelve en `AuthProvider`), `page.tsx` (`AuthGate` + `PlaylistArenaApp`), `dashboard/page.tsx`, `reset/page.tsx` (contraseña nueva), `callback/page.tsx` (OAuth Spotify).

### Componentes (`components/`)
- `playlist-arena-app.tsx` — componente central. Nav de 5 secciones (tarjetas con nombre + descripción clara, **sin** las viejas etiquetas "Opción N"; copy de orientación). Filtros, orden, ranking, novedades, torneo, sync. Derivaciones memoizadas (useMemo). **Paginación**: `SONGS_PAGE_SIZE=40` + estado `visibleSongs`; Búsqueda/Ranking pintan 40 y el resto con "Ver más" (reset por filtro/orden/sección, no por refrescos). El menú **Amigos** muestra un **puntito** con el nº de solicitudes pendientes (sondeo 30s + sync al aceptar/rechazar). Al completar un torneo guarda victorias **y** resultado final; el cierre del torneo se persiste ANTES de guardar + un `finalizingTournamentRef` evita el doble-disparo que duplicaba victorias.
- `auth-gate.tsx` — pantalla de bienvenida ("BACHATA") + login/registro/recuperar + barra de cuenta (muestra @usuario). Gestiona el gate de @usuario.
- `username-gate.tsx` — "elige tu @usuario" (obligatorio si no tienes uno).
- `reset-password.tsx` — poner contraseña nueva.
- `dashboard.tsx` — estadísticas (lee de la BD) + top semanal por victorias.
- `song-library-item.tsx` — tarjeta de canción (nota + media + preview Spotify + abrir). **React.memo** (comparador song+expanded).
- `song-rating-flow.tsx` — flujo "Añadir puntuación" (canción sin puntuar AL AZAR).
- `song-card.tsx` — tarjeta de canción en el torneo (preview + abrir en Spotify).
- `artists-section.tsx` — apartado Artistas (media por artista, buscar, ordenar, abrir).
- `friends-section.tsx` — apartado Amigos (añadir por @usuario, solicitudes, lista, **eliminar amigo** con confirmación, y **"Ver perfil"** de cada amigo: su top 10 + sus torneos de la semana con podio).
- `spotify-embed.tsx` — reproductor oficial incrustado de Spotify vía **IFrame API** (preview 30s). **Coordinado**: un registro a nivel de módulo pausa los demás reproductores cuando uno empieza a sonar (clave en móvil, donde las previews se solapaban).
- `spotify-callback-page.tsx` — resuelve el callback PKCE.

### Lógica/datos (`lib/`)
- `supabase.ts` (cliente, `detectSessionInUrl` true para el reset), `auth-context.tsx` (sesión, perfil, `isOwner`, `signIn/up/out`, `resetPassword`, `updatePassword`, `setUsername`).
- `db.ts` — `fetchSharedPlaylist`, `saveRatingToDb`, `deleteRatingFromDb`, `saveTournamentWins`, **`saveTournamentResult`** (insert idempotente, ignora 23505), `fetchRecentTournamentWins`, `syncPlaylistToDb`, `deleteSongFromDb`.
- `friends.ts` — `findUserByUsername`, `sendFriendRequest`, `acceptFriendRequest`, `removeFriendship`, `fetchFriends`, **`fetchFriendRatings`** (top 10 de un amigo), **`fetchFriendTournaments`** (torneos de un amigo de los últimos 7 días; reconstruye el podio agrupando `tournament_song_wins` por `tournament_id` y ordenando por victorias — NO usa `tournament_results`, así se ven TODOS los torneos), **`fetchIncomingRequestCount`** (puntito de solicitudes).
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
| Amigos (solicitar/aceptar/rechazar, eliminar) — Fase 1 | ✅ desplegado |
| Amigos Fase 2: ver perfil (top 10 + torneos de la semana) | ✅ desplegado |
| Puntito de solicitudes de amistad pendientes | ✅ desplegado |
| Reproductor Spotify coordinado (pausa los demás al darle play) | ✅ desplegado |
| Fix victorias de torneo duplicadas (doble-disparo) | ✅ desplegado |
| Torneos de amigos reconstruidos desde victorias (se ven todos) | ✅ desplegado |
| Paginación de listas de canciones ("Ver más", 40 por tanda) | ✅ desplegado |
| Tildes/ñ y copy de orientación (menú sin "Opción", textos claros) | ✅ desplegado |
| Optimización de rendimiento (memo) | ✅ |

## Flujo de trabajo (git)
- `main` = producción (Vercel). Mientras hay testers, **no se hace push directo**: ramas + desplegar cuando el dueño lo dice.
- **Ritual de deploy seguro**: tag+rama `estable-pre-X` desde main → push → merge feature → `npm run build` → push. (Rollback en GUIA.md §9.)
- Siempre `npm run build` antes de publicar (Next falla el build con errores de lint, p. ej. `<a>` interno).

## Privacidad de Amigos (decisión tomada)
- **Opción A "blanda" (implementada):** la media del ranking sigue siendo de **todos** (amigos y no amigos), calculada igual que siempre en el cliente. Lo "entre amigos" es solo poder ver el **detalle** (top 10 + torneos) de tus amigos; la app únicamente construye esa vista para amigos aceptados. Las notas individuales NO se blindan a nivel de BD.
- **Opción B "dura" (pendiente, futuro):** si se abre la app a desconocidos, bloquear `ratings` a self+amigos y mover la media a una vista/función servidor (`song_rating_stats`) para que siga contando a todos. Es lo delicado (toca la media en vivo).

## Pendientes
- **Privacidad dura (Opción B)** — solo si se abre a desconocidos.
- **Candado en BD para victorias** (defensa extra): `unique(user_id, tournament_id, song_entry_id)` en `tournament_song_wins` + upsert. El doble-disparo ya está resuelto en el cliente; esto sería el cinturón definitivo.
- Email fiable (Gmail SMTP) para reactivar la confirmación. (Por ahora el dueño aprueba cada cuenta a mano en Supabase; ~40 personas.)
- A futuro: trocear `playlist-arena-app.tsx`; virtualizar las listas si la paginación de 40 se queda corta.
- Auditoría externa (2026-06-26): pendientes opcionales NO hechos por decisión del dueño (app cerrada para ~40 amigos, no busca escalar): 404 con marca, favicon, OG tags, Sentry/analytics, toggle ver-contraseña. (Lo "crítico" de las auditorías era casi todo sobre crecimiento o estaba mal diagnosticado.)
