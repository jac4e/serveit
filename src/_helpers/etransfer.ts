import goauth from "./goauth.js";
import { Auth, gmail_v1, google } from "googleapis";
import { authenticate } from 'mailauth';
import logger from './logger.js';
import jsdom from 'jsdom';
import e from "express";
import Transaction from "./transaction.js";
import { ITransactionForm, TransactionType } from "typesit";
import { __savePath } from "./globals.js";
import { join, dirname } from 'path';
import { existsSync, mkdirSync, readFileSync, statSync, readdirSync, writeFileSync } from 'fs';


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


class EtransferProcessor {
    private gmail: gmail_v1.Gmail | null;
    private labelIds: { 
        incoming: string;
        processed: string; 
        unverified: string;
    } | null;

    // For future use to potentially stop the process
    // just and idea I had so that there could be a system dashboard page that can stop this and other interval tasks
    private processTimer: NodeJS.Timeout | null;
    private isStopped: boolean;

    constructor(config: { [key: string]: any; }) {
        this.gmail = null;
        this.labelIds = null;
        this.processTimer = null;
        this.isStopped = true;

        console.log("EtransferProcessor initialized")

        this.configure(config).then(() => {
            if (this.isConfigured()) {
                this.processIncomingEtransfers();
            }
        });
    }

    // Trying out different method compared to setinterval
    // This way setIntervals will not stack if the previous one has not finished
    // THIS IS TEMPORARY
    // Best way forward would be to setup a pub.sub for etransfer
    // https://stackoverflow.com/questions/71924157/how-does-users-watch-in-gmail-google-api-listen-for-notifications
    // But for now, we will check mailbox every 5 minutes for new messages
    private async processIncomingEtransfers() {
        if (this.isStopped) {
            return;
        }

        // Don't do anything if gmail is not configured
        if (this.gmail === null && this.labelIds === null) {
            logger.warning("Etransfer Gmail Authentication not configured");
            return;
        }

        // Process incoming e-transfers
        logger.info("Processing incoming e-transfers")
        const etransfers = await this.getEtransfers();
        console.log("got etransfers")
        console.log(`Incoming: ${etransfers.incoming.length}`)
        // Verify etransfers
        for (let i = 0; i < etransfers.incoming.length; i++) {
            console.log(`Verifying etransfer ${etransfers.incoming[i].id}`)
            try {
                const res = await this.verify(etransfers.incoming[i]);
                if (!res) {
                    throw "Etransfer not verified"
                }
            } catch (err) {
                console.log(`Message ${etransfers.incoming[i].id} could not be verified: ${err}`)
                // move message to unverified label
                try {
                    await this.gmail!.users.messages.modify({
                        userId: 'me',
                        id: etransfers.incoming[i].id,
                        addLabelIds: [this.labelIds!.unverified],
                        removeLabelIds: [this.labelIds!.incoming]
                    } as gmail_v1.Params$Resource$Users$Messages$Modify);
                } catch (err) {
                    console.error(err);
                }
                continue;
            }

            this.processEtransfer(etransfers.incoming[i])

            // Move message to processing label
            try {
                await this.gmail!.users.messages.modify({
                    userId: 'me',
                    id: etransfers.incoming[i].id,
                    addLabelIds: [this.labelIds!.processed],
                    removeLabelIds: [this.labelIds!.incoming]
                } as gmail_v1.Params$Resource$Users$Messages$Modify);
            } catch (err) {
                console.error(err);
            }

            // Wait 0.25 second before verifying next etransfer
            await new Promise(resolve => setTimeout(resolve, 250));
        }
        logger.info("Finished processing incoming e-transfers")
        this.processTimer = setTimeout(this.processIncomingEtransfers, 1000 * 60 * 5);
    }

    private async configure(config: { [key: string]: any; }) {
        console.log("Configuring etransfer processor")
        // wait for oauth2Client to be configured
        while (goauth.oauth2Client === null) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        console.log("Oauth2Client configured")
        // Configure gmail
        this.gmail = google.gmail({
            version: 'v1',
            auth: goauth.oauth2Client,
        })

        // Get email labels
        try {
            await this.getLabels();
        } catch (err) {
            console.error(err);
            // Stop the incomingHandler
            this.gmail = null;
            this.labelIds = null;
            logger.warn(`EtransferProcessor not configured properly: ${err}`)
        }

        logger.info("EtransferProcessor configured")
    }

    isConfigured() {
        return this.gmail !== null && this.labelIds !== null;
    }

    start() {
        this.isStopped = false;
        this.processIncomingEtransfers();
    }

    stop() {
        this.isStopped = true;
        if (this.processTimer !== null) {
            clearTimeout(this.processTimer);
        }
    }

    private async getLabels() {
        if (this.gmail === null) {
            logger.warning("Etransfer Gmail Authentication not configured");
            throw 'gmail not configured';
        }

        console.log("Getting labels")
        const resLabelList = await this.gmail.users.labels.list({
            userId: 'me',
        });
        const labels = resLabelList.data.labels;
        if (!labels || labels.length === 0) {
            throw 'no email labels found';
        }
        console.log("Got labels");
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

        // Check that label id's exist
        if (incoming.id === undefined || processed.id === undefined || incoming.id === null || processed.id === null || unverified.id === undefined || unverified.id === null) {
            throw 'label id not found';
        }

        this.labelIds = {
            incoming: incoming.id,
            processed: processed.id,
            unverified: unverified.id
        }

    }

    async getEtransfers(): Promise<{ incoming: gmail_v1.Schema$Message[]; processing: gmail_v1.Schema$Message[]; }> {
        // Check if gmail is configured
        if (this.gmail === null && this.labelIds === null) {
            logger.warning("Etransfer Gmail Authentication not configured");
            throw 'gmail not configured';
        }

        console.log("Getting etransfers")

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
        console.log(`Potential incoming: ${potentialIncoming.length}`)

        etransfers.incoming = potentialIncoming;

        return etransfers;
    }

    async verify(messageLean: gmail_v1.Schema$Message): Promise<boolean> {
        // Check if gmail is configured
        if (this.gmail === null && this.labelIds === null) {
            logger.warning("Etransfer Gmail Authentication not configured");
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
        // console.log(message)
        if (message.raw === undefined || message.raw === null) {
            throw 'no raw message';
        }

        const messageDecoded = Buffer.from(message.raw, 'base64').toString("utf8")

        // Hopefully this is a semi-secure method of authenticating the email
        // Though it is not perfect, it is better than nothing and the results will probably need to be audited every so often
        const authentication = await authenticate(messageDecoded)

        const arcResult = authentication.arc.status.result
        const dkdomain = authentication.arc.status.comment.split('dkdomain=')[1]

        if (!(arcResult === 'pass' && dkdomain === 'payments.interac.ca')) {
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
            logger.warning("Etransfer Gmail Authentication not configured");
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
        console.log(`PaymentKey: ${paymentKey}`)

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

        // THe JS path to the message body is: document.querySelector("body > table > tbody > tr > td > center > table > tbody > tr > td > table:nth-child(2) > tbody > tr > td > table > tbody > tr:nth-child(1) > td.text-pad > p:nth-child(6)")
        const message = document.querySelector("body > table > tbody > tr > td > center > table > tbody > tr > td > table:nth-child(2) > tbody > tr > td > table > tbody > tr:nth-child(1) > td.text-pad > p:nth-child(6)")?.textContent;

        // The JS path to the paragraph containing amount is: document.querySelector("body > table > tbody > tr > td > center > table > tbody > tr > td > table:nth-child(2) > tbody > tr > td > table > tbody > tr:nth-child(1) > td.text-pad > p:nth-child(3)")
        const amountParagraph = document.querySelector("body > table > tbody > tr > td > center > table > tbody > tr > td > table:nth-child(2) > tbody > tr > td > table > tbody > tr:nth-child(1) > td.text-pad > p:nth-child(3)")?.textContent;
       
        console.log(`Message: ${message?.trim()}`)
        console.log(`Amount: ${amountParagraph?.trim()}`)

        // Etransfer refill messages will have the following format (without the quotes): "REFILL:<accountid>"

        // Check if message is a refill message
        if (!message?.toLowerCase().includes('refill:')) {
            return;
        }

        const accountid = message?.toLowerCase().split('refill:')[1]?.trim();

        console.log(`Accountid: ${accountid}`)

        // Get amount (should be between $ and (CAD)
        const amount: string = amountParagraph.split('$')[1].split('(CAD')[0]?.trim();

        console.log(`Amount: ${amount}`)

        if (accountid === undefined || amount === undefined) {
            throw 'accountid or amount is undefined';
        }

        // Create a new credit transaction for the account
        const transaction: ITransactionForm = {
            accountid: accountid,
            type: TransactionType.Credit,
            total: amount.replace('.', ''),
            reason: 'Auto: Etransfer Refill from ' + paymentKey,
            products: [],
        }

        Transaction.create(transaction).catch(err => {
            console.error(err);
        });


        // Exit node for testing
        // process.exit(0)
    }
}


// const etransferConfig = getFileConfig(__configPath, 'email.json', (err, interval) => {}) as Promise<EmailConfigFile>
const etransferConfig = {}
const etransfer = new EtransferProcessor(etransferConfig)
export default etransfer