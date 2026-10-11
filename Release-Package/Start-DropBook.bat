@echo off
title DropBook Fleet & Parcel Management ERP
cd /d "%~dp0"
if exist "win-unpacked\DropBook.exe" (
    start "" "win-unpacked\DropBook.exe"
) else if exist "DropBook-windows.exe" (
    start "" "DropBook-windows.exe"
) else if exist "DropBook-Setup.exe" (
    start "" "DropBook-Setup.exe"
)
