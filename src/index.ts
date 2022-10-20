"use strict";
import express from 'express';
import {join, dirname} from 'path';
import {existsSync, statSync, readdirSync, readFileSync} from 'fs';
import { fileURLToPath } from 'url';
import config from './config.js'
import accountService from './account/service.js'
import transactionService from './_helpers/transaction.js';
import errorHandler from './_helpers/error-handler.js';
import api from './api.controller.js';
import { ITransactionForm, TransactionType } from 'typesit';

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
  // const account = await accountService.auth({username: config.account.username, password: config.account.password});
  // const genesisTransaction: ITransactionForm = {
  //   accountid: account.id,
  //   type: TransactionType.Credit,
  //   reason: "Genesis",
  //   products: [],
  //   total: BigInt(1000).toString()
  // }
  // await transactionService.create(genesisTransaction);
  // console.log(await accountService.getBalance(account.id));
}

deploy();

// api routes
app.use('/api', api);

// app route
app.get('/', (req,res) => {
  // console.log("ROUTE: Main Index")
  res.sendFile('app/index.html',{root: __dirname})
});

app.get('/*', (req,res) => {
  const filePath = join(`${__dirname}/app`, req.path);
  // If the path does not exist, return a 404.
  if (!existsSync(filePath)) {
    // console.log("ROUTE: Non Main Index")
    res.sendFile('app/index.html',{root: __dirname})
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
app.use(errorHandler);

// start server
app.set('port', config.port);
app.listen(config.port, () => console.log('Backend listening on port ' + app.get('port')));