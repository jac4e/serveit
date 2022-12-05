// Setup is for configuration that is required for the spendit, but not required to start serveit

import express, { Request } from 'express';
import accounts from './account/controller.js';
import admin from './admin/controller.js';
import store from './store/controller.js';
import jwtAuthGuard from './_helpers/jwt.js';
import accountService from './account/service.js'
import transactionService from './_helpers/transaction.js';
import { join, dirname } from 'path';
import { existsSync, statSync, readdirSync, writeFileSync } from 'fs';
import { app } from './index.js';
import { __frontendPath, __configPath, __backendPath, __savePath} from './_helpers/globals.js'
import { authorize, generateAuthUrl, isAuthorized } from './_helpers/scrapper.js';
import { isIAccountForm, Roles } from 'typesit';
import { config } from './configuration/config.js';
import logger from './_helpers/logger.js';

const router = express.Router();

// flags
const scrapperReady = () => {
    // return !isAuthorized()
    return true; // currently not implemented
};

const smtpReady = () => {
    return existsSync(join(__configPath, 'smtp.json'))
};

const brandingReady = () => {
    // return existsSync(join(__appPath, '/assets/branding'))
    return true; // currently not implemented
}

const adminReady = async () => {
    const users = await accountService.getAll()
    // console.log("accountready?", !(users.length < 1))
    return !(users.length < 1);
}

const appReady = () => {
    const app = existsSync(join(__frontendPath, '/index.html'));
    return config.backend.includeApp ? app : true;
}

export const shouldSetup = async () => {
    return !(appReady() && scrapperReady() && (await adminReady()) && brandingReady() && smtpReady())
}

function setupRoute(name, req, res) {
    if (req.path == `/${name}`) {
        res.sendFile(`setup/${name}.html`, { root: __backendPath })
        return;
    }
    res.redirect(`/setup/${name}?setup_key=${req.query['setup_key']}`)
}

async function setupHandler(req, res, next) {
    // Check for valid setup key
    if (req.query['setup_key'] !== app.get('setup_key')) {
        res.sendStatus(401);
        return;
    }

    // Check if we should actually setup
    if (!await shouldSetup()) {
        res.redirect('/');
        return;
    }
    if (!appReady()) {
        // app does not exist, get the app
        
        return;
    }
    
    // Routing
    if (!(await adminReady())){
        setupRoute('account', req, res);
        return;
    }
    if (!smtpReady()){
        setupRoute('smtp', req, res);
        return;
    }
    if (!scrapperReady()){
        setupRoute('scrapper', req, res);
        return;
    }
    if (!brandingReady()){
        setupRoute('branding', req, res);
        return;
    }

    next()
}

router.get('/*', setupHandler);
router.post('/branding', setupBranding);
router.post('/account', setupAccount);
router.post('/smtp', setupSmtp);
router.post('/scrapper', setupScrapper);
router.post('/goauth', authorizeGoogle);

async function setupAccount(req, res) {
    // console.log("test")
    const account = req.body
    if (!isIAccountForm(account)) {
        throw 'not an account form'
    }
    account.role = Roles.Admin;
    await accountService.create(account);
    res.sendStatus(200);
}

async function setupScrapper(req, res) {
    const address = app.get('address')
    if (address === null || typeof address === 'string') {
        throw 'listener address error'
    }
    app.set('urls', generateAuthUrl(address))
}


async function setupBranding(req, res) {
    // const address = app.get('address')
    // if (address === null || typeof address === 'string') {
    //     throw 'listener address error'
    // }
    // app.set('urls', generateAuthUrl(address))
}
async function setupSmtp(req, res) {
    const smtpConfig = {
            host: req.body.host,
            port: req.body.port,
            secure: req.body.secure === "on",
            auth: {
                user: req.body.user,
                pass: req.body.password
            }
    }
    writeFileSync(join(__configPath, 'smtp.json'), JSON.stringify(req.body))
    res.sendStatus(200);
}


async function authorizeGoogle(req, res) {
    // if (isAuthorized()) {
    //     res.sendStatus(404);
    // }
    const code = req.query['code'];

    if (typeof code !== 'string') {
        throw "authorization code not found"
    }
    authorize(code, app.get('urls')['redirect'])
    res.redirect('/');
}

export default router;