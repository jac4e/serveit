import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import {__envConfig} from '../configuration/config.js';
import db from '../_helpers/db.js';
import { randomUUID } from 'crypto';
import transaction from '../_helpers/transaction.js';
import { zxcvbn, zxcvbnOptions } from '@zxcvbn-ts/core'
import zxcvbnCommonPackage from '@zxcvbn-ts/language-common';
import zxcvbnEnPackage from '@zxcvbn-ts/language-en';
import { ITransaction, IAccountDocument, IAccountForm, IAccount, ICredentials, Roles } from 'typesit';
import email from '../_helpers/email.js';


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
const secret = __envConfig.backend.jwt;
const saltRounds = 10;

async function auth(credentials: ICredentials): Promise<{ account: IAccount, token: string }> {
  const account = await Account.findOne({
    username: credentials.username
  });

  // Account not found
  if (account === null) {
    // compare to random hash to help mitigate timing attacks
    // this may be foolish
    // it may also prevent people from discovering user accounts through brute force
    await bcrypt.compare(credentials.password, "$2b$10$rQweXBgpHcRXB8nblwv7JO4URRkvC7GjMhNgDPJA35HNcG383YG8W")
    throw `Auth error username or password is incorrect`
  }

  // Do not login nonverified users
  if (account.role === Roles['Unverified']) {
    throw `Auth error account not verified`
  }

  const match = await bcrypt.compare(credentials.password, account.hash)

  if (match) {
    const token = jwt.sign({
      sub: account.id,
      sid: account.sessionid,
      permissions: account.role
    }, secret, {
      expiresIn: '7d'
    })
    const balance = await getBalance(account.id);
    // toJSON sanitization is not working
    const sanitizedAccount = await Account.findById(account.id).lean<IAccount>();
    return {
      account: {
        ...sanitizedAccount,
        balance: balance,
      },
      token: token
    }
  } else {
    throw `Auth error username or password is incorrect`
  }
}

// Private registration of verified accounts
async function create(accountParam: IAccountForm): Promise<void> {
  // validate
  // we need to ensure following properties exist:
  // username
  // password
  // firstName
  // lastName
  // email
  // role
  if (accountParam.username === undefined) {
    throw 'username is required to create account'
  }
  if (accountParam.password === undefined) {
    throw 'password is required to create account'
  }
  if (accountParam.firstName === undefined) {
    throw 'firstName is required to create account'
  }
  if (accountParam.lastName === undefined) {
    throw 'lastName is required to create account'
  }
  if (accountParam.email === undefined) {
    throw 'email is required to create account'
  }
  if (accountParam.role === undefined) {
    throw 'role is required to create account'
  }

  // Email validation
  // must end in '@ualberta.ca'
  // This may be missing some cases where the email is not a ualberta email
  if (!/@ualberta.ca$/.test(accountParam.email)) {
    throw `email must be of the ualberta.ca domain`;
  }

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

  // Notify
  const subject = `Spendit - Account Registration Successful`;
  const message = `Hi ${account.firstName},\nYour spendit account has been successfully created!\n${account.role === Roles.Unverified ? 'Note, your account is currently unverified so you will be unable to use spendit until an admin verifies your account. If your account has not been verified in 24 hours, please email epclub@ualberta.ca or reach out to an executive on discord.' : 'Your account is already verified so you can begin using the store at anytime.'}`
  email.send(account.toObject(), subject, message)
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

// Private account functions

async function getBalance(id: string): Promise<bigint> {
  // transaction based balance
  // console.log(`id: ${id}`)
  return await transaction.getBalanceByAccountId(id)
  // console.log(res)
}

async function resetSession(id: string): Promise<void> {
  const account = await Account.findById(id)
  if (account === null) {
    throw 'Account not found'
  }
  account.sessionid = randomUUID();
  account.save();
}

async function getAll(): Promise<IAccount[]> {
  const accounts = await Account.find({}).lean<IAccount[]>();
  // console.log(accounts)
  for (let index = 0; index < accounts.length; index++) {
    accounts[index].balance = await getBalance(accounts[index].id)
  }
  // console.log(test);
  return accounts;
}


async function getById(id: string): Promise<IAccount> {
  // console.log("getbyid",id)
  const account = await Account.findById(id).lean<IAccount>();
  if (account === null) {
    throw "account not found"
  }
  const balance = await getBalance(id);
  account.balance = balance;
  // console.log(test);
  return account;
}

async function verify(id: string, role: Roles): Promise<void> {
  let account = await Account.findById<IAccountDocument>(id);
  if (account === null) {
    throw "account not found"
  }
  if (account.role !== Roles.Unverified) {
    throw "account already verified"
  }
  if (role === Roles.Admin || role === Roles.Unverified) {
    throw "cannot verify user as admin or unverified"
  }
  account.role = role;
  account.save();

  // Notify user
  const subject = `Spendit - Account Verified`;
  const message = `Hi ${account.firstName},\nYour spendit account has been verified as a ${account.role}!`
  email.send(account.toObject(), subject, message)
}

async function pay(amount: bigint, id: string): Promise<void> {
  // makes payment on account based on the account Id
  // throws an error if payment cannot be made
  const account = await Account.findById(id);
  const balance = await getBalance(id);
  // console.log('pay',amount,balance)
  if (amount > balance) {
    throw 'Balance too low'
  }
}

async function updateAccountById(id: string, accountParam: IAccountForm) {

  let account = await Account.findById<IAccountDocument>(id)
  if (account === null) {
      throw `Account '${id}' does not exist`;
  }

  // Notify user first, in case email is changed
  const subject = `Spendit - Account Information Changed`;
  const message = `Hi ${account.firstName},\nYour spendit account with the ID of ${account.id} has been modified. If this was not initiated by you, please reach out to an admin as soon as possible.`
  email.send(account.toObject(), subject, message)

  account.set(accountParam);
  account.save()
}

async function deleteAccountById(id: IAccount['id']): Promise<void> {
    const account = await Account.findById<IAccountDocument>(id);
    if (account === null) {
        throw `Account '${id}' does not exist`;
    }

    await Account.deleteOne({_id: id})

    // Notify user
    const subject = `Spendit - Account Deleted`;
    const message = `Hi ${account.firstName},\nYour spendit account with the ID of ${account.id} has been deleted. If this was not initiated by you, please reach out to an admin as soon as possible.`
    email.send(account.toObject(), subject, message)
}

export default {
  auth,
  create,
  getAll,
  getById,
  getBalance,
  resetSession,
  updateAccountById,
  deleteAccountById,
  pay,
  verify
  // search
}