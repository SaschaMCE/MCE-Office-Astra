"""Make a single GitHub branch ZIP download without exceeding Git's file limit."""
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
version = json.loads((ROOT / 'app/package.json').read_text())['version']
name = f'MCE-Office-{version}-portable.exe'
source = ROOT / 'dist' / name
output = ROOT / 'dist' / f'download-{version}'
parts_dir = output / 'parts'
parts_dir.mkdir(parents=True, exist_ok=True)
with source.open('rb') as stream:
    expected = hashlib.file_digest(stream, 'sha256').hexdigest()
parts = []
with source.open('rb') as stream:
    while chunk := stream.read(25 * 1024 * 1024):
        part = parts_dir / f'{name}.{len(parts):03}.part'
        part.write_bytes(chunk)
        parts.append(part)
joined_hash = hashlib.sha256()
for part in parts:
    joined_hash.update(part.read_bytes())
assert joined_hash.hexdigest() == expected
assert sum(p.stat().st_size for p in parts) == source.stat().st_size
joined = '+'.join(f'"%~dp0parts\\{part.name}"' for part in parts)
checks = '\n'.join(f'if not exist "%~dp0parts\\{part.name}" goto missing' for part in parts)
command = f'''@echo off
setlocal
title MCE Office {version}
set "MCE_PACKAGE_DIR=%~dp0"
set "MCE_PACKAGE_NAME={name}"
set "MCE_PACKAGE_HASH={expected}"
{checks}
echo MCE Office {version} wird vorbereitet. Bitte kurz warten...
copy /y /b {joined} "%~dp0%MCE_PACKAGE_NAME%.joining" >nul
if errorlevel 1 goto failed
powershell.exe -NoProfile -NonInteractive -Command "$ErrorActionPreference='Stop'; $p=Join-Path $env:MCE_PACKAGE_DIR ($env:MCE_PACKAGE_NAME+'.joining'); if ((Get-FileHash -LiteralPath $p -Algorithm SHA256).Hash -ne $env:MCE_PACKAGE_HASH) {{ exit 1 }}"
if errorlevel 1 goto failed
move /y "%~dp0%MCE_PACKAGE_NAME%.joining" "%~dp0%MCE_PACKAGE_NAME%" >nul
if errorlevel 1 goto failed
echo Pruefung erfolgreich. MCE Office startet...
start "" "%~dp0%MCE_PACKAGE_NAME%"
exit /b 0
:missing
echo Bitte zuerst die ZIP-Datei vollstaendig mit "Alle extrahieren" entpacken.
echo Die Datei Start-MCE-Office-{version}.cmd und der Ordner parts muessen zusammen bleiben.
pause
exit /b 1
:failed
echo Das Paket konnte nicht erstellt oder geprueft werden.
echo Bitte die ZIP-Datei erneut herunterladen und vollstaendig entpacken.
echo Es wurde keine ungepruefte Anwendung gestartet.
pause
exit /b 1
'''
(output / f'Start-MCE-Office-{version}.cmd').write_bytes(command.replace('\n', '\r\n').encode('ascii'))
(output / 'BITTE-LESEN.txt').write_text(
    f'MCE Office {version}\n\n'
    '1. Rechtsklick auf die heruntergeladene ZIP-Datei: Alle extrahieren.\n'
    '2. Den entpackten Ordner oeffnen.\n'
    f'3. Start-MCE-Office-{version}.cmd doppelt anklicken.\n\n'
    'Der Starter setzt die mitgelieferten Teile zusammen, prueft die Datei\n'
    'und startet MCE Office. Dafuer ist kein Internet erforderlich.\n'
    f'Bei spaeteren Starts kannst du direkt {name} oeffnen.\n\n'
    'SHA256:\n' + expected + '\n', encoding='utf-8')
(output / 'SHA256SUMS.txt').write_text(''.join(
    f'{hashlib.sha256(p.read_bytes()).hexdigest()}  parts/{p.name}\n' for p in parts))
print(f'Created {output.relative_to(ROOT)}: {len(parts)} verified parts and a checksum-verifying starter.')
