import { Config, Environment, ProcessVariables, ProcessVariablesDefined } from "./config.type";
import { getProductionConfig } from "./configs/production.config.js";
import { getDevelopmentConfig } from "./configs/development.config.js";
import logger from "../_helpers/logger.js";

export const config = getConfig(process.env as unknown as ProcessVariables);

export function getConfig(processVariables: ProcessVariables): Config {
    const environment: Environment = processVariables.NODE_ENV as Environment;
    switch (environment) {
        case "production":
            logger.info('Loading production configuration')
            return getProductionConfig(processVariables);
        case "development":
            logger.info('Loading development configuration')
            return getDevelopmentConfig(processVariables);
        default:
            logger.info('Loading development configuration')
            return getDevelopmentConfig(processVariables);
    }
}

export function isDatabaseConfigGood(processVariables: ProcessVariables): processVariables is ProcessVariablesDefined {
    if (processVariables.DB_URL === undefined) {
        return false;
    }
    if (processVariables.DB_PORT === undefined) {
        return false;
    }
    if (processVariables.DB_USER === undefined) {
        return false;
    }
    if (processVariables.DB_PASS === undefined) {
        return false;
    }
    return true
}

export function isBackendConfigGood(processVariables: ProcessVariables) {
    if (processVariables.BACKEND_URL === undefined) {
        return false;
    }
    if (processVariables.BACKEND_PORT === undefined) {
        return false;
    }
    if (processVariables.JWT_SECRET === undefined) {
        return false;
    }
    return true

}

export function saveConfig(config: Config) {

}