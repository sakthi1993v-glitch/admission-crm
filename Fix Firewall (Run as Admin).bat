@echo off
echo Adding firewall rule for Admission CRM...
netsh advfirewall firewall delete rule name="Admission CRM Port 3000" >nul 2>&1
netsh advfirewall firewall add rule name="Admission CRM Port 3000" protocol=TCP dir=in localport=3000 action=allow profile=any
echo.
echo Done! Staff mobile la link open agum now.
pause
