import db from './db.js';
import accountService from '../account/service.js';
import { ITransaction, IAccount, IProduct, ITransactionDocument, ITransactionForm, ITransactionItem, TransactionType } from 'typesit';
import logger from './logger.js';
import email from '../_tasks/email.js';

const Transaction = db.transaction;

async function create(transactionParam: ITransactionForm): Promise<void> {
    // should store entire account and products in transaction incase product or user is deleted
    // this way proper invoices can still be generated

    // Check transaction type:
    if (!Object.values(TransactionType).includes(transactionParam.type)) {
        throw 'invalid transaction type'
    }

    // Check if account valid
    const account = await accountService.getById(transactionParam.accountid).catch(err => {
        throw err;
    });

    let transaction = new Transaction();

    transaction.set(transactionParam);
    await transaction.save()
    // logger.transaction(transaction.toJSON())
    logger.log('info', `Transaction created: ${transaction.id}`, {section: 'transaction',})

    // Notify account of transaction
    // Temporary text based
    const subject = `Spendit - Transaction Receipt`;
    // Date
    // Transaction ID
    // Account ID
    // Type
    // Reason
    // Products (table)
    // Total
    const productsList = transaction.products.map(item => `\t${item.name}\t${item.description ?? 'N/A'}\t${item.amount}\t${item.price}\t${item.total}`).join('\n')
    const productTable = `\tName\tDescription\tQuantity\tUnit Price\tAmount\n${productsList}\n\tTotal:${transaction.total}`
    const message = `Date: ${transaction.date}\nTransaction ID: ${transaction.id}\nAccount ID: ${transaction.accountid}\nType: ${transaction.type}\nReason: ${transaction.reason}\nProducts:\n${productTable}`
    email.send(account, subject, message)
}

async function getAll(): Promise<ITransaction[]> {
    return await Transaction.find({}).sort({
        date: -1
    }).lean<ITransaction[]>();
}


async function getById(id: ITransaction['id']): Promise<ITransaction> {
    // logger.debug(`get trans by id: ${id}`)
    const transaction = await Transaction.findById(id).lean<ITransaction | null>();
    if (transaction === null){
        throw 'transaction not found'
    }
    return transaction;
}

async function getByDate(date) {

}

async function getBalanceByAccountId(accountid: IAccount['id']): Promise<bigint> {
    const balance = await Transaction.aggregate<{_id: null, balance: number}>([{
        $match: {
            accountid: accountid
        }
    }, {
        $group: {
            _id: null,
            balance: {
                $sum: {
                    $cond: [{
                        $eq: ['$type', 'credit']
                    }, {
                        '$toLong': '$total'
                    }, {
                        $multiply: [{
                            '$toLong': '$total'
                        }, -1]
                    }]
                }
            }
        }
    }])

    // if length of balance is 0, that means there are no transactions in the database for this account
    // balance defaults to 0 in this case
    if (balance.length === 0){
        return BigInt(0);
    }
    return BigInt(balance[0].balance);
}

async function getByAccountId(accountid: IAccount['id']): Promise<ITransaction[]> {
    // logger.debug(`get trans by id: ${accountid}`);
    return await Transaction.find({
        accountid: accountid
    }).sort({
        date: -1
    }).lean<ITransaction[]>();

}

async function getByType(type: ITransaction['type']): Promise<ITransaction[]> {
    return await Transaction.find({type: type}).sort({
        date: -1
    }).lean<ITransaction[]>();
}

async function getByReason(reason: ITransaction['reason']): Promise<ITransaction[]>  {
    return await Transaction.find({reason: reason}).sort({
        date: -1
    }).lean<ITransaction[]>();
}

// async function getByProduct(productid: IProduct['id']): Promise<ITransaction[]>  {
//     return await Transaction.find({reason: reason}).sort({
//         date: -1
//     }).lean<ITransaction[]>();
// }


// async function getByAmount(amount) {

// }

export default {
    create,
    getAll,
    getById,
    getByAccountId,
    getBalanceByAccountId
}