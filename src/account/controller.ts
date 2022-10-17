import express from 'express';
import expressJwt from 'express-jwt';
import Guard from 'express-jwt-permissions';
import transaction from '../_helpers/transaction.js';
import { IAccountForm, Roles } from '../_models/account.model.js';
import accountService from './service.js';

const router = express.Router();
const guard = Guard()

// Routes
router.post('/auth', auth);

router.get('/self', getSelf);
router.post('/self/resetSession', resetSessionSelf);
router.get('/self/balance', getSelfBalance);
router.get('/self/transactions', getSelfTransactions);
// router.put('/self', updateSelf);

router.post('/register', register);
router.post('/create', guard.check(Roles.Admin), create);
router.get('/:accountId/resetSession', guard.check(Roles.Admin), resetSession);
router.get('/:accountId/balance', guard.check(Roles.Admin), getBalance);
router.get('/:accountId/transaction', guard.check(Roles.Admin), getTransactions);
router.put('/:accountId/verify', guard.check(Roles.Admin), verify);
// router.delete('/:accountId', guard.check(Roles.Admin), deleteAccountById);
// router.put('/:accountId', guard.check(Roles.Admin), updateAccountById);
router.get('/', guard.check(Roles.Admin), getAll);
// router.get('/search', search)

// Public routes
function auth(req, res, next) {
    accountService.auth(req.body)
        .then(account => account ? res.json(account) : res.status(401).json({
            message: 'username or password is incorrect'
        })).catch(err => next(err));
}

// User available routes
function getSelf(req, res, next) {
    accountService.getById(req.user.sub).then(account => account ? res.json(account) : res.status(500).json({
        message: 'Something went wrong grabbing self'
    })).catch(err => next(err));
}

function resetSessionSelf(req, res, next) {
    accountService.resetSession(req.user.sub).then(() => res.json({})).catch(err => next(err));
}

function getSelfBalance(req, res, next) {
    // console.log("test'")
    // console.log(req.user.sub);
    accountService.getBalance(req.user.sub).then(resp => res.json(resp)).catch(err => next(err));
}

function getSelfTransactions(req, res, next) {
    // console.log(`self transactions: ${JSON.stringify(req.user)}`)
    accountService.getSelfTransactions(req.user.sub).then(resp => res.json(resp)).catch(err => next(err));
}

function register(req: {body: {form: IAccountForm; gid: string}}, res, next) {
    // Public registration

    const googleFirstName = 'BLANK'
    const googleLastName = 'BLANK'
    const googleEmail = 'BLANK'
    const googleId = 'BLANK'

    // registration form initiated creation
    // get email, name, and google account id from google
    let accountParam = req.body.form
    accountParam.firstName = googleFirstName;
    accountParam.lastName = googleLastName;
    accountParam.email = googleEmail;
    accountParam.gid = googleId;
    accountParam.role = Roles.Unverified;

    accountService.create(accountParam).then(() => res.json({})).catch(err => next(err))
}

// Private routes

function create(req: {body: IAccountForm}, res, next) {
    // Registration by admin, req.body
    accountService.create(req.body).then(() => res.json({})).catch(err => next(err))
}

function getAll(req, res, next) {
    // console.log("getall")
    accountService.getAll()
        .then(resp => res.json(resp))
        .catch(err => next(err))
}

function verify(req, res, next) {
    accountService.verify(req.params['accountId']).then(resp => res.json(resp)).catch(err => next(err));
}

function resetSession(req, res, next) {
    accountService.resetSession(req.params['accountId']).then(() => res.json({})).catch(err => next(err));
}

function getAccountById(req, res, next) {

}

function updateAccountById(req, res, next) {

}

function getBalance(req, res, next) {
    accountService.getBalance(req.params['accountId']).then(resp => res.json(resp)).catch(err => next(err));
}

function getTransactions(req, res, next) {
    transaction.getById(req.params['accountId']).then(resp => res.json(resp)).catch(err => next(err));
}


// function search(req, res, next) {
//     console.log(req.query);
//     accountService.search(req.query)
//     .then(resp => resp.count > 0 ? res.json(resp) : res.status(204))
//     .catch(err => next(err))
// }

export default router;