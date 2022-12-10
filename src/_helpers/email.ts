import nodemailer, { Transporter } from "nodemailer";
import { IAccount, Roles } from "typesit";
import accountService from '../account/service.js'
import { __configPath } from "./globals.js";
import { getFileConfig } from "../configuration/config.js";
import logger from "./logger.js";
import SMTPTransport from "nodemailer/lib/smtp-transport/index.js";
import Mail from "nodemailer/lib/mailer/index.js";

class Email {
    private config: null | { [key: string]: any; };
    private transporter: null | Transporter<SMTPTransport.SentMessageInfo>;
    private queue: Mail.Options[]
    private mailHandler: NodeJS.Timer;
    constructor(config: Promise<{[key: string]: any;}>) {
      this.config = null;
      this.transporter = null;
      this.queue = [] as Mail.Options[];

      // Async configure
      this.configure(config);

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
        for (let index = 0; index < toProcess.length; index++) {
          this.transporter.sendMail({
            from: `<${this.config.auth.user}>`, // sender address
            ...toProcess[index]
          });
        }
      },1000);
    }

    async configure(config: Promise<{[key: string]: any;}>){
      this.config = await config;
      this.transporter = nodemailer.createTransport(this.config);
      this.transporter.verify(function (error, success) {
          if (error) {
            logger.error(error);
          } else {
            logger.info("SMTP Server is ready to take our messages");
          }
        });
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

const email = new Email(getFileConfig(__configPath, 'smtp.json', (err, interval) => {

}))
export default email