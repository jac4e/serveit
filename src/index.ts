"use strict";
import express from 'express';
import { join, dirname } from 'path';
import { existsSync, statSync, readdirSync, readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import {__envConfig} from './configuration/config.js';
import errorHandler from './_helpers/error-handler.js';
import api from './api.controller.js';
import setup, { shouldSetup } from './setup.controller.js';
import { randomUUID } from 'crypto'
import cors from 'cors';
import jwtAuthGuard from './_helpers/jwt.js';
import bodyParser from 'body-parser';
import logger from './_helpers/logger.js';
import https from 'https';
import http from 'http';
import { __configPath, __frontendPath, __savePath } from './_helpers/globals.js';
import ssl from './_helpers/ssl.js';
import db from './_helpers/db.js';
import { EmailConfigFile } from './configuration/config.type.js';
import { writeFileSync } from 'fs';
import bcrypt from 'bcrypt';
import { IAccountForm, Roles, isIAccountForm } from 'typesit';
import etransfer from './_tasks/etransfer.js';
import email from './_tasks/email.js';
import { tasks } from './_tasks/task.js';

logger.info('Starting serveit');

// Catch all unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error(`Unhandled Rejection at: ${JSON.stringify(promise)} reason: ${reason}`);
});

// Check if we are in development mode
if (__envConfig.environment === 'development') {
  logger.warning('Development mode');

  // Generate random password for dev account
  // Protects somewhat against unauthorized access on a misconfigured server
  const password = randomUUID().substring(0, 16);
  // Log password
  logger.debug(`Dev account password: ${password}`);

  // Setup development environment
  //   dev account
  const devaccount: IAccountForm = {
    username: 'dev',
    firstName: 'dev',
    lastName: 'dev',
    email: 'dev@dev.dev',
    role: Roles['Admin'],
    password: password,
  }
  
  // Check if dev account exists
  const devAccount = await db.account.findOne({username: 'dev'});
  if (devAccount) {
    // Update dev account password
    devAccount.hash = bcrypt.hashSync(devaccount.password as string, 10);
    devAccount.sessionid = randomUUID();
    await devAccount.save();
  } else {
    // Create dev account
    const devAccount = new db.account(devaccount);
    devAccount.hash = bcrypt.hashSync(devaccount.password as string, 10);
    devAccount.sessionid = randomUUID();
    await devAccount.save();
  }

  // Mock Email
  const emailConfig: EmailConfigFile = {
    provider: 'mock',
  }
  writeFileSync(join(__configPath, 'email.json'), JSON.stringify(emailConfig))

}


// Check that ssl cert and key are defined
ssl.exists()

export const app = express();

// Guards services from being accessed too soon
async function readyGuard(req, res, next) {
  if (await shouldSetup()) {
    logger.warning(`readyGuard 503 status ${await shouldSetup()}`)
    res.sendStatus(503);
    return;
  }
  return next();
}

// Guards accessing app when config states no app included
async function appGuard(req, res, next) {
  if (!__envConfig.backend.includeApp) {
    logger.warning(`appGuard 503 status ${__envConfig.backend.includeApp}`)
    res.sendStatus(503);
    return;
  }
  return next();
}

// connection logger
app.use((req, res, next) => {
    const data =  {
      method: req.method,
      protocol: req.protocol,
      endpoint: req.originalUrl,
      host: req.get('Host'),
      origin: req.get('Origin'),
      userAgent: req.get('User-Agent'),
    }
    // logger.connection(JSON.stringify(data));
    logger.log('info', JSON.stringify(data), {section: 'connection'});
    next();
})

// body parser
app.use(bodyParser.urlencoded({
  extended: true
}));
// app.use(bodyParser.json());
app.use(bodyParser.json({
  verify: (req, res, buf) => {
    req["rawBody"] = buf
  }
}))

// setup route
app.use('/setup', setup);

// api route
app.use('/api', jwtAuthGuard(), cors(), readyGuard, api);

// app route
app.get('/', readyGuard, appGuard, (req, res) => {
  res.sendFile('index.html', { root: __frontendPath })
});

// Catch all for files in _appPath
app.get('/*', readyGuard, appGuard, (req, res) => {
  const filePath = join(__frontendPath, req.path);
  logger.debug(`catch all ${filePath} ${req.path}`)
  // If the path does not exist, send the main app since it could be one of its routes
  if (!existsSync(filePath)) {
    res.sendFile('index.html', { root: __frontendPath })
    return;
  }
  // Check if the existing item is a directory or a file.
  if (statSync(filePath).isDirectory()) {
    // If the item is a directory: show all the items inside that directory.
    const filesInDir = readdirSync(filePath);
    return res.send(filesInDir);
  } else {
    return res.sendFile(filePath);
  }
});

// global error handler
app.use(errorHandler);


// start server
app.set('url', __envConfig.backend.url);
app.set('port', __envConfig.backend.port);
app.set('setup_key', randomUUID());
// const listener = app.listen(config.backend.port, );


var httpServer = http.createServer(app);
var httpsServer = https.createServer({key: ssl.key, cert: ssl.cert}, app);

httpServer.listen(8080);

const httpsListener = httpsServer.listen(__envConfig.backend.port, async () => {
  logger.info('Listening on ' + app.get('url'))
  if (await shouldSetup()){
    logger.info('Setup required, please use ' + __envConfig.backend.url + '/setup?setup_key=' + app.get('setup_key'))
  }
});


// Start processes
etransfer.start()
email.start()


// list tasks
logger.debug(tasks)
