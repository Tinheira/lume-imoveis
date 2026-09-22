@echo off
cd /d "%~dp0"
if not exist node_modules (
  echo Instalando dependencias, aguarde...
  call npm install
)
echo.
echo Abrindo o site em http://localhost:5173  (feche esta janela para parar)
call npm run dev -- --open
pause
