import express, { NextFunction, request, Response } from 'express';
import expressJwt, { Request } from 'express-jwt';
import Guard from 'express-jwt-permissions';
import transactionLedger from '../../../services/ledgers/transactions/index.js';
import { IAccountBaseForm, isIAccountBaseForm, IAccountSettingsForm, isIAccountSettingsForm, ICredentials, isICredentials, Roles, isIRefillForm, IRefillForm, RefillMethods, isIAccountPasswordForm, IAccountPasswordForm, AccountFormTypes, HTTP, isHTTP } from 'typesit';
import accountService from '../../../services/account/index.js';
import { randomUUID } from 'crypto'
import refillLedger from '../../../services/ledgers/refill/index.js';
import { registerRoute, CommonResponses, CommonParameters } from '../../../utils/openapi-docs.js';

const router = express.Router();
const guard = Guard({
    requestProperty: 'auth',
    permissionsProperty: 'permissions'
});

// Base path for this router (used for OpenAPI documentation)
const BASE_PATH = '/api/accounts';

// ============================================================================
// Public Routes
// ============================================================================

registerRoute('POST', BASE_PATH, '/auth', {
    summary: 'Authenticate account',
    description: 'Authenticate a user with username and password credentials. Returns a JWT token on success.',
    tags: ['Accounts', 'Authentication'],
    security: false,
    requestBody: {
        description: 'User credentials',
        schema: 'Credentials'
    },
    responses: {
        200: { description: 'Authentication successful, returns JWT token and account info', schema: 'object' },
        400: { description: 'Invalid credentials payload' },
        401: { description: 'Authentication failed - invalid username or password' }
    }
});
router.post('/auth', auth);

registerRoute('POST', BASE_PATH, '/register', {
    summary: 'Register a new account',
    description: 'Create a new user account. The account will be created with "unverified" role and must be verified by an admin.',
    tags: ['Accounts', 'Authentication'],
    security: false,
    requestBody: {
        description: 'Account registration form',
        schema: 'AccountBaseForm'
    },
    responses: {
        200: { description: 'Account successfully created' },
        400: { description: 'Invalid registration data' },
        409: { description: 'Username or email already exists' }
    }
});
router.post('/register', register);

// ============================================================================
// User Available Routes (Authenticated)
// ============================================================================

registerRoute('GET', BASE_PATH, '/self', {
    summary: 'Get current account',
    description: 'Retrieve the authenticated user\'s account information.',
    tags: ['Accounts'],
    responses: {
        200: { description: 'The authenticated account', schema: 'Account' },
        401: CommonResponses.Unauthorized
    }
});
router.get('/self', getSelf);

registerRoute('PUT', BASE_PATH, '/self', {
    summary: 'Update current account',
    description: 'Update the authenticated user\'s account settings or password. Requires current password verification.',
    tags: ['Accounts'],
    requestBody: {
        description: 'Account update request',
        content: {
            'application/json': {
                schema: {
                    type: 'object',
                    properties: {
                        type: { $ref: '#/components/schemas/AccountFormTypes' },
                        accountForm: {
                            oneOf: [
                                { $ref: '#/components/schemas/AccountSettingsForm' },
                                { $ref: '#/components/schemas/AccountPasswordForm' }
                            ]
                        },
                        currentPassword: { type: 'string', description: 'Current password for verification' }
                    },
                    required: ['type', 'accountForm', 'currentPassword']
                }
            }
        }
    },
    responses: {
        200: { description: 'Account updated successfully' },
        400: { description: 'Invalid update data' },
        401: { description: 'Current password is incorrect' }
    }
});
router.put('/self', updateSelf);

registerRoute('GET', BASE_PATH, '/self/refill', {
    summary: 'Get current account refill history',
    description: 'Retrieve the refill history for the authenticated user.',
    tags: ['Accounts', 'Refills'],
    responses: {
        200: { description: 'List of refill entries', schema: 'Refill[]' },
        401: CommonResponses.Unauthorized
    }
});
router.get('/self/refill', getSelfRefillHistory);

registerRoute('POST', BASE_PATH, '/self/refill', {
    summary: 'Create a refill request',
    description: 'Initiate a new refill request to add funds to the authenticated user\'s account.',
    tags: ['Accounts', 'Refills'],
    requestBody: {
        description: 'Refill request details (account field is automatically set)',
        content: {
            'application/json': {
                schema: {
                    type: 'object',
                    properties: {
                        amount: { type: 'string', description: 'Amount to refill (in smallest currency unit)' },
                        method: { $ref: '#/components/schemas/RefillMethods' }
                    },
                    required: ['amount', 'method']
                }
            }
        }
    },
    responses: {
        200: { description: 'Refill request created', schema: 'Refill' },
        400: { description: 'Invalid refill data' }
    }
});
router.post('/self/refill', createSelfRefill);

registerRoute('DELETE', BASE_PATH, '/self/refill/:refillId', {
    summary: 'Cancel a refill request',
    description: 'Cancel a pending refill request for the authenticated user.',
    tags: ['Accounts', 'Refills'],
    parameters: [CommonParameters.refillId('ID of the refill to cancel')],
    responses: {
        200: { description: 'Refill cancelled successfully' },
        400: { description: 'Refill cannot be cancelled (already completed or failed)' },
        404: { description: 'Refill not found' }
    }
});
router.delete('/self/refill/:refillId', cancelRefill);

registerRoute('GET', BASE_PATH, '/self/resetSession', {
    summary: 'Reset current session',
    description: 'Invalidate the current session, requiring re-authentication.',
    tags: ['Accounts', 'Authentication'],
    responses: {
        200: { description: 'Session reset successfully' }
    }
});
router.get('/self/resetSession', resetSessionSelf);

registerRoute('GET', BASE_PATH, '/self/balance', {
    summary: 'Get current account balance',
    description: 'Retrieve the current balance of the authenticated user.',
    tags: ['Accounts'],
    responses: {
        200: { 
            description: 'Account balance',
            content: {
                'application/json': {
                    schema: {
                        type: 'object',
                        properties: {
                            balance: { type: 'string', description: 'Balance in smallest currency unit' }
                        }
                    }
                }
            }
        }
    }
});
router.get('/self/balance', getSelfBalance);

registerRoute('GET', BASE_PATH, '/self/transactions', {
    summary: 'Get current account transactions',
    description: 'Retrieve the transaction history for the authenticated user.',
    tags: ['Accounts', 'Transactions'],
    responses: {
        200: { description: 'List of transactions', schema: 'Transaction[]' }
    }
});
router.get('/self/transactions', getSelfTransactions);

// ============================================================================
// Admin Routes
// ============================================================================

registerRoute('POST', BASE_PATH, '/create', {
    summary: 'Create a new account (Admin)',
    description: 'Create a new user account with specified role. Admin only.',
    tags: ['Accounts', 'Admin'],
    requestBody: {
        description: 'Account creation form',
        schema: 'AccountBaseForm'
    },
    responses: {
        200: { description: 'Account created successfully' },
        400: { description: 'Invalid account data' },
        403: CommonResponses.Forbidden
    }
});
router.post('/create', guard.check(Roles.Admin), create);

registerRoute('GET', BASE_PATH, '/:accountId/resetSession', {
    summary: 'Reset user session (Admin)',
    description: 'Invalidate a specific user\'s session. Admin only.',
    tags: ['Accounts', 'Admin'],
    parameters: [CommonParameters.accountId()],
    responses: {
        200: { description: 'Session reset successfully' },
        403: CommonResponses.Forbidden,
        404: CommonResponses.NotFound
    }
});
router.get('/:accountId/resetSession', guard.check(Roles.Admin), resetSession);

registerRoute('GET', BASE_PATH, '/:accountId/balance', {
    summary: 'Get user balance (Admin)',
    description: 'Retrieve the balance of a specific user. Admin only.',
    tags: ['Accounts', 'Admin'],
    parameters: [CommonParameters.accountId()],
    responses: {
        200: { 
            description: 'Account balance',
            content: {
                'application/json': {
                    schema: {
                        type: 'object',
                        properties: {
                            balance: { type: 'string' }
                        }
                    }
                }
            }
        },
        403: CommonResponses.Forbidden,
        404: CommonResponses.NotFound
    }
});
router.get('/:accountId/balance', guard.check(Roles.Admin), getBalance);

registerRoute('GET', BASE_PATH, '/:accountId/transaction', {
    summary: 'Get user transactions (Admin)',
    description: 'Retrieve the transaction history of a specific user. Admin only.',
    tags: ['Accounts', 'Admin'],
    parameters: [CommonParameters.accountId()],
    responses: {
        200: { description: 'List of transactions', schema: 'Transaction[]' },
        403: CommonResponses.Forbidden,
        404: CommonResponses.NotFound
    }
});
router.get('/:accountId/transaction', guard.check(Roles.Admin), getTransactions);

registerRoute('PUT', BASE_PATH, '/:accountId/verify/:role', {
    summary: 'Verify user account (Admin)',
    description: 'Update a user\'s role/verification status. Admin only.',
    tags: ['Accounts', 'Admin'],
    parameters: [
        CommonParameters.accountId(),
        {
            name: 'role',
            in: 'path',
            description: 'New role to assign',
            required: true,
            schema: { type: 'string', enum: ['unverified', 'member', 'nonMember', 'admin', 'pos'] }
        }
    ],
    responses: {
        200: { description: 'Account verified/role updated' },
        403: CommonResponses.Forbidden,
        404: CommonResponses.NotFound
    }
});
router.put('/:accountId/verify/:role', guard.check(Roles.Admin), verify);

registerRoute('DELETE', BASE_PATH, '/:accountId', {
    summary: 'Delete user account (Admin)',
    description: 'Permanently delete a user account. Admin only.',
    tags: ['Accounts', 'Admin'],
    parameters: [CommonParameters.accountId()],
    responses: {
        200: { description: 'Account deleted successfully' },
        403: CommonResponses.Forbidden,
        404: CommonResponses.NotFound
    }
});
router.delete('/:accountId', guard.check(Roles.Admin), deleteAccountById);

registerRoute('PUT', BASE_PATH, '/:accountId', {
    summary: 'Update user account (Admin)',
    description: 'Update a user\'s account settings. Admin only.',
    tags: ['Accounts', 'Admin'],
    parameters: [CommonParameters.accountId()],
    requestBody: {
        description: 'Account settings to update',
        schema: 'AccountSettingsForm'
    },
    responses: {
        200: { description: 'Account updated successfully' },
        400: { description: 'Invalid update data' },
        403: CommonResponses.Forbidden,
        404: CommonResponses.NotFound
    }
});
router.put('/:accountId', guard.check(Roles.Admin), updateAccountById);

registerRoute('PUT', BASE_PATH, '/:accountId/resetPassword', {
    summary: 'Reset user password (Admin)',
    description: 'Generate a new random password for a user. Admin only.',
    tags: ['Accounts', 'Admin'],
    parameters: [CommonParameters.accountId()],
    responses: {
        200: { 
            description: 'Password reset successfully',
            content: {
                'application/json': {
                    schema: {
                        type: 'object',
                        properties: {
                            password: { type: 'string', description: 'New generated password' }
                        }
                    }
                }
            }
        },
        403: CommonResponses.Forbidden,
        404: CommonResponses.NotFound
    }
});
router.put('/:accountId/resetPassword', guard.check(Roles.Admin), resetPasswordById);

registerRoute('GET', BASE_PATH, '/', {
    summary: 'Get all accounts (Admin)',
    description: 'Retrieve a list of all user accounts. Admin only.',
    tags: ['Accounts', 'Admin'],
    responses: {
        200: { description: 'List of all accounts', schema: 'Account[]' },
        403: CommonResponses.Forbidden
    }
});
router.get('/', guard.check(Roles.Admin), getAll);
// router.get('/search', search)

// Public routes
function auth(req, res, next) {
    // Check if body is an ICredentials type
    const data = req.body;
    if(!isICredentials(data)){
        throw 'request body is of wrong type, must be ICredentials'
    }
    accountService.auth(data).then((resp) => res.json(resp)).catch(err => next(err));
}

function register(req, res, next) {
    // Check if body is an IAccountForm type
    const data = req.body;
    if(!isIAccountBaseForm(data)){
        // logger.debug(data);
        throw 'request body is of wrong type, must be IAccountForm'
    }

    // registration form initiated creation
    data.role = Roles.Unverified;

    accountService.create(data).then(() => res.json({})).catch(err => next(err))
}

// User available routes
function getSelf(req: Request, res: Response, next: NextFunction) {
    const selfId = getIdFromPayload(req);
    accountService.getById(selfId).then(account => account ? res.json(account) : res.status(500).json({
        message: 'Something went wrong grabbing self'
    })).catch(err => next(err));
}

function resetSessionSelf(req, res, next) {
    const selfId = getIdFromPayload(req);
    accountService.resetSession(selfId).then(() => res.json({})).catch(err => next(err));
}

function getSelfBalance(req, res, next) {
    const selfId = getIdFromPayload(req);
    accountService.getBalance(selfId).then(resp => res.json(resp)).catch(err => next(err));
}

function getSelfTransactions(req, res, next) {
    const selfId = getIdFromPayload(req);
    transactionLedger.listEntries({accountId: selfId}).then(resp => res.json(resp)).catch(err => next(err));
}

function updateSelf(req, res, next) {
    const selfId = getIdFromPayload(req);
    const type: AccountFormTypes = req.body.type;
    const form: HTTP<IAccountSettingsForm> | HTTP<IAccountPasswordForm> = req.body.accountForm;
    const currentPassword = req.body.currentPassword;


    // Check if body is an IAccountForm type
    if(!isIAccountSettingsForm(form) && !isIAccountPasswordForm(form)) {
        throw 'AccountForm is of wrong type, must be IAccountSettingsForm or IAccountPasswordForm'
    }

    // Check that current password is correct
    if (currentPassword === undefined) {
        throw 'currentPassword is required'
    }
    if (typeof currentPassword !== 'string') {
        throw 'currentPassword must be a string'
    }
    accountService.matchPassword(selfId,currentPassword).then((match) => {
        if (!match) {
            throw 'Current password is incorrect'
        }
        if (type === 'password' && isIAccountPasswordForm(form)) {
            accountService.updatePasswordById(selfId,form.password).then(() => res.json({})).catch(err => next(err))
        } else if (type === 'settings' && isIAccountSettingsForm(form)) {
            accountService.updateAccountById(selfId,form).then(() => res.json({})).catch(err => next(err))
        } else {
            throw 'Invalid update type'
        }
    }).catch(err => next(err)) 
}

function getSelfRefillHistory(req, res, next) {
    const selfId = getIdFromPayload(req);
    refillLedger.getRefillHistory(selfId).then(resp => res.json(resp)).catch(err => next(err));
}

function createSelfRefill(req, res, next) {
    const selfId = getIdFromPayload(req);

    const data = {
        ...req.body,
        account: selfId
    }
    if (!isIRefillForm(data)) {
        throw 'request body is of wrong type, must be IRefillForm'
    }
    refillLedger.createEntry(data).then((resp) => res.json(resp)).catch(err => next(err));

}

function cancelRefill(req, res, next) {
    const selfId = getIdFromPayload(req);
    const refillId = req.params.refillId;
    const note = 'User: Refill cancelled';
    refillLedger.cancelRefill(refillId, {note: note}).then(() => res.json({})).catch(err => next(err));
}

// Private routes

function create(req, res, next) {
    // Check if body is an IAccountForm type
    const data = req.body;
    if(!isIAccountBaseForm(data)){
        throw 'request body is of wrong type, must be IAccountForm'
    }
    accountService.create(data).then(() => res.json({})).catch(err => next(err))
}

function getAll(req, res, next) {
    // logger.debug("getall")
    accountService.getAll()
        .then(resp => res.json(resp))
        .catch(err => next(err))
}

function verify(req, res, next) {
    accountService.verify(req.params['accountId'],req.params['role']).then(resp => res.json(resp)).catch(err => next(err));
}

function resetSession(req, res, next) {
    accountService.resetSession(req.params['accountId']).then(() => res.json({})).catch(err => next(err));
}

function deleteAccountById(req, res, next) {
    accountService.deleteAccountById(req.params['accountId'])
        .then(resp => res.json(resp))
        .catch(err => next(err))
}

function updateAccountById(req, res, next) {
    const data: HTTP<IAccountSettingsForm> = req.body;
    console.log(data);
    if(!isHTTP<IAccountSettingsForm>(data)){
        throw 'request body is of wrong type, must be HTTP<IAccountSettingsForm>'
    }

    const form: IAccountSettingsForm = {
        firstName: data.firstName,
        lastName: data.lastName,
        username: data.username,
        notify: data.notify,
        email: data.email
    };
    
    if(!isIAccountSettingsForm(form)){
        throw 'request body is of wrong type, must be IAccountSettingsForm'
    }
    accountService.updateAccountById(req.params['accountId'], form)
        .then(() => res.json({}))
        .catch(err => next(err))
}

function resetPasswordById(req, res, next) {
    const newPassword = randomUUID().substring(0, 16);
    accountService.updatePasswordById(req.params['accountId'],newPassword)
        .then(resp => res.json({ password: newPassword }))
        .catch(err => next(err))
}

function getBalance(req, res, next) {
    accountService.getBalance(req.params['accountId']).then(resp => res.json(resp)).catch(err => next(err));
}

function getTransactions(req, res, next) {
    transactionLedger.listEntries({accountId:req.params['accountId']}).then(resp => res.json(resp)).catch(err => next(err));
}

function getIdFromPayload(req: Request): string {
    if (req.auth === undefined) {
        throw "jwt payload not found in request"
    }
    if (req.auth.sub === undefined) {
        throw "jwt payload sub not found in request"
    }
    return req.auth.sub
}

// function search(req, res, next) {
//     logger.debug(req.query);
//     accountService.search(req.query)
//     .then(resp => resp.count > 0 ? res.json(resp) : res.status(204))
//     .catch(err => next(err))
// }

export default router;
