import { randomUUID } from 'crypto';
import Stripe from 'stripe';
import {
    IRefill,
    IRefillForm,
    ITransactionForm,
    LedgerType,
    RefillMethods,
    RefillStatus,
    Roles,
    TransactionType,
} from 'typesit';
import db from '../../../core/db/index.js';
import email from '../../../tasks/email.js';
import accountService from '../../account/index.js';
import { default as transactionService } from '../transactions/index.js';
import { __envConfig } from '../../../config/config.js';
import logger from '../../../core/logger/index.js';
import Ledger, { LedgerContext, LedgerListCriteria } from '../ledger.js';

const stripe = new Stripe(__envConfig.backend.stripeSecret);
const Refill = db.refill;

class RefillLedger extends Ledger<IRefill, IRefillForm> {
    protected type = LedgerType.Refill;

    constructor() {
        super();
    }

    protected async create(form: IRefillForm, context?: LedgerContext): Promise<IRefill> {
        if (BigInt(form.amount) < 50n && form.method !== RefillMethods.Cash) {
            throw new Error('Minimum refill amount for non-cash transactions is 50');
        }

        const now = new Date();
        const refill = new Refill({
            ...form,
            status: RefillStatus.Pending
        });

        await this.applyPaymentMethodSideEffects(refill);
        await refill.save();

        const created = await Refill.findById(refill._id).lean<IRefill | null>();
        if (!created) {
            throw new Error('Refill not found after creation');
        }

        const account = await accountService.getById(created.account);
        const subject = 'Spendit - New Refill Requested';
        const message = `A new refill of ${created.amount} on ${created.createdAt} with ${created.method} has been requested!`;
        email.send(account, subject, message);
        email.sendAll(Roles.Admin, 'New Pending Refill Requested', `A new refill of ${created.amount} on ${created.createdAt} with ${created.method} has been requested by ${account.username} <${account.email}>!`);

        logger.info('Refill created', {
            section: 'refill',
            refillId: created.id,
            accountId: created.account,
            actorId: context?.actorId,
        });

        return created;
    }

    protected async getById(id: string, context?: LedgerContext): Promise<IRefill> {
        const result = await Refill.findById(id).lean<IRefill | null>();
        if (!result) {
            throw new Error('Refill not found');
        }
        return result;
    }

    protected async list(criteria: LedgerListCriteria = {}, context?: LedgerContext): Promise<IRefill[]> {
        const query = this.buildListQuery(criteria);
        let cursor = Refill.find(query).sort({ createdAt: -1 });
        if (criteria.limit) {
            cursor = cursor.limit(criteria.limit);
        }
        return cursor.lean<IRefill[]>();
    }

    protected override async update(id: string, patch: Partial<IRefill>, context?: LedgerContext): Promise<IRefill> {
        const updated = await Refill.findByIdAndUpdate(id, patch, { new: true }).lean<IRefill | null>();
        if (!updated) {
            throw new Error('Refill not found');
        }

        const account = await accountService.getById(updated.account);
        email.send(account, 'Refill Request Updated', `Your refill of ${updated.amount} on ${updated.createdAt} with ${updated.method} has been updated.`);

        logger.info('Refill updated', {
            section: 'refill',
            refillId: id,
            accountId: updated.account,
            actorId: context?.actorId,
        });

        return updated;
    }

    protected supports(form: unknown): form is IRefillForm {
        return Boolean(form && typeof (form as IRefillForm).method === 'string');
    }

    // Additional public methods specific to RefillLedger
    async getRefillHistory(accountId: string, context?: LedgerContext): Promise<IRefill[]> {
        return this.list({ accountId }, context);
    }

    async getPendingRefills(method: RefillMethods, context?: LedgerContext): Promise<IRefill[]> {
        return Refill.find({ status: RefillStatus.Pending, method }).sort({ createdAt: -1 }).lean<IRefill[]>();
    }

    async completeRefill(
        id: string,
        { amount, reference, note }: { amount?: bigint; reference?: string; note?: string },
        context?: LedgerContext
    ): Promise<IRefill> {
        const refill = await Refill.findById(id);
        if (!refill) {
            throw new Error('Refill not found');
        }
        if (refill.status !== RefillStatus.Pending) {
            throw new Error('Refill is not pending');
        }
        if (amount && BigInt(refill.amount) !== amount) {
            throw new Error('Amount does not match');
        }

        const transaction: ITransactionForm = {
            type: LedgerType.Transaction,
            accountId: refill.account,
            transactionType: TransactionType.Credit,
            total: String(refill.amount),
            description: `${refill.method} Refill: ${reference || refill.reference}`,
            products: [],
        };

        await transactionService.createEntry(transaction, context);

        refill.status = RefillStatus.Complete;
        refill.reference = reference || refill.reference;
        refill.description = note;
        await refill.save();

        const account = await accountService.getById(refill.account);
        email.send(account, 'Refill Request Completed', `Your refill of ${refill.amount} on ${refill.createdAt} with ${refill.method} has been completed!`);

        logger.info('Refill completed', {
            section: 'refill',
            refillId: refill.id,
            accountId: refill.account,
            actorId: context?.actorId,
        });

        return (refill.toJSON() as unknown) as IRefill;
    }

    async failRefill(
        id: string,
        { reference, note }: { reference?: string; note?: string } = {},
        context?: LedgerContext
    ): Promise<IRefill> {
        const refill = await Refill.findById(id);
        if (!refill) {
            throw new Error('Refill not found');
        }
        if (refill.status !== RefillStatus.Pending) {
            throw new Error('Refill is not pending');
        }

        refill.status = RefillStatus.Failed;
        refill.reference = reference || refill.reference;
        refill.description = note;
        await refill.save();

        const account = await accountService.getById(refill.account);
        email.send(account, 'Refill Request Failed', `Your refill of ${refill.amount} on ${refill.createdAt} with ${refill.method} has failed!`);

        logger.info('Refill failed', {
            section: 'refill',
            refillId: refill.id,
            accountId: refill.account,
            actorId: context?.actorId,
        });

        return (refill.toJSON() as unknown) as IRefill;
    }

    async cancelRefill(
        id: string,
        { note }: { note?: string } = {},
        context?: LedgerContext
    ): Promise<IRefill> {
        const refill = await Refill.findById(id);
        if (!refill) {
            throw new Error('Refill not found');
        }

        refill.status = RefillStatus.Cancelled;
        refill.updatedAt = new Date();
        refill.description = note;
        await refill.save();

        const account = await accountService.getById(refill.account);
        email.send(account, 'Refill Request Cancelled', `Your refill of ${refill.amount} on ${refill.createdAt} with ${refill.method} has been cancelled!`);

        logger.info('Refill cancelled', {
            section: 'refill',
            refillId: refill.id,
            accountId: refill.account,
            actorId: context?.actorId,
        });

        return (refill.toJSON() as unknown) as IRefill;
    }

    verifyStripeWebhook(sig: string, payload: string | Buffer): Stripe.Event {
        return stripe.webhooks.constructEvent(payload, sig, __envConfig.backend.stripeWebhookSecret);
    }

    private async applyPaymentMethodSideEffects(refill: any): Promise<void> {
        if (refill.method === RefillMethods.Stripe) {
            refill.cost = BigInt(Math.round((Number(refill.amount) + 30) / (1 - 0.029)));
            const session = await stripe.checkout.sessions.create({
                metadata: {
                    amt: String(refill.amount),
                },
                line_items: [
                    {
                        price_data: {
                            currency: 'cad',
                            product_data: {
                                name: 'Phrydge Account Refill',
                            },
                            unit_amount: Number(refill.amount),
                        },
                        quantity: 1,
                    },
                    {
                        price_data: {
                            currency: 'cad',
                            product_data: {
                                name: 'Online Service Fee',
                            },
                            unit_amount: Number(refill.cost) - Number(refill.amount),
                        },
                        quantity: 1,
                    },
                ],
                client_reference_id: refill.id,
                mode: 'payment',
                success_url: `${__envConfig.backend.url}/account/refill?success=true&refill=${refill._id}`,
                cancel_url: `${__envConfig.backend.url}/account/refill?success=false&refill=${refill._id}`,
            });
            refill.reference = session.id;
        } else if (refill.method === RefillMethods.Etransfer) {
            refill.cost = refill.amount;
            refill.reference = randomUUID();
        } else if (refill.method === RefillMethods.Cash) {
            refill.cost = refill.amount;
            refill.reference = randomUUID();
        } else if (refill.method === RefillMethods.CreditCard) {
            refill.cost = BigInt(Math.round((Number(refill.amount) + 5 + 16) / (1 - 0.027)));
            refill.reference = randomUUID();
        } else if (refill.method === RefillMethods.DebitCard) {
            refill.cost = BigInt(Math.round(Number(refill.amount) + 15 + 16));
            refill.reference = randomUUID();
        }
    }

    private buildListQuery(criteria: LedgerListCriteria): Record<string, unknown> {
        const query: Record<string, unknown> = {};

        if (criteria.accountId) {
            query.account = criteria.accountId;
        }

        if (criteria.status) {
            const statuses = Array.isArray(criteria.status) ? criteria.status : [criteria.status];
            const validStatuses = statuses.filter((status): status is RefillStatus => 
                Object.values(RefillStatus).includes(status as RefillStatus)
            );
            if (validStatuses.length === 1) {
                query.status = validStatuses[0];
            } else if (validStatuses.length > 1) {
                query.status = { $in: validStatuses };
            }
        }

        if (criteria.dateRange?.from || criteria.dateRange?.to) {
            const dateClause: Record<string, Date> = {};
            if (criteria.dateRange.from) {
                dateClause.$gte = criteria.dateRange.from;
            }
            if (criteria.dateRange.to) {
                dateClause.$lte = criteria.dateRange.to;
            }
            query.createdAt = dateClause;
        }

        return query;
    }
}

// Create singleton instance
const refillLedger = new RefillLedger();

// Exports for backward compatibility with the old API
export {
    refillLedger as default,
    refillLedger as instance,
};
