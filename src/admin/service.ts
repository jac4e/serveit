import db from '../_helpers/db.js';
import transaction from '../_helpers/transaction.js';
import { ITransaction, ITransactionForm } from 'typeit';

const Account = db.account
const Product = db.product

async function createTransaction(transactionParam: ITransactionForm) {
    transactionParam.reason = `Admin: ${transactionParam.reason}`;
    transaction.create(transactionParam);
}

async function getAllTransactions() {
    return await transaction.getAll();
}

export default {
    createTransaction,
    getAllTransactions
}