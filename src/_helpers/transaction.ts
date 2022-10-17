import db from './db.js';
import accountService from '../account/service.js';
import { ITransaction, ITransactionForm, ITransactionItem, ITransactionLean, TransactionType } from '../_models/transaction.model.js';
import { IAccount } from '../_models/account.model.js';
import { IProduct, IProductLean } from '../_models/product.model.js';

const Transaction = db.transaction;

async function create(transactionParam: ITransactionForm): Promise<void> {
    // should store entire account and products in transaction incase product or user is deleted
    // this way proper invoices can still be generated

    // Check transaction type:
    if (!Object.values(TransactionType).includes(transactionParam.type)) {
        throw 'invalid transaction type'
    }

    // Check if username valid
    const account = await accountService.getById(transactionParam.accountid);

    let transaction = new Transaction();

    transaction.set(transactionParam);

    await transaction.save()
}

async function getAll(): Promise<ITransactionLean[]> {
    return await Transaction.find({}).sort({
        date: -1
    }).lean<ITransactionLean[]>();
}


async function getById(id: ITransaction['id']): Promise<ITransaction> {
    // console.log(`get trans by id: ${id}`)
    const transaction = await Transaction.findById<ITransaction>(id);
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
        return 0n;
    }
    return BigInt(balance[0].balance);
}

async function getByAccountId(accountid: IAccount['id']): Promise<ITransactionLean[]> {
    // console.log(`get trans by id: ${accountid}`);
    return await Transaction.find({
        accountid: accountid
    }).sort({
        date: -1
    }).lean<ITransactionLean[]>();

}

async function getByType(type: ITransaction['type']): Promise<ITransactionLean[]> {
    return await Transaction.find({type: type}).sort({
        date: -1
    }).lean<ITransactionLean[]>();
}

async function getByReason(reason: ITransaction['reason']): Promise<ITransactionLean[]>  {
    return await Transaction.find({reason: reason}).sort({
        date: -1
    }).lean<ITransactionLean[]>();
}

// async function getByProduct(productid: IProduct['id']): Promise<ITransactionLean[]>  {
//     return await Transaction.find({reason: reason}).sort({
//         date: -1
//     }).lean<ITransactionLean[]>();
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