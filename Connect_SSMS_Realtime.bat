@echo off
chcp 65001 >nul
title NOIR ^& CREAM - SQL Server (SSMS .\SQLEXPRESS01) Realtime Sync
echo ======================================================================
echo   NOIR ^& CREAM — ระบบเชื่อมต่อ SQL Server (.\SQLEXPRESS01) แบบ Realtime
echo ======================================================================
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0sync-ssms-realtime.ps1"
pause
