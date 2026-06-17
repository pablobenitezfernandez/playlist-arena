# Siguientes Pasos

## Objetivo

Este documento recoge lo siguiente:

- que falta para poder validar bien la app
- que conviene instalar o preparar
- mejoras funcionales
- mejoras tecnicas
- orden recomendado de trabajo

## 1. Preparacion del entorno

El entorno local ya tiene `Node.js` y `npm` instalados. La app se ha validado correctamente con `npm run lint` y `npm run build`, y puede arrancarse en `http://127.0.0.1:3000`.

Antes de avanzar de verdad con ejecucion y validaciones, conviene tener:

### Imprescindible

- `Node.js` instalado
- `npm` disponible
- archivo `.env.local` creado

Contenido de `.env.local`:

```bash
NEXT_PUBLIC_SPOTIFY_CLIENT_ID=
NEXT_PUBLIC_SPOTIFY_REDIRECT_URI=http://127.0.0.1:3000/callback
```

Spotify ya no acepta `localhost` como redirect local. Hay que usar `127.0.0.1`.

### Recomendable

- `git` instalado para llevar control de cambios
- navegador con sesion de Spotify lista para pruebas reales

## 2. Instalaciones pendientes

Ya se ha ejecutado `npm install` y existe `package-lock.json`.

Para ejecutar la app localmente:

1. hacer doble clic en `Abrir Playlist Arena.bat`
2. mantener abierta la ventana del lanzador mientras uses la app
3. probar login, sync, filtros y torneo

Alternativa manual:

```bash
npm run dev -- -H 127.0.0.1
```

Si se arranca manualmente, conviene fijar tambien el puerto para que coincida con Spotify:

```bash
npm run dev -- -H 127.0.0.1 -p 3000
```

## 3. Validaciones pendientes

Validaciones hechas:

- `npm install`
- `npm run lint`
- `npm run build`
- arranque local en `127.0.0.1:3000`

Validaciones pendientes con datos reales:

1. probar callback de Spotify tras limpiar sesion
2. probar import inicial
3. probar actualizacion con canciones nuevas
4. probar caso de playlist sin cambios
5. probar canciones eliminadas de Spotify
6. probar torneo completo en ambos modos

## 4. Mejoras funcionales recomendadas

### Prioridad alta

- vista de `Ranking` con mas estadisticas
- filtro por rango visual mas comodo
- resumen mas claro de canciones eliminadas de la playlist
- vista de detalles de ultima actualizacion con mas contexto

### Prioridad media

- sistema de exportacion de ranking a `CSV` o `JSON`
- estadisticas por artista
- estadisticas por album
- top canciones por nota
- top canciones por victorias internas
- contador de canciones aun sin puntuar

### Prioridad media-alta

- accion guiada para revisar solo las canciones nuevas sin nota
- confirmacion visual antes de borrar una cancion archivada
- mensajes tipo toast ademas del popup de errores

### Prioridad futura

- varias playlists archivadas sin mezclar datos
- comparativas entre notas y victorias
- panel de analitica
- historial de cambios de nota por cancion

## 5. Mejoras tecnicas recomendadas

### Refactor de interfaz

`components/playlist-arena-app.tsx` es el centro de casi toda la app. Conviene separarlo mas.

Division recomendada:

- `songs-section.tsx`
- `tournament-section.tsx`
- `updates-section.tsx`
- `song-filters.tsx`
- `sync-history-panel.tsx`

### Refactor de estado

Conviene extraer logica compartida a hooks o helpers:

- hook de filtros
- hook de sincronizacion
- hook de torneo
- helper de ordenacion del ranking

### Calidad y pruebas

Pendientes tecnicos utiles:

- pruebas unitarias de `lib/tournament.ts`
- pruebas unitarias de `lib/spotify.ts` en la parte de merge
- pruebas de regresion para filtros
- pruebas de persistencia de `localStorage`

### Robustez de datos

Mejoras aconsejables:

- migraciones de datos mas explicitas en `storage`
- control mas estricto de fechas incompletas
- normalizacion extra para repetidas

## 6. Mejoras concretas que encajan muy bien con tu idea

Por como has planteado la app, estas mejoras tienen mucho sentido:

1. `Ranking` con mas personalidad visual
2. `Modo repaso` para puntuar solo canciones nuevas
3. `Panel de repetidas` con resumen por grupos
4. `Historial de notas` para ver si cambiaste mucho una cancion con el tiempo
5. `Estadisticas de torneo` para ver que canciones rinden mejor aunque no tengan la mejor nota

## 7. Orden recomendado de trabajo

### Fase 1

- limpiar datos del navegador si se quiere empezar de cero
- probar login y sincronizacion real con la playlist propia
- revisar el primer import completo

### Fase 2

- probar todos los filtros
- probar ranking y desempates
- probar canciones fuera de playlist

### Fase 3

- refactorizar el componente principal
- anadir pruebas basicas

### Fase 4

- mejorar UX
- anadir exportaciones
- anadir estadisticas avanzadas

## 8. Siguiente paso recomendado

El mejor siguiente paso practico es este:

1. limpiar `localStorage` del navegador si quieres empezar completamente de cero
2. recargar `http://127.0.0.1:3000`
3. conectar Spotify
4. importar tu playlist
5. revisar juntos cualquier ajuste visual o funcional que salga de esa prueba
