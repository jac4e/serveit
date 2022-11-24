import { join, dirname } from 'path';
import { existsSync, mkdirSync, readFileSync } from 'fs';
import { fileURLToPath } from 'url';

export const __distPath = join(dirname(fileURLToPath(import.meta.url)), '../');
export const __projectPath = join(__distPath, '../');
export const __appPath = join(__projectPath, 'app');
export const __savePath = join(__projectPath, 'data');
export const __configPath = join(__savePath, 'config');
if (!existsSync(__savePath)) {
    mkdirSync(__savePath);
}
if (!existsSync(__configPath)) {
    mkdirSync(__configPath);
}

export const __pkg = JSON.parse(readFileSync(join(__projectPath,'package.json'), 'utf-8'));