import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const rootPackagePath = path.join(rootDir, 'package.json');
const cliPackagePath = path.join(rootDir, 'packages/cli/package.json');

const [rootPackage, cliPackage] = await Promise.all([
  readPackageJson(rootPackagePath),
  readPackageJson(cliPackagePath),
]);

rootPackage.version = cliPackage.version;

await fs.writeFile(rootPackagePath, `${JSON.stringify(rootPackage, null, 2)}\n`);

async function readPackageJson(path) {
  return JSON.parse(await fs.readFile(path, 'utf8'));
}
