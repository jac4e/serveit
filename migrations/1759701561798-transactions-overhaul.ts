// Import your schemas here
import { Document, Schema, type Connection } from 'mongoose';
import { ITransaction, ITransactionDocument, ITransactionForm, ITransactionItem, LedgerType, TransactionType } from 'typesit';
import { backup, migrateCollection, restoreBackup } from './common.ts';

// Old Types
export interface ITransactionOld {
    date: Date | string;
    id: string;
    accountid: string;
    type: TransactionType;
    reason: string;
    products: ITransactionItem[];
    total: bigint | string;
}

type ITransactionDocumentOld = Document & {
    date: ITransactionOld['date'];
    accountid: ITransactionOld['accountid'];
    type: ITransactionOld['type'];
    reason: ITransactionOld['reason'];
    products: ITransactionOld['products'];
    total: string;
}

export async function up(connection: Connection): Promise<void> {
    // Move transactions collection to v0.3.4_transactions without renaming transactions
    await backup(connection, 'transactions', 'v0.3.4_transactions_backup');

    // Modify transactions collection to new schema in place (without adding new documents, by modifying existing documents)
    function transactionTransform(oldDoc: ITransactionDocumentOld): ITransactionDocument {

        // Create new fields
        // Omitting document fields as we don't care about the correctness of those and assume it will be fine
        const newDoc: Omit<ITransactionDocument, keyof Document> = {
            ...(oldDoc as Omit<ITransactionDocumentOld, keyof Document>),
            type: LedgerType.Transaction,
            accountId: oldDoc.accountid,
            transactionType: oldDoc.type==='debit' ? TransactionType.Debit : TransactionType.Credit,
            description: oldDoc.reason,
            createdAt: typeof oldDoc.date === 'string' ? new Date(oldDoc.date) : oldDoc.date,
            updatedAt: typeof oldDoc.date === 'string' ? new Date(oldDoc.date) : oldDoc.date,
        };
        // Remove old fields
        delete (newDoc as any).accountid;
        delete (newDoc as any).reason;
        delete (newDoc as any).date;

        console.log(`Modified transaction ${oldDoc._id}`);
        console.log('Old document:', oldDoc);
        console.log('New document:', newDoc);
        return newDoc as ITransactionDocument;
    }
    await migrateCollection<ITransaction>(connection, 'transactions', transactionTransform);
}

export async function down(connection: Connection): Promise<void> {
    // Restore transactions collection from backup
    await restoreBackup(connection, 'v0.3.4_transactions_backup', 'transactions');
}
