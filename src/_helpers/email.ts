import nodemailer from "nodemailer";
import { IAccount, Roles } from "typesit";
import accountService from '../account/service.js'
import { join, dirname } from 'path';
import { existsSync, statSync, readdirSync, readFileSync } from 'fs';
import { __configPath } from "./globals.js";
import logger from "./logger.js";

class Email {
    private config
    private transporter
    constructor(config) {
        this.config = config;
        // create reusable transporter object using the default SMTP transport
        this.transporter = nodemailer.createTransport({...config, 
            secureConnection: true,
            tls: {
                 ciphers:"SSLv3",
             }
          });
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
            }
        })
        return await this.transporter.sendMail({
          from: `<${this.config.auth.user}>`, // sender address
          bcc: emails, // list of receivers
          subject: subject, // Subject line
          text: message, // plain text body
        });
    }

    async send(account: IAccount, subject: string, message: string){
        return await this.transporter.sendMail({
          from: `<${this.config.auth.user}>`, // sender address
          to: account.email, // list of receivers
          subject: subject, // Subject line
          text: message, // plain text body
        });
    }
}

const config = JSON.parse(readFileSync(join(__configPath, 'smtp.json'), 'utf-8'))
const email = new Email(config)
export default email