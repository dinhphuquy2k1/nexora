@echo off
setlocal
cd /d "%~dp0"
if "%~1"=="--prebuilt" (docker compose -f compose.release.yml down) else (docker compose down)
if errorlevel 1 exit /b 1
echo Da dung. Du lieu van duoc giu trong volumes.
