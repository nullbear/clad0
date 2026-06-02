@echo off
setlocal

:: ── clad0 server launcher ────────────────────────────────────────────────────
:: Double-click this file to start the Field Journal of the Throat server.
:: Requires Node.js (https://nodejs.org) to be installed.
:: The viewer will open automatically in your default browser.

title clad0 — Field Journal of the Throat

:: Check Node.js is available
where node >nul 2>&1
if errorlevel 1 (
    echo.
    echo  ERROR: Node.js is not installed or not on your PATH.
    echo.
    echo  Please download and install it from:
    echo      https://nodejs.org
    echo.
    echo  After installing, restart this script.
    echo.
    pause
    exit /b 1
)

:: Show Node version
for /f "tokens=*" %%v in ('node --version') do set NODE_VER=%%v
echo.
echo  clad0 ^| Field Journal of the Throat
echo  Node.js %NODE_VER%
echo.

:: Change to the directory this .bat lives in
cd /d "%~dp0"

:: Check the server file exists
if not exist "server.js" (
    echo  ERROR: server.js not found in %~dp0
    echo  Make sure start.bat is in the same folder as server.js.
    echo.
    pause
    exit /b 1
)

:: Pick a port (default 3000, override with SET PORT=xxxx before running)
if "%PORT%"=="" set PORT=3000

echo  Starting server on http://localhost:%PORT%
echo  Press Ctrl+C to stop.
echo.

:: Open the browser after a short delay (1 second)
start "" /min cmd /c "timeout /t 1 >nul && start http://localhost:%PORT%"

:: Start the server (blocking — stays open in this window)
node server.js

echo.
echo  Server stopped.
pause
