import express from 'express';
import Guard from 'express-jwt-permissions';
import { isITransactionForm, Roles } from 'typesit';
import adminService from './service.js';

const router = express.Router();
const guard = Guard({
    requestProperty: 'auth',
    permissionsProperty: 'permissions'
  })

router.use(guard.check(Roles.Admin))
router.get('/transactions', getAllTransactions);
router.post('/transactions', createTransactions);

function getAllTransactions(req, res, next) {
    // console.log("HELP");
    adminService.getAllTransactions().then(resp => res.json(resp)).catch(err => next(err))
}

function createTransactions(req, res, next) {
    // Check if body is an ITransactionForm type
    const data = req.body;
    if(!isITransactionForm(data)){
        console.log(data);
        throw 'request body is of wrong type, must be ITransactionForm'
    }
    adminService.createTransaction(data).then(() => res.json({})).catch(err => next(err))
}

export default router;