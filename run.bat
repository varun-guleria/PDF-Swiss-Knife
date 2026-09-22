@echo off
title PDF Swiss-Knife
cd /d "%~dp0"

echo ============================================================
echo   Starting PDF Swiss-Knife...
echo ============================================================

where python >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Python was not found in your PATH.
    echo Please install Python 3.10+ from https://www.python.org/
    echo and ensure "Add Python to PATH" is checked during installation.
    echo.
    pause
    exit /b 1
)

python run.py
if %ERRORLEVEL% neq 0 (
    echo.
    echo [INFO] App exited with code %ERRORLEVEL%.
    pause
)
