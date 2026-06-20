# Playlist Arena

Aplicación web **multiusuario** para puntuar y comparar las canciones de **una playlist de Spotify compartida**. Cada persona entra con su cuenta, pone sus notas, y todos ven la media de la comunidad y el ranking que sale entre todos. Incluye torneos para desempatar gustos.

- **En vivo:** https://playlist-arena.vercel.app
- **Stack:** Next.js 15 + React 19 + TypeScript + Tailwind, datos en **Supabase** (Postgres + Auth + Realtime), desplegado en **Vercel**.

> Versión anterior: era una app local de un solo usuario con datos en `localStorage`. Ahora es multiusuario en la nube. Algunos datos (torneos) siguen siendo locales por persona; ver abajo.

## Qué hace

- **Login propio**: cada persona se registra con email y contraseña (Supabase Auth). Sin entrar en Spotify.
- **Playlist compartida**: las canciones viven en la base de datos. Las sincroniza **solo el dueño** desde Spotify; el resto solo las lee y puntúa.
- **Dos notas por canción**: tu nota personal + la **media de todos** (con número de votos).
- **Ranking doble**: por tu nota o por la media de todos. Desempate por **victorias de torneo de todas las personas**.
- **Torneos**: 1v1 o 4-way, con estrategias de selección por edad de la canción (al azar).
- **Dashboard** (`/dashboard`): estadísticas personales y de comunidad.
- **Tiempo real**: cuando alguien puntúa, la media se actualiza (refresco automático + realtime).

## Estructura de la app

Al entrar (tras iniciar sesión) hay tres apartados:

1. **Canciones** — Búsqueda y Ranking.
2. **Torneo** — montar y jugar brackets.
3. **Estado de la playlist** — para todos es solo lectura; para el **dueño** es "Administrar playlist" (sincronizar desde Spotify, ver duplicadas y última actualización).

Además, al entrar en Canciones se muestran las **Novedades** (las 10 canciones de lanzamiento más reciente).

## Roles

- **Dueño** (la cuenta marcada con `is_owner` en la base de datos): puede sincronizar la playlist desde Spotify y ver las herramientas de administración (duplicadas, última sincronización).
- **Resto de usuarios**: leen la playlist, puntúan y juegan torneos. Nunca tocan Spotify.

## Datos: qué es compartido y qué es local

| Dato | Dónde vive | Compartido |
|---|---|---|
| Canciones de la playlist | Supabase (`songs`) | Sí (una copia para todos) |
| Notas por persona | Supabase (`ratings`) | Sí (todos ven la media y quién puntuó) |
| Victorias de torneo | Supabase (`tournament_song_wins`) | Sí (suma global para el desempate) |
| Torneo en curso / historial de torneos | `localStorage` del navegador | No (por persona, por ahora) |

## Puesta en marcha (desarrollo)

Requisitos: Node.js (LTS) y npm.

1. Variables de entorno en `.env.local` (ver [`.env.local.example`](.env.local.example)):
   ```bash
   NEXT_PUBLIC_SUPABASE_URL=...
   NEXT_PUBLIC_SUPABASE_ANON_KEY=...
   # Solo el dueño, para sincronizar la playlist:
   NEXT_PUBLIC_SPOTIFY_CLIENT_ID=...
   NEXT_PUBLIC_SPOTIFY_REDIRECT_URI=http://127.0.0.1:3000/callback
   ```
2. Base de datos: ejecutar [`supabase/schema.sql`](supabase/schema.sql) en el SQL Editor de Supabase (crea tablas, RLS, triggers y realtime; es idempotente).
3. Arrancar en local: doble clic en `Abrir Playlist Arena.bat`, o `npm run dev` y abrir `http://127.0.0.1:3000`.

> La `anon key` de Supabase es pública por diseño: la seguridad real la imponen las políticas **RLS** definidas en `supabase/schema.sql`. La clave `service_role` NO se usa en el cliente.

## Despliegue

- Hospedado en **Vercel** (rama `main` → deploy automático en cada push).
- Las variables de entorno se configuran en Vercel → Project Settings → Environment Variables.
- El dueño puede sincronizar la playlist **desde la web** (redirect `https://playlist-arena.vercel.app/callback` registrado en Spotify) o desde local.

## Autenticación y email

- Login con email + contraseña (Supabase Auth). Contraseñas cifradas por Supabase.
- Flujo de **recuperar contraseña** por email (página `/reset`).
- La **confirmación de email** está actualmente desactivada (moderación manual), porque el email gratis de Supabase está muy limitado. Para reactivarla con fiabilidad hace falta un SMTP propio (p. ej. Gmail SMTP con contraseña de aplicación).

## Documentación

- [GUIA.md](GUIA.md) — guía operativa para el dueño (abrir/cerrar local, Vercel, sincronizar).
- [GUIA_APLICACION.md](GUIA_APLICACION.md) — cómo usar la app como usuario.
- [FUNCIONALIDAD.md](FUNCIONALIDAD.md) — comportamiento funcional detallado.
- [SEGUIMIENTO_CODIGO.md](SEGUIMIENTO_CODIGO.md) — mapa de archivos y estado técnico.
- [SIGUIENTES_PASOS.md](SIGUIENTES_PASOS.md) — pendientes y mejoras.

## Notas técnicas (Spotify 2026)

- La app usa el endpoint `/playlists/{playlist_id}/items` y OAuth PKCE.
- Spotify retiró el campo `popularity` (no se usa) y, a finales de 2024, también el `preview_url`, por lo que las previews integradas requieren el reproductor incrustado oficial de Spotify (pendiente).
- En modo desarrollo de la app de Spotify, solo las cuentas añadidas en *User Management* pueden conectar Spotify — como solo sincroniza el dueño, basta con que él esté añadido.
