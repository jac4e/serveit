import db from '../../../core/db/index.js';
import accountService from '../../account/index.js';
import { ITransaction, ITransactionForm, LedgerType, TransactionType, IAccount } from 'typesit';
import logger from '../../../core/logger/index.js';
import email from '../../../tasks/email.js';
import Ledger, { LedgerContext, LedgerListCriteria } from '../ledger.js';
// import type { LedgerHandler, LedgerHandlerContext, LedgerListCriteria } from '../index.js';

const Transaction = db.transaction;

class TransactionLedger extends Ledger<ITransaction, ITransactionForm> {
    protected type = LedgerType.Transaction;
    constructor() {
        super();
    }

    protected async create(form: ITransactionForm, context?: LedgerContext): Promise<ITransaction> {
        const doc = new Transaction(form);
        await doc.save();

        const saved = await Transaction.findById(doc._id).lean<ITransaction | null>();
        if (!saved) {
            throw new Error('Transaction not found after creation');
        }

        return saved;
    }

    protected override async afterCreate(transaction: ITransaction, context?: LedgerContext): Promise<void> {
        const account = await accountService.getById(transaction.accountId);

        logger.info('Transaction created', {
            section: 'transaction',
            transactionId: transaction.id,
            accountId: transaction.accountId,
            actorId: context?.actorId,
        });

        notifyTransactionCreated(account, transaction);
    }

    protected async getById(id: ITransaction['id'], context?: LedgerContext): Promise<ITransaction> {
        const transaction = await Transaction.findById(id).lean<ITransaction | null>();
        if (!transaction) {
            throw new Error('Transaction not found');
        }
        return transaction;
    }

    protected async list(criteria: LedgerListCriteria = {}, context?: LedgerContext): Promise<ITransaction[]> {
        const query = buildListQuery(criteria);
        let cursor = Transaction.find(query).sort({ createdAt: -1 });
        if (criteria.limit) {
            cursor = cursor.limit(criteria.limit);
        }
        return await cursor.lean<ITransaction[]>();
    }

    protected async getByAccountId(accountId: string, context?: LedgerContext): Promise<ITransaction[]> {
        return this.list({ accountId }, context);
    }

    async getBalanceByAccountId(accountId: string, context?: LedgerContext): Promise<bigint> {
        const balance = await Transaction.aggregate<{ balance: string }>([
            {
                $match: {
                    accountId,
                }
            },
            {
                $group: {
                    _id: null,
                    balance: {
                        $sum: {
                            $cond: [
                                { $eq: ['$transactionType', TransactionType.Credit] },
                                { $toLong: '$total' },
                                {
                                    $multiply: [
                                        { $toLong: '$total' },
                                        -1
                                    ]
                                }
                            ]
                        }
                    }
                }
            }
        ]);

        if (!balance.length) {
            return 0n;
        }

        return BigInt(balance[0].balance);
    }

    protected supports(form: unknown): form is ITransactionForm {
        return Boolean(form && typeof (form as ITransactionForm).transactionType === 'string');
    }
}

function buildListQuery(criteria: LedgerListCriteria): Record<string, unknown> {
    const query: Record<string, unknown> = {};

    if (criteria.accountId) {
        query.accountId = criteria.accountId;
    }

    if (criteria.status) {
        const status = Array.isArray(criteria.status) ? criteria.status : [criteria.status];
        const transactionTypes = status.filter((value): value is TransactionType => Object.values(TransactionType).includes(value as TransactionType));
        if (transactionTypes.length === 1) {
            query.transactionType = transactionTypes[0];
        } else if (transactionTypes.length > 1) {
            query.transactionType = { $in: transactionTypes };
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

function notifyTransactionCreated(account: IAccount, transaction: ITransaction): void {
    const subject = 'Spendit - Transaction Receipt';
    const productsList = transaction.products.map((item) => `\t${item.name}\t${item.description ?? 'N/A'}\t${item.amount}\t${item.price}\t${item.total}`).join('\n');
    const productTable = productsList.length
        ? `\tName\tDescription\tQuantity\tUnit Price\tAmount\n${productsList}\n\tTotal:${transaction.total}`
        : '\tNo line items provided';
    const message = `Date: ${transaction.createdAt.toISOString()}\nTransaction ID: ${transaction.id}\nAccount ID: ${transaction.accountId}\nType: ${transaction.transactionType}\nDescription: ${transaction.description ?? ''}\nProducts:\n${productTable}`;
    email.send(account, subject, message);
}

// Create singleton instance
const transactionLedger = new TransactionLedger();

// Exports for backward compatibility with the old API
export {
    transactionLedger as default,
    transactionLedger as instance,
};

