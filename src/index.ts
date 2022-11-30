"use strict";
import express from 'express';
import { join, dirname } from 'path';
import { existsSync, statSync, readdirSync, readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import {config} from './configuration/config.js';
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
import { __appPath } from './_helpers/globals.js';
import ssl from './_helpers/ssl.js';

logger.info('Starting serveit');

// Check that ssl cert and key are defined
ssl.exists()

export const app = express();

// Guards services from being accessed too soon
async function readyGuard(req, res, next) {
  if (await shouldSetup()) {
    logger.warning('readyGuard 503 status' + await shouldSetup())
    res.sendStatus(503);
    return;
  }
  return next();
}

// Guards accessing app when config states no app included
async function appGuard(req, res, next) {
  if (!config.backend.includeApp) {
    logger.warning('appGuard 503 status' + config.backend.includeApp)
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
    logger.connection(data);
    next();
})

// body parser
app.use(bodyParser.urlencoded({
  extended: true
}));
app.use(bodyParser.json());

// setup route
app.use('/setup', setup);

// api route
app.use('/api', jwtAuthGuard(), cors(), readyGuard, api);

// app route
app.get('/', readyGuard, appGuard, (req, res) => {
  res.sendFile('index.html', { root: __appPath })
});

// Catch all for files in _appPath
app.get('/*', readyGuard, appGuard, (req, res) => {
  const filePath = join(__appPath, req.path);
  logger.debug(`catch all ${filePath} ${req.path}`)
  // If the path does not exist, send the main app since it could be one of its routes
  if (!existsSync(filePath)) {
    res.sendFile('index.html', { root: __appPath })
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

// Start email backend
// email.authorize().then(email.processTransfers).catch(console.error);

// start server
app.set('port', config.backend.port);
app.set('setup_key', randomUUID());
// const listener = app.listen(config.backend.port, );

var httpServer = http.createServer(app);
var httpsServer = https.createServer({key: ssl.key, cert: ssl.cert}, app);

httpServer.listen(8080);
const httpsListener = httpsServer.listen(config.backend.port, async () => {
  logger.info('Listening on ' + app.get('port'))
  if (await shouldSetup()){
    logger.info('Setup required, please use ' + config.backend.url + '/setup?setup_key=' + app.get('setup_key'))
  }
});