@echo off

start cmd /k "npm start"

timeout /t 1.2 /nobreak >nul

start http://localhost:3000

exit