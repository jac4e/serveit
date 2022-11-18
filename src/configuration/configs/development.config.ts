import { BackendConfig, Config, DatabaseConfig, ProcessVariables } from "../config.type";
import { randomBytes } from 'crypto';

export function getDevelopmentConfig(processVariables: ProcessVariables ): Config {
    const database: DatabaseConfig = {
        url: processVariables.DB_URL ?? "localhost",
        port: processVariables.DB_PORT ?? "27017",
        user: processVariables.DB_USER ?? "",
        pass: processVariables.DB_PASS ?? "",
        name: "spendit-dev-db",
    }
    const backend: BackendConfig = {
        url: processVariables.BACKEND_URL ?? "http://localhost:3000",
        port: parseInt(processVariables.BACKEND_PORT ?? "3000"),
        includeApp: processVariables.INCLUDE_APP === "true" ? true : false,
        jwt: processVariables.JWT_SECRET ?? randomBytes(96).toString('hex'),
    }
  return {
    environment: "development",
    database: database,
    backend: backend,
  };
}