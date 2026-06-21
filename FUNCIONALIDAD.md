# Funcionalidad Actual

## Objetivo

Playlist Arena es una app web **multiusuario** sobre **una única playlist compartida** de Spotify. Cada persona inicia sesión, puntúa canciones y todos ven la media de la comunidad y el ranking conjunto. El dueño es quien mantiene la playlist sincronizada desde Spotify.

- Datos compartidos (canciones, notas, victorias de torneo): en **Supabase**.
- Torneos: el **progreso e historial completo** van por persona en `localStorage`; al completar un torneo, su **resultado final** (campeón + top 3) también se guarda en **Supabase** (`tournament_results`) para que tus amigos lo vean.

## Acceso y cuentas

- Pantalla de **bienvenida** ("BACHATA") → **Iniciar sesión** / **Registrarse**.
- Registro e inicio de sesión con **email y contraseña** (Supabase Auth).
- **@usuario único**: la primera vez que entras, eliges un @usuario (minúsculas, único). Sirve para que tus amigos te añadan sin confundir nombres repetidos.
- **Recuperar contraseña**: enlace "¿Olvidaste tu contraseña?" → email → página `/reset`.
- Confirmación de email: configurable en Supabase; actualmente desactivada (moderación manual).
- Roles: **dueño** (sincroniza la playlist y ve administración) y **usuarios** (leen y puntúan).

## Estructura

Tras entrar, cinco apartados: **Canciones**, **Artistas**, **Torneo**, **Amigos** y **Estado de la playlist** (Administrar playlist para el dueño).

En Canciones, arriba, se muestran las **Novedades**: las 10 canciones de **lanzamiento más reciente** (con su fecha completa). Al pulsar una carátula se abre en Spotify.

## Canciones

Dos subapartados: **Búsqueda** y **Ranking**. (La detección de repetidas y la última actualización se movieron a "Administrar playlist", solo para el dueño.)

### Búsqueda

- Buscar por título, artista, álbum o año.
- **Ordenar por**: fecha añadida a la playlist, fecha de salida, alfabético, ranking (tu nota) o ranking global (media de todos).
- Filtros: estado de nota (todas / solo puntuadas / solo sin puntuar), nota mínima y nota máxima.
  - La nota mínima/máxima filtra según el contexto: por la **media de todos** si estás ordenando por ranking global, por **tu nota** en el resto (la etiqueta lo indica).
- Desplegar cada canción para ver sus datos, tu nota, la media de la comunidad (con nº de votos) y abrir en Spotify.
- **Añadir puntuación**: flujo que te muestra una canción **sin puntuar al azar** (no sigue ningún orden) y avanza a otra aleatoria al guardar.

### Ranking

- Selector **"Mi nota" / "Media de todos"**.
- Orden: por la nota elegida; en empate, por **victorias de torneo de todas las personas**; si sigue el empate, alfabético.
- Las canciones sin esa nota quedan al final.

## Puntuaciones

- De `0` a `10` con **un solo decimal** (el campo no deja meter dos decimales, p. ej. `9.23` no es válido).
- Cada nota se guarda en la base de datos asociada a tu cuenta.
- La **media de la comunidad** se recalcula al instante (tu propia nota) y con un refresco periódico + realtime para ver las de los demás.

## Artistas

Apartado propio. Lista de todos los artistas de la playlist (incluye colaboraciones) con:
- Tu **nota media** del artista y la **media de todos** (según sus canciones puntuadas).
- Nº de canciones.
- **Buscar** por artista y **ordenar** por: tu nota, media de todos, alfabético o nº de canciones.
- Abrir un artista muestra **sus canciones** (puntuables, con su preview de Spotify).

## Amigos

Apartado para conectar con otra gente de la app:
- **Añadir por @usuario**: escribes el @usuario y envías solicitud.
- **Solicitudes recibidas**: aceptar o rechazar.
- **Solicitudes enviadas** y **lista de amigos**.
- **Eliminar amigo** (con confirmación): deja de ser amigos; para volver a ver sus datos hay que mandar solicitud de nuevo.
- **Ver perfil** de un amigo (Fase 2): su **top 10** de canciones (sus mejores notas) y sus **torneos de esta semana** con el podio (campeón + top 3).
- **Privacidad (Opción A "blanda")**: la **media del ranking sigue siendo de todos** (amigos y no amigos), igual que siempre. Lo "entre amigos" es poder ver el **detalle** (notas y torneos) de tus amigos aceptados; la app solo muestra ese detalle de amigos. (Un blindaje "duro" a nivel de base de datos queda pendiente para el futuro, si se abre la app a desconocidos.)

## Preview de Spotify

En el detalle de cada canción, en el flujo "Añadir puntuación" y en cada canción del torneo hay un **reproductor oficial incrustado de Spotify** que suena la preview de 30s sin necesidad de login (para quien tenga sesión Premium en su navegador, suena entera).

## Torneo

Usa las canciones de la playlist compartida; el progreso del torneo se guarda en local (por persona).

### Modos y tamaños

- `1v1`: 2 canciones, eliges 1. Tamaños 16, 32, 64, 128, 256.
- `2v2 / 4-way`: 4 canciones, eliges 1. Tamaños 16, 64, 256.

### Estrategias de selección

- **Aleatorio**: cualquier canción.
- **Antiguas (más de 6 años)**: solo canciones lanzadas hace más de 6 años, **elegidas al azar** (el torneo no es siempre el mismo).
- **Nuevas (últimos 6 años)**: solo canciones de los últimos 6 años, también al azar.

Si pides un tamaño mayor que las canciones disponibles de ese grupo (p. ej. 256 "antiguas" pero solo hay 225), sale una **pantalla** avisando de que no es posible y de que bajes la cantidad.

### Durante el torneo

- Cada canción del enfrentamiento tiene un botón **"Abrir en Spotify"** para escucharla antes de votar.
- Se ve ronda, progreso, restantes, historial de enfrentamientos y archivo de torneos completados (con top 3).
- Puedes **Salir** o **Reiniciar** el torneo.

### Victorias y desempate

- Durante el torneo solo avanza el bracket.
- Al **completarlo**, se cuentan las victorias de cada canción y se guardan en la base de datos compartida (`tournament_song_wins`).
- Ese total **global** (de todas las personas) desempata el ranking entre canciones con la misma nota.
- Si sales o reinicias antes de terminar, no se registran victorias ni queda en el historial.

## Administrar playlist (solo dueño)

- **Conectar Spotify** (OAuth PKCE) y pegar la URL de la playlist → sincroniza las canciones a la base de datos compartida.
- Sincroniza solo nuevas, marca como "fuera de playlist" las que ya no están, y no borra datos.
- Herramientas del dueño: **canciones de la última actualización** y **canciones repetidas** (duplicadas por mismo título + mismo artista principal).
- La sincronización se puede hacer desde la web (en producción) o desde local.

## Dashboard (`/dashboard`)

- KPIs: total de canciones, tus puntuadas, duración total, tu nota media y la **media de todos**.
- **Top de la semana · por victorias**: canciones con más victorias en torneos de todos en los últimos 7 días.
- Distribución de tus notas, **Top 10 por tu nota** y **Top 10 por media de todos**, estadísticas de torneos y campeones recurrentes.

## Errores controlados

- URL de playlist inválida, login de Spotify fallido, token caducado (`401`/`403`), playlist distinta a la fijada, playlist vacía, y canciones insuficientes para el torneo (con pantalla de aviso). Los fallos de Spotify se muestran en un popup.
