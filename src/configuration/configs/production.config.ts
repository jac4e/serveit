import { __savePath } from "../../_helpers/globals.js";
import {join} from 'path';
import {randomBytes} from 'crypto';
import { BackendConfig, Config, DatabaseConfig, ProcessVariables, ProcessVariablesDefined, SSLConfig } from "../config.type";

export function getProductionConfig(processVariables: ProcessVariablesDefined): Config {
    const database: DatabaseConfig = {
        url: processVariables.DB_URL,
        port: processVariables.DB_PORT,
        user: processVariables.DB_USER,
        pass: processVariables.DB_PASS,
        name: "spendit-db",
    }
    const backend: BackendConfig = {
        url: `https://${processVariables.BACKEND_DOMAIN}:${parseInt(processVariables.BACKEND_PORT)}`,
        includeApp: processVariables.INCLUDE_APP === "true" ? true : false,
        includeGoogle: processVariables.INCLUDE_GOOGLE === "true" ? true : false,
        port: parseInt(processVariables.BACKEND_PORT),
        jwt: randomBytes(96).toString('hex'),
        stripeSecret: processVariables.STRIPE_SECRET,
        stripeWebhookSecret: processVariables.STRIPE_WEBHOOK_SECRET
    }
    
    const ssl: SSLConfig = {
        selfSign: false,
        // maintainer: processVariables.MAINTAINER,
        path: join(__savePath, "certs/"),
        subject: processVariables.BACKEND_DOMAIN,
        altnames: [processVariables.BACKEND_DOMAIN],
        cloudflare: {
            token: processVariables.CF_TOKEN
        }
      }
  return {
    environment: "production",
    database: database,
    backend: backend,
    ssl: ssl
  };
}