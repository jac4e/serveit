// Import your schemas here
import {Document, type Connection, Types } from 'mongoose'
import { IProduct, IProductDocument, IStockEntry, IStockEntryDocument, LedgerType, ProductCategories, ProductTypes, StockEntryType } from 'typesit';
import { backup, migrateCollection, restoreBackup } from './common.ts';

export interface IProductOld {
  id: string;
  name: string;
  description?: string;
  image?: string;
  price: bigint | string;
  stock: bigint | string;
}

export interface IProductDocumentOld extends Document {
  name: IProductOld['name'];
  description?: IProductOld['description'];
  image?: IProductOld['image'];
  price: string;
  stock: string;
}

export async function up(connection: Connection): Promise<void> {
    // Move products collection to v0.3.4_products without renaming products
    await backup(connection, 'products', 'v0.3.4_products_backup');

    // Modify products collection to new schema in place (without adding new documents, by modifying existing documents)
    function productTransform(oldDoc: any): IProductDocument {
        const { stock: oldStock, ...rest } = oldDoc as Omit<IProductDocumentOld, keyof Document>;
        const newDoc: Omit<IProductDocument, keyof Document> = {
            ...rest,
            category: ProductCategories.Food, // Default to Food, we can manually change the drinks and merch later
            type: ProductTypes.Stock, // Everything in the phrydge database should be stock based already
            price: typeof oldDoc.price === 'string' ? oldDoc.price : oldDoc.price.toString(),
        };

        console.log(`Modified product ${oldDoc._id}`);
        console.log('Old document:', oldDoc);
        console.log('New document:', newDoc);

        const stockEntry: Omit<IStockEntryDocument<StockEntryType.Purchase>, keyof Document> = {
            // required id field for StockEntryBase
            type: LedgerType.Stock,
            entryType: StockEntryType.Purchase,
            productId: oldDoc._id.toString(),
            description: 'Initial stock entry from migration',
            // purchase entries require a cost field
            cost: "0",
            delta: oldStock,
            createdAt: new Date(),
            updatedAt: new Date(),
        };

        connection.collection('stockentries').insertOne(stockEntry);
        console.log(`Created initial stock entry for product ${oldDoc._id} with delta ${oldStock}`);

        return newDoc as IProductDocument;
    }
    await migrateCollection<IProduct>(connection, 'products', productTransform);
}

export async function down(connection: Connection): Promise<void> {
    // Restore products collection from backup
    await restoreBackup(connection, 'v0.3.4_products_backup', 'products');
    // delete stock entries created during the up migration
    try {
        console.log('Deleting stock entries created during migration');
        const result = await connection.collection('stockentries').deleteMany({});
        console.log(`Deleted ${result.deletedCount} stock entries`);
    } catch (error) {
        console.error('Error deleting stock entries:', error);
    }
}
