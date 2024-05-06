// Copyright 2020 Google LLC
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//    http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

// Modifications made from @google-cloud/local-auth:
// - semi-converted to typescript (just fixed errors when code)
// - converted imports to be module based
// - made it print url to console, instead of opening a browser as to support headless installs
// added functions from googles gmail api quickstart (https://developers.google.com/gmail/api/quickstart/nodejs)

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { createServer } from 'http';
import { AddressInfo } from 'net';
import { cwd } from 'process';
import arrify from 'arrify';
import destroyer from 'server-destroy';
import { URL } from 'url';
import { google } from 'googleapis';
import { gmail_v1 } from 'googleapis'
import { OAuth2Client, GetTokenOptions } from 'google-auth-library';
import { authenticate } from 'mailauth';
import logger from './logger.js';

export interface LocalAuthOptions {
    keyfilePath: string;
    scopes: string[] | string;
}

const invalidRedirectUri = `The provided keyfile does not define a valid
redirect URI. There must be at least one redirect URI defined, and this sample
assumes it redirects to 'http://localhost:3000/oauth2callback'.  Please edit
your keyfile, and add a 'redirect_uris' section.  For example:

"redirect_uris": [
  "http://localhost:3000/oauth2callback"
]
`;

function isAddressInfo(addr): addr is AddressInfo {
    return addr.port !== undefined;
}

// If modifying these scopes, delete token.json.
const SCOPES = ['https://www.googleapis.com/auth/gmail.readonly', 'https://www.googleapis.com/auth/gmail.modify'];
// The file token.json stores the user's access and refresh tokens, and is
// created automatically when the authorization flow completes for the first
// time.
const TOKEN_PATH = join(process.cwd(), 'token.json');
const CREDENTIALS_PATH = join(process.cwd(), 'credentials.json');

/**
 * Reads previously authorized credentials from the save file.
 *
 * @return {Promise<OAuth2Client|null>}
 */
async function loadSavedCredentialsIfExist() {
    try {
        const content = readFileSync(TOKEN_PATH, 'utf-8');
        const credentials = JSON.parse(content);
        return google.auth.fromJSON(credentials) as OAuth2Client;
    } catch (err) {
        return null;
    }
}

/**
 * Serializes credentials to a file comptible with GoogleAUth.fromJSON.
 *
 * @param {OAuth2Client} client
 * @return {Promise<void>}
 */
async function saveCredentials(client) {
    const content = readFileSync(CREDENTIALS_PATH, 'utf-8');
    const keys = JSON.parse(content);
    const key = keys.installed || keys.web;
    const payload = JSON.stringify({
        type: 'authorized_user',
        client_id: key.client_id,
        client_secret: key.client_secret,
        refresh_token: client.credentials.refresh_token,
    });
    writeFileSync(TOKEN_PATH, payload);
}


async function googleAuth(options: LocalAuthOptions): Promise<OAuth2Client> {
    var _a;
    if (!options ||
        !options.keyfilePath ||
        typeof options.keyfilePath !== 'string') {
        throw new Error('keyfilePath must be set to the fully qualified path to a GCP credential keyfile.');
    }
    const keyFile = JSON.parse(readFileSync(options.keyfilePath).toString());
    const keys = keyFile.installed || keyFile.web;
    if (!keys.redirect_uris || keys.redirect_uris.length === 0) {
        throw new Error(invalidRedirectUri);
    }
    const redirectUri = new URL((_a = keys.redirect_uris[0]) !== null && _a !== void 0 ? _a : 'http://localhost');
    if (redirectUri.hostname !== 'localhost') {
        throw new Error(invalidRedirectUri);
    }
    // create an oAuth client to authorize the API call
    const client = new OAuth2Client({
        clientId: keys.client_id,
        clientSecret: keys.client_secret,
    });
    return new Promise((resolve, reject) => {
        const server = createServer(async (req, res) => {
            logger.debug('request');
            try {
                logger.debug("begin try")
                if (req.url === undefined) {
                    reject(new Error("req.url must be defined"))
                    return;
                }
                logger.debug("req.url defined")
                const url = new URL(req.url, 'http://localhost:3000');
                if (url.pathname !== redirectUri.pathname) {
                    res.end('Invalid callback URL');
                    return;
                }
                logger.debug("callback url defined")
                const searchParams = url.searchParams;
                if (searchParams.has('error')) {
                    res.end('Authorization rejected.');
                    const sperrors = searchParams.get('error');
                    if (sperrors === null) {
                        reject(new Error("searchparams must be defined"))
                        return;
                    }
                    reject(new Error(sperrors));
                    return;
                }
                logger.debug("auth not rejected")
                if (!searchParams.has('code')) {
                    res.end('No authentication code provided.');
                    reject(new Error('Cannot read authentication code.'));
                    return;
                }
                logger.debug("auth code provided")
                const code = searchParams.get('code');
                if (code === null) {
                    reject(new Error("code must be defined"))
                    return;
                }
                logger.debug("code is defined")
                const tokenOptions: GetTokenOptions = {
                    code: code,
                    redirect_uri: redirectUri.toString(),
                };
                const tokenResponse = await client.getToken(tokenOptions);
                client.credentials = tokenResponse.tokens;
                logger.debug("token got")
                resolve(client);
                res.end('Authentication successful! Please return to the console.');
            }
            catch (e) {
                reject(e);
            }
            finally {
                req.destroy();
            }
        });
        let listenPort = 3000;
        if (keyFile.installed) {
            // Use emphemeral port if not a web client
            listenPort = 0;
        }
        else if (redirectUri.port !== '') {
            listenPort = Number(redirectUri.port);
        }
        logger.debug(listenPort)
        server.listen(listenPort, () => {
            const address = server.address();
            if (isAddressInfo(address)) {
                redirectUri.port = String(address.port);
            }
            logger.debug(redirectUri)
            const scopes = arrify(options.scopes || []);
            // open the browser to the authorize url to start the workflow
            const authorizeUrl = client.generateAuthUrl({
                redirect_uri: redirectUri.toString(),
                access_type: 'offline',
                scope: scopes.join(' '),
            });
            logger.debug(`Go to the following link in your browser: \n${authorizeUrl}\n`);
        });
        destroyer(server);
    });
}

/**
 * Load or request or authorization to call APIs.
 *
 */
async function authorize() {
    logger.debug("begin");
    let client = await loadSavedCredentialsIfExist();
    logger.debug("test");
    if (client) {
        return client;
    }
    logger.debug("test2");
    client = await googleAuth({
        scopes: SCOPES,
        keyfilePath: CREDENTIALS_PATH,
    });
    logger.debug("test3");
    if (client.credentials) {
        await saveCredentials(client);
    }
    logger.debug("test4");
    return client;
}

async function processTransfers(auth) {
    logger.debug("Begin mailbox processing")
    const gmail = google.gmail({ version: 'v1', auth });

    // Get email labels 
    logger.debug("Getting labels")
    const resLabelList = await gmail.users.labels.list({
        userId: 'me',
    });
    const labels = resLabelList.data.labels;
    if (!labels || labels.length === 0) {
        throw 'no email labels found';
    }
    logger.debug("Got labels");
    // Check if there is an incoming e-Transfers label
    const incoming = labels.filter(e => e.name === 'INCOMING_ETRANSFERS').length === 1 ? labels.filter(e => e.name === 'INCOMING_ETRANSFERS')[0] : undefined;
    if (incoming === undefined) {
        throw 'no "INCOMING_ETRANSFERS" label';
    }

    // Check if there is an processed e-Transfers label
    const processed = labels.filter(e => e.name === 'PROCESSED_ETRANSFERS').length === 1 ? labels.filter(e => e.name === 'PROCESSED_ETRANSFERS')[0] : undefined;
    if (processed === undefined) {
        throw 'no "PROCESSED_ETRANSFERS" label';
    }

    // Best way forward would be to setup a pub.sub for etransfer
    // https://stackoverflow.com/questions/71924157/how-does-users-watch-in-gmail-google-api-listen-for-notifications
    // But for now, we will check mailbox every 5 minutes for new messages

    // Current unit setup ~ per 5 minutes
    // message list = 5
    // message get = 5 * amount of messages (lets say ~50 per day) = 250
    //      ^ user quota per second is 250 units so we can only process on message every second to avoid limit
    // 

    async function loop() {
        logger.debug('Fetching incoming etransfers');
        // get all incoming potential etransfers
        if (incoming === undefined) {
            throw 'no "INCOMING_ETRANSFERS" label';
        }
        if (processed === undefined) {
            throw 'no "PROCESSED_ETRANSFERS" label';
        }
        const resMessagesGet = await gmail.users.messages.list({
            userId: 'me',
            labelIds: [incoming.id],
        } as gmail_v1.Params$Resource$Users$Messages$List);
        const potentialIncoming = resMessagesGet.data.messages;
        if (potentialIncoming === undefined || potentialIncoming.length === 0) {
            throw 'no potential etransfers found'
        }

        async function processMessage(messageLean) {

            // helper function for logging and continuing if bad transfer was found
            function badMessage(emailMessage: gmail_v1.Schema$Message, errorMessage: string) {
                logger.debug(`${emailMessage.id} could not be processed: ${errorMessage}. The email headers have been logged if it contained any.`)
                // check if header folder exists
                if (!existsSync(`./failed_messages/`)) {
                    mkdirSync(`./failed_messages/`, { recursive: true })
                }
                writeFileSync(`./failed_messages/${emailMessage.id}_headers.txt`, JSON.stringify(emailMessage.payload?.headers, null, 2))
                // move message to FAILED_ETRANSFERS
                if (incoming?.id === undefined || incoming?.id === null) {
                    throw 'no "INCOMING_ETRANSFERS" label';
                }
                if (processed?.id === undefined || processed?.id === undefined) {
                    throw 'no "PROCESSED_ETRANSFERS" label';
                }
                // gmail.users.messages.modify({
                //     userId: 'me',
                //     id: messageLean.id,
                //     requestBody: {
                //         addLabelIds: [processed.id],
                //         removeLabelIds: [incoming.id]
                //     }
                // } as gmail_v1.Params$Resource$Users$Messages$Modify);
            }

            if (incoming?.id === undefined || incoming?.id === null) {
                throw 'no "INCOMING_ETRANSFERS" label';
            }
            if (processed?.id === undefined || processed?.id === null) {
                throw 'no "PROCESSED_ETRANSFERS" label';
            }

            // Get potential etransfer
            const messageReq = await gmail.users.messages.get({
                userId: 'me',
                id: messageLean.id,
                format: 'RAW'
            } as gmail_v1.Params$Resource$Users$Messages$Get);
            const message = messageReq.data

            // Authenticate the email
            logger.debug(message)
            if (message.raw === undefined || message.raw === null) {
                throw 'no raw message';
            }
            const messageDecoded = Buffer.from(message.raw, 'base64').toString("utf8")
            logger.debug(await authenticate(messageDecoded))
            throw "done"

            // process potential etransfer

            // Headers for interac etransfer
            // X-PaymentKey -> etransfer reference number
            // ARC-Authentication-Results -> spf and dkim results
            // Subject -> message subject
            // if (message.payload === undefined) {
            //     badMessage(message, ' payload undefined');
            //     return;
            // }
            // const headers = message.payload.headers;
            // if (headers === undefined) {
            //     badMessage(message, ' headers undefined');
            //     return;
            // }
            // const paymentKey = headers.filter(e => e.name === 'X-PaymentKey').length === 1 ? headers.filter(e => e.name === 'X-PaymentKey')[0].value : undefined;
            // if (paymentKey === undefined || paymentKey === null) {
            //     badMessage(message, 'no payment key found');
            //     return;
            // }
            // const arcAuthResults = headers.filter(e => e.name === 'ARC-Authentication-Results').length === 1 ? headers.filter(e => e.name === 'ARC-Authentication-Results')[0].value : undefined;
            // if (arcAuthResults === undefined || arcAuthResults === null) {
            //     badMessage(message, 'no arc authentication results found');
            //     return;
            // }
            // const subject = headers.filter(e => e.name === 'Subject').length === 1 ? headers.filter(e => e.name === 'Subject')[0].value : undefined;
            // if (subject === undefined || subject === null) {
            //     badMessage(message, 'no subject found');
            //     return;
            // }

            // // Check if arc auth results are passed
            // if (!arcAuthResults.includes('dkim=pass') && !arcAuthResults.includes('spf=pass')) {
            //     badMessage(message, ' did not pass dkim and spf');
            //     return;
            // }

            // // Check if subject is an auto deposit.
            // if (!(/^INTERAC e-Transfer: A money transfer from.+has been automatically deposited.$/.test(subject))) {
            //     badMessage(message, ' is not auto deposit notification');
            //     return;
            // }

            // if (message.payload.parts === undefined || message.payload.parts.length === 0){
            //     badMessage(message,  'error in message parts');
            //     return;
            // }
            // if (message.payload.parts[0].parts === undefined || message.payload.parts[0].parts.length === 0){
            //     badMessage(message,  'error in message parts');
            //     return;
            // }
            // if (message.payload.parts[0].parts[0].parts === undefined || message.payload.parts[0].parts[0].parts.length === 0){
            //     badMessage(message,  'error in message parts');
            //     return;
            // }
            // if (message.payload.parts[0].parts[0].parts[0].body === undefined) {
            //     badMessage(message,  'error in text body');
            //     return;
            // }
            // const textBody = message.payload.parts[0].parts[0].parts[0].body.data
            // if (textBody === undefined || textBody === null){
            //     badMessage(message,  'error in text body');
            //     return;
            // }
            // const decodedBody = Buffer.from(textBody, 'base64').toString("utf8")
            
            // Get amount deposited
            // ^Hi UNIVERSITY OF ALBERTA ENGINEERING PHYSICS CLUB,\n\n.*\$(\d+\.\d+) \(CAD\)
            // logger.debug(decodedBody)
            // let test = new RegExp("/^Hi UNIVERSITY OF ALBERTA ENGINEERING PHYSICS CLUB,\n\n.*\$(\d+\.\d+)/")
            // logger.debug(decodedBody.match(test))
            // Get user id of depositee

            // move message to PROCESSED_ETRANSFERS
            // gmail.users.messages.modify({
            //     userId: 'me',
            //     id: messageLean.id,
            //     requestBody: {
            //         addLabelIds: [processed.id],
            //         removeLabelIds: [incoming.id]
            //     }
            // } as gmail_v1.Params$Resource$Users$Messages$Modify);
        }

        // wait 1 second
        potentialIncoming.forEach(async (messageLean, count) => {
            setTimeout(() => processMessage(messageLean), count * 1000);
        });
    }

    // Check mail at startup then every 5 minutes
    loop();
    setInterval(loop, 5 * 60 * 1000);

}

async function sendMail(subject, to, body) {

}

export default {
    loadSavedCredentialsIfExist,
    saveCredentials,
    authorize,
    processTransfers
}