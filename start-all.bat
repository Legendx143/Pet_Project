@echo off
echo Starting Pet-Care Frontend and Backend...

start "Pet-Care Backend" cmd /k "cd Backend && npm run dev"
start "Pet-Care Frontend" cmd /k "cd Frontend && npm run dev"

echo Both servers are starting in separate windows.
