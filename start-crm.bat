@echo off
cd /d "%~dp0"
title Admission CRM Server

netstat -an | findstr ":3000 " | findstr "LISTENING" >nul 2>&1
if %errorlevel%==0 (
  echo CRM already running - opening window...
  start msedge --app=http://localhost:3000 --window-size=1280,800
  exit
)

echo Starting Admission CRM...
for /f "tokens=2 delims=:" %%A in ('ipconfig ^| findstr /c:"IPv4 Address"') do set IP=%%A
echo Manager : http://localhost:3000
echo Staff   : http://%IP%:3000
echo.
echo Keep this window open.
start /b npm start
timeout /t 3 /nobreak >nul
start msedge --app=http://localhost:3000 --window-size=1280,800
