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

export const __distPath = dirname(fileURLToPath(import.meta.url));
export const __appPath = join(__distPath, '../app');

export const app = express();

// Guards services from being accessed too soon
async function readyGuard(req, res, next) {
  if (await shouldSetup()) {
    res.sendStatus(503);
    return;
  }
  next();
}

// Guards accessing app when config states no app included
async function appGuard(req, res, next) {
  if (!config.backend.includeApp) {
    res.sendStatus(503);
    return;
  }
  next();
}

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
  res.sendFile('app/index.html', { root: __appPath })
});

// Catch all for files in _appPath
app.get('/*', readyGuard, appGuard, (req, res) => {
  const filePath = join(__appPath, req.path);
  // If the path does not exist, redirect to main app since it could be one of its routes
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
const listener = app.listen(config.backend.port, async () => {
  console.log('Listening on port ' + app.get('port'))
  if (await shouldSetup()){
    console.log('Setup required, please use ' + config.backend.url + '/setup?setup_key=' + app.get('setup_key'))
  }
  app.set('address', listener.address())
});