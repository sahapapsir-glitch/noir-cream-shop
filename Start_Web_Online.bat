@echo off
setlocal EnableExtensions
chcp 65001 >nul
cd /d "%~dp0"

if not defined PORT set "PORT=3000"
set "APP_PORT=%PORT%"
set "TUNNEL_TARGET=http://127.0.0.1:%APP_PORT%"
set "CF_BIN="

title NOIR ^& CREAM - Web ^& Cloudflare Quick Tunnel

echo ======================================================================
echo   NOIR ^& CREAM — เปิดเว็บพร้อม Cloudflare Quick Tunnel (Online)
echo ======================================================================
echo.

where node >nul 2>&1
if errorlevel 1 goto :NO_NODE

node --disable-warning=ExperimentalWarning -e "require('node:sqlite')" >nul 2>&1
if errorlevel 1 goto :BAD_NODE_VERSION

if not exist "node_modules\express\package.json" goto :INSTALL_DEPS
goto :CHECK_DB

:INSTALL_DEPS
echo [เตรียมระบบ] ยังไม่พบ node_modules — กำลังติดตั้งแพ็กเกจด้วย npm install ...
call npm install
if errorlevel 1 goto :NPM_FAIL
echo.

:CHECK_DB
if exist "shop.db" goto :CHECK_CF
echo [เตรียมฐานข้อมูล] ยังไม่พบ shop.db — กำลังสร้างข้อมูลเริ่มต้น...
call npm run seed
if errorlevel 1 goto :SEED_FAIL
echo.

:CHECK_CF
call :FIND_CLOUDFLARED
if defined CF_BIN goto :CF_FOUND

echo [!] ไม่พบโปรแกรม cloudflared (Cloudflare Tunnel) ในเครื่อง
where winget >nul 2>&1
if errorlevel 1 goto :NO_CLOUDFLARED_MANUAL

echo.
set "INSTALL_CF=N"
set /p "INSTALL_CF=ต้องการติดตั้ง cloudflared อัตโนมัติผ่าน winget ตอนนี้หรือไม่? (Y/N): "
if /i "%INSTALL_CF%"=="Y" goto :INSTALL_CLOUDFLARED
if /i "%INSTALL_CF%"=="YES" goto :INSTALL_CLOUDFLARED
goto :NO_CLOUDFLARED_MANUAL

:INSTALL_CLOUDFLARED
echo.
echo กำลังติดตั้ง Cloudflare.cloudflared ผ่าน winget ...
winget install --id Cloudflare.cloudflared -e --accept-source-agreements --accept-package-agreements
call :FIND_CLOUDFLARED
if defined CF_BIN goto :CF_FOUND
echo.
echo [!] ติดตั้งเสร็จแล้ว แต่ยังไม่พบ cloudflared ใน PATH ปัจจุบัน
echo     กรุณาปิดหน้าต่างนี้ แล้วเปิด Start_Web_Online.bat ใหม่อีกครั้ง
echo.
pause
exit /b 1

:CF_FOUND
echo [OK] พบ cloudflared: %CF_BIN%
echo.
echo [1/2] กำลังตรวจสอบ Web Server ที่พอร์ต %APP_PORT% ...

node -e "const n=require('net'),s=n.connect(+process.argv[1]||3000,'127.0.0.1',()=>{s.destroy();process.exit(0)});s.on('error',()=>process.exit(1));setTimeout(()=>process.exit(1),1200)" %APP_PORT% >nul 2>&1
if not errorlevel 1 goto :SERVER_ALREADY_RUNNING

node -e "const n=require('net'),s=n.connect(+process.argv[1]||3000,'::1',()=>{s.destroy();process.exit(0)});s.on('error',()=>process.exit(1));setTimeout(()=>process.exit(1),1200)" %APP_PORT% >nul 2>&1
if not errorlevel 1 goto :SERVER_ALREADY_IPV6

echo [1/2] กำลังเปิด Web Server (พอร์ต %APP_PORT%) ในหน้าต่างใหม่...
start "NOIR & CREAM - Web Server (Port %APP_PORT%)" /D "%~dp0" cmd /c "chcp 65001 >nul & node --disable-warning=ExperimentalWarning server.js || (echo. & echo [ERROR] Web Server หยุดทำงานกะทันหัน & pause)"

echo       กำลังรอให้ Web Server พร้อมใช้งาน...
node -e "const n=require('net'),p=+process.argv[1]||3000,end=Date.now()+15000;(function t(){const s=n.connect(p,'127.0.0.1',()=>{s.destroy();process.exit(0)});s.on('error',()=>{s.destroy();if(Date.now()>end)process.exit(1);setTimeout(t,300)})})()" %APP_PORT% >nul 2>&1
if errorlevel 1 goto :SERVER_WAIT_TIMEOUT
echo [OK] Web Server พร้อมใช้งานแล้วที่ http://localhost:%APP_PORT%
goto :START_TUNNEL

:SERVER_WAIT_TIMEOUT
echo [คำเตือน] Web Server ใช้เวลาเปิดนานกว่าปกติ หรือเกิดข้อผิดพลาด
echo           กรุณาตรวจสอบในหน้าต่าง "NOIR & CREAM - Web Server"
set "CONT_TUNNEL=N"
set /p "CONT_TUNNEL=ต้องการเปิด Cloudflare Quick Tunnel ต่อเลยหรือไม่? (Y/N): "
if /i "%CONT_TUNNEL%"=="Y" goto :START_TUNNEL
if /i "%CONT_TUNNEL%"=="YES" goto :START_TUNNEL
goto :DONE

:SERVER_ALREADY_IPV6
set "TUNNEL_TARGET=http://localhost:%APP_PORT%"

:SERVER_ALREADY_RUNNING
echo [OK] พบ Web Server ทำงานอยู่ที่พอร์ต %APP_PORT% อยู่แล้ว (%TUNNEL_TARGET%)

:START_TUNNEL
echo.
echo [2/2] กำลังเปิด Cloudflare Quick Tunnel ไปยัง %TUNNEL_TARGET% ...
echo.
echo ======================================================================
echo   ลิงก์ออนไลน์ (https://xxxx.trycloudflare.com) จะแสดงด้านล่างในไม่กี่วินาที
echo   * เปิดหน้าต่างนี้ และหน้าต่าง Web Server ค้างไว้ตลอดการใช้งาน
echo   * กด Ctrl+C หรือปิดหน้าต่างนี้เมื่อต้องการหยุด Quick Tunnel
echo ======================================================================
echo.

"%CF_BIN%" tunnel --url "%TUNNEL_TARGET%"
if not errorlevel 1 goto :DONE

echo.
echo [!] Cloudflare Quick Tunnel หยุดทำงานหรือเชื่อมต่อไม่สำเร็จ
set "RETRY_HTTP2=N"
set /p "RETRY_HTTP2=ต้องการลองเชื่อมต่อใหม่ด้วยโหมด HTTP/2 (แก้ปัญหาเน็ตบางแห่งบล็อก UDP/QUIC) หรือไม่? (Y/N): "
if /i "%RETRY_HTTP2%"=="Y" goto :START_TUNNEL_HTTP2
if /i "%RETRY_HTTP2%"=="YES" goto :START_TUNNEL_HTTP2
goto :DONE_PAUSE

:START_TUNNEL_HTTP2
echo.
echo กำลังเปิด Cloudflare Quick Tunnel (โหมด HTTP/2) ไปยัง %TUNNEL_TARGET% ...
echo.
"%CF_BIN%" tunnel --protocol http2 --url "%TUNNEL_TARGET%"
if errorlevel 1 goto :DONE_PAUSE
goto :DONE

:FIND_CLOUDFLARED
if exist "%~dp0cloudflared.exe" set "CF_BIN=%~dp0cloudflared.exe"
if defined CF_BIN goto :eof
where cloudflared >nul 2>&1
if not errorlevel 1 set "CF_BIN=cloudflared"
if defined CF_BIN goto :eof
if exist "%ProgramFiles%\cloudflared\cloudflared.exe" set "CF_BIN=%ProgramFiles%\cloudflared\cloudflared.exe"
if defined CF_BIN goto :eof
if exist "%ProgramFiles(x86)%\cloudflared\cloudflared.exe" set "CF_BIN=%ProgramFiles(x86)%\cloudflared\cloudflared.exe"
if defined CF_BIN goto :eof
if exist "%LocalAppData%\Microsoft\WinGet\Links\cloudflared.exe" set "CF_BIN=%LocalAppData%\Microsoft\WinGet\Links\cloudflared.exe"
if defined CF_BIN goto :eof
if exist "%LocalAppData%\cloudflared\cloudflared.exe" set "CF_BIN=%LocalAppData%\cloudflared\cloudflared.exe"
if defined CF_BIN goto :eof
if exist "%USERPROFILE%\scoop\shims\cloudflared.exe" set "CF_BIN=%USERPROFILE%\scoop\shims\cloudflared.exe"
if defined CF_BIN goto :eof
if exist "%ProgramData%\chocolatey\bin\cloudflared.exe" set "CF_BIN=%ProgramData%\chocolatey\bin\cloudflared.exe"
goto :eof

:NO_NODE
echo [ERROR] ไม่พบ Node.js ในเครื่อง
echo         กรุณาติดตั้ง Node.js เวอร์ชัน 22.13 ขึ้นไป จาก https://nodejs.org
echo.
pause
exit /b 1

:BAD_NODE_VERSION
echo [ERROR] Node.js เวอร์ชันปัจจุบันไม่รองรับ node:sqlite (ต้องใช้ Node.js 22.13 ขึ้นไป)
node -v
echo         กรุณาอัปเดต Node.js จาก https://nodejs.org
echo.
pause
exit /b 1

:NPM_FAIL
echo.
echo [ERROR] ติดตั้งแพ็กเกจด้วย npm install ไม่สำเร็จ
echo.
pause
exit /b 1

:SEED_FAIL
echo.
echo [ERROR] สร้างฐานข้อมูลเริ่มต้นด้วย npm run seed ไม่สำเร็จ
echo.
pause
exit /b 1

:NO_CLOUDFLARED_MANUAL
echo.
echo วิธีติดตั้ง cloudflared:
echo   1. เปิด PowerShell หรือ CMD แล้วรันคำสั่ง:
echo      winget install --id Cloudflare.cloudflared -e
echo   2. หรือดาวน์โหลดจาก:
echo      https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/
echo      (ดาวน์โหลด cloudflared-windows-amd64.exe แล้วเปลี่ยนชื่อเป็น cloudflared.exe วางในโฟลเดอร์นี้)
echo.
pause
exit /b 1

:DONE_PAUSE
echo.
pause

:DONE
endlocal
exit /b 0
