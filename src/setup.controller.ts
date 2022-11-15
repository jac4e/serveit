import express from 'express';
import accounts from './account/controller.js';
import admin from './admin/controller.js';
import store from './store/controller.js';
import jwtAuthGuard from './_helpers/jwt.js';
import accountService from './account/service.js'
import transactionService from './_helpers/transaction.js';
import { join, dirname } from 'path';
import { existsSync, statSync, readdirSync, readFileSync } from 'fs';

// import guard from 'express-jwt-permissions';
import bodyParser from 'body-parser';
import cors from 'cors'
import { app, __appPath } from './index.js';
import { authorize, generateAuthUrl, isAuthorized } from './_helpers/email.js';
import { isIAccountForm, Roles } from 'typesit';
import { account } from './config.js';

const router = express.Router();
router.use(bodyParser.urlencoded({
    extended: true
}));

// flags
const scrapperReady = () => {
    return !isAuthorized()
};

const brandingReady = () => {
    return existsSync(join(__appPath, '/assets/branding'))
}

const accountReady = () => {
    return existsSync(join(__appPath, '/index.html')) && brandingReady()
}

const databaseReady = () => {
    return existsSync(join(__appPath, '/index.html')) && brandingReady()
}

const appReady = () => {
    return existsSync(join(__appPath, '/index.html')) && brandingReady()
}
const backendReady = () => {
    return databaseReady() && accountReady()
}

export const shouldSetup = () => {
    return !(appReady() && backendReady())
}

router.use(bodyParser.urlencoded({
    extended: true
}));
router.use(bodyParser.json());

router.get('/setup', base); 
router.get('/setup/brandin', getBranding); 
router.get('/setup/account', getAccount); 
router.post('/setup/account', setupAccount); 
router.get('/setup/scrapper', getScrapper); 
router.post('/setup/scrapper', setupScrapper); 
router.post('/goauth', authorizeGoogle);

function base(req, res) {
    if (!shouldSetup()) {
        res.redirect('/');
    }
    if (!brandingReady()) {
        res.redirect('/setup/branding')
    }
    if (!accountReady()) {
        res.redirect('/setup/account')
    }
    if (!scrapperReady()) {
        res.redirect('/setup/scrapper')
    }
}

function getBranding() {

}

function getAccount() {

}

function getScrapper() {

}

async function setupAccount(req, res) {
    if (accountReady()) {
        res.redirect('/setup');
    }
    const account = req.body
    if (!isIAccountForm(account)) {
        throw 'not an account form'
    }
    account.role = Roles.Admin;
    await accountService.create(account);
    res.sendStatus(200);
}
async function setupScrapper(req, res) {
    if (scrapperReady()) {
        res.redirect('/setup');
    }
    const address = app.get('address')
    if (address === null || typeof address === 'string') {
        throw 'listener address error'
    }
    app.set('urls', generateAuthUrl(address))
    
}

async function authorizeGoogle(req, res) {
    if (isAuthorized()) {
        res.sendStatus(404);
    }
    const code = req.query['code'];

    if (typeof code !== 'string') {
        throw "authorization code not found"
    }
    authorize(code, app.get('urls')['redirect'])
    res.redirect('/');
}

export default router;