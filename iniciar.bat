@echo off
rem Abre o Sistema Solida no navegador (servidor local, sem instalar nada).
rem Se o servidor cair por algum erro, ele reinicia sozinho. Para encerrar, feche esta janela.
title Sistema Solida - deixe esta janela aberta
cd /d "%~dp0"
set ABRIR=-AbrirNavegador
:inicio
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0servidor.ps1" %ABRIR%
set CODIGO=%errorlevel%
if "%CODIGO%"=="0" exit /b
if "%CODIGO%"=="3" (
  echo.
  echo Nao foi possivel abrir o sistema. Tire um print desta janela e mande para o suporte.
  pause
  exit /b
)
echo.
echo O servidor parou ^(codigo %CODIGO%; detalhes em dados\servidor-log.txt^). Reiniciando em 5 segundos...
timeout /t 5 /nobreak >nul
set ABRIR=
goto inicio
