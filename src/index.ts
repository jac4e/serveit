"use strict";
import express from 'express';
import { join, dirname } from 'path';
import { existsSync, statSync, readdirSync, readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import config from './config.js'
import errorHandler from './_helpers/error-handler.js';
import api from './api.controller.js';
import { isIAccount, isIAccountForm, ITransactionForm, Roles, TransactionType } from 'typesit';
import './_helpers/email.js';
import { authorize, generateAuthUrl, isAuthorized } from './_helpers/email.js';
import bodyParser from 'body-parser';
import { shouldSetup } from './setup.controller.js';

export const __distPath = dirname(fileURLToPath(import.meta.url));
export const __appPath = join(__distPath, '../app');
export const app = express();

// setup route
app.use('/setup', setup);

// api route
app.use('/api', api);

// app route
app.get('/', (req, res) => {
  // console.log("ROUTE: Main Index")

  // Check if server is properly setup, if not we should setup
  if (shouldSetup()) {
    res.redirect('/setup')
  }
  // things to setup:
  //   Admin account
  //   Gmail account

  res.sendFile('app/index.html', { root: __appPath })
});


// Initial setup


// Catch all for files in _appPath
app.get('/*', (req, res) => {
  const filePath = join(__appPath, req.path);
  console.log(filePath)
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
app.set('port', config.port);
const listener = app.listen(config.port, () => {
  console.log('Backend listening on port ' + app.get('port'))
  app.set('address', listener.address())
});