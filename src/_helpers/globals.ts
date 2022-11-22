import { join, dirname } from 'path';
import { existsSync, mkdirSync, readFileSync } from 'fs';
import { fileURLToPath } from 'url';

export const __distPath = dirname(fileURLToPath(import.meta.url));
export const __projectPath = join(__distPath, '../');
export const __appPath = join(__projectPath, '../app');
export const __savePath = join(__projectPath, '../data');
if (!existsSync(__savePath)) {
    mkdirSync(__savePath);
}

export const __pkg = JSON.parse(readFileSync(join(__distPath,'../../package.json'), 'utf-8'));