import db from '../_helpers/db.js';
import transaction from '../_helpers/transaction.js';
import { ITransaction, ITransactionForm } from 'typesit';
import { tasks } from '../_tasks/task.js';

const Account = db.account
const Product = db.product

async function createTransaction(transactionParam: ITransactionForm) {
    transactionParam.reason = `Admin: ${transactionParam.reason}`;
    transaction.create(transactionParam);
}

async function getAllTransactions() {
    return await transaction.getAll();
}

interface ITask {
    name: string;
    stopped: boolean;
    lastRun: Date | null;
    nextRun: Date | null;
}

async function getAllTasks() {
    // Serialize tasks
    return tasks.map(task => {
        return {
            name: task.name,
            stopped: task.stopped,
            lastRun: task.lastRun,
            nextRun: task.nextRun
        }
    });
}

async function getTask(name: string) {
    const task = tasks.find(task => task.name === name);
    if (task === undefined) {
        throw 'task not found';
    }
    return {
        name: task.name,
        stopped: task.stopped,
        lastRun: task.lastRun,
        nextRun: task.nextRun
    }

}

async function startTask(name: string) {
    const task = tasks.find(task => task.name === name);
    task?.start();
}

async function stopTask(name: string) {
    const task = tasks.find(task => task.name === name);
    task?.stop();
}

async function forceRunTask(name: string) {
    const task = tasks.find(task => task.name === name);
    task?.forceRun();
}

async function getTaskLogs(name: string) {
    const task = tasks.find(task => task.name === name);
    // return task?.logs;
}


export default {
    createTransaction,
    getAllTransactions,
    getAllTasks,
    getTask,
    startTask,
    stopTask,
    forceRunTask,
    getTaskLogs
}