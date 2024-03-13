import nodemailer, { Transporter } from "nodemailer";
import { IAccount, Roles } from "typesit";
import accountService from '../account/service.js'
import { __configPath } from "./globals.js";
import { getFileConfig } from "../configuration/config.js";
import logger from "./logger.js";
import SMTPTransport from "nodemailer/lib/smtp-transport/index.js";
import Mail from "nodemailer/lib/mailer/index.js";
import goauth from "./goauth.js";
import { EmailConfigFile } from "../configuration/config.type";
import { Auth, gmail_v1, google } from "googleapis";

abstract class EmailProvider {
    abstract sendAll(targetRole: Roles, subject: string, message: string) : void;
    abstract send(account: IAccount, subject: string, message: string) : void;
}

class Email {
    private provider: EmailProvider | null;
    
    constructor(config: Promise<EmailConfigFile>) {
        this.provider = null;
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

    async sendAll(targetRole: Roles, subject: string, message: string) {
        if (this.provider === null) {
            logger.warning("Email provider not configured");
            return;
        }
        this.provider.sendAll(targetRole, subject, message);
    }

    async send(account: IAccount, subject: string, message: string) {
        if (this.provider === null) {
            logger.warning("Email provider not configured");
            return;
        }
        this.provider.send(account, subject, message);
    }
}

class EmailProviderMock extends EmailProvider {
    configure(config: Promise<{[key: string]: any;}>) : void {
        logger.info("Mock email provider configured");
        return;
    }
    sendAll(targetRole: Roles, subject: string, message: string) : void {
        // Log
        logger.info(`Sending email to all ${targetRole} users with subject: ${subject} and message: ${message}`);
    }
    send(account: IAccount, subject: string, message: string) : void {
        // Log
        logger.info(`Sending email to ${account.email} with subject: ${subject} and message: ${message}`);
    }
}


class SMTPProvider extends EmailProvider {
    private config: { [key: string]: any; };
    private transporter: Transporter<SMTPTransport.SentMessageInfo>;
    private queue: Mail.Options[]
    private mailHandler: NodeJS.Timer;
    constructor(config: { [key: string]: any; }) {
        super();
        this.config = config;
        this.queue = [] as Mail.Options[];

        // Configure

        this.transporter = nodemailer.createTransport(this.config);
        this.transporter.verify(function (error, success) {
            if (error) {
                logger.error(error);
            } else {
                logger.info("SMTP Server is ready to take our messages");
            }
        });

        // Setup mail queue handler
        // Process mail queue every second
        this.mailHandler = setInterval(() => {
            // Don't do anything if mailer isnt configured
            if (this.config === null || this.transporter === null) {
                return;
            }

            // Make copy of queue and then empty the queue
            const toProcess = this.queue.map(message => message);
            this.queue.length = 0;

            // Send all messages in queue
            for (let index = 0; index < toProcess.length; index++) {
                try {
                    this.transporter.sendMail({
                        from: `<${this.config.auth.user}>`, // sender address
                        ...toProcess[index]
                    });
                } catch (error) {
                    logger.error(error);
                    this.queue.push(toProcess[index]);                    
                }
            }
        },1000);
    }

    async sendAll(targetRole: Roles, subject: string, message: string){
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
    }

    async send(account: IAccount, subject: string, message: string){
        this.queue.push({
          to: account.email, // list of receivers
          subject: subject, // Subject line
          text: message, // plain text body
        });
    }
}

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

class GmailProvider extends EmailProvider {
    // private oauth2Client
    private gmail: gmail_v1.Gmail | null;
    private mailHandler: NodeJS.Timer;
    private queue: { [key: string]: any; }[];

    constructor(config: { [key: string]: any; }) {
        super();

        // Configure
        // const gmail: gmail_v1.Gmail = google.gmail({
        //     version: 'v1',
        //     auth: oauth2Client,
        // })
        this.gmail = null;
        this.queue = [] as { [key: string]: any; }[];

        // Setup mail queue handler
        // Process mail queue every second
        this.mailHandler = setInterval(() => {
            // Don't do anything if mailer isnt configured
            if (this.gmail === null) {
                return;
            }

            // Make copy of queue and then empty the queue
            const toProcess = this.queue.map(message => message);
            this.queue.length = 0;

            // Send all messages in queue
            for (let index = 0; index < toProcess.length; index++) {

                // Error handling: if we are unable to send email, add message back to queue so it can be retried
                try {
                    this.gmail.users.messages.send({
                        userId: 'me',
                        requestBody: {
                            raw: this.createMessage(toProcess[index].to, toProcess[index].subject, toProcess[index].text)
                        }
                    })
                } catch (error) {
                    logger.error(error);
                    this.queue.push(toProcess[index]);    
                }
                
            }

            this.queue.length = 0;
        },1000);

        this.configure(config);
    }

    async configure(config: { [key: string]: any; }) {
        // wait for oauth2Client to be configured
        while (goauth.oauth2Client === null) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        this.gmail = google.gmail({
            version: 'v1',
            auth: goauth.oauth2Client,
        })
    }

    async sendAll(targetRole: Roles, subject: string, message: string){
        const accounts = await accountService.getAll()
        const emails = accounts.map(({role, email}) => {
            if (targetRole === role) {
                return email;
            } else {
              return '';
            }
        })

        this.queue.push({
          to: emails, // list of receivers
          subject: subject, // Subject line
          text: message, // plain text body
        });
    }

    async send(account: IAccount, subject: string, message: string){
        this.queue.push({
          to: account.email, // list of receivers
          subject: subject, // Subject line
          text: message, // plain text body
        });
    }

    private createMessage(recipients: string[] | string, subject: string, body: string) {
        const to = Array.isArray(recipients) ? recipients.join(', ') : recipients;
        const message = [
            'Content-Type: text/plain; charset="UTF-8"\n',
            'MIME-Version: 1.0\n',
            'Content-Transfer-Encoding: 7bit\n',
            'to: ', to, '\n',
            'subject: ', subject, '\n\n',
            body
        ].join('');

        return Buffer.from(message).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    }
}

const emailConfig = getFileConfig(__configPath, 'email.json', (err, interval) => {}) as Promise<EmailConfigFile>
const email = new Email(emailConfig)
export default email