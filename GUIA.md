# Guía de uso — Playlist Arena (para Pablo)

Guía para manejar el proyecto tú solo, sin depender de nadie.

---

## 1. La idea clave: hay DOS cosas separadas

| | Qué es | Dónde vive | Cómo se cambia |
|---|---|---|---|
| **La app (el código)** | Cómo se ve y funciona la web | GitHub → la publica **Vercel** | Cambiando el código y subiéndolo (push) |
| **Los datos** | Las canciones y las notas de la gente | **Supabase** (base de datos) | Solos, en tiempo real (puntuar, sincronizar) |

**Lo más importante de entender:**
- La **web pública** (`https://playlist-arena.vercel.app`) y tu **app local** (`http://127.0.0.1:3000`) usan **la MISMA base de datos** (Supabase).
- Por eso, cuando **sincronizas la playlist** desde tu local, las canciones nuevas aparecen **al instante en la web** para todos. **No hace falta "desplegar" ni tocar nada más.**
- Solo necesitas "actualizar la app" (deploy) cuando se cambia el **código** (una función nueva, un arreglo). Eso normalmente lo hacemos juntos.

---

## 2. La web pública (lo que usa la gente)

- URL: **https://playlist-arena.vercel.app**
- Está **siempre encendida**. No tienes que abrirla ni cerrarla. Vercel la mantiene online 24/7 gratis.
- Cualquiera entra ahí, se registra con email y contraseña, y puntúa.
- Para el uso del día a día (tú o tus amigos puntuando), **se usa esta web**, no el local.

---

## 3. Abrir la app en LOCAL (en tu ordenador)

Solo necesitas el local para **2 cosas**: sincronizar tu playlist desde Spotify, o probar cambios antes de publicarlos.

**Forma fácil:**
1. Entra en la carpeta `torneo`.
2. Doble clic en **`Abrir Playlist Arena.bat`**.
3. Se abre una ventana negra (déjala abierta) y, a los ~5 segundos, el navegador en `http://127.0.0.1:3000`.

> La primera vez puede tardar un poco (instala cosas). Las siguientes es rápido.

**Forma manual (si el .bat falla):**
1. Abre PowerShell o la terminal en la carpeta `torneo`.
2. Escribe: `npm run dev`
3. Abre el navegador en `http://127.0.0.1:3000`

---

## 4. Cerrar la app local

- Ve a la **ventana negra** (la terminal donde se está ejecutando) y pulsa **`Ctrl + C`**.
- O simplemente **cierra esa ventana**.
- Cerrar el local **no apaga la web pública** — esa sigue online siempre.

---

## 5. Sincronizar la playlist (añadir/actualizar canciones)

Esto **solo lo puedes hacer tú** (eres el dueño) y **desde el local**:
1. Abre el local (paso 3) en **`http://127.0.0.1:3000`** (importante: `127.0.0.1`, no `localhost`).
2. Inicia sesión con tu cuenta.
3. Ve a **"Administrar playlist"** → **Conectar Spotify** → pega la URL de tu playlist → **Importar/Actualizar**.
4. Listo: las canciones se guardan en la base de datos y **aparecen en la web para todos al momento**. No hay que hacer nada más.

---

## 6. Actualizar la APP (cambios de código / nuevas funciones)

Esto es cuando cambia el **código** (no los datos). Normalmente lo hacemos juntos, pero así funciona:

1. Se cambia el código en la carpeta `torneo`.
2. Se "sube" a GitHub con estos 3 comandos (en la terminal, dentro de `torneo`):
   ```
   git add -A
   git commit -m "describe el cambio"
   git push
   ```
3. **Vercel detecta el push y redespliega solo** en ~1-2 minutos. La web pública se actualiza sola.

**Alternativa sin comandos:** desde el panel de Vercel (vercel.com → tu proyecto → Deployments) puedes ver los despliegues y volver a desplegar con un botón.

---

## 7. ¿Cuándo necesito el local y cuándo no?

| Quiero... | ¿Necesito el local? |
|---|---|
| Puntuar canciones (tú o tus amigos) | ❌ No — se usa la web |
| Ver el ranking / dashboard | ❌ No — la web |
| **Sincronizar la playlist desde Spotify** | ✅ Sí — desde el local |
| Probar un cambio antes de publicarlo | ✅ Sí — desde el local |

---

## 8. Si algo va mal

- **"El puerto 3000 está en uso"**: ya hay una ventana del local abierta. Ciérrala (Ctrl+C) y vuelve a abrir.
- **La web da error tras un cambio**: probablemente el build falló en Vercel. En vercel.com → tu proyecto → Deployments, el último saldrá en rojo con el error.
- **No encuentro Node.js**: hay que tener instalado Node.js (LTS) desde nodejs.org. Ya lo tienes (`node v24`).
- **Las claves/secretos**: están en el archivo `.env.local` (en tu ordenador) y en las *Environment Variables* de Vercel. Nunca se suben a GitHub. No los compartas.

---

## Resumen de 30 segundos

- **Usar la app** → web: `https://playlist-arena.vercel.app` (siempre encendida).
- **Abrir local** → doble clic en `Abrir Playlist Arena.bat`. **Cerrar** → `Ctrl + C` en la ventana negra.
- **Añadir canciones** → desde el local, "Administrar playlist". Aparece en la web al instante.
- **Cambiar la app** → `git push` → Vercel redespliega solo.
