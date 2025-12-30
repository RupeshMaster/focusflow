@echo off
echo Starting Local Server for FocusFlow...
echo Please open the URL shown below in your browser (usually http://127.0.0.1:8080)
echo.
call npx http-server -c-1 .
pause
