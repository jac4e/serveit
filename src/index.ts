"use strict";
import express from 'express';
import {join, dirname} from 'path';
import {existsSync, statSync, readdirSync, readFileSync} from 'fs';
import { fileURLToPath } from 'url';
import config from './config.js'
import accountService from './account/service.js'
import errorHandler from './_helpers/error-handler.js';
import api from './api.controller.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();

// Initial deploy
async function deploy() {
  // check useraccount amount
  const users = await accountService.getAll()
  // console.log("checking if we should deploy")
  if (users.length < 1){
    // add base admin account
    // console.log("deploying")
    await accountService.create(config.account);
  }
}

deploy()

// api routes
app.use('/api', api);

// app route
app.get('/', (req,res) => {
  // console.log("ROUTE: Main Index")
  res.sendFile('dist/index.html',{root: __dirname})
});

app.get('/*', (req,res) => {
  const filePath = join(`${__dirname}/dist`, req.path);
  // If the path does not exist, return a 404.
  if (!existsSync(filePath)) {
    // console.log("ROUTE: Non Main Index")
    res.sendFile('dist/index.html',{root: __dirname})
    return;
  }
  // Check if the existing item is a directory or a file.
  if (statSync(filePath).isDirectory()) {
    // console.log("ROUTE: dir")
    const filesInDir = readdirSync(filePath);
    // If the item is a directory: show all the items inside that directory.
    return res.send(filesInDir);
  } else {
    // console.log("ROUTE: file")
    return res.sendFile(filePath);
  }
});

// global error handler
app.use(errorHandler)

// start server
app.set('port', config.port)
app.listen(config.port, () => console.log('Backend listening on port ' + app.get('port')));