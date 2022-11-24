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
    ssl: SSLConfig;
    //   frontend?: FrontendConfig;
}

export interface ProcessVariables {
    SELFSIGN?: string;
    CF_TOKEN?: string;
    NODE_ENV?: string;
    DB_URL?: string;
    INCLUDE_APP?: string;
    DB_PORT?: string;
    DB_USER?: string;
    DB_PASS?: string;
    BACKEND_DOMAIN?: string;
    BACKEND_PORT?: string;
}

export interface ProcessVariablesDefined {
    SELFSIGN: string;
    CF_TOKEN: string;
    NODE_ENV: string;
    DB_URL: string;
    DB_PORT: string;
    DB_USER: string;
    INCLUDE_APP: string;
    DB_PASS: string;
    BACKEND_DOMAIN: string;
    BACKEND_PORT: string;
}

export interface SSLConfig {
    selfSign: boolean,
    path: string,
    subject: string,
    altnames: string[],
    cloudflare: {
        token: string
    }
}