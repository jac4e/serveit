import { Connection } from 'mongoose';
import { MongooseDocumentType } from 'typesit';

async function backup(connection: Connection, sourceCollectionName: string, backupCollectionName: string) {
    try {
        console.log(`Backing up old accounts collection to ${backupCollectionName}`);
        const sourceCollection = await connection.collection(sourceCollectionName);
        await sourceCollection.aggregate([
            { $match: {} },
            { $out: backupCollectionName }
        ]).toArray();
        console.log('Backup complete');
    } catch (error) {
        console.error('Error backing up accounts collection:', error);
    }
}

async function restoreBackup(connection: Connection, backupCollectionName: string, targetCollectionName: string) {
    // Drop the target collection   
    try {
        console.log(`Dropping ${targetCollectionName} collection`);
        await connection.collection(targetCollectionName).drop();
        console.log(`Dropped ${targetCollectionName} collection`);
    } catch (error) {
        console.error(`Error dropping ${targetCollectionName} collection:`, error);
    }

    // Rename backup collection back to accounts
    try {
        console.log(`Restoring old accounts collection from ${backupCollectionName}`);
        await connection.collection(backupCollectionName).rename(targetCollectionName);
        console.log(`Restored old accounts collection to ${targetCollectionName}`);
    } catch (error) {
        console.error(`Error restoring old accounts collection to ${targetCollectionName}:`, error);
    }
}

async function migrateCollection<T>(connection: Connection, sourceCollectionName: string, transformFn: (oldDoc: any) => MongooseDocumentType<T>) {
    try {
        console.log(`Modifying ${sourceCollectionName} collection to new schema`);
        const documents = await connection.collection<MongooseDocumentType<T>>(sourceCollectionName).find().toArray();
        for (const tx of documents) {
            console.log(`Modifying account ${tx._id}`);
            const updatedTx = transformFn(tx);
            const res = await connection.collection(sourceCollectionName).replaceOne({ _id: tx._id }, updatedTx);  
            console.log(res);
        }
        console.log('Accounts collection modified to new schema');
    } catch (error) {
        console.error('Error modifying accounts collection:', error);
    }
}

export { backup, restoreBackup, migrateCollection };