# Siguientes Pasos

Estado del proyecto. En producción (https://playlist-arena.vercel.app) con gente probándolo.

## Hecho y desplegado
- Multiusuario con login propio (email/contraseña) sobre Supabase + pantalla de bienvenida ("BACHATA").
- **@usuario único** por persona (pantalla "elige tu @usuario" al entrar la primera vez).
- Playlist compartida; sync solo del dueño (web o local).
- Notas personales + media de la comunidad (1 decimal), tiempo real.
- Ranking doble (tu nota / media de todos) + desempate por victorias globales.
- Apartado **Artistas** (media y ranking por artista).
- Torneos con estrategias por edad al azar, aviso si faltan canciones, "Abrir en Spotify".
- **Preview de Spotify** (reproductor incrustado oficial) en detalle, al puntuar y en torneo.
- **Dashboard** + **top semanal por victorias**.
- **Amigos Fase 1**: añadir por @usuario, aceptar/rechazar, **eliminar amigo** (con confirmación), lista de amigos.
- **Amigos Fase 2**: **"Ver perfil"** de cada amigo → su **top 10** y sus **torneos de la semana** (podio). El resultado final de cada torneo se guarda en la BD (`tournament_results`).
- **Puntito** de aviso de solicitudes de amistad pendientes en el menú Amigos.
- **Reproductor de Spotify coordinado**: al darle play a una canción, las demás se **pausan solas** (vía IFrame API; arregla el solape en móvil).
- "Añadir puntuación" en su **propia caja** dentro de Canciones.
- **Fix de victorias de torneo duplicadas** (el doble-disparo al completar ya no duplica).
- Recuperar contraseña por email (`/reset`). Optimización de rendimiento (memo).

### Privacidad de Amigos — decisión tomada
- **Opción A "blanda" (hecha):** la media del ranking sigue siendo de **todos**; lo "entre amigos" es solo poder ver el detalle (top 10 + torneos) de tus amigos aceptados.
- **Opción B "dura" (futuro):** si abres la app a desconocidos, blindar las notas individuales a self+amigos y mover la media a una vista/función en el servidor (`song_rating_stats`).

## Más adelante
- **Privacidad dura (Opción B)** — solo si se abre a desconocidos.
- **Candado en BD para victorias**: `unique(user_id, tournament_id, song_entry_id)` en `tournament_song_wins` (defensa extra; el doble-disparo ya está resuelto en el cliente).
- Email fiable: montar **Gmail SMTP** (app password, sin dominio) y reactivar la confirmación de email.
- Trocear `components/playlist-arena-app.tsx` (es grande).
- Paginar/virtualizar listas muy largas si vuelve a ir lento.
- Estadísticas extra en el dashboard.

## Recordatorios de operación
- `main` = lo desplegado; mientras haya testers, trabajar en ramas y publicar (merge + push) solo cuando se diga.
- Siempre `npm run build` antes de publicar.
- Ritual de deploy seguro + rollback: ver [GUIA.md](GUIA.md) §9.
- Cuenta de prueba: `test-claude@example.com` / `test123456` (@usuario `testclaude`).
