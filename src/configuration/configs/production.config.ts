import { isBackendConfigGood, isDatabaseConfigGood } from "../config.js";
import { BackendConfig, Config, DatabaseConfig, ProcessVariables } from "../config.type";

export function getProductionConfig(processVariables: ProcessVariables): Config {
    if (!isDatabaseConfigGood(processVariables)) {
        throw 'Database configuration not completed, please set the appropriate environment variables'
    }
    if (!isBackendConfigGood(processVariables)) {
        throw 'Backend configuration not completed, please set the appropriate environment variables'
    }
    const database: DatabaseConfig = {
        url: processVariables.DB_URL,
        port: processVariables.DB_PORT,
        user: processVariables.DB_USER,
        pass: processVariables.DB_PASS,
        name: "spendit-db",
    }
    const backend: BackendConfig = {
        url: processVariables.BACKEND_URL,
        includeApp: processVariables.INCLUDE_APP === "true" ? true : false,
        port: parseInt(processVariables.BACKEND_PORT),
        jwt: processVariables.JWT_SECRET,
    }
  return {
    environment: "production",
    database: database,
    backend: backend
  };
}