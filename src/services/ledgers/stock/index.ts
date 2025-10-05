import { BaseLedgerEntry, IProduct, IStockEntry, IStockEntryForm, LedgerType, StockEntryType } from 'typesit';
import db from '../../../core/db/index.js';
import logger from '../../../core/logger/index.js';
import Ledger, { LedgerContext, LedgerListCriteria } from '../ledger.js';
import { IQuantity, ICoin } from 'typesit/lib/common.js';

const StockEntry = db.stock;

class StockLedger extends Ledger<IStockEntry, IStockEntryForm> {
    protected type = LedgerType.Stock;

    constructor() {
        super();
    }

    protected async create(form: IStockEntryForm, context?: LedgerContext): Promise<IStockEntry> {
        const doc = new StockEntry(form);
        await doc.save();

        const saved = await StockEntry.findById(doc._id).lean<IStockEntry | null>();
        if (!saved) {
            throw new Error('Stock entry not found after creation');
        }

        logger.info('Stock entry created', {
            section: 'stock',
            stockEntryId: saved.id,
            productId: saved.productId,
            actorId: context?.actorId,
        });

        return saved;
    }

    protected async getById(id: string, context?: LedgerContext): Promise<IStockEntry> {
        const entry = await StockEntry.findById(id).lean<IStockEntry | null>();
        if (!entry) {
            throw new Error('Stock entry not found');
        }
        return entry;
    }

    protected async list(criteria: LedgerListCriteria = {}, context?: LedgerContext): Promise<IStockEntry[]> {
        const query = this.buildListQuery(criteria);
        let cursor = StockEntry.find(query).sort({ createdAt: -1 });
        if (criteria.limit) {
            cursor = cursor.limit(criteria.limit);
        }
        return await cursor.lean<IStockEntry[]>();
    }

    async getBalanceByProductId(productId: string, context?: LedgerContext): Promise<IQuantity> {
        const entries = await StockEntry.find({ productId }).lean<IStockEntry[]>();
        return entries.reduce((total: IQuantity, entry) => total + BigInt(entry.delta), 0n);
    }

    async getByProductId(productId: string, context?: LedgerContext): Promise<IStockEntry[]> {
        return StockEntry.find({ productId }).sort({ createdAt: -1 }).lean<IStockEntry[]>();
    }

    protected supports(form: unknown): form is IStockEntryForm {
        return Boolean(form && typeof (form as IStockEntryForm).productId === 'string');
    }

    private buildListQuery(criteria: LedgerListCriteria): Record<string, unknown> {
        const query: Record<string, unknown> = {};
    
        // Stock entries are not account-scoped; ignore account filters intentionally.
    
        if (criteria.status) {
            const statuses = Array.isArray(criteria.status) ? criteria.status : [criteria.status];
            const entryTypes = statuses.filter((status): status is StockEntryType => 
                Object.values(StockEntryType).includes(status as StockEntryType)
            );
            if (entryTypes.length === 1) {
                query.entryType = entryTypes[0];
            } else if (entryTypes.length > 1) {
                query.entryType = { $in: entryTypes };
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

// Create a singleton instance for export
const stockLedger = new StockLedger();
export {
    stockLedger as default,
    stockLedger as instance,
};