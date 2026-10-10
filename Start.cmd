@echo off
setlocal
cd /d "%~dp0"
docker info >nul 2>&1
if errorlevel 1 (echo Can cai va mo Docker Desktop. & exit /b 1)
docker compose version >nul 2>&1
if errorlevel 1 (echo Can Docker Compose v2. & exit /b 1)
if "%~1"=="--prebuilt" (docker compose -f compose.release.yml up -d --wait --wait-timeout 180) else (docker compose up --build -d --wait --wait-timeout 180)
if errorlevel 1 (echo Khoi dong that bai. Chay docker compose logs de xem loi. & exit /b 1)
echo Nexora da san sang: http://localhost:3001
start "" "http://localhost:3001"
