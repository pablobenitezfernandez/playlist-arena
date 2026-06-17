# Funcionalidad Actual

## Objetivo

La app funciona como una libreria local persistente para una unica playlist de Spotify.

Su comportamiento base es:

- importar canciones de Spotify a `localStorage`
- no perder notas ni progreso aunque la playlist crezca
- detectar canciones nuevas en sincronizaciones futuras
- mantener historico de canciones antiguas aunque salgan de Spotify
- reutilizar todo ese catalogo en ranking y torneos

## Flujo principal

1. El usuario entra en la app.
2. Ve tres botones principales:
   - `Canciones`
   - `Torneo`
   - `Actualizar datos`
3. Conecta Spotify desde `Actualizar datos`.
4. Pega el enlace de su playlist y la importa.
5. La app guarda la playlist en local.
6. En futuras visitas, solo se actualiza cuando el usuario pulse el boton.

## Regla de playlist unica

La app queda asociada a una sola playlist.

Casos contemplados:

- Si se vuelve a usar el enlace de esa misma playlist, la sincronizacion continua normal.
- Si Spotify cambia el enlace pero la playlist sigue siendo la misma, se puede pegar el nuevo sin perder datos.
- Si se intenta sincronizar una playlist diferente, la app lo bloquea y muestra un popup de error.

## Canciones

El modulo `Canciones` se divide en 4 subapartados.

### 1. Busqueda

Permite:

- buscar por titulo, artista, album o ano
- ver fichas desplegables por cancion
- abrir el enlace de Spotify
- editar o borrar la nota personal
- eliminar manualmente canciones que ya no esten en la playlist activa

Filtros disponibles:

- solo puntuadas
- solo sin puntuar
- nota minima
- nota maxima
- rango de notas usando minima y maxima
- solo repetidas
- solo de ultima actualizacion

### 2. Ranking

Usa la misma libreria local, pero ordena por reglas de ranking:

1. Nota mas alta primero.
2. En empate, mas victorias internas de torneo.
3. Si sigue el empate, orden alfabetico.

Las canciones sin nota:

- muestran `Sin puntuacion`
- quedan al final del ranking
- tienen una apariencia visual algo distinta

### 3. Canciones de la ultima actualizacion

Muestra:

- la ultima fecha de sincronizacion
- `Total de Canciones Nuevas: X canciones`
- las canciones nuevas de la ultima sincronizacion
- el historial completo de sincronizaciones anteriores

### 4. Canciones repetidas

Detecta duplicados por:

- mismo titulo
- mismo artista principal

La idea es localizar repetidas para que el usuario decida despues si las elimina de Spotify y, si quiere, tambien de la app.

## Puntuaciones

Cada cancion admite:

- nota entre `0.0` y `10.0`
- un decimal
- cambios posteriores

Existe un flujo `Anadir puntuacion` que:

- busca canciones sin nota
- las presenta una a una
- avanza automaticamente al guardar

El orden usado para ese flujo es por fecha de anadido a playlist, de mas reciente a mas antigua.

## Sincronizacion y crecimiento de la playlist

### Primer import

La app:

- descarga metadatos de la playlist
- pagina todos los items de Spotify usando `/playlists/{playlist_id}/items`
- guarda todas las canciones localmente

### Sincronizaciones posteriores

Al pulsar `Actualizar datos`:

- la app vuelve a consultar Spotify
- anade solo las canciones nuevas
- conserva notas existentes
- conserva victorias internas acumuladas
- no borra canciones que ya tenias en la app

Si una cancion ya no aparece en la playlist:

- no se elimina
- queda marcada con estado `fuera de playlist`
- puede borrarse manualmente desde su ficha

## Torneo

El torneo usa canciones guardadas en local y guarda el progreso automaticamente.

### Modos

- `1v1`
- `2v2 / 4-way battle`

### Logica

- En `1v1` se muestran 2 canciones y se elige 1 ganadora.
- En `2v2 / 4-way battle` se muestran 4 canciones y se elige 1 ganadora.
- La ganadora avanza.
- Las demas quedan eliminadas.
- El proceso sigue hasta tener una campeona final.
- Si el usuario sale o reinicia el torneo antes de terminarlo, ese intento no queda archivado.

### Tamano

- `1v1`: `16`, `32`, `64`, `128`, `256`
- `2v2 / 4-way battle`: `16`, `64`, `256`

Los tamanos superiores al numero de canciones locales disponibles aparecen desactivados.

### Desempate por victorias internas

Las victorias internas no se consolidan match a match.

La regla correcta es:

- durante el torneo solo existe el progreso del bracket
- cuando el torneo se completa, se cuentan las victorias logradas por cada cancion
- ese total se suma entonces a `tournamentWins`
- ese contador permanente sirve para desempatar el ranking cuando dos canciones comparten la misma nota

Si el torneo se abandona o se reinicia antes de terminar:

- no suma victorias internas
- no genera entrada en el historial de torneos

### Historial de torneos

La app conserva un historial separado de torneos completados.

Cada entrada guarda:

- fecha y hora de inicio
- fecha y hora de finalizacion
- modo de torneo
- tamano
- estrategia usada
- top 3 de canciones de ese torneo

## Errores controlados

La app contempla:

- URL de playlist invalida
- fallo de login de Spotify
- token expirado
- `Spotify 401`
- `Spotify 403`
- playlist distinta a la ya fijada
- playlist vacia
- canciones insuficientes para el tamano de torneo elegido

Los errores de Spotify se muestran mediante popup para que el usuario entienda por que no se pudo conectar o actualizar.

## Persistencia local

La app guarda en `localStorage`:

- sesion Spotify
- playlist importada
- notas personales
- estado de canciones fuera de playlist
- victorias internas de torneo
- torneo actual
- historial de actualizaciones
- historial de torneos completados

Desde `Datos locales` se puede exportar una copia JSON con la playlist, notas, torneo actual, historial de actualizaciones e historial de torneos. La limpieza local exige confirmacion escribiendo `BORRAR`.

## Estado actual del documento

Este documento describe el comportamiento funcional implementado ahora mismo y deja preparada la base para ampliar despues exportaciones, rankings mas avanzados u otras vistas adicionales.
