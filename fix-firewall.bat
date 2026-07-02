@echo off
echo Adding Windows Firewall rules for Rurban development...
netsh advfirewall firewall add rule name="Node.js Dev - Port 3000" dir=in action=allow protocol=TCP localport=3000
netsh advfirewall firewall add rule name="Node.js Dev - Port 8081" dir=in action=allow protocol=TCP localport=8081
netsh advfirewall firewall add rule name="Node.js Dev - Port 8082" dir=in action=allow protocol=TCP localport=8082
echo.
echo Done! Firewall rules added successfully.
echo You can now close this window.
pause
