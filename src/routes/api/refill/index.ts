import express from 'express';
import Guard from 'express-jwt-permissions';
import { HTTP, IRefillForm, isHTTP, isIRefill, isIRefillForm, RefillStatus, Roles } from 'typesit';
import refillLedger from '../../../services/ledgers/refill/index.js';
import logger from '../../../core/logger/index.js';
import bodyParser from 'body-parser';
import { registerRoute, CommonResponses, CommonParameters } from '../../../utils/openapi-docs.js';

const router = express.Router();
const guard = Guard({
    requestProperty: 'auth',
    permissionsProperty: 'permissions'
})

// Base path for this router
const BASE_PATH = '/api/refills';

// ============================================================================
// Admin Routes
// ============================================================================

registerRoute('POST', BASE_PATH, '/create', {
    summary: 'Create a refill (Admin)',
    description: 'Create a new refill entry for any account. Admin only.',
    tags: ['Refills', 'Admin'],
    requestBody: {
        description: 'Refill details',
        schema: 'RefillForm'
    },
    responses: {
        200: { description: 'Refill created successfully', schema: 'Refill' },
        400: { description: 'Invalid refill data' },
        403: CommonResponses.Forbidden
    }
});
router.post('/create', guard.check(Roles.Admin), create);

registerRoute('GET', BASE_PATH, '/', {
    summary: 'Get all refills (Admin)',
    description: 'Retrieve a list of all refill entries. Admin only.',
    tags: ['Refills', 'Admin'],
    responses: {
        200: { description: 'List of all refills', schema: 'Refill[]' },
        403: CommonResponses.Forbidden
    }
});
router.get('/', guard.check(Roles.Admin), getAll);

registerRoute('GET', BASE_PATH, '/:accountId/history', {
    summary: 'Get user refill history (Admin)',
    description: 'Retrieve the refill history for a specific user. Admin only.',
    tags: ['Refills', 'Admin'],
    parameters: [CommonParameters.accountId()],
    responses: {
        200: { description: 'List of refills for the user', schema: 'Refill[]' },
        403: CommonResponses.Forbidden,
        404: CommonResponses.NotFound
    }
});
router.get('/:accountId/history', guard.check(Roles.Admin), getRefillHistory);

registerRoute('GET', BASE_PATH, '/:refillId', {
    summary: 'Get refill by ID (Admin)',
    description: 'Retrieve details of a specific refill. Admin only.',
    tags: ['Refills', 'Admin'],
    parameters: [CommonParameters.refillId()],
    responses: {
        200: { description: 'Refill details', schema: 'Refill' },
        403: CommonResponses.Forbidden,
        404: CommonResponses.NotFound
    }
});
router.get('/:refillId', guard.check(Roles.Admin), getById);

registerRoute('PUT', BASE_PATH, '/:refillId', {
    summary: 'Update refill (Admin)',
    description: 'Update a refill entry. Admin only.',
    tags: ['Refills', 'Admin'],
    deprecated: true,
    parameters: [CommonParameters.refillId()],
    requestBody: {
        description: 'Updated refill data',
        schema: 'Refill'
    },
    responses: {
        200: { description: 'Refill updated successfully' },
        400: { description: 'Invalid refill data' },
        403: CommonResponses.Forbidden,
        404: CommonResponses.NotFound
    }
});
router.put('/:refillId', guard.check(Roles.Admin), updateById);

registerRoute('PUT', BASE_PATH, '/:refillId/approve', {
    summary: 'Approve refill (Admin)',
    description: 'Approve a pending refill and credit the account. Admin only.',
    tags: ['Refills', 'Admin'],
    parameters: [CommonParameters.refillId()],
    responses: {
        200: { description: 'Refill approved and account credited' },
        400: { description: 'Refill cannot be approved (invalid status)' },
        403: CommonResponses.Forbidden,
        404: CommonResponses.NotFound
    }
});
router.put('/:refillId/approve', guard.check(Roles.Admin), approveRefill);

registerRoute('PUT', BASE_PATH, '/:refillId/cancel', {
    summary: 'Cancel refill (Admin)',
    description: 'Cancel a pending refill. Admin only.',
    tags: ['Refills', 'Admin'],
    parameters: [CommonParameters.refillId()],
    responses: {
        200: { description: 'Refill cancelled' },
        400: { description: 'Refill cannot be cancelled (invalid status)' },
        403: CommonResponses.Forbidden,
        404: CommonResponses.NotFound
    }
});
router.put('/:refillId/cancel', guard.check(Roles.Admin), cancelRefill);

registerRoute('PUT', BASE_PATH, '/:refillId/fail', {
    summary: 'Fail refill (Admin)',
    description: 'Mark a refill as failed. Admin only.',
    tags: ['Refills', 'Admin'],
    parameters: [CommonParameters.refillId()],
    responses: {
        200: { description: 'Refill marked as failed' },
        400: { description: 'Refill cannot be failed (invalid status)' },
        403: CommonResponses.Forbidden,
        404: CommonResponses.NotFound
    }
});
router.put('/:refillId/fail', guard.check(Roles.Admin), failRefill);

// ============================================================================
// Webhook Routes
// ============================================================================

registerRoute('POST', BASE_PATH, '/stripe/webhook', {
    summary: 'Stripe webhook endpoint',
    description: 'Receives webhook events from Stripe for payment processing. This endpoint should not be called directly.',
    tags: ['Refills', 'Webhooks'],
    security: false,
    requestBody: {
        description: 'Stripe webhook event payload',
        content: {
            'application/json': {
                schema: { type: 'object' }
            }
        }
    },
    responses: {
        200: { description: 'Webhook received' },
        400: { description: 'Invalid webhook signature' }
    }
});
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
