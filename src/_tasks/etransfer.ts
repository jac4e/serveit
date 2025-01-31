import goauth from "../_helpers/goauth.js";
import Task from "./task.js";
import { Auth, gmail_v1, google } from "googleapis";
import { authenticate } from 'mailauth';
import logger from '../_helpers/logger.js';
import jsdom from 'jsdom';
import e from "express";
import Transaction from "../_helpers/transaction.js";
import { ITransactionForm, TransactionType } from "typesit";
import { __savePath } from "../_helpers/globals.js";
import { join, dirname } from 'path';
import { existsSync, mkdirSync, readFileSync, statSync, readdirSync, writeFileSync } from 'fs';
import refillService from '../refill/service.js';


// Helper functions
function getHtmlPart(parts: gmail_v1.Schema$MessagePart[]): gmail_v1.Schema$MessagePart | undefined {
    for (const part of parts) {
        if (part.mimeType?.includes('multipart')) {
            const innerPart = getHtmlPart(part.parts!)
            if (innerPart !== undefined) {
                return innerPart;
            }
        } else if (part.mimeType === 'text/html') {
            return part;
        }
    }
}

function urlSafeBase64Decode(base64: string): string {
    return Buffer.from(base64, 'base64').toString('utf8');
}

function parseEtransferEmailFromDOM(document: any, log: Task["log"]): { refillid: string; amount: string; } {
    let refillid: string | undefined = undefined;
    let amount: string | undefined = undefined;

    // Find element that contains REFILL using xpath
    const messageXpath = "//p[contains(translate(text(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'refill')]";
    const message = document.evaluate(messageXpath, document, null, 9, null).singleNodeValue.textContent.trim();
    const amountText = document.evaluate("//*[contains(text(), '$')]", document, null, 9, null).singleNodeValue.textContent.trim();

    // Make sure both are not the same one to prevent amounts being places in the message
    if ( message === amountText && typeof message === "string") {
        throw "message and amount text are the same"
    }

    // Parse message to get refillid
    const delims = [
        ':',
        '&',
    ]

    for (const delim of delims) {
        if ((message.toLowerCase().includes(`refill${delim}`))) {
            refillid = message.toLowerCase().split(`refill${delim}`)[1]?.trim();
        }
    }

    if (refillid === undefined && refillid !== ""){
        throw 'refillid is undefined';
    }
    log('debug', `refillid: ${refillid}`);

    // Parse amountText to get amount
    amount = amountText.split('$')[1].split('(CAD')[0]?.trim();

    if (amount === undefined && amount !==""){
        throw 'amount is undefined';
    }
    log('debug', `amount: ${amount}`);

    return { refillid: refillid, amount: amount };
}


class EtransferTask extends Task {
    private gmail: gmail_v1.Gmail | null;
    private labelIds: { 
        incoming: string;
        processed: string; 
        unverified: string;
        unprocessed: string;
    } | null;

    // For future use to potentially stop the process
    // just and idea I had so that there could be a system dashboard page that can stop this and other interval tasks

    constructor(config: { [key: string]: any; }) {
        super("etransfer", 1000 * 60 * 1);
        this.gmail = null;
        this.labelIds = null;

        this.log('debug', "EtransferProcessor initialized")
        this.configure(config).catch(err => {
            this.log('error', err);
        });
    }

    stopHandler() {
        this.log('info', "Stopping EtransferProcessor")
    }

    startHandler() {
        this.log('info', "Starting EtransferProcessor")
    }

    // Trying out different method compared to setinterval
    // This way setIntervals will not stack if the previous one has not finished
    // THIS IS TEMPORARY
    // Best way forward would be to setup a pub.sub for etransfer
    // https://stackoverflow.com/questions/71924157/how-does-users-watch-in-gmail-google-api-listen-for-notifications
    // But for now, we will check mailbox every 5 minutes for new messages
    async taskHandler() {
        // Don't do anything if gmail is not configured
        if (this.gmail === null && this.labelIds === null) {
            this.log('warning', "Etransfer Gmail Authentication not configured");
            return;
        }

        // Process incoming e-transfers
        this.log('info', "Processing incoming e-transfers")
        const etransfers = await this.getEtransfers();
        this.log('debug', "got etransfers")
        this.log('debug', `Incoming: ${etransfers.incoming.length}`)
        // Verify etransfers
        for (let i = 0; i < etransfers.incoming.length; i++) {
            this.log('debug', `Verifying etransfer ${etransfers.incoming[i].id}`)
            // Wait 0.25 second before verifying next etransfer
            await new Promise(resolve => setTimeout(resolve, 250));
            try {
                const res = await this.verify(etransfers.incoming[i]);
                if (!res) {
                    throw "Etransfer not verified"
                }
            } catch (err) {
                this.log('debug', `Message ${etransfers.incoming[i].id} could not be verified: ${err}`)
                // move message to unverified label
                try {
                    await this.gmail!.users.messages.modify({
                        userId: 'me',
                        id: etransfers.incoming[i].id,
                        addLabelIds: [this.labelIds!.unverified],
                        removeLabelIds: [this.labelIds!.incoming]
                    } as gmail_v1.Params$Resource$Users$Messages$Modify);
                } catch (err) {
                    this.log('error', err);
                }
                continue;
            }
            try {
                this.processEtransfer(etransfers.incoming[i])
            } catch (err) {
                this.log('error',`Message ${etransfers.incoming[i].id} could not be processed: ${err}`)
                // move message to unprocessed label
                try {
                    await this.gmail!.users.messages.modify({
                        userId: 'me',
                        id: etransfers.incoming[i].id,
                        addLabelIds: [this.labelIds!.unprocessed],
                        removeLabelIds: [this.labelIds!.incoming]
                    } as gmail_v1.Params$Resource$Users$Messages$Modify);
                } catch (err) {
                    this.log('error', err);
                }
                continue;
            }

            // Move message to processing label
            try {
                await this.gmail!.users.messages.modify({
                    userId: 'me',
                    id: etransfers.incoming[i].id,
                    addLabelIds: [this.labelIds!.processed],
                    removeLabelIds: [this.labelIds!.incoming]
                } as gmail_v1.Params$Resource$Users$Messages$Modify);
            } catch (err) {
                this.log('error', err);
            }
        }
    }

    private async configure(config: { [key: string]: any; }) {
        this.log('debug', "Configuring etransfer processor")
        // wait for oauth2Client to be configured
        while (goauth.oauth2Client === null) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        this.log('debug', "Oauth2Client configured")
        // Configure gmail
        this.gmail = google.gmail({
            version: 'v1',
            auth: goauth.oauth2Client,
        })

        // Get email labels
        try {
            await this.getLabels();
        } catch (err) {
            this.log('error', err);
            // Stop the incomingHandler
            this.gmail = null;
            this.labelIds = null;
            this.log('warning', `EtransferProcessor not configured properly: ${err}`)
        }

        this.log('info', "EtransferProcessor configured")
    }

    isConfigured() {
        return this.gmail !== null && this.labelIds !== null;
    }

    private async getLabels() {
        if (this.gmail === null) {
            this.log('warning', "Etransfer Gmail Authentication not configured");
            throw 'gmail not configured';
        }

        this.log('debug', "Getting labels")
        const resLabelList = await this.gmail.users.labels.list({
            userId: 'me',
        });
        const labels = resLabelList.data.labels;
        if (!labels || labels.length === 0) {
            throw 'no email labels found';
        }
        this.log('debug', "Got labels");
        // Check if there is an incoming e-Transfers label
        const incoming = labels.filter(e => e.name === 'INCOMING_ETRANSFERS').length === 1 ? labels.filter(e => e.name === 'INCOMING_ETRANSFERS')[0] : undefined;
        if (incoming === undefined) {
            throw 'no "INCOMING_ETRANSFERS" label found in Gmail';
        }

        const processed = labels.filter(e => e.name === 'PROCESSED_ETRANSFERS').length === 1 ? labels.filter(e => e.name === 'PROCESSED_ETRANSFERS')[0] : undefined;
        if (processed === undefined) {
            throw 'no "PROCESSED_ETRANSFERS" label found in Gmail';
        }

        const unverified = labels.filter(e => e.name === 'UNVERIFIED_ETRANSFERS').length === 1 ? labels.filter(e => e.name === 'UNVERIFIED_ETRANSFERS')[0] : undefined;
        if (unverified === undefined) {
            throw 'no "UNVERIFIED_ETRANSFERS" label found in Gmail';
        }

        const unprocessed = labels.filter(e => e.name === 'UNPROCESSED_ETRANSFERS').length === 1 ? labels.filter(e => e.name === 'UNPROCESSED_ETRANSFERS')[0] : undefined;
        if (unprocessed === undefined) {
            throw 'no "UNPROCESSED_ETRANSFERS" label found in Gmail';
        }

        // Check that label id's exist
        if (incoming.id === undefined || processed.id === undefined || incoming.id === null || processed.id === null || unverified.id === undefined || unverified.id === null || unprocessed.id === undefined || unprocessed.id === null) {
            throw 'label id not found';
        }

        this.labelIds = {
            incoming: incoming.id,
            processed: processed.id,
            unverified: unverified.id,
            unprocessed: unprocessed.id
        }

    }

    async getEtransfers(): Promise<{ incoming: gmail_v1.Schema$Message[]; processing: gmail_v1.Schema$Message[]; }> {
        // Check if gmail is configured
        if (this.gmail === null && this.labelIds === null) {
            this.log('warning', "Etransfer Gmail Authentication not configured");
            throw 'gmail not configured';
        }

        this.log('debug', "Getting etransfers")

        let etransfers: { incoming: gmail_v1.Schema$Message[]; processing: gmail_v1.Schema$Message[]; } = {
            incoming: [],
            processing: []
        };

        // Get email messages
        const resMessagesGet = await this.gmail!.users.messages.list({
            userId: 'me',
            maxResults: 500,
            labelIds: [this.labelIds!.incoming],
        } as gmail_v1.Params$Resource$Users$Messages$List);
        const potentialIncoming = resMessagesGet.data.messages;

        if (potentialIncoming === undefined || potentialIncoming === null) {
            throw 'no potential incoming etransfers';
        }
        this.log('debug', `Potential incoming: ${potentialIncoming.length}`)

        etransfers.incoming = potentialIncoming;

        return etransfers;
    }

    async verify(messageLean: gmail_v1.Schema$Message): Promise<boolean> {
        // Check if gmail is configured
        if (this.gmail === null && this.labelIds === null) {
            this.log('warning', "Etransfer Gmail Authentication not configured");
            throw 'gmail not configured';
        }

        // Get potential etransfer
        const messageReq = await this.gmail!.users.messages.get({
            userId: 'me',
            id: messageLean.id,
            format: 'RAW'
        } as gmail_v1.Params$Resource$Users$Messages$Get);
        const message = messageReq.data

        // Authenticate the email
        // this.log('debug', message)
        if (message.raw === undefined || message.raw === null) {
            throw 'no raw message';
        }

        const messageDecoded = Buffer.from(message.raw, 'base64').toString("utf8")

        // Hopefully this is a semi-secure method of authenticating the email
        // Though it is not perfect, it is better than nothing and the results will probably need to be audited every so often
        const authentication = await authenticate(messageDecoded)

        const arcResult = authentication.arc.status.result
        const dkimdomains = authentication.dkim.results.map((result) => result.signingDomain)
        const validDomains = ["payments.interac.ca", "amazonses.com"]
        const dkdomainsIsValid = dkimdomains.every((domain) => validDomains.includes(domain))

        if (!(arcResult === 'pass' && dkdomainsIsValid)) {
            // Save the message to a file for auditing in __savePath/etransfer/unverified
            const unverifiedPath = join(__savePath, 'etransfer', 'unverified', messageLean.id!);
            if (!existsSync(unverifiedPath)) {
                mkdirSync(unverifiedPath, { recursive: true });
            }
            const unverifiedAuthPathFile = join(unverifiedPath, messageLean.id + '_authentication.json')
            const unverifiedEmailPathFile = join(unverifiedPath, messageLean.id + '_email.txt')

            writeFileSync(unverifiedAuthPathFile, JSON.stringify(authentication, null, 2))
            writeFileSync(unverifiedEmailPathFile, messageDecoded)

            return false;
        }

        return true;
    }

    async processEtransfer(messageLean: gmail_v1.Schema$Message) {
        // Check if gmail is configured
        if (this.gmail === null && this.labelIds === null) {
            this.log('warning', "Etransfer Gmail Authentication not configured");
            throw 'gmail not configured';
        }

        // Get the email html body from gmail api
        const messageReq = await this.gmail!.users.messages.get({
            userId: 'me',
            id: messageLean.id,
            format: 'FULL'
        } as gmail_v1.Params$Resource$Users$Messages$Get);

        // Get X-PaymentKey from the email headers
        const paymentKey = messageReq.data.payload?.headers?.filter(e => e.name === 'X-PaymentKey')[0]?.value;
        // Check if paymentKey is defined
        if (paymentKey === undefined || paymentKey === null) {
            throw 'no payment key';
        }
        this.log('debug', `PaymentKey: ${paymentKey}`)

        // Check if payload is defined
        if (messageReq.data.payload === undefined || messageReq.data.payload === null) {
            throw 'no payload';
        }

        // Check if parts is defined
        if (messageReq.data.payload.parts === undefined || messageReq.data.payload.parts === null) {
            throw 'no parts';
        }

        const part = getHtmlPart(messageReq.data.payload.parts)

        // Verify that the html part is defined properly
        if (part === undefined) {
            throw 'no html part';
        }

        if (part.body === undefined || part.body === null) {
            throw 'no body';
        }

        if (part.body.data === undefined || part.body.data === null) {
            throw 'no data';
        }
        
        // Create a dom from the html
        const html = urlSafeBase64Decode(part.body.data);
        const dom = new jsdom.JSDOM(html);
        const document = dom.window.document;

        // Parse the etransfer email
        const { refillid, amount } = parseEtransferEmailFromDOM(document, this.log.bind(this));

        // Complete the etransfer
        const note = 'Auto-Etransfer: Refill completed';
        refillService.completeRefill(refillid, {amount: BigInt(amount), reference: paymentKey, note: note}).catch(err => {
            this.log('error', err);
        });
    }
}


// const etransferConfig = getFileConfig(__configPath, 'email.json', (err, interval) => {}) as Promise<EmailConfigFile>
const etransferConfig = {}
const etransfer = new EtransferTask(etransferConfig)
export default etransfer