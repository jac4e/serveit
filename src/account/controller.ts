import express, { NextFunction, request, Response } from 'express';
import expressJwt, { Request } from 'express-jwt';
import Guard from 'express-jwt-permissions';
import transaction from '../_helpers/transaction.js';
import { IAccountForm, isIAccountForm, ICredentials, isICredentials, Roles } from 'typesit';
import accountService from './service.js';
import { randomUUID } from 'crypto'

const router = express.Router();
const guard = Guard({
    requestProperty: 'auth',
    permissionsProperty: 'permissions'
});

// Routes
router.post('/auth', auth);

router.get('/self', getSelf);
router.get('/self/resetSession', resetSessionSelf);
router.get('/self/balance', getSelfBalance);
router.get('/self/transactions', getSelfTransactions);
router.put('/self', updateSelf);

router.post('/register', register);
router.post('/create', guard.check(Roles.Admin), create);
router.get('/:accountId/resetSession', guard.check(Roles.Admin), resetSession);
router.get('/:accountId/balance', guard.check(Roles.Admin), getBalance);
router.get('/:accountId/transaction', guard.check(Roles.Admin), getTransactions);
router.put('/:accountId/verify/:role', guard.check(Roles.Admin), verify);
router.delete('/:accountId', guard.check(Roles.Admin), deleteAccountById);
router.put('/:accountId', guard.check(Roles.Admin), updateAccountById);
router.put('/:accountId/resetPassword', guard.check(Roles.Admin), resetPasswordById);
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
    transaction.getByAccountId(selfId).then(resp => res.json(resp)).catch(err => next(err));
}

function register(req, res, next) {
    // Check if body is an IAccountForm type
    const data = req.body;
    if(!isIAccountForm(data)){
        // logger.debug(data);
        throw 'request body is of wrong type, must be IAccountForm'
    }

    // registration form initiated creation
    data.role = Roles.Unverified;

    accountService.create(data).then(() => res.json({})).catch(err => next(err))
}

function updateSelf(req, res, next) {
    const selfId = getIdFromPayload(req);
    const type = req.body.type;
    const accountForm = req.body.accountForm;
    const currentPassword = req.body.currentPassword;


    // Check if body is an IAccountForm type
    if(!isIAccountForm(accountForm)){
        throw 'AccountForm is of wrong type, must be IAccountForm'
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
        if (type === 'password') {
            if (accountForm.password === undefined) {
                throw 'password is required in accountForm'
            }
            accountService.updatePasswordById(selfId,accountForm.password).then(() => {
                accountService.resetSession(selfId).then(() => res.json({})).catch(err => next(err))
            }).catch(err => next(err))
        } else if (type === 'account') {
            accountService.updateAccountById(selfId,accountForm).then(() => res.json({})).catch(err => next(err))
        } else {
            throw 'Invalid update type'
        }
    }).catch(err => next(err))

}

// Private routes

function create(req, res, next) {
    // Check if body is an IAccountForm type
    const data = req.body;
    if(!isIAccountForm(data)){
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
    const data = req.body;
    if(!isIAccountForm(data)){
        throw 'request body is of wrong type, must be IAccountForm'
    }
    accountService.updateAccountById(req.params['accountId'],data)
        .then(() => res.json({}))
        .catch(err => next(err))
}

function resetPasswordById(req, res, next) {
    const newPassword = randomUUID().substring(0, 16);
    console.log(`New password: ${newPassword}`);
    accountService.updatePasswordById(req.params['accountId'],newPassword)
        .then(resp => res.json({ password: newPassword }))
        .catch(err => next(err))
}

function getBalance(req, res, next) {
    accountService.getBalance(req.params['accountId']).then(resp => res.json(resp)).catch(err => next(err));
}

function getTransactions(req, res, next) {
    transaction.getById(req.params['accountId']).then(resp => res.json(resp)).catch(err => next(err));
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