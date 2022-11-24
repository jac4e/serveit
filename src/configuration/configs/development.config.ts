import { BackendConfig, Config, DatabaseConfig, ProcessVariables, ProcessVariablesDefined, SSLConfig } from "../config.type";
import { randomBytes } from 'crypto';
import { join } from 'path'
import { __savePath } from "../../_helpers/globals.js";

export function getDevelopmentConfig(processVariables: ProcessVariables ): Config {
    const database: DatabaseConfig = {
        url: processVariables.DB_URL ?? "localhost",
        port: processVariables.DB_PORT ?? "27017",
        user: processVariables.DB_USER ?? "",
        pass: processVariables.DB_PASS ?? "",
        name: "spendit-dev-db",
    }
    const backend: BackendConfig = {
        port: parseInt(processVariables.BACKEND_PORT ?? "3443"),
        url: `https://${processVariables.BACKEND_DOMAIN ?? "localhost"}:${parseInt(processVariables.BACKEND_PORT ?? "3443")}`,
        includeApp: processVariables.INCLUDE_APP === "true" ? true : true,
        jwt: randomBytes(96).toString('hex'),
    }
    const ssl: SSLConfig = {
      selfSign: processVariables.SELFSIGN === "false" ? false : true,
      // maintainer: processVariables.MAINTAINER ?? "admin@localhost",
      path: join(__savePath, "certs/"),
      subject: processVariables.BACKEND_DOMAIN ?? "localhost",
      altnames: [processVariables.BACKEND_DOMAIN ?? "localhost"],
      cloudflare: {
          token: processVariables.CF_TOKEN ?? ""
      }
    }
  return {
    environment: "development",
    database: database,
    backend: backend,
    ssl: ssl
  };
}