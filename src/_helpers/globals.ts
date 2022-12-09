import { join, dirname } from 'path';
import { existsSync, mkdirSync, readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import logger from './logger.js';

export const __backendPath = join(dirname(fileURLToPath(import.meta.url)), '../');
export const __projectPath = join(__backendPath, '../');
export const __frontendPath = join(__projectPath, 'app');
export const __savePath = join(__projectPath, 'data');
export const __configPath = join(__savePath, 'config');
if (!existsSync(__savePath)) {
    mkdirSync(__savePath);
}
if (!existsSync(__configPath)) {
    mkdirSync(__configPath);
}

// Returns a JSON config files if it exists, if it doesnt exist it returns undefined.
export function readConfig(location: string, name: string): { [key: string]: any; } | undefined {
    const path = join(location, name);

    // Check if path exists
    if (!existsSync(path)) {
        return undefined;
    }

    // Read config
    const configFile = readFileSync(path, 'utf-8');
    return JSON.parse(configFile);
}

const pkgConfig = readConfig(__projectPath,'package.json');
if (pkgConfig === undefined) {
    logger.error('package.json not found!');
    process.exit(1);
}
export const __pkg = pkgConfig