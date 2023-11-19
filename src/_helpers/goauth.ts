import {
    google,
    gmail_v1,
    Auth
} from 'googleapis'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import { createHash, randomBytes } from 'crypto'
import express from 'express';
import { add } from 'winston';
import { __configPath } from './globals.js';
import { __envConfig, getFileConfig  } from '../configuration/config.js';
import logger from './logger.js';


interface credentials {
    client_id: string,
    project_id: string,
    auth_uri: string,
    token_uri: string,
    auth_provider_x509_cert_url: string,
    client_secret:  string,
    redirect_uris: string[]
}

interface credentialStore {
    web: credentials
}

interface tokenStore {
    type: string,
    client_id: string,
    client_secret: string,
    refresh_token: string,
    expiry: string
}

const SCOPES = ['https://www.googleapis.com/auth/gmail.readonly', 'https://www.googleapis.com/auth/gmail.modify'];
const TOKEN_PATH = join(__configPath, 'google_token.json');
const CREDENTIALS_PATH = join(__configPath, 'google_credentials.json');
const credentialsConfig = getFileConfig(__configPath, 'google_credentials.json', (err, interval) => {}) as Promise<credentialStore>;
const CODE_VERIFIER = randomBytes(128).toString()
const CODE_CHALLENGE = createHash("SHA256").update(CODE_VERIFIER).digest('base64url')

class GoAuth {
    oauth2Client: Auth.OAuth2Client | null;
    private credentials: credentials | null;
    
    constructor(credentials: Promise<credentialStore>) {
        this.oauth2Client = null;
        this.credentials = null;
        this.configure(credentials);
    };

    async configure(credentials: Promise<credentialStore>) {
        this.credentials = (await credentials).web;

        this.oauth2Client = new google.auth.OAuth2(
            this.credentials.client_id,
            this.credentials.client_secret,
            this.credentials.redirect_uris[0] // assume one redirect uri
        );
        
        // Gets refresh token from file
        if (this.isAuthorized()) {
            this.oauth2Client.setCredentials(JSON.parse(readFileSync(TOKEN_PATH, 'utf-8')));
            // Need to get new access token as well since it is not stored in the file
            const newToken = await this.oauth2Client.getAccessToken();
        }

        //

        this.oauth2Client.on('tokens', (tokens) => {
            if (this.credentials === null) {
                throw 'credentials not configured';
            }

            tokens.expiry_date
            if (tokens.refresh_token) {
                // store the refresh_token in my database!
                const payload = JSON.stringify({
                    type: 'authorized_user',
                    client_id: this.credentials.client_id,
                    client_secret: this.credentials.client_secret,
                    refresh_token: tokens.refresh_token,
                });
                writeFileSync(TOKEN_PATH, payload);
            }
        });
    }

    isAuthorized() {
        return existsSync(TOKEN_PATH) && this.oauth2Client !== null;
    }
    
    // Get tokens
    async authorize(code, redirect_uri) {
        if (this.oauth2Client === null) {
            throw 'oauth2Client not configured';
        }

        const tokenOptions: Auth.GetTokenOptions = {
            code: code,
            // codeVerifier: CODE_VERIFIER.toString(),
            redirect_uri: redirect_uri,
        };
        const tokenResponse = await this.oauth2Client.getToken(tokenOptions);
        this.oauth2Client.setCredentials(tokenResponse.tokens);
    }
    
    // Generates oauth url and the redirect url and 
    generateAuthUrl(path: string, port, state: { [key: string]: any;}) {
        if (this.oauth2Client === null) {
            throw 'oauth2Client not configured';
        }

        if (this.credentials === null) {
            throw 'credentials not configured';
        }

        const redirect_uri = new URL(__envConfig.backend.url);
        redirect_uri.pathname = path;
        redirect_uri.port = String(port);
        const url = this.oauth2Client.generateAuthUrl({
            redirect_uri: redirect_uri.toString(),
            access_type: 'offline',
            // store state as base64 encoded string
            state: Buffer.from(JSON.stringify(state)).toString('base64'),
            // code_challenge_method: Auth.CodeChallengeMethod.S256,
            // code_challenge: CODE_CHALLENGE,
            scope: SCOPES
        });
    
        return {oauth: url, redirect: redirect_uri.toString()}
    }
}

const goauth = new GoAuth(credentialsConfig);

export default goauth;
