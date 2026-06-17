# Guia de la Aplicacion

## Objetivo

`Playlist Arena` es una app local para trabajar con una unica playlist de Spotify.

La app permite:

- guardar canciones en local
- detectar canciones nuevas cuando actualizas
- puntuar canciones
- consultar ranking
- jugar torneos con esas canciones

## Estructura general

Al entrar en la app hay 3 botones principales:

1. `Canciones`
2. `Torneo`
3. `Actualizar datos`

## 1. Canciones

Este bloque es la libreria principal de la app.

Incluye 4 subapartados:

1. `Busqueda`
2. `Ranking`
3. `Canciones de la ultima actualizacion`
4. `Canciones repetidas`

### 1.1 Busqueda

Sirve para explorar y editar tu libreria local.

Opciones disponibles:

- buscar por titulo
- buscar por artista
- buscar por album
- buscar por ano
- abrir el detalle de cada cancion
- editar la nota manualmente
- quitar la nota
- abrir el link de Spotify

Filtros disponibles:

- `Solo puntuadas`
- `Solo sin puntuar`
- `Nota minima`
- `Nota maxima`
- `Solo repetidas`
- `Solo de ultima actualizacion`

Comportamiento especial:

- las canciones sin nota muestran `Sin puntuacion`
- las canciones sin nota tienen un estilo visual ligeramente distinto
- si una cancion ya no esta en la playlist de Spotify, sigue guardada en la app
- esas canciones se marcan como `Fuera de playlist`
- solo esas canciones se pueden eliminar manualmente de la app

### 1.2 Anadir puntuacion

Dentro de `Busqueda` existe un boton llamado `Anadir puntuacion`.

Ese flujo:

- busca canciones sin puntuar
- te las ensena una a una
- guarda la nota
- pasa automaticamente a la siguiente

La nota permitida va de `0.0` a `10.0` con un decimal.

### 1.3 Ranking

Muestra la libreria ordenada por rendimiento.

Orden del ranking:

1. nota personal mas alta
2. si hay empate, mas victorias internas de torneo
3. si sigue el empate, orden alfabetico

Detalles importantes:

- las canciones sin nota quedan al final
- el ranking usa los mismos filtros que `Busqueda`
- puedes abrir la ficha de cualquier cancion desde aqui

### 1.4 Canciones de la ultima actualizacion

Este apartado muestra:

- la ultima fecha de sincronizacion
- el total de canciones nuevas de esa actualizacion
- el listado de canciones nuevas
- el historial de actualizaciones anteriores

Es util para ver rapidamente que ha entrado nuevo desde Spotify.

### 1.5 Canciones repetidas

Este apartado detecta canciones repetidas por:

- mismo titulo
- mismo artista principal

No elimina nada automaticamente.

Su funcion es ayudarte a detectar duplicados para que luego decidas que hacer en Spotify o en la app.

## 2. Torneo

Este bloque usa solo canciones ya guardadas en local.

### Modos

Hay 2 modos:

1. `1v1`
2. `2v2 / 4-way battle`

Importante:

- `2v2` es solo un nombre visual
- no hay equipos reales
- se muestran 4 canciones y eliges exactamente 1 ganadora

### Tamanos

`1v1`:

- `16`
- `32`
- `64`
- `128`
- `256`

`2v2 / 4-way battle`:

- `16`
- `64`
- `256`

Si no hay suficientes canciones importadas, la app desactiva esos tamanos.

### Estrategias de seleccion

Puedes elegir:

- aleatorio
- mas nuevas por fecha de lanzamiento
- mas antiguas por fecha de lanzamiento
- mas nuevas anadidas a la playlist
- mas antiguas anadidas a la playlist

La app no ofrece seleccion por popularidad porque Spotify ha retirado ese dato de las respuestas disponibles para apps en modo desarrollo.

### Durante el torneo

La pantalla muestra:

- ronda actual
- progreso
- canciones restantes
- enfrentamiento actual
- historial de enfrentamientos jugados
- historial de torneos completados con top 3

Ademas, en medio de un torneo puedes:

- `Salir del torneo`
- `Reiniciar torneo`

Regla importante:

- si sales o reinicias antes de terminar, ese intento no se registra en el historial de torneos
- tampoco suma victorias internas al ranking

### Campeona y desempates

Cuando una cancion gana un enfrentamiento:

- avanza a la siguiente ronda

Cuando el torneo termina:

- se calcula cuantas victorias logro cada cancion dentro de ese torneo
- se guardan de forma permanente
- sirven para desempatar el ranking entre canciones con la misma nota

Es decir:

- durante el torneo las victorias aun no se consolidan
- solo se consolidan al finalizarlo

## 3. Actualizar datos

Este bloque controla la conexion con Spotify y la sincronizacion local.

### Flujo

1. Si necesitas importar o actualizar datos, pulsas `Conectar Spotify`
2. Haces login con Spotify si no tienes una sesion valida
3. Pegas la URL de tu playlist
4. Pulsas `Importar playlist` o `Actualizar datos`

Matiz importante:

- el login con Spotify solo es necesario para importar o actualizar datos desde Spotify
- si ya tienes canciones guardadas en local, puedes usar `Canciones` y `Torneo` sin reconectar en ese momento
- si la sesion ha caducado y quieres actualizar otra vez, entonces si tendras que reconectar

### Que hace la app al actualizar

- consulta Spotify
- trae toda la playlist paginando canciones
- anade solo canciones nuevas
- mantiene las notas ya guardadas
- mantiene las victorias internas ya guardadas
- no borra canciones antiguas de la app

Si una cancion ya no aparece en Spotify:

- no desaparece de la app
- queda marcada como `Fuera de playlist`

### Regla de playlist unica

La app trabaja con una sola playlist.

Eso significa:

- la primera playlist importada queda fijada
- si pegas otra playlist distinta, la app la rechaza
- si Spotify cambia el enlace pero sigue siendo la misma playlist, puedes usar el nuevo enlace

### Errores

Si falla Spotify, la app muestra un popup con el motivo.

Ejemplos:

- URL invalida
- login fallido
- token caducado
- error `401`
- error `403`
- playlist distinta
- playlist vacia

## Datos que quedan guardados

La app guarda en `localStorage`:

- sesion de Spotify
- playlist importada
- canciones
- notas
- victorias de torneo
- progreso del torneo
- historial de actualizaciones

## Flujo recomendado de uso

1. Abre `Abrir Playlist Arena.bat`
2. Entra en `Actualizar datos`
3. Conecta Spotify
4. Actualiza la playlist
5. Revisa `Canciones de la ultima actualizacion`
6. Usa `Anadir puntuacion` para las nuevas
7. Consulta `Ranking`
8. Juega un `Torneo` cuando quieras

Para cerrar la app local, vuelve a la ventana del lanzador y pulsa `Ctrl+C`.
