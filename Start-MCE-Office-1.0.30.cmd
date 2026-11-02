@echo off
setlocal
title MCE Office 1.0.30
set "MCE_PACKAGE_DIR=%~dp0"
set "MCE_PACKAGE_NAME=MCE-Office-1.0.30-portable.exe"
set "MCE_PACKAGE_HASH=ff89230b4785e6599f49b1ec8b271441b4f4c4efbcb36a0b7fdbf1262124e7b3"
if not exist "%~dp0parts\MCE-Office-1.0.30-portable.exe.000.part" goto missing
if not exist "%~dp0parts\MCE-Office-1.0.30-portable.exe.001.part" goto missing
if not exist "%~dp0parts\MCE-Office-1.0.30-portable.exe.002.part" goto missing
if not exist "%~dp0parts\MCE-Office-1.0.30-portable.exe.003.part" goto missing
if not exist "%~dp0parts\MCE-Office-1.0.30-portable.exe.004.part" goto missing
if not exist "%~dp0parts\MCE-Office-1.0.30-portable.exe.005.part" goto missing
echo MCE Office 1.0.30 wird vorbereitet. Bitte kurz warten...
copy /y /b "%~dp0parts\MCE-Office-1.0.30-portable.exe.000.part"+"%~dp0parts\MCE-Office-1.0.30-portable.exe.001.part"+"%~dp0parts\MCE-Office-1.0.30-portable.exe.002.part"+"%~dp0parts\MCE-Office-1.0.30-portable.exe.003.part"+"%~dp0parts\MCE-Office-1.0.30-portable.exe.004.part"+"%~dp0parts\MCE-Office-1.0.30-portable.exe.005.part" "%~dp0%MCE_PACKAGE_NAME%.joining" >nul
if errorlevel 1 goto failed
powershell.exe -NoProfile -NonInteractive -Command "$ErrorActionPreference='Stop'; $p=Join-Path $env:MCE_PACKAGE_DIR ($env:MCE_PACKAGE_NAME+'.joining'); if ((Get-FileHash -LiteralPath $p -Algorithm SHA256).Hash -ne $env:MCE_PACKAGE_HASH) { exit 1 }"
if errorlevel 1 goto failed
move /y "%~dp0%MCE_PACKAGE_NAME%.joining" "%~dp0%MCE_PACKAGE_NAME%" >nul
if errorlevel 1 goto failed
echo Pruefung erfolgreich. MCE Office startet...
start "" "%~dp0%MCE_PACKAGE_NAME%"
exit /b 0
:missing
echo Bitte zuerst die ZIP-Datei vollstaendig mit "Alle extrahieren" entpacken.
echo Die Datei Start-MCE-Office-1.0.30.cmd und der Ordner parts muessen zusammen bleiben.
pause
exit /b 1
:failed
echo Das Paket konnte nicht erstellt oder geprueft werden.
echo Bitte die ZIP-Datei erneut herunterladen und vollstaendig entpacken.
echo Es wurde keine ungepruefte Anwendung gestartet.
pause
exit /b 1
