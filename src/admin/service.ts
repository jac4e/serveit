import db from '../_helpers/db.js';
import transaction from '../_helpers/transaction.js';
import { ITransaction, ITransactionForm } from 'typesit';

const Account = db.account
const Product = db.product

async function createTransaction(transactionParam: ITransactionForm) {
    transactionParam.reason = `Admin: ${transactionParam.reason}`;
    return transaction.create(transactionParam).catch(err => {
        throw err;
    });
}

async function getAllTransactions() {
    return await transaction.getAll();
}

export default {
    createTransaction,
    getAllTransactions
}