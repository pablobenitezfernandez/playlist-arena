# Seguimiento de Codigo

## Objetivo de este documento

Este archivo sirve como registro tecnico del proyecto.

Su funcion es explicar:

- que partes estan implementadas
- en que archivos vive cada bloque de funcionalidad
- como se relaciona el codigo con `FUNCIONALIDAD.md`
- que puntos estan cerrados y cuales siguen pendientes

## Relacion con FUNCIONALIDAD.md

`FUNCIONALIDAD.md` define el comportamiento funcional de la app:

- que puede hacer el usuario
- que reglas sigue la app
- como deberia comportarse cada modulo

`SEGUIMIENTO_CODIGO.md` complementa eso con la parte tecnica:

- donde esta implementado cada comportamiento
- que archivos participan
- estado actual del desarrollo

Resumen rapido:

- `FUNCIONALIDAD.md` = que hace la app
- `SEGUIMIENTO_CODIGO.md` = donde y como esta hecho en codigo

## Estado actual

Revision tecnica preparada el `2026-06-17`.

Estado general:

- base de la app montada
- flujo principal funcional y validado con `npm run lint` y `npm run build`
- documentacion funcional creada
- entorno local preparado con Node.js y npm

## Mapa de archivos

### Entrada de la app

- `app/page.tsx`
  - monta la home principal
- `app/callback/page.tsx`
  - monta la ruta del callback de Spotify

### Lanzador local

- `Abrir Playlist Arena.bat`
  - arranca la app en Windows con doble clic
  - anade temporalmente `C:\Program Files\nodejs` al `PATH`
  - instala dependencias si falta `node_modules`
  - abre `http://127.0.0.1:3000`
  - mantiene el servidor vivo hasta cerrar con `Ctrl+C`

### Componentes principales

- `components/playlist-arena-app.tsx`
  - componente central de toda la interfaz
  - controla navegacion interna entre `Canciones`, `Torneo` y `Actualizar datos`
  - gestiona estado local, filtros, sincronizacion, ranking y torneo

- `components/song-library-item.tsx`
  - tarjeta desplegable de cada cancion
  - muestra metadatos
  - permite poner o quitar nota
  - muestra estado `Fuera de playlist`
  - permite borrado manual de canciones archivadas

- `components/song-rating-flow.tsx`
  - flujo rapido de `Anadir puntuacion`
  - avanza cancion a cancion entre las no puntuadas

- `components/song-card.tsx`
  - tarjeta visual para enfrentamientos del torneo

- `components/spotify-callback-page.tsx`
  - resuelve el callback OAuth PKCE
  - guarda la sesion
  - envia errores al popup de la home

### Logica y datos

- `lib/spotify.ts`
  - login OAuth PKCE
  - refresh token
  - llamadas a Spotify
  - paginacion de canciones con `/playlists/{playlist_id}/items`
  - compatibilidad con el campo nuevo `item` y el legado `track`
  - merge de canciones nuevas sin perder datos locales
  - bloqueo de playlist unica

- `lib/storage.ts`
  - lectura y escritura en `localStorage`
  - normalizacion de datos antiguos
  - persistencia de playlist, torneo, historial de actualizaciones e historial de torneos

- `lib/tournament.ts`
  - creacion del torneo
  - avance de rondas
  - historial de enfrentamientos
  - progreso y reinicio
  - consolidacion de resultados al terminar
  - construccion del archivo historico de torneos

- `lib/types.ts`
  - tipos globales del dominio
  - canciones, playlist, historial de sync y torneo

- `lib/constants.ts`
  - claves de almacenamiento
  - etiquetas
  - tamanos y estrategias de torneo

- `lib/utils.ts`
  - helpers de fecha, duracion, rating y parseos auxiliares

## Estado por bloques funcionales

### 1. Libreria de canciones

Estado: `Implementado`

Cubierto en:

- `components/playlist-arena-app.tsx`
- `components/song-library-item.tsx`
- `components/song-rating-flow.tsx`

Incluye:

- busqueda
- filtros
- ranking
- historial de ultima actualizacion
- deteccion de repetidas
- puntuacion manual

### 2. Persistencia local

Estado: `Implementado`

Cubierto en:

- `lib/storage.ts`
- `lib/types.ts`

Incluye:

- playlist guardada
- canciones guardadas
- notas persistentes
- victorias persistentes
- torneo persistente
- historial de actualizaciones persistente
- historial de torneos persistente

### 3. Sincronizacion con Spotify

Estado: `Implementado a nivel de codigo`

Cubierto en:

- `lib/spotify.ts`
- `components/playlist-arena-app.tsx`
- `components/spotify-callback-page.tsx`

Incluye:

- OAuth PKCE
- import inicial
- actualizacion manual
- paginacion de canciones
- merge sin borrado automatico
- popup de error

### 4. Regla de playlist unica

Estado: `Implementado`

Cubierto en:

- `lib/spotify.ts`
- `components/playlist-arena-app.tsx`

Comportamiento:

- bloquea reemplazo automatico por otra playlist distinta
- conserva la libreria local existente

### 5. Torneo

Estado: `Implementado`

Cubierto en:

- `lib/tournament.ts`
- `components/playlist-arena-app.tsx`
- `components/song-card.tsx`

Incluye:

- `1v1`
- `2v2 / 4-way battle`
- progreso guardado
- campeona
- historial
- victorias internas acumuladas solo al finalizar
- historial de torneos completados con top 3

## Modelo de datos importante

Campos destacados por cancion:

- `userRating`
- `isInActivePlaylist`
- `tournamentWins`

Uso de cada uno:

- `userRating`
  - nota personal de la cancion
- `isInActivePlaylist`
  - indica si la cancion sigue estando en la playlist actual de Spotify
- `tournamentWins`
  - contador permanente usado para desempates del ranking

## Registros tecnicos actuales

### Registro 2026-06-17

Cambios principales presentes en el codigo:

- separacion de `Canciones` en 4 subapartados
- historial de actualizaciones persistente
- filtro por puntuadas y no puntuadas
- filtro por nota minima y maxima
- filtro por repetidas
- filtro por ultima actualizacion
- bloqueo de playlist unica
- marcado de canciones fuera de playlist
- borrado manual solo para canciones archivadas
- victorias internas aplicadas solo al completar el torneo
- historial de torneos completados con top 3, fecha, hora y especificaciones
- popup de errores de Spotify
- adaptacion a Spotify 2026: `127.0.0.1` como redirect, endpoint `/items`, y retirada de popularidad
- migracion de torneos antiguos que usaban estrategias por popularidad hacia `Aleatorio`
- migracion de `next lint` a ESLint CLI con `eslint.config.mjs`
- lanzador Windows `Abrir Playlist Arena.bat`
- build validado correctamente con Next 15
- documentacion funcional y de uso actualizada

## Pendientes detectados

Pendiente tecnico inmediato:

- probar una sincronizacion real completa con tu playlist desde el navegador
- probar torneo completo en ambos modos con datos reales

Pendiente funcional futuro:

- ampliar estadisticas de ranking
- mejorar exportaciones
- seguir separando el componente principal en piezas mas pequenas

## Como mantener este documento

Cada vez que se toque una funcionalidad importante, conviene actualizar:

1. `FUNCIONALIDAD.md` si cambia el comportamiento para el usuario
2. `SEGUIMIENTO_CODIGO.md` si cambia la implementacion, el estado o el mapa de archivos

Regla recomendada:

- cambio funcional = actualiza ambos documentos
- cambio solo tecnico = actualiza al menos `SEGUIMIENTO_CODIGO.md`
