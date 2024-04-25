import nodemailer, { Transporter } from "nodemailer";
import { IAccount, Roles } from "typesit";
import accountService from '../account/service.js'
import { __configPath } from "../_helpers/globals.js";
import { getFileConfig } from "../configuration/config.js";
import logger from "../_helpers/logger.js";
import SMTPTransport from "nodemailer/lib/smtp-transport/index.js";
import Mail from "nodemailer/lib/mailer/index.js";
import goauth from "../_helpers/goauth.js";
import { EmailConfigFile } from "../configuration/config.type.js";
import { Auth, gmail_v1, google } from "googleapis";
import Task from "./task.js";

interface EmailOptions {
    to?: string,
    bcc?: string[],
    subject: string,
    text: string
}

abstract class EmailProvider {
    abstract mailHandler(queue: EmailOptions) : void;
    abstract isConfigured() : boolean;
}

class EmailTask extends Task {
    private provider: EmailProvider | null;
    private queue: EmailOptions[]
    
    constructor(config: Promise<EmailConfigFile>) {
        super("email", 1000 * 60 * 5);
        this.provider = null;
        this.queue = [] as EmailOptions[];
        this.configure(config);
    };

    async configure(config: Promise<{[key: string]: any;}>) {
        // wait for config to be loaded
        config.then((config) => {
            switch (config.provider) {
                case "smtp":
                    this.provider = new SMTPProvider(config.smtp);
                    break;
                case "google":
                    this.provider = new GmailProvider(config.google);
                    break;
                case "mock":
                    this.provider = new EmailProviderMock();
                    break;
                case "none":
                    this.provider = null;
                    break;
                default:
                    logger.error(`Email provider ${config.provider} not found`);
                    break;
            }

            logger.info(`Email provider ${config.provider} configured`);
        });
    }

    stopHandler() {
    }
    startHandler() {
    }

    async taskHandler() {
        if (this.provider === null || !this.provider.isConfigured()) {
            logger.warning("Email provider not configured");
            return;
        }

        // Make copy of queue and then empty the queue
        const toProcess = this.queue.map(message => message);
        this.queue.length = 0;

        // Send all messages in queue
        for (let index = 0; index < toProcess.length; index++) {
            try {
                this.provider.mailHandler(toProcess[index]);
            } catch (error) {
                logger.error(error);
                this.queue.push(toProcess[index]);                    
            }
        }
    }

    async sendAll(targetRole: Roles, subject: string, message: string) {
        if (this.provider === null) {
            logger.warning("Email provider not configured");
            return;
        }
        const accounts = await accountService.getAll()
        const emails = accounts.map(({role, email}) => {
            if (targetRole === role) {
                return email;
            } else {
              return '';
            }
        })

        this.queue.push({
          bcc: emails, // list of receivers
          subject: subject, // Subject line
          text: message, // plain text body
        });
        // this.provider.sendAll(targetRole, subject, message);
    }

    async send(account: IAccount, subject: string, message: string) {
        if (this.provider === null) {
            logger.warning("Email provider not configured");
            return;
        }
        this.queue.push({
            to: account.email, // list of receivers
            subject: subject, // Subject line
            text: message, // plain text body
        });
        // this.provider.send(account, subject, message);
    }
}

class EmailProviderMock extends EmailProvider {
    configure(config: Promise<{[key: string]: any;}>) : void {
        logger.info("Mock email provider configured");
        return;
    }

    isConfigured(): boolean {
        return true;
    }

    mailHandler(mail: EmailOptions) : void {
        logger.info(`Mock email provider sending email to ${mail.to || mail.bcc} with subject: ${mail.subject} and message: ${mail.text}`);
    }
}


class SMTPProvider extends EmailProvider {
    private config: { [key: string]: any; };
    private transporter: Transporter<SMTPTransport.SentMessageInfo>;

    constructor(config: { [key: string]: any; }) {
        super();
        this.config = config;

        // Configure

        this.transporter = nodemailer.createTransport(this.config);
        this.transporter.verify(function (error, success) {
            if (error) {
                logger.error(error);
            } else {
                logger.info("SMTP Server is ready to take our messages");
            }
        });
    }

    isConfigured(): boolean {
        return this.config !== null && this.transporter !== null;
    }

    mailHandler(mail: Mail.Options) {
        this.transporter.sendMail({
            from: `<${this.config.auth.user}>`, // sender address
            ...mail
        });
    }
}

class GmailProvider extends EmailProvider {
    // private oauth2Client
    private gmail: gmail_v1.Gmail | null;

    constructor(config: { [key: string]: any; }) {
        super();

        // Configure
        // const gmail: gmail_v1.Gmail = google.gmail({
        //     version: 'v1',
        //     auth: oauth2Client,
        // })
        this.gmail = null;

        this.configure(config);
    }

    isConfigured(): boolean {
        return this.gmail !== null;
    }

    mailHandler(mail: EmailOptions) {
        if (this.gmail === null) {
            throw "Gmail not configured"
        }

        // Why is address inferred type is string | string[] | undefined
        const address = mail.to || mail.bcc;

        if (address === undefined) {
            throw "No to or bcc address provided"
        }

        this.gmail.users.messages.send({
            userId: 'me',
            requestBody: {
                raw: this.createMessage(address, mail.subject, mail.text)
            }
        })
    }

    private async configure(config: { [key: string]: any; }) {
        // wait for oauth2Client to be configured
        while (goauth.oauth2Client === null) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        this.gmail = google.gmail({
            version: 'v1',
            auth: goauth.oauth2Client,
        })
    }

    private createMessage(recipients: string[] | string, subject: string, body: string) {
        if (Array.isArray(recipients) && recipients.length === 0) {
            throw "No recipients provided"
        }

        if (typeof recipients === 'string' && recipients === '') {
            throw "No recipients provided"
        }

        const message = [
            'Content-Type: text/plain; charset="UTF-8"\n',
            'MIME-Version: 1.0\n',
            'Content-Transfer-Encoding: 7bit\n',
            (typeof recipients === 'string') ? `to: ${recipients}\n` : `bcc: ${recipients.join(', ')}\n`,
            'subject: ', subject, '\n\n',
            body
        ].join('');

        return Buffer.from(message).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    }
}

const emailConfig = getFileConfig(__configPath, 'email.json', (err, interval) => {}) as Promise<EmailConfigFile>
const email = new EmailTask(emailConfig);
export default email