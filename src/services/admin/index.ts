import db from '../../core/db/index.js';
import transactionLedger from '../ledgers/transactions/index.js';
import { ITransaction, ITransactionForm, Roles, TransactionType, IAccountStats, IFinanceStats, IInventoryStats, IRefillStats, IStoreStats, ITaskLean, ITransactionStats, RefillStatus, StatsDateRange, ProductTypes, IProduct } from 'typesit';
import { tasks } from '../../tasks/task.js';
import { LedgerListCriteria } from '../ledgers/ledger.js';
import { stockLedger } from '../ledgers/index.js';

const Account = db.account
const Product = db.product
const Transaction = db.transaction
const Refill = db.refill

async function createTransaction(transactionParam: ITransactionForm) {
    transactionParam.description = `Admin: ${transactionParam.description}`;
    return transactionLedger.createEntry(transactionParam).catch(err => {
        throw err;
    });
}

async function getAllTransactions() {
    return await transactionLedger.listEntries({});
}

// Statistics functions
// All these functions need improving as they take like one second to respond I think its the reduce?

async function getFinanceStats(dateOption: StatsDateRange): Promise<IFinanceStats> {
    // Turn dateOption into a date range
    const endDate = new Date();
    let startDate = new Date();
    if (dateOption === StatsDateRange.Day) {
        startDate.setDate(endDate.getDate() - 1);
    } else if (dateOption === StatsDateRange.Week) {
        startDate.setDate(endDate.getDate() - 7);
    } else if (dateOption === StatsDateRange.Month) {
        startDate.setMonth(endDate.getMonth() - 1);
    } else if (dateOption === StatsDateRange.Quarter) {
        startDate.setMonth(endDate.getMonth() - 3);
    } else if (dateOption === StatsDateRange.Year) {
        startDate.setFullYear(endDate.getFullYear() - 1);
    }

    const query: LedgerListCriteria = dateOption === StatsDateRange.All ? {} : { dateRange: { from: startDate, to: endDate } };
    const transactions = await transactionLedger.listEntries(query);

    let totalCredit = 0n;
    let revenue = 0n;

    for (const transaction of transactions) {
        if (transaction.transactionType === TransactionType.Credit) {
            totalCredit += BigInt(transaction.total);
        } else if (transaction.transactionType === TransactionType.Debit) {
            revenue += BigInt(transaction.total);
        }
    }

    const creditBalance = totalCredit - revenue;


    const costOfGoodsSold = 0n;
    
    const profit = revenue - costOfGoodsSold;
    return { 
        totalCredit: Number(totalCredit)/100, 
        revenue: Number(revenue)/100, 
        creditBalance: Number(creditBalance)/100, 
        costOfGoodsSold: Number(costOfGoodsSold)/100, 
        profit: Number(profit)/100 
    };
}

async function getInventoryStats(): Promise<IInventoryStats> {
    // Generate inventory stats
    // Total products
    const total = await Product.countDocuments({ type: ProductTypes.Stock });
    
    const inventory = await stockLedger.getInventory();
    console.log(inventory);
    // In-stock products
    const inStock = Array.from(inventory.entries()).filter(([_, product]) => product.stock > 0n).length;
    // Out-of-stock products
    const outOfStock = Array.from(inventory.entries()).filter(([_, product]) => product.stock <= 0n).length;

    // Book value
    const bookValue = Number(Array.from(inventory.entries()).reduce((acc, [_, product]) => acc + product.cost, 0n)) / 100;

    // Retail value
    const retailValue = Number(await Product.find<IProduct<ProductTypes.Stock>>({ type: ProductTypes.Stock }).then(products => {
        return products.reduce((acc, product) => acc + BigInt(product.price) * BigInt(inventory.get(product.id)?.stock || 0n), 0n);
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
    return { total: total, unverified: unverified, nonMember: nonMembers, member: members, admin: admins };
}

async function getRefillStats(): Promise<IRefillStats> {
    // Generate refill stats
    // Pending refills
    const pending = await Refill.countDocuments({ status: RefillStatus.Pending });
    // Complete refills
    const complete = await Refill.countDocuments({ status: RefillStatus.Complete });
    // Cancelled refills
    const cancelled = await Refill.countDocuments({ status: RefillStatus.Cancelled });
    // Failed refills
    const failed = await Refill.countDocuments({ status: RefillStatus.Failed });
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
    // valid transaction is a debit transaction with a non empty product array
    const validTransactions = await Transaction.find({ type: TransactionType.Debit, products: { $not: { $size: 0 } } });
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
        if (!buyerMap[transaction.accountId]) {
            buyerMap[transaction.accountId] = 0;
        }
        buyerMap[transaction.accountId] += amount;
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
