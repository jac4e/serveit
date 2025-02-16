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
    stripeSecret: string;
    stripeWebhookSecret: string;
    includeApp: boolean;
    includeGoogle: boolean;
}

export interface EmailConfigFile {
    provider: "smtp" | "google" | "mock" | "none";
    smtp?: {
        host: string,
        port: number,
        secure: boolean,
        auth: {
            user: string,
            pass: string
        }
    }
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
    INCLUDE_GOOGLE?: string;
    DB_PORT?: string;
    DB_USER?: string;
    DB_PASS?: string;
    BACKEND_DOMAIN?: string;
    BACKEND_PORT?: string;
    STRIPE_SECRET?: string;
    STRIPE_WEBHOOK_SECRET?: string;
}

export interface ProcessVariablesDefined {
    SELFSIGN: string;
    CF_TOKEN: string;
    NODE_ENV: string;
    DB_URL: string;
    DB_PORT: string;
    DB_USER: string;
    INCLUDE_APP: string;
    INCLUDE_GOOGLE: string;
    DB_PASS: string;
    BACKEND_DOMAIN: string;
    BACKEND_PORT: string;
    STRIPE_SECRET: string;
    STRIPE_WEBHOOK_SECRET: string;
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