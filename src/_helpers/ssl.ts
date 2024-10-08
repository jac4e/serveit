import Greenlock from '@root/greenlock';
import acmeDnsCloudflare from 'acme-dns-01-cloudflare';
import { __envConfig, __pkg } from '../configuration/config.js';
import logger from './logger.js';
import { chown, readFileSync, mkdirSync, existsSync, writeFileSync } from 'fs'
import { join } from 'path';
import { __projectPath, __backendPath, __savePath } from './globals.js';
import { X509Certificate }  from 'crypto';
import selfsigned from 'selfsigned';

const __keyPath = join(__envConfig.ssl.path,'key.pem')
const __certPath = join(__envConfig.ssl.path,'cert.pem')
const __chainPath = join(__envConfig.ssl.path,'pem.pem')

// create ssl path if it does not exist
if (!existsSync(__envConfig.ssl.path)) {
    // process.umask(0);
    mkdirSync(__envConfig.ssl.path, { mode: 0o770 });
    if (process.getuid === undefined || process.getuid === undefined) {
        logger.critical('Must use a posix os');
    }
    // logger.debug((<any> process).getuid(), (<any> process).getgid())
    chown(__envConfig.ssl.path, (<any> process).getuid(), (<any> process).getgid(), logger.debug)
}

class SSL {
    constructor() {
        // Prevent self signed production server
        if (__envConfig.environment === "production" && __envConfig.ssl.selfSign){
            logger.critical("Self signed certificate is not allowed in production");
            process.exit(1)
        }
        // check if keys exist
        if (this.key !== undefined || this.cert !== undefined || this.chain !== undefined) {
            logger.info(`SSL cert found in ${__envConfig.ssl.path}!`)
            return;
        }

        logger.warning(`No SSL cert found in ${__envConfig.ssl.path}, creating one now...`)

        if (__envConfig.ssl.selfSign) {
            this.selfSign()
        } else {
            this.cloudflare()
        } 
    }
    get key(): string | undefined {
        return existsSync(__keyPath) ? readFileSync(__keyPath, 'utf-8') : undefined;
    }
    get cert(): string | undefined {
        const path = join(__envConfig.ssl.path,'cert.pem')
        return existsSync(__certPath) ? readFileSync(__certPath, 'utf-8') : undefined;
    }
    get chain(): string | undefined {
        const path = join(__envConfig.ssl.path,'pem.pem')
        return existsSync(__chainPath) ? readFileSync(__chainPath, 'utf-8') : undefined;
    }
    exists(){
        while (true) {
            if (this.key === undefined || this.cert === undefined || this.chain) {
                break;
            }
            
        }
    }
    private checkValidity(cert) {
        const { validTo } = new X509Certificate(cert);
    }
    private selfSign() {
        // get self sign
        const attrs = [{ name: __pkg.name, value: __envConfig.ssl.subject, type: __pkg.name }];
        const pems = selfsigned.generate(attrs, { days: 365, keySize: 2048 });

        // save self signed
        writeFileSync(__certPath, pems.cert,{mode: 0o600});
        writeFileSync(__keyPath, pems.private,{mode: 0o600});
        writeFileSync(__chainPath, pems.public,{mode: 0o600});
    }
    private cloudflare() {
        const cloudflareDns01 = new acmeDnsCloudflare({
            token: __envConfig.ssl.cloudflare.token,
            verifyPropagation: true,
            verbose: true // log propagation delays and other debug information
        });
        
        const greenlock = Greenlock.create({
            packageAgent: __pkg.name + '/' + __pkg.version,
            configDir: __savePath,
            packageRoot: __projectPath,
            maintainerEmail: __pkg.author
        });

        greenlock.manager.defaults({
            agreeToTerms: true,
            subscriberEmail: __pkg.author,
            store: {
                module: "greenlock-store-fs",
                basePath: __envConfig.ssl.path
            },
            challenges: {
                "dns-01": cloudflareDns01
            }
        });
        
        greenlock.add({
            subject: __envConfig.ssl.subject,
            altnames: __envConfig.ssl.altnames
        }).then(function(){
            logger.info(`Successfully added ${__envConfig.ssl.subject} SSL cert`);
        }).catch(logger.error);

        greenlock.get({ servername: __envConfig.ssl.subject })
        .then(function(pems) {
            if (pems && pems.privkey && pems.cert && pems.chain) {
                console.info('Success');
            }
            //logger.debug(pems);
        })
        .catch(function(e) {
            console.error('Big bad error:', e.code);
            console.error(e);
        });
    }
}

const ssl = new SSL;
export default ssl;