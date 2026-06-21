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
- **Amigos Fase 1**: añadir por @usuario, aceptar/rechazar, lista de amigos.
- Recuperar contraseña por email (`/reset`). Optimización de rendimiento (memo).

## En curso / próximo
### Tweaks UI (pedidos, a montar en rama)
- "Añadir puntuación" en Canciones: ponerlo en su **propia caja** (ahora se confunde con los filtros).
- Amigos: botón **"Eliminar amigo"** con confirmación ("¿Seguro? Tendrás que volver a mandar solicitud para ver sus datos").

### Amigos Fase 2 (la grande)
- Ver el **top 10** de cada amigo y sus **torneos de la semana** (+ posiciones).
- Decisión tomada: **privado entre amigos**. Implica:
  - Las notas individuales pasan a verse solo por ti + tus amigos.
  - La **media pública** se calcula en el servidor (vista/función Postgres `song_rating_stats`), no leyendo todas las notas en el cliente.
  - Persistir los **torneos en la base de datos** (ahora son locales por dispositivo) para poder mostrar los de los amigos.

## Más adelante
- Email fiable: montar **Gmail SMTP** (app password, sin dominio) y reactivar la confirmación de email.
- Trocear `components/playlist-arena-app.tsx` (es grande).
- Paginar/virtualizar listas muy largas si vuelve a ir lento.
- Estadísticas extra en el dashboard.

## Recordatorios de operación
- `main` = lo desplegado; mientras haya testers, trabajar en ramas y publicar (merge + push) solo cuando se diga.
- Siempre `npm run build` antes de publicar.
- Ritual de deploy seguro + rollback: ver [GUIA.md](GUIA.md) §9.
- Cuenta de prueba: `test-claude@example.com` / `test123456` (@usuario `testclaude`).
