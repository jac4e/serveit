import { BaseLedgerEntry, IProduct, IStockEntry, IStockEntryForm, LedgerType, StockEntryType } from 'typesit';
import db from '../../../core/db/index.js';
import logger from '../../../core/logger/index.js';
import Ledger, { LedgerContext, LedgerListCriteria } from '../ledger.js';
import { IQuantity, ICoin } from 'typesit/lib/common.js';

const StockEntry = db.stock;

class StockLedger extends Ledger<IStockEntry, IStockEntryForm> {
    protected type = LedgerType.Stock;

    constructor() {
        super('stock');
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

    async getCostById(productId: string, context?: LedgerContext): Promise<ICoin> {
        const entries = await this.getByProductId(productId);
        const layers: Array<{ qty: bigint, unitCost: ICoin }> = [];
        let totalCost = 0n;

        for (const entry of entries) {
            const delta = BigInt(entry.delta);
            
            if (delta > 0) {
                // Purchase or positive adjustment creates a new layer
                layers.push({ qty: delta, unitCost: entry.cost || 0n });
            } else if (delta < 0) {
                // Sale or negative adjustment consumes from oldest layers
                let remainingQty = -delta;
                while (remainingQty > 0n && layers.length > 0) {
                    const oldestLayer = layers[0];
                    if (oldestLayer.qty <= remainingQty) {
                        // Consume entire layer
                        remainingQty -= oldestLayer.qty;
                        totalCost += oldestLayer.qty * oldestLayer.unitCost;
                        layers.shift();
                    } else {
                        // Partially consume layer
                        oldestLayer.qty -= remainingQty;
                        totalCost += remainingQty * oldestLayer.unitCost;
                        remainingQty = 0n;
                    }
                }
            }
        }

        return totalCost;
    }

    // Returns a map of all product IDs to their current stock balances and costs
    async getInventory(context?: LedgerContext): Promise<Map<IProduct['id'], { stock: IQuantity, cost: ICoin }>> {
        const entries = await StockEntry.find({}).lean<IStockEntry[]>();
        const inventory = new Map<IProduct['id'], { stock: IQuantity, cost: ICoin }>();
        
        for (const productId of new Set(entries.map(e => e.productId))) {
            const layers: Array<{ qty: bigint, unitCost: ICoin }> = [];
            let totalCost = 0n;
            let stock = 0n;
            
            // Process entries for this product in chronological order
            const productEntries = entries
                .filter(e => e.productId === productId)
                .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

            for (const entry of productEntries) {
                const delta = BigInt(entry.delta);
                stock += delta;
                
                if (delta > 0) {
                    layers.push({ qty: delta, unitCost: entry.cost || 0n });
                } else if (delta < 0) {
                    let remainingQty = -delta;
                    while (remainingQty > 0n && layers.length > 0) {
                        const oldestLayer = layers[0];
                        if (oldestLayer.qty <= remainingQty) {
                            remainingQty -= oldestLayer.qty;
                            totalCost += oldestLayer.qty * oldestLayer.unitCost;
                            layers.shift();
                        } else {
                            oldestLayer.qty -= remainingQty;
                            totalCost += remainingQty * oldestLayer.unitCost;
                            remainingQty = 0n;
                        }
                    }
                }
            }
            
            inventory.set(productId, { stock, cost: totalCost });
        }
        
        return inventory;
    }

    protected override async afterCreate(entry: IStockEntry, context: LedgerContext | undefined): Promise<void> {
        const balance = await this.getBalanceByProductId(entry.productId);
        if (balance <= 0n) {
            logger.warn('Product is out of stock', {
                section: 'stock',
                productId: entry.productId,
                balance: balance.toString()
            });
        }
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