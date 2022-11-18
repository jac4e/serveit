// import { Level } from "pino";

export type Environment = "production" | "development";

export interface DatabaseConfig {
    url: string;
    port: string;
    user: string;
    pass: string;
    name: string;
}

export interface BackendConfig {
    url: string;
    port: number;
    jwt: string;
    includeApp: boolean;
}

export interface Config {
    environment: Environment;
    database: DatabaseConfig;
    backend: BackendConfig;
    //   frontend?: FrontendConfig;
    //   logLevel: Level;
}

export interface ProcessVariables {
    NODE_ENV: string;
    DB_URL?: string;
    INCLUDE_APP?: string;
    DB_PORT?: string;
    DB_USER?: string;
    DB_PASS?: string;
    BACKEND_URL?: string;
    BACKEND_PORT?: string;
    JWT_SECRET?: string;
    //   frontend?: FrontendConfig;
    //   logLevel: Level;
}

export interface ProcessVariablesDefined {
    NODE_ENV: string;
    DB_URL: string;
    DB_PORT: string;
    DB_USER: string;
    INCLUDE_APP: string;
    DB_PASS: string;
    BACKEND_URL: string;
    BACKEND_PORT: string;
    JWT_SECRET: string;
    //   frontend?: FrontendConfig;
    //   logLevel: Level;
}