// This configuration is only for things required for serveit to actually start
// Things like SSL, database, etc.

import { Config, Environment, ProcessVariables, ProcessVariablesDefined } from "./config.type";
import { getProductionConfig } from "./configs/production.config.js";
import { getDevelopmentConfig } from "./configs/development.config.js";
import { join } from 'path';
import { readFile } from 'fs';
import logger from "../_helpers/logger.js";
import { __projectPath } from "../_helpers/globals.js";

export const __envConfig = getEnvConfig(process.env as unknown as ProcessVariables);

export function getEnvConfig(processVariables: ProcessVariables): Config {
    const environment: Environment = processVariables.NODE_ENV as Environment;
    switch (environment) {
        case "production":
            logger.info('Loading production configuration')
            if (!defineProcessVariables(processVariables)){
                return {} as Config;
            }
            return getProductionConfig(processVariables);
        case "development":
            logger.info('Loading development configuration')
            return getDevelopmentConfig(processVariables);
        default:
            logger.info('Loading development configuration')
            return getDevelopmentConfig(processVariables);
    }
}

// Returns a JSON config files when it exists.
export async function getFileConfig(location: string, name: string, onError: (err, interval) => void): Promise<{ [key: string]: any; }> {
    const path = join(location, name);
    // Somehow wait until path exists then return the configuration
    return new Promise((resolve, reject) => {
        const configWait = setInterval(() => {
            // Read config
            const configFile = readFile(path, 'utf-8', (err, configData) => {
                if ( err !== null){
                    onError(err, configWait);
                    return;
                }
                clearInterval(configWait);
                resolve(JSON.parse(configData));
            });
        }, 1000);
    });
}

export function defineProcessVariables(processVariables: ProcessVariables): processVariables is ProcessVariablesDefined {
    if(processVariables.SELFSIGN === undefined) {
        throw "Environment variable SELFSIGN must be defined";
    }
    if(processVariables.CF_TOKEN === undefined) {
        throw "Environment variable CF_TOKEN must be defined";
    }
    // if(processVariables.MAINTAINER === undefined) {
    //     throw "Environment variable MAINTAINER must be defined";
    // }
    if(processVariables.NODE_ENV === undefined) {
        throw "Environment variable NODE_ENV must be defined";
    }
    if(processVariables.DB_URL === undefined) {
        throw "Environment variable DB_URL must be defined";
    }
    if(processVariables.DB_PORT === undefined) {
        throw "Environment variable DB_PORT must be defined";
    }
    if(processVariables.DB_USER === undefined) {
        throw "Environment variable DB_USER must be defined";
    }
    if(processVariables.INCLUDE_APP === undefined) {
        throw "Environment variable INCLUDE_APP must be defined";
    }
    if(processVariables.DB_PASS === undefined) {
        throw "Environment variable DB_PASS must be defined";
    }
    if(processVariables.BACKEND_DOMAIN === undefined) {
        throw "Environment variable BACKEND_URL must be defined";
    }
    if(processVariables.BACKEND_PORT === undefined) {
        throw "Environment variable BACKEND_PORT must be defined";
    }
    return true
}

export function saveFileConfig(config: Config) {

}

// Setup package.json configuration
const pkgConfig = await getFileConfig(__projectPath,'package.json', (err, interval) => {
    logger.error(err);
    process.exit(1);
});
export const __pkg = pkgConfig