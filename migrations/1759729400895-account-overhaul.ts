// Import your schemas here
import { Schema, type Connection } from 'mongoose';
import { IAccount, IAccountDocument, LedgerType, Roles, MongooseDocumentType } from 'typesit';
import { create } from 'domain';
import { backup, migrateCollection, restoreBackup } from './common.ts';

export async function up(connection: Connection): Promise<void> {
    // Move accounts collection to v0.3.4_accounts without renaming accounts
    await backup(connection, 'accounts', 'v0.3.4_accounts_backup');

    // Modify accounts collection to new schema in place (without adding new documents, by modifying existing documents)
    function accountTransform(oldDoc: any): IAccountDocument {
        const newDoc: Omit<IAccountDocument, keyof Document> = {
            ...(oldDoc as Omit<IAccountDocument, keyof Document>),
            // Convert member to camelCase
            role: oldDoc.role === 'nonmember' ? Roles.NonMember : oldDoc.role,
        };

        console.log(`Modified account ${oldDoc._id}`);
        console.log('Old document:', oldDoc);
        console.log('New document:', newDoc);
        return newDoc;
    }
    await migrateCollection<IAccount>(connection, 'accounts', accountTransform);
}

export async function down(connection: Connection): Promise<void> {
    // Restore accounts collection from backup
    await restoreBackup(connection, 'v0.3.4_accounts_backup', 'accounts');
}
