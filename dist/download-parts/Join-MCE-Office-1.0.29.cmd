@echo off
setlocal
set "APP=MCE-Office-1.0.29-portable.exe"
copy /b "%~dp0%APP%.000.part"+"%~dp0%APP%.001.part"+"%~dp0%APP%.002.part"+"%~dp0%APP%.003.part"+"%~dp0%APP%.004.part"+"%~dp0%APP%.005.part" "%~dp0%APP%"
if errorlevel 1 (
  echo The files could not be joined. Check that all six .part files are in this folder.
  pause
  exit /b 1
)
echo.
echo Done. Starting MCE Office 1.0.29...
start "" "%~dp0%APP%"
