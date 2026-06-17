# Playlist Arena

Playlist Arena es una app local en Next.js para gestionar una unica playlist de Spotify, guardar canciones en `localStorage`, puntuar temas y jugar torneos con progreso persistente.

La app no borra automaticamente lo que ya tienes guardado. Si en Spotify desaparece una cancion, aqui sigue existiendo como historico y solo tu decides si eliminarla de la app.

## Que hace la app

La pantalla principal se divide en 3 botones:

1. `Canciones`
2. `Torneo`
3. `Actualizar datos`

### Canciones

Dentro de `Canciones` hay 4 apartados:

1. `Busqueda`
2. `Ranking`
3. `Canciones de la ultima actualizacion`
4. `Canciones repetidas`

Funciones disponibles:

- Buscar por titulo, artista, album o ano.
- Filtrar por `solo puntuadas`, `solo sin puntuar`, `nota minima`, `nota maxima`, `solo repetidas` y `solo de ultima actualizacion`.
- Desplegar cada cancion para ver sus datos importados y abrir su enlace de Spotify.
- Poner o cambiar notas personales de `0.0` a `10.0`.
- Usar `Anadir puntuacion` para recorrer automaticamente las canciones sin nota.
- Ver un estilo visual distinto en las canciones sin puntuar.
- Ver un icono/estado cuando una cancion ya no esta en la playlist activa de Spotify.
- Eliminar manualmente de la app solo esas canciones que ya no siguen en la playlist.

### Ranking

El ranking se ordena asi:

1. Nota personal mas alta.
2. Si hay empate, gana la cancion con mas victorias internas de torneo acumuladas.
3. Si sigue habiendo empate, orden alfabetico.

Las canciones sin nota aparecen al final como `Sin puntuacion`.

### Canciones de la ultima actualizacion

Aqui se muestra:

- La fecha de la ultima sincronizacion.
- `Total de Canciones Nuevas: X canciones`.
- El listado de canciones nuevas de esa ultima sincronizacion.
- El historial completo de sincronizaciones anteriores.

### Canciones repetidas

Las repetidas se detectan por:

- mismo titulo
- mismo artista principal

### Torneo

El torneo usa las canciones guardadas en local y guarda el progreso en `localStorage`.

Modos:

- `1v1`
- `2v2 / 4-way battle`

Reglas:

- En `1v1` eliges 1 ganadora entre 2 canciones.
- En `2v2 / 4-way battle` ves 4 canciones a la vez y eliges exactamente 1 ganadora.
- La ganadora avanza y las demas quedan eliminadas.
- Si abandonas o reinicias un torneo a medias, ese intento no suma nada.
- Al completar un torneo, se consolidan sus victorias internas y entonces si se suman al contador permanente.
- Ese contador se usa despues para desempatar el ranking.
- La app guarda un historial de torneos completados con fecha, hora, especificaciones y top 3.

Tamano de torneo:

- `1v1`: `16`, `32`, `64`, `128`, `256`
- `2v2 / 4-way battle`: `16`, `64`, `256`

La app desactiva los tamanos que superen el numero de canciones locales disponibles.

### Actualizar datos

Este apartado sirve para:

- Conectar Spotify con OAuth PKCE.
- Importar la playlist por primera vez.
- Volver a sincronizarla solo cuando pulses el boton.
- Detectar canciones nuevas y anadirlas sin borrar las anteriores.
- Marcar como fuera de playlist las canciones que ya no existen en Spotify.
- Guardar historial de actualizaciones en `localStorage`.
- Mostrar errores en popup si Spotify falla o no se puede actualizar.

El login con Spotify solo hace falta para importar o actualizar datos. Si ya tienes la libreria guardada, puedes usar `Canciones` y `Torneo` sin reconectar en ese momento.

## Regla de playlist unica

La app trabaja con una sola playlist.

Eso significa:

- La primera playlist que importas queda fijada como playlist principal.
- Si Spotify cambia el link pero sigue siendo la misma playlist, puedes pegar el nuevo enlace y se actualizara sin perder datos.
- Si intentas sincronizar una playlist distinta, la app la bloquea y no reemplaza tu libreria local.

## Persistencia local

Se guarda de forma permanente en `localStorage`:

- sesion de Spotify
- playlist importada
- notas por cancion
- victorias internas de torneo
- progreso del torneo
- historial de actualizaciones
- historial de torneos completados

## Datos guardados por cancion

Cada cancion local conserva:

- `id`
- `entryId`
- `spotifyUri`
- `title`
- `artists`
- `album`
- `coverUrl`
- `spotifyUrl`
- `releaseDate`
- `releaseYear`
- `addedAt`
- `durationMs`
- `userRating`
- `isInActivePlaylist`
- `tournamentWins`

Nota Spotify 2026: la app ya no depende del campo `popularity`, porque Spotify lo ha retirado de las respuestas disponibles para apps en modo desarrollo.

## Configurar Spotify

1. Entra en Spotify Developer Dashboard y crea una app.
2. Copia el `Client ID`.
3. Anade `http://127.0.0.1:3000/callback` como `Redirect URI`.
4. Crea manualmente un archivo `.env.local` en la raiz del proyecto.

Contenido minimo:

```bash
NEXT_PUBLIC_SPOTIFY_CLIENT_ID=tu_client_id
NEXT_PUBLIC_SPOTIFY_REDIRECT_URI=http://127.0.0.1:3000/callback
```

Tienes el ejemplo en [.env.example](</c:/Users/EM2025008407/Documents/Proyectos codex/Torneo/.env.example:1>).

## Documentacion funcional

La explicacion funcional ampliada esta en [FUNCIONALIDAD.md](</c:/Users/EM2025008407/Documents/Proyectos codex/Torneo/FUNCIONALIDAD.md:1>).

## Documentacion adicional

Tambien he dejado estos documentos de apoyo:

- [GUIA_APLICACION.md](</c:/Users/EM2025008407/Documents/Proyectos codex/Torneo/GUIA_APLICACION.md:1>) para usar la app desde el punto de vista del usuario
- [SEGUIMIENTO_CODIGO.md](</c:/Users/EM2025008407/Documents/Proyectos codex/Torneo/SEGUIMIENTO_CODIGO.md:1>) para entender el estado tecnico y el mapa de archivos
- [SIGUIENTES_PASOS.md](</c:/Users/EM2025008407/Documents/Proyectos codex/Torneo/SIGUIENTES_PASOS.md:1>) para ver mejoras, validaciones y pasos recomendados

## Estado tecnico validado

En este ordenador ya se ha instalado Node.js, se han instalado dependencias con `npm install`, se han validado `npm run lint` y `npm run build`, y la app arranca en:

```bash
http://127.0.0.1:3000
```

Tambien existe un lanzador para Windows:

```bash
Abrir Playlist Arena.bat
```

Con doble clic arranca el servidor local y abre la app en el navegador. Mantener esa ventana abierta mientras se use la app; para cerrarla, volver a la ventana y pulsar `Ctrl+C`.

La sincronizacion usa el endpoint actual de Spotify `/playlists/{playlist_id}/items`, compatible con los cambios de Spotify 2026. En modo desarrollo, Spotify exige que la cuenta que use la app este anadida en User Management y que la playlist sea de esa cuenta o accesible como colaborador.
