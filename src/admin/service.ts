import db from '../_helpers/db.js';
import transaction from '../_helpers/transaction.js';
import { ITransaction, ITransactionForm, Roles, TransactionType, IAccountStats, IFinanceStats, IInventoryStats, IRefillStats, IStoreStats, ITaskLean, ITransactionStats } from 'typesit';
import { tasks } from '../_tasks/task.js';

const Account = db.account
const Product = db.product
const Transaction = db.transaction
const Refill = db.refill

async function createTransaction(transactionParam: ITransactionForm) {
    transactionParam.reason = `Admin: ${transactionParam.reason}`;
    return transaction.create(transactionParam).catch(err => {
        throw err;
    });
}

async function getAllTransactions() {
    return await transaction.getAll();
}

// Statistics functions
async function getFinanceStats(): Promise<IFinanceStats> {
    // Generate finance stats
    // Total credit
    const totalCredit = await Transaction.find({ type: TransactionType.Credit }).then(transactions => {
        return transactions.reduce((acc, transaction) => acc + BigInt(transaction.total), 0n);
    });
    // Revenue
    const revenue = await Transaction.find({ type: TransactionType.Debit }).then(transactions => {
        return transactions.reduce((acc, transaction) => acc + BigInt(transaction.total), 0n);
    });
    const creditBalance = totalCredit - revenue;
    // Cost of goods sold
    const costOfGoodsSold = 0n;
    const profit = revenue - costOfGoodsSold;
    return { totalCredit: Number(totalCredit)/100, revenue: Number(revenue)/100, creditBalance: Number(creditBalance)/100, costOfGoodsSold: Number(costOfGoodsSold)/100, profit: Number(profit)/100 };
}

async function getInventoryStats(): Promise<IInventoryStats> {
    // Generate inventory stats
    // Total products
    const total = await Product.countDocuments();
    // In stock products
    const inStock = await Product.countDocuments({ stock: { $gt: 0 } });
    // Out of stock products
    const outOfStock = await Product.countDocuments({ stock: 0 });
    // Book value
    const bookValue = 0;
    // Retail value
    const retailValue = Number(await Product.find().then(products => {
        return products.reduce((acc, product) => acc + BigInt(product.price) * BigInt(product.stock), 0n);
    })) / 100;
    return { total: total, inStock: inStock, outOfStock: outOfStock, bookValue: bookValue, retailValue: retailValue };
}

async function getTransactionStats(): Promise<ITransactionStats> {
    // Generate transaction stats
    // Total transactions
    const total = await Transaction.countDocuments();
    // Total credit transactions
    const credit = await Transaction.countDocuments({ type: TransactionType.Credit });
    // Total debit transactions
    const debit = await Transaction.countDocuments({ type: TransactionType.Debit });
    return { total: total, credit: credit, debit: debit };
}

async function getAccountStats(): Promise<IAccountStats> {
    // Generate account stats
    // Total accounts
    const total = await Account.countDocuments();
    // Unverified accounts
    const unverified = await Account.countDocuments({ role: Roles.Unverified });
    // Non-member accounts
    const nonMembers = await Account.countDocuments({ role: Roles.NonMember });
    // Member accounts
    const members = await Account.countDocuments({ role: Roles.Member });
    // Admin accounts
    const admins = await Account.countDocuments({ role: Roles.Admin });
    return { total: total, unverified: unverified, nonmember: nonMembers, member: members, admin: admins };
}

async function getRefillStats(): Promise<IRefillStats> {
    // Generate refill stats
    // Pending refills
    const pending = await Refill.countDocuments({ status: 'Pending' });
    // Complete refills
    const complete = await Refill.countDocuments({ status: 'Complete' });
    // Cancelled refills
    const cancelled = await Refill.countDocuments({ status: 'Cancelled' });
    // Failed refills
    const failed = await Refill.countDocuments({ status: 'Failed' });
    const total = await Refill.countDocuments();
    return { pending: pending, complete: complete, cancelled: cancelled, failed: failed, total: total };
}

async function getStoreStats(): Promise<IStoreStats> {
    interface ProductRanking {
        name: string;
        amount: number;
    }
    // Generate store stats
    // Ranking of products most sold to least sold
    // First get all products and make array of object {name: string, amount: number}
    const products = await Product.find();
    const validTransactions = await Transaction.find({ type: TransactionType.Debit, products: { $exists: true } });
    const productMap: Record<string, number> = {};
    // Fill productMap with all products, amount 0 for now
    products.forEach((product) => {
        productMap[product.name] = 0;
    });

    validTransactions.forEach((transaction) => {
        transaction.products.forEach((product) => {
            const amount = parseFloat(product.amount); // Convert string to number
            if (!productMap[product.name]) {
                productMap[product.name] = 0;
            }
            productMap[product.name] += amount;
        });
    });
    const productRanking: IStoreStats['rankedProducts'] = Object.entries(productMap).sort((a, b) => b[1] - a[1]).map(([name, amount]) => {
        const price = products.find(product => product.name === name)?.price || 0;
        return { name: name, amountSold: amount, price: Number(price)};
    });

    // Ranking of buyers who spent the most to least
    const accounts = await Account.find();
    const buyerMap: Record<string, number> = {};
    // Fill buyerMap with all accounts, amount 0 for now
    accounts.forEach((account) => {
        buyerMap[account.id] = 0;
    });

    validTransactions.forEach((transaction) => {
        const amount = parseFloat(transaction.total); // Convert string to number
        if (!buyerMap[transaction.accountid]) {
            buyerMap[transaction.accountid] = 0;
        }
        buyerMap[transaction.accountid] += amount;
    });

    // Sort the buyerMap by amount spent
    const rankedBuyers: IStoreStats['rankedBuyers'] = Object.entries(buyerMap).sort((a, b) => b[1] - a[1]).map(([id, amount]) => {
        const account = accounts.find(account => account.id === id);
        if (!account) {
            return { id: id, username: 'Unknown', amountSpent: amount };
        }
        return { id: id, username: account.username, amountSpent: amount };
    });

    return { rankedProducts: productRanking, rankedBuyers: rankedBuyers };
}

// Task functions
async function getTasks(): Promise<ITaskLean[]> {

    // Get all tasks and return only the necessary information
    const tasksLean: ITaskLean[] = tasks.map(task => {
        return {
            stopped: task.stopped,
            name: task.name,
            lastRun: task.lastRun,
            nextRun: task.nextRun,
        }
    });

    return tasksLean;
}

async function manageTask(taskId: string, command: string, data: any) {
    // Find the task
    const task = tasks.find(task => task.name === taskId);
    if (!task) {
        throw 'Task not found';
    }
    if (command === 'start') {
        task.start();
    } else if (command === 'stop') {
        task.stop();
    } else {
        throw 'Invalid command';
    }
}


export default {
    createTransaction,
    getAllTransactions,
    getFinanceStats,
    getInventoryStats,
    getTransactionStats,
    getAccountStats,
    getRefillStats,
    getStoreStats,
    getTasks,
    manageTask,
}