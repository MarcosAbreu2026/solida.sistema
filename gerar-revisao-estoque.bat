@echo off
rem Gera a proxima revisao da planilha de ferramentas (R61, R62...) com as contagens feitas no site. Nao mexe na revisao atual.
rem Para so ver o que mudaria: gerar-revisao-estoque.bat -Simular
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\gerar-revisao-estoque.ps1 %*
echo.
pause
