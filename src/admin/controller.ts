import express from 'express';
import Guard from 'express-jwt-permissions';
import adminService from './service.js';

const router = express.Router();
const guard = Guard()

router.use(guard.check('admin'))
router.get('/transactions', getAllTransactions);
router.post('/transactions', createTransactions);

function getAllTransactions(req, res, next) {
    // console.log("HELP");
    adminService.getAllTransactions().then(resp => res.json(resp)).catch(err => next(err))
}

function createTransactions(req, res, next) {
    adminService.createTransaction(req.body).then(() => res.json({})).catch(err => next(err))
}

export default router;