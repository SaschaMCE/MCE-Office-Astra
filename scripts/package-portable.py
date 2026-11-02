"""Rebuild the original Windows launcher/ZIP/footer format without executing it."""
import hashlib
import io
import json
from pathlib import Path
import shutil
import struct
import sys
import zipfile

ROOT = Path(__file__).resolve().parents[1]
ORIGINAL_SHA256 = '1c5078f41a05a2cd7bd542452d879bcbc3e4fa538a43359d68d0081c533fb9b1'

def header_hash(archive):
    length = struct.unpack_from('<I', archive, 12)[0]
    header = archive[16:16 + length]
    json.loads(header)
    return hashlib.sha256(header).hexdigest()

def digest(path):
    with path.open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()

def main():
    if len(sys.argv) != 2:
        raise SystemExit('Usage: npm run package -- /path/to/MCE-Office-1.0.28-portable.exe (run npm run build first)')
    original = Path(sys.argv[1]).resolve()
    if digest(original) != ORIGINAL_SHA256:
        raise SystemExit('Original executable checksum does not match the inspected 1.0.28 release.')
    version = json.loads((ROOT / 'app/package.json').read_text())['version']
    archive = (ROOT / 'dist/app.asar').read_bytes()
    with original.open('rb') as stream:
        stream.seek(-32, 2)
        footer = stream.read(32)
        assert footer[24:] == b'MCEOFFC1'
        old_length = struct.unpack_from('<Q', footer)[0]
        prefix_length = original.stat().st_size - 32 - old_length
        stream.seek(0)
        launcher = stream.read(prefix_length)
    output_zip = ROOT / f'dist/MCE-Office-{version}-windows.zip'
    output_exe = ROOT / f'dist/MCE-Office-{version}-portable.exe'
    with zipfile.ZipFile(original) as source, zipfile.ZipFile(output_zip, 'w', zipfile.ZIP_DEFLATED, compresslevel=6) as target:
        old_archive = source.read('resources\\app.asar')
        old_hash = header_hash(old_archive)
        new_hash = header_hash(archive)
        for entry in source.infolist():
            data = source.read(entry)
            if entry.filename == 'resources\\app.asar':
                data = archive
            elif entry.filename == 'MCE Office.exe':
                # Electron's embedded ASAR integrity must be updated for our newly
                # built app; integrity checking itself stays enabled.
                record = json.dumps([{'file':'resources\\app.asar','alg':'SHA256','value':old_hash}], separators=(',', ':')).encode()
                assert data.count(record) == 1, 'Original Electron integrity resource did not match its ASAR header'
                new_record = record.replace(old_hash.encode(), new_hash.encode())
                data = data.replace(record, new_record)
                assert len(new_record) == len(record)
            target.writestr(entry.filename.replace('\\', '/'), data)
    with zipfile.ZipFile(output_zip) as check:
        assert check.testzip() is None
        assert check.read('resources/app.asar') == archive
        runtime = check.read('MCE Office.exe')
        assert new_record in runtime and record not in runtime
    # A unique 16-character cache key prevents the launcher reusing the old app.
    build_id = hashlib.sha256(archive).hexdigest()[:16].encode('ascii')
    assert build_id != footer[8:24]
    with output_exe.open('wb') as target, output_zip.open('rb') as source:
        target.write(launcher)
        shutil.copyfileobj(source, target)
        target.write(struct.pack('<Q', output_zip.stat().st_size) + build_id + b'MCEOFFC1')
    with output_exe.open('rb') as stream:
        stream.seek(-32, 2)
        rebuilt_footer = stream.read(32)
        rebuilt_length = struct.unpack_from('<Q', rebuilt_footer)[0]
        offset = output_exe.stat().st_size - 32 - rebuilt_length
        assert offset == prefix_length and rebuilt_footer[24:] == b'MCEOFFC1'
        stream.seek(offset)
        # Validate the exact bounded ZIP stream read by the .NET launcher.
        with zipfile.ZipFile(io.BytesIO(stream.read(rebuilt_length))) as check:
            assert check.testzip() is None
            assert check.read('resources/app.asar') == archive
    files = [output_exe, output_zip, ROOT / 'dist/app.asar']
    (ROOT / 'dist/SHA256SUMS.txt').write_text(''.join(f'{digest(file)}  {file.name}\n' for file in files))
    print(f'Built {output_exe.name} and {output_zip.name}; archive CRCs, launcher footer, and ASAR integrity verified.')

if __name__ == '__main__':
    main()
