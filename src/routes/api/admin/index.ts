import express from 'express';
import Guard from 'express-jwt-permissions';
import { HTTP, isHTTP, isITransactionForm, ITransactionForm, Roles, IStockEntryForm, isIStockEntryForm } from 'typesit';
import adminService from '../../../services/admin/index.js';
import logger from '../../../core/logger/index.js';
import { registerRoute, CommonResponses, CommonParameters } from '../../../utils/openapi-docs.js';

const router = express.Router();
const guard = Guard({
    requestProperty: 'auth',
    permissionsProperty: 'permissions'
  })

// Base path for this router
const BASE_PATH = '/api/admin';

router.use(guard.check(Roles.Admin))

// ============================================================================
// Transaction Routes
// ============================================================================

registerRoute('GET', BASE_PATH, '/transactions', {
    summary: 'Get all transactions',
    description: 'Retrieve a list of all transactions in the system. Admin only.',
    tags: ['Admin', 'Transactions'],
    responses: {
        200: { description: 'List of all transactions', schema: 'Transaction[]' },
        403: CommonResponses.Forbidden
    }
});
router.get('/transactions', getAllTransactions);

registerRoute('POST', BASE_PATH, '/transactions', {
    summary: 'Create a transaction',
    description: 'Manually create a new transaction. Admin only.',
    tags: ['Admin', 'Transactions'],
    requestBody: {
        description: 'Transaction details',
        schema: 'TransactionForm'
    },
    responses: {
        200: { description: 'Transaction created successfully' },
        400: { description: 'Invalid transaction data' },
        403: CommonResponses.Forbidden
    }
});
router.post('/transactions', createTransactions);

// ============================================================================
// Stock Entry Routes
// ============================================================================

registerRoute('GET', BASE_PATH, '/stock', {
    summary: 'Get all stock entries',
    description: 'Retrieve a list of all stock entries (purchases, shrinkage, overage, sales). Admin only.',
    tags: ['Admin', 'Stock'],
    responses: {
        200: { description: 'List of all stock entries', schema: 'StockEntry[]' },
        403: CommonResponses.Forbidden
    }
});
router.get('/stock', getAllStockEntries);

registerRoute('POST', BASE_PATH, '/stock', {
    summary: 'Create a stock entry',
    description: 'Record a new stock entry (purchase, shrinkage, overage). Admin only.',
    tags: ['Admin', 'Stock'],
    requestBody: {
        description: 'Stock entry details',
        schema: 'StockEntryForm'
    },
    responses: {
        200: { description: 'Stock entry created successfully' },
        400: { description: 'Invalid stock entry data' },
        403: CommonResponses.Forbidden
    }
});
router.post('/stock', createStockEntry);

// ============================================================================
// Statistics Routes
// ============================================================================

registerRoute('GET', BASE_PATH, '/stats/finance/:dateOption', {
    summary: 'Get finance statistics',
    description: 'Retrieve financial statistics including revenue, profit, and credit balance. Admin only.',
    tags: ['Admin', 'Statistics'],
    parameters: [CommonParameters.dateOption('Time period for statistics')],
    responses: {
        200: { description: 'Finance statistics', schema: 'FinanceStats' },
        403: CommonResponses.Forbidden
    }
});
router.get('/stats/finance/:dateOption', getFinanceStats);

registerRoute('GET', BASE_PATH, '/stats/inventory', {
    summary: 'Get inventory statistics',
    description: 'Retrieve inventory statistics including stock counts and valuations. Admin only.',
    tags: ['Admin', 'Statistics'],
    responses: {
        200: { description: 'Inventory statistics', schema: 'InventoryStats' },
        403: CommonResponses.Forbidden
    }
});
router.get('/stats/inventory', getInventoryStats);

registerRoute('GET', BASE_PATH, '/stats/transactions', {
    summary: 'Get transaction statistics',
    description: 'Retrieve transaction statistics by type. Admin only.',
    tags: ['Admin', 'Statistics'],
    responses: {
        200: { description: 'Transaction statistics', schema: 'TransactionStats' },
        403: CommonResponses.Forbidden
    }
});
router.get('/stats/transactions', getTransactionStats);

registerRoute('GET', BASE_PATH, '/stats/accounts', {
    summary: 'Get account statistics',
    description: 'Retrieve account statistics by role. Admin only.',
    tags: ['Admin', 'Statistics'],
    responses: {
        200: { description: 'Account statistics', schema: 'AccountStats' },
        403: CommonResponses.Forbidden
    }
});
router.get('/stats/accounts', getAccountStats);

registerRoute('GET', BASE_PATH, '/stats/refills', {
    summary: 'Get refill statistics',
    description: 'Retrieve refill statistics by status. Admin only.',
    tags: ['Admin', 'Statistics'],
    responses: {
        200: { description: 'Refill statistics', schema: 'RefillStats' },
        403: CommonResponses.Forbidden
    }
});
router.get('/stats/refills', getRefillStats);

registerRoute('GET', BASE_PATH, '/stats/store', {
    summary: 'Get store statistics',
    description: 'Retrieve store performance statistics including top products and buyers. Admin only.',
    tags: ['Admin', 'Statistics'],
    responses: {
        200: { description: 'Store statistics', schema: 'StoreStats' },
        403: CommonResponses.Forbidden
    }
});
router.get('/stats/store', getStoreStats);

// ============================================================================
// Task Routes
// ============================================================================

registerRoute('GET', BASE_PATH, '/tasks', {
    summary: 'Get all background tasks',
    description: 'Retrieve a list of all background tasks and their status. Admin only.',
    tags: ['Admin', 'Tasks'],
    responses: {
        200: { description: 'List of tasks', schema: 'TaskLean[]' },
        403: CommonResponses.Forbidden
    }
});
router.get('/tasks', getTasks);

registerRoute('GET', BASE_PATH, '/tasks/:taskId/:command', {
    summary: 'Manage a background task',
    description: 'Execute a command on a background task (start, stop, run). Admin only.',
    tags: ['Admin', 'Tasks'],
    parameters: [
        CommonParameters.taskId(),
        {
            name: 'command',
            in: 'path',
            description: 'Command to execute on the task',
            required: true,
            schema: { type: 'string', enum: ['start', 'stop', 'run'] }
        }
    ],
    responses: {
        200: { description: 'Task command executed successfully' },
        400: { description: 'Invalid command' },
        403: CommonResponses.Forbidden,
        404: { description: 'Task not found' }
    }
});
router.get('/tasks/:taskId/:command', updateTask);

function getAllTransactions(req, res, next) {
    // logger.debug("HELP");
    adminService.getAllTransactions().then(resp => res.json(resp)).catch(err => next(err))
}

function getAllStockEntries(req, res, next) {
    adminService.getAllStockEntries().then(resp => res.json(resp)).catch(err => next(err))
}

function createStockEntry(req, res, next) {
    const data: HTTP<IStockEntryForm> = req.body;

    if (!isHTTP<IStockEntryForm>(data)) {
        throw 'request body is of wrong type, must be HTTP<IStockEntryForm>'
    }

    const form: IStockEntryForm = {
        entryType: data.entryType,
        productId: data.productId,
        delta: BigInt(data.delta),
        cost: data.cost ? BigInt(data.cost) : undefined,
    };

    if (!isIStockEntryForm(form)) {
        throw 'request body is of wrong type, must be IStockEntryForm'
    }

    adminService.createStockEntry(form).then(() => res.json({})).catch(err => next(err))
}

function createTransactions(req, res, next) {
    // Check if body is an ITransactionForm type
    const data: HTTP<ITransactionForm> = req.body;

    if (!isHTTP<ITransactionForm>(data)) {
        throw 'request body is of wrong type, must be HTTP<ITransactionForm>'
    }

    const form: ITransactionForm = {
        type: data.type,
        transactionType: data.transactionType,
        description: data.description,
        accountId: data.accountId,
        products: data.products,
        total: data.total,
    };

    if(!isITransactionForm(form)){
        // logger.debug(data);
        throw 'request body is of wrong type, must be ITransactionForm'
    }
    adminService.createTransaction(data).then(() => res.json({})).catch(err => next(err))
}

// statistics functions
function getFinanceStats(req, res, next) {
    const dateOption = req.params.dateOption;
    adminService.getFinanceStats(dateOption).then(resp => res.json(resp)).catch(err => next(err))
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
