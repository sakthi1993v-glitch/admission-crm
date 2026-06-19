@echo off
echo Stopping Admission CRM node server...
for /f "tokens=5" %%A in ('netstat -ano ^| findstr ":3000"') do (
  taskkill /F /PID %%A
)
echo Done.
pause
