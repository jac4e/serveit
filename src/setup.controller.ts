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
import { __frontendPath, __configPath, __backendPath, __savePath, __templatePath} from './_helpers/globals.js'
import goauth from './_helpers/goauth.js';
import { isIAccountForm, Roles } from 'typesit';
import { __envConfig } from './configuration/config.js';
import logger from './_helpers/logger.js';
import { EmailConfigFile } from './configuration/config.type';

const router = express.Router();

// flags
const googleReady = () => {
    const google = existsSync(join(__configPath, 'google_credentials.json')) && existsSync(join(__configPath, 'google_token.json'));
    return __envConfig.backend.includeGoogle ? google : true;
}

const emailReady = () => {
    // existsSync(join(__configPath, 'smtp.json'))
    return existsSync(join(__configPath, 'email.json'))
};

const brandingReady = () => {
    // return existsSync(join(__appPath, '/assets/branding'))
    return true; // currently not implemented
}

const adminReady = async () => {
    const users = await accountService.getAll()
    return !(users.length < 1);
}

const appReady = () => {
    const app = existsSync(join(__frontendPath, '/index.html'));
    return __envConfig.backend.includeApp ? app : true;
}

export const shouldSetup = async () => {
    return !(appReady() && googleReady() && (await adminReady()) && brandingReady() && emailReady())
}

function setupRoute(name, req, res) {
    if (req.path == `/${name}`) {
        res.sendFile(`setup/${name}.html`, { root: __templatePath })
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
    if (!emailReady()){
        setupRoute('email', req, res);
        return;
    }
    if (!googleReady()){
        setupRoute('google', req, res);
        return;
    }
    if (!brandingReady()){
        setupRoute('branding', req, res);
        return;
    }

    next()
}

// Separate routes for setup/goauth as the setup_key must be retrieved from the state query parameter
router.get('/goauth', authorizeGoogle);
router.get('/*', setupHandler);
router.post('/branding', setupBranding);
router.post('/account', setupAccount);
router.post('/email', setupEmail);
router.post('/google', setupGoogle);

async function setupAccount(req, res) {
    const account = req.body
    if (!isIAccountForm(account)) {
        throw 'not an account form'
    }
    account.role = Roles.Admin;
    await accountService.create(account);
    res.redirect(`/setup?setup_key=${req.query['setup_key']}`)
}

async function setupGoogle(req, res) {
    const port = app.get('port')
    if (port === null || port === undefined) {
        throw 'listener address error'
    }

    // log address
    const goauth_stuff = goauth.generateAuthUrl('setup/goauth', port, req.query);
    app.set('urls', goauth_stuff)
    res.redirect(goauth_stuff.oauth)
}


async function setupBranding(req, res) {
    // not implemented
    // const address = app.get('address')
    // if (address === null || typeof address === 'string') {
    //     throw 'listener address error'
    // }
    // app.set('urls', generateAuthUrl(address))
}

async function setupEmail(req, res) {

    // Check if provider is valid
    if (req.body.provider !== 'smtp' && req.body.provider !== 'google' && req.body.provider !== 'mock' && req.body.provider !== 'none') {
        throw 'invalid email provider'
    }

    const emailConfig: EmailConfigFile = {
        provider: req.body.provider,
    }

    if (req.body.provider === 'smtp') {
        // Check if smtp config is valid
        if (typeof req.body.host !== 'string' || typeof req.body.port !== 'number' || typeof req.body.secure !== 'boolean' || typeof req.body.user !== 'string' || typeof req.body.pass !== 'string') {
            throw 'invalid smtp config'
        }

        emailConfig.smtp = {
            host: req.body.host,
            port: req.body.port,
            secure: req.body.secure,
            auth: {
                user: req.body.user,
                pass: req.body.pass
            }
        }
    }
    writeFileSync(join(__configPath, 'email.json'), JSON.stringify(emailConfig))
    res.redirect(`/setup?setup_key=${req.query['setup_key']}`)
}

async function authorizeGoogle(req, res) {
    // Get original query parameters from state parameter
    const state_raw = req.query['state'] // Base64 encoded JSON String
    if (typeof state_raw !== 'string') {
        throw "state parameter not found"
    }
    const state = JSON.parse(Buffer.from(state_raw, 'base64').toString('ascii'))
    const setup_key = state['setup_key']

    // Check setup key
    if (setup_key !== app.get('setup_key')) {
        res.sendStatus(401);
        return;
    }

    if (goauth.isAuthorized()) {
        res.sendStatus(404);
        return;
    }
    const code = req.query['code'];

    if (typeof code !== 'string') {
        throw "authorization code not found"
    }

    await goauth.authorize(code, app.get('urls')['redirect'])
    res.redirect(`/setup?setup_key=${setup_key}`)
}

export default router;