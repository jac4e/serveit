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

export function saveConfig(config: Config) {

}