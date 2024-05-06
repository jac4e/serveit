import { join, dirname } from 'path';
import { existsSync, mkdirSync, readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import logger from './logger.js';

export const __backendPath = join(dirname(fileURLToPath(import.meta.url)), '../');
export const __projectPath = join(__backendPath, '../');
export const __frontendPath = join(__projectPath, 'app');
export const __savePath = join(__projectPath, 'data');
export const __configPath = join(__savePath, 'config');
export const __templatePath = join(__backendPath, 'templates');
export const __logPath = join(__savePath, 'logs');
if (!existsSync(__savePath)) {
    mkdirSync(__savePath);
}
if (!existsSync(__configPath)) {
    mkdirSync(__configPath);
}
