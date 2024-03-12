import goauth from "./goauth.js";
import { Auth, gmail_v1, google } from "googleapis";
import { authenticate } from 'mailauth';

class EtransferProcessor {
    private gmail: gmail_v1.Gmail | null;
    private incomingHandler: NodeJS.Timer;
    private labelIds: { 
        incoming: string;
        processing: string; 
    } | null;

    constructor(config: { [key: string]: any; }) {
        this.gmail = null;
        this.labelIds = null;

        // THIS IS TEMPORARY
        // Best way forward would be to setup a pub.sub for etransfer
        // https://stackoverflow.com/questions/71924157/how-does-users-watch-in-gmail-google-api-listen-for-notifications
        // But for now, we will check mailbox every 5 minutes for new messages
        this.incomingHandler = setInterval(async () => {
            // Don't do anything if gmail is not configured
            if (this.gmail === null && this.labelIds === null) {
                return;
            }

            // Process incoming e-transfers
            console.log("Processing incoming e-transfers")
            const etransfers = await this.getEtransfers();

            // Verify etransfers
            for (let i = 0; i < etransfers.incoming.length; i++) {
                try {
                    const res = await this.verify(etransfers.incoming[i]);
                    if (res) {
                        console.log("Etransfer verified");
                    } else {
                        console.log("Etransfer not verified");
                    }
                } catch (err) {
                    console.log(`Message ${etransfers.incoming[i].id} could not be verified: ${err}`)
                }
                // Wait 1 second before verifying next etransfer
                await new Promise(resolve => setTimeout(resolve, 1000));
            }

        }, 1000 * 60 * 5); // 5 minutes

        this.configure(config);
    }

    private async configure(config: { [key: string]: any; }) {
        // wait for oauth2Client to be configured
        while (goauth.oauth2Client === null) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        // Configure gmail
        this.gmail = google.gmail({
            version: 'v1',
            auth: goauth.oauth2Client,
        })

        // Get email labels
        await this.getLabels();
    }

    private async getLabels() {
        if (this.gmail === null) {
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
            throw 'no "INCOMING_ETRANSFERS" label';
        }

        const processing = labels.filter(e => e.name === 'PROCESSING_ETRANSFERS').length === 1 ? labels.filter(e => e.name === 'PROCESSING_ETRANSFERS')[0] : undefined;
        if (processing === undefined) {
            throw 'no "PROCESSING_ETRANSFERS" label';
        }

        // Check that label id's exist
        if (incoming.id === undefined || processing.id === undefined || incoming.id === null || processing.id === null) {
            throw 'label id not found';
        }

        this.labelIds = {
            incoming: incoming.id,
            processing: processing.id
        }

    }

    async getEtransfers(): Promise<{ incoming: gmail_v1.Schema$Message[]; processing: gmail_v1.Schema$Message[]; }> {
        // Check if gmail is configured
        if (this.gmail === null && this.labelIds === null) {
            throw 'gmail not configured';
        }

        let etransfers: { incoming: gmail_v1.Schema$Message[]; processing: gmail_v1.Schema$Message[]; } = {
            incoming: [],
            processing: []
        };

        // Get email messages
        const resMessagesGet = await this.gmail!.users.messages.list({
            userId: 'me',
            labelIds: [this.labelIds!.incoming],
        } as gmail_v1.Params$Resource$Users$Messages$List);
        const potentialIncoming = resMessagesGet.data.messages;

        return etransfers;
    }

    async verify(messageLean: gmail_v1.Schema$Message): Promise<boolean> {
        // Check if gmail is configured
        if (this.gmail === null && this.labelIds === null) {
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
        console.log(message)
        if (message.raw === undefined || message.raw === null) {
            throw 'no raw message';
        }
        const messageDecoded = Buffer.from(message.raw, 'base64').toString("utf8")
        const authentication = await authenticate(messageDecoded)
        console.log(authentication)

        // Get ARC-Authentication-Results from gmail
        if (message.payload === undefined) {
            throw 'no message payload';
        }
        const headers = message.payload.headers;

        if (headers === undefined) {
            throw 'no headers';
        }

        const arcAuthResults = headers.filter(e => e.name === 'ARC-Authentication-Results').length === 1 ? headers.filter(e => e.name === 'ARC-Authentication-Results')[0].value : undefined;
        if (arcAuthResults === undefined || arcAuthResults === null) {
            throw 'no arc authentication results found';
        }

        console.log(arcAuthResults)

        // Return false for now until a proven verification method is found
        return false;
    }


}