@echo off
setlocal

cd /d "%~dp0"
set "PATH=C:\Program Files\nodejs;%PATH%"

where node >nul 2>nul
if errorlevel 1 (
  echo No se ha encontrado Node.js.
  echo Instala Node.js LTS o reinicia Windows si lo acabas de instalar.
  pause
  exit /b 1
)

where npm >nul 2>nul
if errorlevel 1 (
  echo No se ha encontrado npm.
  echo Instala Node.js LTS o reinicia Windows si lo acabas de instalar.
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo Instalando dependencias...
  call npm install
  if errorlevel 1 (
    echo No se pudieron instalar las dependencias.
    pause
    exit /b 1
  )
)

echo.
echo Playlist Arena se abrira en el navegador.
echo Mantener esta ventana abierta mientras uses la app.
echo Para cerrar la app, vuelve aqui y pulsa Ctrl+C.
echo.

start "" powershell -NoProfile -WindowStyle Hidden -Command "Start-Sleep -Seconds 5; Start-Process 'http://127.0.0.1:3000'"

call npm run dev -- -H 127.0.0.1 -p 3000

endlocal
