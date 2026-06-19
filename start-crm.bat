@echo off
cd /d "%~dp0"
title Admission CRM Server
echo Starting Admission CRM...
echo.
echo Manager: http://localhost:3000
for /f "tokens=2 delims=:" %%A in ('ipconfig ^| findstr /c:"IPv4 Address"') do (
  echo Staff mobile: http://%%A:3000
)
echo.
echo Keep this window open while using the app.
echo.
start /b npm start
timeout /t 3 /nobreak >nul
start msedge --app=http://localhost:3000 --window-size=1280,800
