import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import config from '../config.js';
import db from '../_helpers/db.js';
import { randomUUID } from 'crypto';
import transaction from '../_helpers/transaction.js';
import { zxcvbn, zxcvbnOptions } from '@zxcvbn-ts/core'
import zxcvbnCommonPackage from '@zxcvbn-ts/language-common';
import zxcvbnEnPackage from '@zxcvbn-ts/language-en';
import {IAccount, IAccountForm, IAccountLean, IAccountLogin, Roles} from '../_models/account.model.js';
import { ITransaction, ITransactionLean } from '../_models/transaction.model.js';


const zxcvbnBaseSettings = {
  translations: zxcvbnEnPackage.translations,
  graphs: zxcvbnCommonPackage.adjacencyGraphs,
  dictionary: {
    ...zxcvbnCommonPackage.dictionary,
    ...zxcvbnEnPackage.dictionary,
  },
}

zxcvbnOptions.setOptions(zxcvbnBaseSettings)

const Account = db.account;
const secret = config.secret;
const saltRounds = 10;

async function auth({
  username,
  password
}: IAccountLogin): Promise<IAccountLean & {token: string}>  {
  const account = await Account.findOne({
    username: username
  });

  // Account not found
  if (account === null) {
    // compare to random hash to help mitigate timing attacks
    // this may be foolish
    // it may also prevent people from discovering user accounts through brute force
    await bcrypt.compare(password, "$2b$10$rQweXBgpHcRXB8nblwv7JO4URRkvC7GjMhNgDPJA35HNcG383YG8W")
    throw `Auth error username or password is incorrect`
  }

  // Do not login nonverified users
  if (account.role === Roles['Unverified']) {
    throw `Auth error account not verified`
  }

  const match = await bcrypt.compare(password, account.hash)

  if (account && match) {
    const token = jwt.sign({
      sub: account.id,
      sid: account.sessionid,
      permissions: account.role
    }, secret, {
      expiresIn: '7d'
    })
    const balance = await getBalance(account.id);
    // toJSON sanitization is not working
    const sanitizedAccount = await Account.findById(account.id).lean<IAccountLean>();
    return {
      ...sanitizedAccount,
      balance,
      token
    }
  } else {
    throw `Auth error username or password is incorrect`
  }
}

// Private registration of verified accounts
async function create(accountParam: IAccountForm): Promise<void> {
  // validate
  console.log(JSON.stringify(accountParam))

  // make sure username is not taken
  if (await Account.findOne({
      username: accountParam.username
    })) {
    throw `username '${accountParam.username}' is already taken`
  }

  // Password validation
  const result = zxcvbn(accountParam.password, [accountParam.username, accountParam.firstName, accountParam.lastName, accountParam.email]);
  if (result.score < 2) {
    throw `Registration error password is too weak: ${result.feedback.warning}`
  }

  const account = new Account(accountParam)
  
  // hash password
  if (accountParam.password) {
    account.hash = bcrypt.hashSync(accountParam.password, saltRounds);
  }

  // create session ID
  account.sessionid = randomUUID();

  // save account
  await account.save();
}

// async function search({
//   type,
//   query,
//   sortBy,
//   limit,
//   page
// }) {
//   //sortBy is object composed of {field: 'order'}
//   console.log(type, query, sortBy, limit, page)
//   let searchParam = {}
//   searchParam[type] = query;
//   let results = await Account.find(searchParam).sort(sortBy).skip(parseInt(page) * parseInt(limit)).limit(parseInt(limit))
//   console.log(results)
//   const count = await Account.countDocuments(query)
//   return {
//     results: results,
//     total: count,
//     page: page,
//     pageSize: results.length
//   }
// }


async function getSelfTransactions(id: string): Promise<ITransactionLean[]> {
  // need this specific function to remove account id from transaction list
  const transactions = await transaction.getByAccountId(id);
  return transactions.map(({accountid, ...keepAttrs}) => keepAttrs);
}

// Private account functions

async function getBalance(id: string): Promise<bigint>{
  // transaction based balance
  // console.log(`id: ${id}`)
  return await transaction.getBalanceByAccountId(id)
  // console.log(res)
}

async function resetSession(id: string): Promise<void> {
  Account.findById(id, (account: IAccount | null)=> {
    if (account === null){
      throw 'Account not found'
    }
    account.sessionid = randomUUID();
    account.save();
  });
}

async function getAll(): Promise<IAccountLean[]> {
  const accounts = await Account.find({}).lean<IAccountLean[]>();
  // console.log(accounts)
  for (let index = 0; index < accounts.length; index++) {
    accounts[index].balance = await getBalance(accounts[index].id) 
  }
  // console.log(test);
  return accounts;
}


async function getById(id: string): Promise<IAccountLean> {
  // console.log("getbyid",id)
  const account = await Account.findById(id).lean<IAccountLean>();
  const balance = await getBalance(id);
  if (account === null){
    throw "account not found"
  }
  account.balance = balance;
  // console.log(test);
  return account;
}

async function verify(id: string): Promise<void> {
  let account = await Account.findById<IAccount>(id);
  if (account === null){
    throw "account not found"
  }
  if (account.role !== Roles.Unverified){
    throw "account already verified"
  }
  account.role = Roles.User;
  account.save();
}

async function pay(amount: bigint, id: string): Promise<boolean> {
  // makes payment on account based on the account Id
  // returns true on success, false on failure
  const account = await Account.findById(id);
  const balance = await getBalance(id);
  // console.log('pay',amount,balance)
  if (amount > balance){
    return false;
  }

  return true;
}

export default {
  auth,
  create,
  getAll,
  getById,
  getBalance,
  resetSession,
  getSelfTransactions,
  pay,
  verify
  // search
}