// Setup is for configuration that is required for the spendit, but not required to start serveit

import express, { Request } from 'express';
import accountService from '../../services/account/index.js';
import { join } from 'path';
import { existsSync, statSync, readdirSync, writeFileSync } from 'fs';
import { app } from '../../index.js';
import { __frontendPath, __configPath, __backendPath, __savePath, __templatePath } from '../../config/paths.js';
import goauth from '../../core/auth/google-oauth.js';
import { isIAccountBaseForm, Roles } from 'typesit';
import { __envConfig } from '../../config/config.js';
import logger from '../../core/logger/index.js';
import { EmailConfigFile } from '../../config/config.type';

const router = express.Router();

// flags
const googleReady = () => {
    const google = existsSync(join(__configPath, 'google_credentials.json')) && existsSync(join(__configPath, 'google_token.json'));
    logger.debug(`googleReady: includeGoogle=${__envConfig.backend.includeGoogle}, google=${google}`);
    if (!google) {
        logger.warning('Google not ready')
    }
    return __envConfig.backend.includeGoogle ? google : true;
}

const emailReady = () => {
    const exists = existsSync(join(__configPath, 'email.json'));
    logger.debug(`emailReady: exists=${exists}`);
    if (!exists) {
        logger.warning('Email not ready')
    }
    return exists;
};

const brandingReady = () => {
    logger.debug('brandingReady: always true (not implemented)');
    return true; // currently not implemented
}

const adminReady = async () => {
    const users = await accountService.getAll()
    logger.debug(`adminReady: users.length=${users.length}`);
    if (users.length < 1) {
        logger.warning('Admin not ready')
    }
    return !(users.length < 1);
}

const appReady = () => {
    const appExists = existsSync(join(__frontendPath, '/index.html'));
    logger.debug(`appReady: includeApp=${__envConfig.backend.includeApp}, appExists=${appExists}`);
    if (!appExists) {
        logger.warning('App not ready')
    }
    return __envConfig.backend.includeApp ? appExists : true;
}

export const shouldSetup = async () => {
    const ready = appReady() && googleReady() && (await adminReady()) && brandingReady() && emailReady();
    logger.debug(`shouldSetup: ready=${ready}`);
    const condition = !ready;
    if (condition) {
        logger.warning('Setup required')
    }
    return condition;
}

function setupRoute(name, req, res) {
    logger.debug(`setupRoute: name=${name}, req.path=${req.path}`);
    if (req.path == `/${name}`) {
        res.sendFile(`setup/${name}.html`, { root: __templatePath })
        return;
    }
    res.redirect(`/setup/${name}?setup_key=${req.query['setup_key']}`)
}

async function setupHandler(req, res, next) {
    logger.debug(`setupHandler: path=${req.path}, setup_key=${req.query['setup_key']}`);
    // Check for valid setup key
    if (req.query['setup_key'] !== app.get('setup_key')) {
        logger.debug('setupHandler: invalid setup_key');
        res.sendStatus(401);
        return;
    }

    // Check if we should actually setup
    if (!await shouldSetup()) {
        logger.debug('setupHandler: setup not required, redirecting to /');
        res.redirect('/');
        return;
    }
    if (!appReady()) {
        logger.debug('setupHandler: app not ready');
        // app does not exist, get the app
        return;
    }
    
    // Routing
    if (!(await adminReady())){
        logger.debug('setupHandler: admin not ready, routing to account');
        setupRoute('account', req, res);
        return;
    }
    if (!emailReady()){
        logger.debug('setupHandler: email not ready, routing to email');
        setupRoute('email', req, res);
        return;
    }
    if (!googleReady()){
        logger.debug('setupHandler: google not ready, routing to google');
        setupRoute('google', req, res);
        return;
    }
    if (!brandingReady()){
        logger.debug('setupHandler: branding not ready, routing to branding');
        setupRoute('branding', req, res);
        return;
    }

    logger.debug('setupHandler: all setup complete, calling next()');
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
    logger.debug(`setupAccount: body=${JSON.stringify(req.body)}`);
    const account = req.body
    if (!isIAccountBaseForm(account)) {
        logger.debug('setupAccount: not an account form');
        throw 'not an account form'
    }
    account.role = Roles.Admin;
    await accountService.create(account);
    logger.debug('setupAccount: admin account created');
    res.redirect(`/setup?setup_key=${req.query['setup_key']}`)
}

async function setupGoogle(req, res) {
    const port = app.get('port')
    logger.debug(`setupGoogle: port=${port}`);
    if (port === null || port === undefined) {
        logger.debug('setupGoogle: listener address error');
        throw 'listener address error'
    }

    // log address
    const goauth_stuff = goauth.generateAuthUrl('setup/goauth', port, req.query);
    logger.debug(`setupGoogle: goauth_stuff=${JSON.stringify(goauth_stuff)}`);
    app.set('urls', goauth_stuff)
    res.redirect(goauth_stuff.oauth)
}


async function setupBranding(req, res) {
    logger.debug('setupBranding: not implemented');
    // not implemented
    // const address = app.get('address')
    // if (address === null || typeof address === 'string') {
    //     throw 'listener address error'
    // }
    // app.set('urls', generateAuthUrl(address))
}

async function setupEmail(req, res) {
    logger.debug(`setupEmail: body=${JSON.stringify(req.body)}`);

    // Check if provider is valid
    if (req.body.provider !== 'smtp' && req.body.provider !== 'google' && req.body.provider !== 'mock' && req.body.provider !== 'none') {
        logger.debug('setupEmail: invalid email provider');
        throw 'invalid email provider'
    }

    const emailConfig: EmailConfigFile = {
        provider: req.body.provider,
    }

    if (req.body.provider === 'smtp') {
        // Check if smtp config is valid
        if (typeof req.body.host !== 'string' || typeof req.body.port !== 'number' || typeof req.body.secure !== 'boolean' || typeof req.body.user !== 'string' || typeof req.body.pass !== 'string') {
            logger.debug('setupEmail: invalid smtp config');
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
    logger.debug(`setupEmail: writing email config to ${join(__configPath, 'email.json')}`);
    writeFileSync(join(__configPath, 'email.json'), JSON.stringify(emailConfig))
    res.redirect(`/setup?setup_key=${req.query['setup_key']}`)
}

async function authorizeGoogle(req, res) {
    logger.debug(`authorizeGoogle: query=${JSON.stringify(req.query)}`);
    // Get original query parameters from state parameter
    const state_raw = req.query['state'] // Base64 encoded JSON String
    if (typeof state_raw !== 'string') {
        logger.debug('authorizeGoogle: state parameter not found');
        throw "state parameter not found"
    }
    const state = JSON.parse(Buffer.from(state_raw, 'base64').toString('ascii'))
    const setup_key = state['setup_key']

    // Check setup key
    if (setup_key !== app.get('setup_key')) {
        logger.debug('authorizeGoogle: invalid setup_key');
        res.sendStatus(401);
        return;
    }

    if (goauth.isAuthorized()) {
        logger.debug('authorizeGoogle: already authorized');
        res.sendStatus(404);
        return;
    }
    const code = req.query['code'];

    if (typeof code !== 'string') {
        logger.debug('authorizeGoogle: authorization code not found');
        throw "authorization code not found"
    }

    logger.debug(`authorizeGoogle: authorizing with code`);
    await goauth.authorize(code, app.get('urls')['redirect'])
    res.redirect(`/setup?setup_key=${setup_key}`)
}

export default router;
