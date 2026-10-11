@echo off
title DropBook Windows Installer Builder
echo ========================================================
echo   DROPBOOK - BUILDING PRODUCTION WINDOWS SETUP INSTALLER
echo ========================================================
echo.

echo 1. Checking Node.js and dependencies...
call npm install
if %errorlevel% neq 0 (
    echo [ERROR] npm install failed. Please ensure Node.js is installed.
    pause
    exit /b %errorlevel%
)

echo.
echo 2. Building Official Windows NSIS Installer (DropBook-Setup.exe)...
call npm run build:win
if %errorlevel% neq 0 (
    echo [ERROR] Build failed.
    pause
    exit /b %errorlevel%
)

echo.
echo ========================================================
echo [SUCCESS] Windows Setup Installer created successfully!
echo Location: %~dp0dist\DropBook-Setup.exe
echo ========================================================
echo.
pause
