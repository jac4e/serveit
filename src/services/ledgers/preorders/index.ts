import { IPreOrder, IPreOrderForm, LedgerType, PreOrderStatus } from 'typesit';
import db from '../../../core/db/index.js';
import logger from '../../../core/logger/index.js';
import Ledger, { LedgerContext, LedgerListCriteria } from '../ledger.js';

const PreOrder = db.preorders;

class PreOrderLedger extends Ledger<IPreOrder, IPreOrderForm> {
    protected type = LedgerType.PreOrder;

    constructor() {
        super();
    }

    protected async create(form: IPreOrderForm, context?: LedgerContext): Promise<IPreOrder> {
        const now = new Date();
        const preOrder = new PreOrder({
            ...form,
            status: PreOrderStatus.Ordered,
        });

        await preOrder.save();

        const saved = await PreOrder.findById(preOrder._id).lean<IPreOrder | null>();
        if (!saved) {
            throw new Error('Pre-order not found after creation');
        }

        logger.info('Pre-order created', {
            section: 'preorder',
            preOrderId: saved.id,
            accountId: saved.accountId,
            actorId: context?.actorId,
        });

        return saved;
    }

    protected async getById(id: string, context?: LedgerContext): Promise<IPreOrder> {
        const preOrder = await PreOrder.findById(id).lean<IPreOrder | null>();
        if (!preOrder) {
            throw new Error('Pre-order not found');
        }
        return preOrder;
    }

    protected async list(criteria: LedgerListCriteria = {}, context?: LedgerContext): Promise<IPreOrder[]> {
        const query = this.buildListQuery(criteria);
        let cursor = PreOrder.find(query).sort({ createdAt: -1 });
        if (criteria.limit) {
            cursor = cursor.limit(criteria.limit);
        }
        return cursor.lean<IPreOrder[]>();
    }

    protected override async update(id: string, patch: Partial<IPreOrder>, context?: LedgerContext): Promise<IPreOrder> {
        const updated = await PreOrder.findByIdAndUpdate(id, patch, { new: true }).lean<IPreOrder | null>();
        if (!updated) {
            throw new Error('Pre-order not found');
        }

        logger.info('Pre-order updated', {
            section: 'preorder',
            preOrderId: id,
            accountId: updated.accountId,
            actorId: context?.actorId,
        });

        return updated;
    }

    protected supports(form: unknown): form is IPreOrderForm {
        return Boolean(form && typeof (form as IPreOrderForm).productId === 'string');
    }

    private buildListQuery(criteria: LedgerListCriteria): Record<string, unknown> {
        const query: Record<string, unknown> = {};

        if (criteria.accountId) {
            query.accountId = criteria.accountId;
        }

        if (criteria.status) {
            const statuses = Array.isArray(criteria.status) ? criteria.status : [criteria.status];
            const validStatuses = statuses.filter((status): status is PreOrderStatus => 
                Object.values(PreOrderStatus).includes(status as PreOrderStatus)
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
const preOrderLedger = new PreOrderLedger();

// Exports for backward compatibility with the old API
export {
    preOrderLedger as default,
    preOrderLedger as instance,
};

