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
- Por eso, cuando **sincronizas la playlist** (desde la web o el local, da igual), las canciones nuevas aparecen **al instante** para todos. **No hace falta "desplegar" ni tocar nada más.**
- Solo necesitas "actualizar la app" (deploy) cuando se cambia el **código** (una función nueva, un arreglo). Eso normalmente lo hacemos juntos.

---

## 2. La web pública (lo que usa la gente)

- URL: **https://playlist-arena.vercel.app**
- Está **siempre encendida**. No tienes que abrirla ni cerrarla. Vercel la mantiene online 24/7 gratis.
- Cualquiera entra ahí, se registra con email y contraseña, y puntúa.
- Para el uso del día a día (tú o tus amigos puntuando), **se usa esta web**, no el local.

---

## 3. Abrir la app en LOCAL (en tu ordenador)

Ya casi no necesitas el local: puntuar y **sincronizar la playlist** se hacen desde la web. El local solo hace falta para **probar cambios de código antes de publicarlos** (algo que normalmente hacemos juntos).

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

Esto **solo lo puedes hacer tú** (eres el dueño). Ya puedes hacerlo **directamente desde la web**, sin abrir el local:

1. Entra en **https://playlist-arena.vercel.app** e inicia sesión con tu cuenta.
2. Ve a **"Administrar playlist"** → **Conectar Spotify** → pega la URL de tu playlist → **Importar/Actualizar**.
3. Listo: las canciones se guardan en la base de datos y **aparecen para todos al momento**. No hay que hacer nada más.

> También puedes sincronizar desde el local (`http://127.0.0.1:3000`, ojo: `127.0.0.1`, no `localhost`) si lo prefieres. Da igual desde dónde lo hagas: la base de datos es la misma.
>
> Solo tu cuenta puede conectar Spotify (estás en *User Management* de la app de Spotify). Si en el futuro añades a otra persona como dueña, tendrás que añadir su cuenta de Spotify ahí.

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
| **Sincronizar la playlist desde Spotify** | ❌ No — ya se hace desde la web |
| Probar un cambio de código antes de publicarlo | ✅ Sí — desde el local |

---

## 8. Si algo va mal

- **"El puerto 3000 está en uso"**: ya hay una ventana del local abierta. Ciérrala (Ctrl+C) y vuelve a abrir.
- **La web da error tras un cambio**: probablemente el build falló en Vercel. En vercel.com → tu proyecto → Deployments, el último saldrá en rojo con el error.
- **No encuentro Node.js**: hay que tener instalado Node.js (LTS) desde nodejs.org. Ya lo tienes (`node v24`).
- **Las claves/secretos**: están en el archivo `.env.local` (en tu ordenador) y en las *Environment Variables* de Vercel. Nunca se suben a GitHub. No los compartas.

---

## 9. Rollback (volver atrás si un cambio sale mal)

Si publicas algo y la web empieza a fallar, hay dos formas de volver al estado bueno anterior. **Siempre antes de publicar algo arriesgado, creamos un punto de respaldo** (un "tag" y una rama en git que apuntan a la versión que funcionaba).

### Punto de respaldo actual
- **Tag**: `estable-pre-orientacion`
- **Rama**: `respaldo-pre-orientacion`
- Apuntan a la producción estable de antes de las mejoras de orientación/copy (el último cambio publicado).
- Cada función publicada deja su propio punto: `…amigosfase2`, `…fixvictorias`, `…puntito`, `…reproductor`, `…paginacion`, `…orientacion`… (siempre puedes volver a cualquiera con `estable-pre-<nombre>`).

### Método 1 — Vercel (rápido, recomendado, sin git)
Es lo más fácil y es **instantáneo**:
1. Entra en **vercel.com** → tu proyecto → pestaña **Deployments**.
2. Busca el último deploy que funcionaba bien (los de antes salen con su fecha).
3. En su menú **⋯** → **Promote to Production** (o **Rollback**).
4. En segundos, la web vuelve a esa versión. (Esto no toca el código en GitHub, solo lo que se sirve.)

### Método 2 — git (volver el código al punto de respaldo)
Si quieres que el **código** vuelva al punto estable (en la terminal, dentro de `torneo`):
```
git checkout main
git reset --hard estable-pre-orientacion
git push origin main --force
```
Vercel detecta el push y redespliega ese estado estable. El trabajo nuevo no se pierde: sigue guardado en su rama (p. ej. `orientacion-ux`), listo para arreglarlo y volver a intentarlo.

> ⚠️ El `--force` reescribe la rama `main`. Úsalo solo para esto (rollback) y solo si el Método 1 no te vale. Si dudas, usa siempre el Método 1 (Vercel).

### Crear un punto de respaldo nuevo (para la próxima vez)
Antes de publicar algo arriesgado, estando en `main` actualizado:
```
git tag -a respaldo-AAAA-MM-DD -m "Estable antes de X"
git branch respaldo-AAAA-MM-DD-rama
git push origin respaldo-AAAA-MM-DD
git push origin respaldo-AAAA-MM-DD-rama
```
(Cambia `AAAA-MM-DD` por la fecha.) Así siempre tienes a dónde volver.

---

## Resumen de 30 segundos

- **Usar la app** → web: `https://playlist-arena.vercel.app` (siempre encendida).
- **Añadir canciones** → desde la web, "Administrar playlist" → Conectar Spotify. Aparece para todos al instante.
- **Abrir local** (solo para probar cambios de código) → doble clic en `Abrir Playlist Arena.bat`. **Cerrar** → `Ctrl + C` en la ventana negra.
- **Cambiar la app** → `git push` → Vercel redespliega solo.
