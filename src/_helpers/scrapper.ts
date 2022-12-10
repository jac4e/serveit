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
import { __configPath } from './globals';
import { getFileConfig  } from '../configuration/config.js';
import logger from './logger';

interface credentialStore {
    installed: {
        client_id: string,
        project_id: string,
        auth_uri: string,
        token_uri: string,
        auth_provider_x509_cert_url: string,
        client_secret:  string,
        redirect_uris: string[]
    }
}

interface tokenStore {
    type: string,
    client_id: string,
    client_secret: string,
    refresh_token: string,
    expiry: string
}

const SCOPES = ['https://www.googleapis.com/auth/gmail.readonly', 'https://www.googleapis.com/auth/gmail.modify'];
const TOKEN_PATH = join(__configPath, 'token.json');
const CREDENTIALS_PATH = join(__configPath, 'credentials.json');
const credentialsConfig = getFileConfig(__configPath, 'credentials.json', (err, interval) => {
    
});
if (credentialsConfig === undefined) {
    logger.warning('Credentials.json is needed, stopping ')
}
const credentials = (JSON.parse(readFileSync(CREDENTIALS_PATH, 'utf-8')) as credentialStore).installed;

const CODE_VERIFIER = randomBytes(128).toString()
const CODE_CHALLENGE = createHash("SHA256").update(CODE_VERIFIER).digest('base64url')

const oauth2Client: Auth.OAuth2Client = new google.auth.OAuth2(
    credentials.client_id,
    credentials.client_secret,
    credentials.redirect_uris[0] // assume one redirect uri
);

const gmail: gmail_v1.Gmail = google.gmail({
    version: 'v1',
    auth: oauth2Client,
})

// Store refresh token automatically
oauth2Client.on('tokens', (tokens) => {
    tokens.expiry_date
    if (tokens.refresh_token) {
        // store the refresh_token in my database!
        console.log(tokens.refresh_token);
        const payload = JSON.stringify({
            type: 'authorized_user',
            client_id: credentials.client_id,
            client_secret: credentials.client_secret,
            refresh_token: tokens.refresh_token,
        });
        writeFileSync(TOKEN_PATH, payload);
    }
    console.log(tokens.access_token);
});

export function isAuthorized() {
    return existsSync(TOKEN_PATH);
}

// Get tokens
export async function authorize(code, redirect_uri) {
    const tokenOptions: Auth.GetTokenOptions = {
        code: code,
        // codeVerifier: CODE_VERIFIER.toString(),
        redirect_uri: redirect_uri,
    };
    const tokenResponse = await oauth2Client.getToken(tokenOptions);
    oauth2Client.setCredentials(tokenResponse.tokens);
}

// Generates oauth url and the redirect url and 
export function generateAuthUrl(address) {
    const redirect_uri = new URL(credentials.redirect_uris[0]);
    redirect_uri.pathname = 'goauth'
    redirect_uri.port = String(address.port)
    
    const url = oauth2Client.generateAuthUrl({
        redirect_uri: redirect_uri.toString(),
        access_type: 'offline',
        // code_challenge_method: Auth.CodeChallengeMethod.S256,
        // code_challenge: CODE_CHALLENGE,
        scope: SCOPES
    });

    return {oauth: url, redirect: redirect_uri.toString()}
}
