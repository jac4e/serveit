import express from 'express';
import Guard from 'express-jwt-permissions';
import { isITransactionForm, Roles } from 'typesit';
import adminService from './service.js';
import logger from '../_helpers/logger.js';

const router = express.Router();
const guard = Guard({
    requestProperty: 'auth',
    permissionsProperty: 'permissions'
  })

router.use(guard.check(Roles.Admin))
router.get('/transactions', getAllTransactions);
router.post('/transactions', createTransactions);

// Statistics routes needed
// router.get('/stats', getStats);
// Finance stats
router.get('/stats/finance', getFinanceStats);
// Inventory stats
router.get('/stats/inventory', getInventoryStats);
// Transaction stats
router.get('/stats/transactions', getTransactionStats);
// Account stats
router.get('/stats/accounts', getAccountStats);
// Refill stats
router.get('/stats/refills', getRefillStats);
// Store stats
router.get('/stats/store', getStoreStats);

// Task routes needed
router.get('/tasks', getTasks);
router.get('/tasks/:taskId/:command', updateTask);

function getAllTransactions(req, res, next) {
    // logger.debug("HELP");
    adminService.getAllTransactions().then(resp => res.json(resp)).catch(err => next(err))
}

function createTransactions(req, res, next) {
    // Check if body is an ITransactionForm type
    const data = req.body;
    if(!isITransactionForm(data)){
        // logger.debug(data);
        throw 'request body is of wrong type, must be ITransactionForm'
    }
    adminService.createTransaction(data).then(() => res.json({})).catch(err => next(err))
}

// statistics functions
function getFinanceStats(req, res, next) {
    adminService.getFinanceStats().then(resp => res.json(resp)).catch(err => next(err))
}

function getInventoryStats(req, res, next) {
    adminService.getInventoryStats().then(resp => res.json(resp)).catch(err => next(err))
}

function getTransactionStats(req, res, next) {
    adminService.getTransactionStats().then(resp => res.json(resp)).catch(err => next(err))
}

function getAccountStats(req, res, next) {
    adminService.getAccountStats().then(resp => res.json(resp)).catch(err => next(err))
}

function getRefillStats(req, res, next) {
    adminService.getRefillStats().then(resp => res.json(resp)).catch(err => next(err))
}

function getStoreStats(req, res, next) {
    adminService.getStoreStats().then(resp => res.json(resp)).catch(err => next(err))
}

// task functions
function getTasks(req, res, next) {
    adminService.getTasks().then(resp => res.json(resp)).catch(err => next(err))
}

function updateTask(req, res, next) {
    const id = req.params.taskId;
    const command = req.params.command;
    const data = req.body;
    adminService.manageTask(id, command, data).then(resp => res.json(resp)).catch(err => next(err))
}

export default router;