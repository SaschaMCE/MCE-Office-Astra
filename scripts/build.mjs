import {createPackage, getRawHeader, listPackage, extractFile} from '@electron/asar';
import {mkdir, readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root = fileURLToPath(new URL('../', import.meta.url));
const output = path.join(root, 'dist', 'app.asar');
await mkdir(path.dirname(output), {recursive:true});
await createPackage(path.join(root, 'app'), output);
for (const file of listPackage(output)) {
  const name = file.replace(/^[/\\]/, '');
  // Entries without an extension can be directories; inspect through the header.
  let entry = getRawHeader(output).header;
  for (const part of name.split(/[/\\]/)) entry = entry.files[part];
  if (entry.files) continue;
  const packaged = extractFile(output, name);
  const source = await readFile(path.join(root, 'app', name));
  if (!packaged.equals(source)) throw new Error(`Archive mismatch: ${name}`);
  if (entry.integrity?.hash !== createHash('sha256').update(source).digest('hex')) throw new Error(`Integrity mismatch: ${name}`);
}
console.log('Built and verified dist/app.asar');
