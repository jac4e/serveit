import { join, dirname } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';

export const __backendPath = join(dirname(fileURLToPath(import.meta.url)), '../');
export const __projectPath = join(__backendPath, '../');
export const __frontendPath = join(__projectPath, 'app');
export const __savePath = join(__projectPath, 'data');
export const __nodeModulesPath = join(__projectPath, 'node_modules');
export const __configPath = join(__savePath, 'config');
export const __templatePath = join(__backendPath, 'views/templates');
export const __logPath = join(__savePath, 'logs');
if (!existsSync(__savePath)) {
    mkdirSync(__savePath);
}
if (!existsSync(__configPath)) {
    mkdirSync(__configPath);
}
