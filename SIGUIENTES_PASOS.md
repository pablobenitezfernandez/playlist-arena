# Siguientes Pasos

Estado y pendientes del proyecto. La app ya está en producción (https://playlist-arena.vercel.app) y con gente probándola.

## Hecho

- Multiusuario con login propio (email/contraseña) sobre Supabase.
- Playlist compartida; sincronización solo del dueño (desde la web o local).
- Notas por persona + media de la comunidad, con actualización en tiempo real.
- Ranking doble (tu nota / media de todos) con desempate por victorias de torneo globales.
- Torneos con estrategias por edad al azar, aviso si faltan canciones y "Abrir en Spotify".
- Dashboard de estadísticas leyendo de la base de datos.
- Recuperar contraseña por email (`/reset`).
- Validación de notas a 1 decimal, novedades en Canciones, filtro contextual, acentos.

## En curso / inmediato

### Preview de Spotify (rama `preview-spotify`)
- Añadir el **reproductor incrustado oficial de Spotify** (suena la preview de 30s sin login, legal) en: el detalle de la canción, el flujo "Añadir puntuación" y el torneo.
- Motivo del embed: Spotify retiró el `preview_url` a finales de 2024, así que el play directo sobre la carátula ya casi no funciona.
- Pendiente de implementar cuando el dueño lo indique.

### Email fiable
- La confirmación de email está desactivada porque el email gratis de Supabase está muy limitado (bloqueaba registros).
- Para reactivarla bien: montar un SMTP propio (recomendado: **Gmail SMTP** con contraseña de aplicación, no necesita dominio) y subir el límite de emails en Supabase.

## Mejoras futuras

### Funcionales
- Mover los **torneos a la base de datos** (ahora el torneo en curso y su historial son locales por persona).
- Vista de "quién puntuó qué" más explícita (ver la nota de cada persona en una canción).
- Más estadísticas en el dashboard (por artista, por año, evolución).
- Exportar ranking a CSV/JSON.

### Técnicas
- Trocear `components/playlist-arena-app.tsx` (es muy grande) en secciones (`songs`, `tournament`, `admin`) y extraer hooks.
- Pruebas unitarias de `lib/tournament.ts` y del merge de `lib/spotify.ts`.
- Revisar el manejo de fechas de lanzamiento incompletas (solo año).

## Recordatorios de operación

- `main` es lo desplegado; mientras haya testers, trabajar en ramas y publicar (merge + push) solo cuando se diga.
- Siempre `npm run build` antes de publicar (Next falla el build con errores de lint).
- La sincronización de la playlist actualiza la base de datos compartida al instante (no hace falta redeploy para que aparezcan canciones nuevas).
