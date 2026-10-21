@echo off
rem Liga o leitor do WhatsApp neste computador (so na primeira vez, ou se o WhatsApp Web desconectar).
rem Abre o Edge do leitor: escaneie o QR code com o celular (WhatsApp > Aparelhos conectados > Conectar um aparelho).
cd /d "%~dp0"
echo Fechando o leitor automatico, se estiver rodando...
powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \"Name='msedge.exe'\" | Where-Object { $_.CommandLine -match 'whatsapp-perfil' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }"
node scripts\leitor-whatsapp.mjs --login
echo.
pause