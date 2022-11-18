import express, { Request } from 'express';
import accounts from './account/controller.js';
import admin from './admin/controller.js';
import store from './store/controller.js';
import jwtAuthGuard from './_helpers/jwt.js';
import accountService from './account/service.js'
import transactionService from './_helpers/transaction.js';
import { join, dirname } from 'path';
import { existsSync, statSync, readdirSync, readFileSync } from 'fs';
import { app, __distPath } from './index.js';
import { authorize, generateAuthUrl, isAuthorized } from './_helpers/email.js';
import { isIAccountForm, Roles } from 'typesit';
import { config } from './configuration/config.js';

const router = express.Router();

// flags
const scrapperReady = () => {
    // return !isAuthorized()
    return true; // currently not implemented
};

const brandingReady = () => {
    // return existsSync(join(__distPath, '/assets/branding'))
    return true; // currently not implemented
}

const accountReady = async () => {
    const users = await accountService.getAll()
    // console.log("accountready?", !(users.length < 1))
    return !(users.length < 1);
}

const appReady = () => {
    const app = existsSync(join(__distPath, '/index.html'));
    // console.log("appready?", config.backend.includeApp ? app : true)
    return config.backend.includeApp ? app : true;
}

export const shouldSetup = async () => {
    return !(appReady() && scrapperReady() && (await accountReady()) && brandingReady())
}

async function setupHandler(req, res, next) {
    // Check for valid setup key
    if (req.query['setup_key'] !== app.get('setup_key')) {
        res.sendStatus(401);
        return;
    }

    // Routing
    if (!await shouldSetup()) {
        res.redirect('/');
        return;
    }
    if (!appReady()) {
        // app does not exist, get the app
        
        return;
    }
    if (!(await accountReady())) {
        if (req.path == "/account") {
            res.sendFile('setup/account.html', { root: __distPath })
            return;
        }
        res.redirect(`/setup/account?setup_key=${req.query['setup_key']}`)
        return;
    }
    if (!scrapperReady()) {
        if (req.path == "/scrapper") {
            res.sendFile('setup/scrapper.html', { root: __distPath })
            return;
        }
        res.redirect(`/setup/scrapper?setup_key=${req.query['setup_key']}`)
        return;
    }
    if (!brandingReady()) {
        if (req.path == "/branding") {
            res.sendFile('setup/branding.html', { root: __distPath })
            return;
        }
        res.redirect(`/setup/branding?setup_key=${req.query['setup_key']}`)
        return;
    }
    next();
}

router.get('/*', setupHandler);
router.post('/branding', setupBranding);
router.post('/account', setupAccount);
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