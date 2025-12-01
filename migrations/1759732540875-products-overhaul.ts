// Import your schemas here
import {Document, type Connection } from 'mongoose'
import { IProduct, IProductDocument, ProductCategories, ProductTypes } from 'typesit';
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
        return newDoc as IProductDocument;
    }
    await migrateCollection<IProduct>(connection, 'products', productTransform);
}

export async function down(connection: Connection): Promise<void> {
    // Restore products collection from backup
    await restoreBackup(connection, 'v0.3.4_products_backup', 'products');
}
