import express from 'express';
import Guard from 'express-jwt-permissions';
import { isIRefillForm, Roles } from 'typesit';
import refillService from './service.js';
import logger from '../_helpers/logger.js';

const router = express.Router();
const guard = Guard({
    requestProperty: 'auth',
    permissionsProperty: 'permissions'
  })

// Refill routes needed

// create refill (Any user)
router.post('/create', create);
// cancel refill by id (Any user)
router.post('/self/:refillId/cancel', cancelByIdSelf);
// get all refills on self account (Any user)
router.get('/self', getAllSelf);

// get all refills (Admin)
router.get('/', guard.check(Roles.Admin), getAll);
// get refill by id (Admin)
router.get('/:refillId', guard.check(Roles.Admin), getById);
// update refill by id (Admin)
router.put('/:refillId', guard.check(Roles.Admin), updateById);

// webhook route for stripe
router.post('/webhook/stripe', stripeWebhook);



export default router;