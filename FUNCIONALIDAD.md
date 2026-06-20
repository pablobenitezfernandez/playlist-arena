# Funcionalidad Actual

## Objetivo

Playlist Arena es una app web **multiusuario** sobre **una única playlist compartida** de Spotify. Cada persona inicia sesión, puntúa canciones y todos ven la media de la comunidad y el ranking conjunto. El dueño es quien mantiene la playlist sincronizada desde Spotify.

- Datos compartidos (canciones, notas, victorias de torneo): en **Supabase**.
- Torneos (en curso e historial): por persona, en `localStorage`.

## Acceso y cuentas

- Registro e inicio de sesión con **email y contraseña** (Supabase Auth).
- **Recuperar contraseña**: enlace "¿Olvidaste tu contraseña?" en el login → email con enlace → página `/reset` para poner una nueva.
- Confirmación de email: configurable en Supabase; actualmente desactivada (moderación manual).
- Roles: **dueño** (sincroniza la playlist y ve administración) y **usuarios** (leen y puntúan).

## Estructura

Tras entrar, tres apartados: **Canciones**, **Torneo** y **Estado de la playlist** (Administrar playlist para el dueño).

En Canciones, arriba, se muestran las **Novedades**: las 10 canciones de **lanzamiento más reciente** (con su fecha completa). Solo aparece dentro de Canciones.

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
- Distribución de tus notas, **Top 10 por tu nota** y **Top 10 por media de todos**, estadísticas de torneos y campeones recurrentes.

## Errores controlados

- URL de playlist inválida, login de Spotify fallido, token caducado (`401`/`403`), playlist distinta a la fijada, playlist vacía, y canciones insuficientes para el torneo (con pantalla de aviso). Los fallos de Spotify se muestran en un popup.
