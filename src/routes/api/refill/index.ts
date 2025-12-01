import express from 'express';
import Guard from 'express-jwt-permissions';
import { HTTP, IRefillForm, isHTTP, isIRefill, isIRefillForm, RefillStatus, Roles } from 'typesit';
import refillLedger from '../../../services/ledgers/refill/index.js';
import logger from '../../../core/logger/index.js';
import bodyParser from 'body-parser';

const router = express.Router();
const guard = Guard({
    requestProperty: 'auth',
    permissionsProperty: 'permissions'
})

// Refill routes needed

// create refill (Admin)
router.post('/create', guard.check(Roles.Admin), create);

// get all refills (Admin)
router.get('/', guard.check(Roles.Admin), getAll);
// get refill by user id (Admin)
router.get('/:accountId/history', guard.check(Roles.Admin), getRefillHistory);
// get refill by id (Admin)
router.get('/:refillId', guard.check(Roles.Admin), getById);
// update refill by id (Admin)
router.put('/:refillId', guard.check(Roles.Admin), updateById);
// approve refill (Admin)
router.put('/:refillId/approve', guard.check(Roles.Admin), approveRefill);
// cancel refill (Admin)
router.put('/:refillId/cancel', guard.check(Roles.Admin), cancelRefill);
// fail refill (Admin)
router.put('/:refillId/fail', guard.check(Roles.Admin), failRefill);

// webhook route for stripe
router.post('/stripe/webhook', stripeWebhook);

function create(req, res, next) {
    // Check if body is an IRefillForm type
    const data: HTTP<IRefillForm> = req.body;

    if (!isHTTP<IRefillForm>(data)) {
        throw 'request body is of wrong type, must be HTTP<IRefillForm>'
    }

    const form: IRefillForm = {
        account: data.account,
        amount: BigInt(data.amount),
        method: data.method,
    };

    if (!isIRefillForm(form)) {
        throw 'request body is of wrong type, must be IRefillForm'
    }
    refillLedger.createEntry(form).then((resp) => res.json(resp)).catch(err => next(err));
}

function getAll(req, res, next) {
    refillLedger.listEntries({}).then((resp) => res.json(resp)).catch(err => next(err));
}

function getById(req, res, next) {
    const id = req.params.refillId;
    refillLedger.getEntry(id).then((resp) => res.json(resp)).catch(err => next(err));
}

// This is an unused route, i am not sure if I want to keep it
function updateById(req, res, next) {
    const id = req.params.refillId;
    const data = req.body;
    // Check if body is an IRefill type
    if (!isIRefill(data))
        throw 'request body is of wrong type, must be IRefill'
    refillLedger.updateEntry(id, data).then((resp) => res.json(resp)).catch(err => next(err));
}

function approveRefill(req, res, next) {
    const id = req.params.refillId;
    const note = 'Admin: Refill approved';
    refillLedger.completeRefill(id, {note: note}).then((resp) => res.json(resp)).catch(err => next(err));
}

function cancelRefill(req, res, next) {
    const id = req.params.refillId;
    const note = 'Admin: Refill cancelled';
    refillLedger.cancelRefill(id, {note: note}).then((resp) => res.json(resp)).catch(err => next(err));
}

function failRefill(req, res, next) {
    const id = req.params.refillId;
    const note = 'Admin: Refill failed';
    refillLedger.failRefill(id, {note: note}).then((resp) => res.json(resp)).catch(err => next(err));
}

function getRefillHistory(req, res, next) {
    const id = req.params.accountId;
    refillLedger.getRefillHistory(id).then((resp) => res.json(resp)).catch(err => next(err));
}

function stripeWebhook(req, res) {
    const event = refillLedger.verifyStripeWebhook(req.headers['stripe-signature'], req.rawBody)
    
    logger.log('debug', `Stripe Webhook received`, {section: 'stripeWebhook'});
    switch (event.type) {
        case 'checkout.session.completed': 
        case 'checkout.session.async_payment_succeeded':{
            const session = event.data.object;

            // Verify that the session is paid
            if (session.payment_status !== 'paid') {
                // Does not contain a payment
                break;
            }

            // Verify that the session has a client reference id
            if (!session.client_reference_id) {
                // No refill id
                logger.error(`No client reference id for session ${session.id}`, {section: 'stripeWebhook'});
                break;
            }

            // Get amount from metadata
            const amount = session.metadata?.amt;
            if (!amount) {
                // No amount in metadata
                logger.error(`No amount in metadata for session ${session.id}`, {section: 'stripeWebhook'});
                refillLedger.failRefill(session.client_reference_id, {reference: session.id, note: 'Stripe: No amount in metadata'}).then(() => {
                    logger.log('info', `Refill ${session.client_reference_id} was failed`, {section: 'stripeWebhook'});
                }).catch(err => {
                    logger.error(`Refill ${session.client_reference_id} failed to fail`, {section: 'stripeWebhook'});
                    logger.error(err, {section: 'stripeWebhook'});
                });
                break;
            }

            logger.log('info', `${event.type}: Payment was successful for session ${session.id}`, {section: 'stripeWebhook'});

            // Fulfill the purchase...
            const note = `Stripe: ${event.type}`;
            refillLedger.completeRefill(session.client_reference_id, {amount: BigInt(amount), reference: session.id, note: note}).then(() => {
                logger.log('info', `Refill ${session.client_reference_id} was completed`, {section: 'stripeWebhook'});
            }).catch(err => {
                logger.error(`Refill ${session.client_reference_id} failed to complete`, {section: 'stripeWebhook'});
                logger.error(err, {section: 'stripeWebhook'});
            });
            break;
        }
        // Add case for checkout session expiring:
        case 'checkout.session.async_payment_failed':
        case 'checkout.session.expired': {
            const session = event.data.object;

            // Verify that the session has a client reference id
            if (!session.client_reference_id) {
                // No refill id
                logger.error(`No client reference id for session ${session.id}`, {section: 'stripeWebhook'});
                break;
            }

            logger.log('info', `${event.type}: Payment was not successful for session ${session.id}`, {section: 'stripeWebhook'});

            // Fail the purchase...
            const note = `Stripe: ${event.type}`;
            refillLedger.failRefill(session.client_reference_id, {reference: session.id}).then(() => {
                logger.log('info', `Refill ${session.client_reference_id} was failed`, {section: 'stripeWebhook'});
            }).catch(err => {
                logger.error(`Refill ${session.client_reference_id} failed to fail`, {section: 'stripeWebhook'});
                logger.error(err, {section: 'stripeWebhook'});
            });
            break;
        }
    }

    res.json({ received: true });
}

export default router;
