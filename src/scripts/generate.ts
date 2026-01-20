/**
 * @fileoverview Development data generator script.
 * 
 * This script generates sample development data in the database for testing
 * and development purposes. It creates:
 * - Sample user accounts (admin, member, unverified)
 * - Sample products (stock and order types)
 * - Sample stock entries
 * - Sample transactions
 * - Sample refills
 * 
 * Usage: npm run generate
 * 
 * WARNING: This script will clear existing data in the collections it populates.
 * Only use in development environments.
 * 
 * @author Jacques Fourie
 */

import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import { 
    Roles,
    ProductCategories,
    ProductTypes,
    TransactionType,
    LedgerType,
    RefillMethods,
    RefillStatus,
    StockEntryType,
    PreOrderStatus
} from 'typesit';

// Database connection setup
const DB_URL = process.env.DB_URL ?? 'localhost';
const DB_PORT = process.env.DB_PORT ?? '27017';
const DB_NAME = 'spendit-dev-db';

const connectionString = `mongodb://${DB_URL}:${DB_PORT}/${DB_NAME}?retryWrites=true&w=majority`;

// Import models after connection setup
import db from '../core/db/index.js';

const saltRounds = 10;

// Sample data definitions
const sampleAccounts = [
    {
        username: 'admin',
        firstName: 'Admin',
        lastName: 'User',
        email: 'admin@ualberta.ca',
        role: Roles.Admin,
        notify: true,
        password: 'admin123!'
    },
    {
        username: 'member1',
        firstName: 'John',
        lastName: 'Doe',
        email: 'jdoe@ualberta.ca',
        role: Roles.Member,
        notify: true,
        password: 'member123!'
    },
    {
        username: 'member2',
        firstName: 'Jane',
        lastName: 'Smith',
        email: 'jsmith@ualberta.ca',
        role: Roles.Member,
        notify: false,
        password: 'member123!'
    },
    {
        username: 'newuser',
        firstName: 'New',
        lastName: 'User',
        email: 'newuser@ualberta.ca',
        role: Roles.Unverified,
        notify: true,
        password: 'newuser123!'
    },
    {
        username: 'nonmember',
        firstName: 'Non',
        lastName: 'Member',
        email: 'nonmember@ualberta.ca',
        role: Roles.NonMember,
        notify: false,
        password: 'nonmember123!'
    },
    {
        username: 'pos',
        firstName: 'Point',
        lastName: 'OfSale',
        email: 'pos@ualberta.ca',
        role: Roles.POS,
        notify: false,
        password: 'pos12345!'
    }
];

const sampleProducts = [
    // Stock products
    {
        name: 'Red Bull Energy Drink',
        category: ProductCategories.Drinks,
        description: 'Classic Red Bull energy drink, 250ml can',
        price: '350', // $3.50 in cents
        type: ProductTypes.Stock,
    },
    {
        name: 'Monster Energy',
        category: ProductCategories.Drinks,
        description: 'Monster Energy drink, 473ml can',
        price: '400',
        type: ProductTypes.Stock,
    },
    {
        name: 'Coca-Cola',
        category: ProductCategories.Drinks,
        description: 'Classic Coca-Cola, 355ml can',
        price: '150',
        type: ProductTypes.Stock,
    },
    {
        name: 'Chips - Original',
        category: ProductCategories.Food,
        description: 'Classic salted potato chips',
        price: '200',
        type: ProductTypes.Stock,
    },
    {
        name: 'Chocolate Bar',
        category: ProductCategories.Food,
        description: 'Milk chocolate bar',
        price: '175',
        type: ProductTypes.Stock,
    },
    {
        name: 'Granola Bar',
        category: ProductCategories.Food,
        description: 'Chewy granola bar',
        price: '125',
        type: ProductTypes.Stock,
    },
    {
        name: 'Coffee - Medium',
        category: ProductCategories.Drinks,
        description: 'Freshly brewed medium coffee',
        price: '200',
        type: ProductTypes.Stock,
    },
    // Order products
    {
        name: 'Engineering Physics T-Shirt',
        category: ProductCategories.Clothing,
        description: 'Official EP Club t-shirt, various sizes',
        price: '2500', // $25.00
        type: ProductTypes.Order,
        order: {
            supplier: 'Campus Print Shop',
            minimum: '20'
        }
    },
    {
        name: 'EP Club Hoodie',
        category: ProductCategories.Clothing,
        description: 'Premium club hoodie with embroidered logo',
        price: '5500', // $55.00
        type: ProductTypes.Order,
        order: {
            supplier: 'Campus Print Shop',
            minimum: '15'
        }
    },
    {
        name: 'Engineering Sticker Pack',
        category: ProductCategories.Merch,
        description: 'Pack of 10 engineering-themed stickers',
        price: '800',
        type: ProductTypes.Order,
        order: {
            supplier: 'Sticker Mule',
            minimum: '50'
        }
    },
    {
        name: 'Lab Notebook',
        category: ProductCategories.Other,
        description: 'Graph paper lab notebook, 100 pages',
        price: '1200',
        type: ProductTypes.Stock,
    }
];

async function clearDatabase(): Promise<void> {
    console.log('🗑️  Clearing existing data...');
    
    await db.account.deleteMany({ username: { $ne: 'dev' } }); // Keep dev account
    await db.product.deleteMany({});
    await db.stock.deleteMany({});
    await db.transaction.deleteMany({});
    await db.refill.deleteMany({});
    await db.preorders.deleteMany({});
    
    console.log('✅ Database cleared (dev account preserved)');
}

async function createAccounts(): Promise<Map<string, string>> {
    console.log('👤 Creating sample accounts...');
    
    const accountIds = new Map<string, string>();
    
    for (const accountData of sampleAccounts) {
        const existingAccount = await db.account.findOne({ username: accountData.username });
        
        if (existingAccount) {
            console.log(`   ⏭️  Account '${accountData.username}' already exists, skipping`);
            accountIds.set(accountData.username, existingAccount._id.toString());
            continue;
        }
        
        const account = new db.account({
            username: accountData.username,
            firstName: accountData.firstName,
            lastName: accountData.lastName,
            email: accountData.email,
            role: accountData.role,
            notify: accountData.notify,
            hash: bcrypt.hashSync(accountData.password, saltRounds),
            sessionid: randomUUID()
        });
        
        await account.save();
        accountIds.set(accountData.username, account._id.toString());
        console.log(`   ✅ Created account: ${accountData.username} (${accountData.role})`);
    }
    
    return accountIds;
}

async function createProducts(): Promise<Map<string, string>> {
    console.log('📦 Creating sample products...');
    
    const productIds = new Map<string, string>();
    
    for (const productData of sampleProducts) {
        const product = new db.product(productData);
        await product.save();
        productIds.set(productData.name, product._id.toString());
        console.log(`   ✅ Created product: ${productData.name} (${productData.type})`);
    }
    
    return productIds;
}

async function createStockEntries(productIds: Map<string, string>): Promise<void> {
    console.log('📊 Creating stock entries...');
    
    const stockProducts = sampleProducts.filter(p => p.type === ProductTypes.Stock);
    
    for (const product of stockProducts) {
        const productId = productIds.get(product.name);
        if (!productId) continue;
        
        // Create initial stock purchase entry
        const stockAmount = Math.floor(Math.random() * 50) + 20; // 20-70 units
        const unitCost = Math.floor(Number(product.price) * 0.6); // 60% of sale price
        
        const stockEntry = new db.stock({
            type: LedgerType.Stock,
            entryType: StockEntryType.Purchase,
            productId: productId,
            delta: stockAmount.toString(),
            cost: (unitCost * stockAmount).toString(),
            description: 'Initial stock purchase'
        });
        
        await stockEntry.save();
        console.log(`   ✅ Added stock for ${product.name}: ${stockAmount} units`);
    }
}

async function createTransactions(accountIds: Map<string, string>, productIds: Map<string, string>): Promise<void> {
    console.log('💳 Creating sample transactions...');
    
    // Get member accounts for transactions
    const memberAccounts = ['member1', 'member2'];
    
    for (const username of memberAccounts) {
        const accountId = accountIds.get(username);
        if (!accountId) continue;
        
        // Create a few purchase transactions
        const numTransactions = Math.floor(Math.random() * 3) + 2; // 2-4 transactions
        
        for (let i = 0; i < numTransactions; i++) {
            // Pick random products
            const stockProducts = sampleProducts.filter(p => p.type === ProductTypes.Stock);
            const numProducts = Math.floor(Math.random() * 3) + 1; // 1-3 products
            const selectedProducts = stockProducts
                .sort(() => Math.random() - 0.5)
                .slice(0, numProducts);
            
            const products = selectedProducts.map(p => {
                const amount = Math.floor(Math.random() * 2) + 1; // 1-2 units
                const price = Number(p.price);
                return {
                    name: p.name,
                    description: p.description,
                    price: p.price,
                    amount: amount.toString(),
                    total: (price * amount).toString()
                };
            });
            
            const total = products.reduce((sum, p) => sum + Number(p.total), 0);
            
            const transaction = new db.transaction({
                type: LedgerType.Transaction,
                accountId: accountId,
                transactionType: TransactionType.Debit,
                products: products,
                total: total.toString(),
                description: 'Sample purchase'
            });
            
            await transaction.save();
        }
        
        console.log(`   ✅ Created ${numTransactions} transactions for ${username}`);
    }
}

async function createRefills(accountIds: Map<string, string>): Promise<void> {
    console.log('💰 Creating sample refills...');
    
    const memberAccounts = ['member1', 'member2'];
    const refillMethods = [RefillMethods.Cash, RefillMethods.Etransfer, RefillMethods.Stripe];
    
    for (const username of memberAccounts) {
        const accountId = accountIds.get(username);
        if (!accountId) continue;
        
        // Create 1-2 refills per account
        const numRefills = Math.floor(Math.random() * 2) + 1;
        
        for (let i = 0; i < numRefills; i++) {
            const amount = (Math.floor(Math.random() * 5) + 1) * 1000; // $10-$50 in cents
            const method = refillMethods[Math.floor(Math.random() * refillMethods.length)];
            
            const refill = new db.refill({
                type: LedgerType.Refill,
                account: accountId,
                method: method,
                amount: amount.toString(),
                cost: amount.toString(), // Simplified: no surcharge for sample data
                reference: `REF-${randomUUID().substring(0, 8).toUpperCase()}`,
                status: RefillStatus.Complete,
                description: 'Sample refill'
            });
            
            await refill.save();
            
            // Create corresponding credit transaction
            const creditTransaction = new db.transaction({
                type: LedgerType.Transaction,
                accountId: accountId,
                transactionType: TransactionType.Credit,
                products: [{
                    name: 'Account Refill',
                    description: `Refill via ${method}`,
                    price: amount.toString(),
                    amount: '1',
                    total: amount.toString()
                }],
                total: amount.toString(),
                description: `Refill via ${method}`
            });
            
            await creditTransaction.save();
        }
        
        console.log(`   ✅ Created ${numRefills} refills for ${username}`);
    }
}

async function createPreOrders(accountIds: Map<string, string>, productIds: Map<string, string>): Promise<void> {
    console.log('📋 Creating sample pre-orders...');
    
    const orderProducts = sampleProducts.filter(p => p.type === ProductTypes.Order);
    const memberAccounts = ['member1', 'member2'];
    
    for (const product of orderProducts) {
        const productId = productIds.get(product.name);
        if (!productId) continue;
        
        // Create some pre-orders for order products
        const numPreOrders = Math.floor(Math.random() * 3) + 1;
        
        for (let i = 0; i < numPreOrders; i++) {
            const username = memberAccounts[Math.floor(Math.random() * memberAccounts.length)];
            const accountId = accountIds.get(username);
            if (!accountId) continue;
            
            const preorder = new db.preorders({
                type: LedgerType.PreOrder,
                productId: productId,
                accountId: accountId,
                amount: (Math.floor(Math.random() * 2) + 1).toString(),
                status: PreOrderStatus.Ordered
            });
            
            await preorder.save();
        }
        
        console.log(`   ✅ Created ${numPreOrders} pre-orders for ${product.name}`);
    }
}

async function printSummary(accountIds: Map<string, string>): Promise<void> {
    console.log('\n📊 Generation Summary:');
    console.log('━'.repeat(50));
    
    const accountCount = await db.account.countDocuments();
    const productCount = await db.product.countDocuments();
    const stockCount = await db.stock.countDocuments();
    const transactionCount = await db.transaction.countDocuments();
    const refillCount = await db.refill.countDocuments();
    const preorderCount = await db.preorders.countDocuments();
    
    console.log(`   Accounts:     ${accountCount}`);
    console.log(`   Products:     ${productCount}`);
    console.log(`   Stock Entries: ${stockCount}`);
    console.log(`   Transactions: ${transactionCount}`);
    console.log(`   Refills:      ${refillCount}`);
    console.log(`   Pre-orders:   ${preorderCount}`);
    
    console.log('\n🔑 Test Account Credentials:');
    console.log('━'.repeat(50));
    for (const account of sampleAccounts) {
        console.log(`   ${account.username.padEnd(12)} | ${account.password.padEnd(15)} | ${account.role}`);
    }
    console.log('━'.repeat(50));
}

async function main(): Promise<void> {
    console.log('🚀 Starting development data generation...\n');
    
    try {
        // Wait for database connection
        await new Promise<void>((resolve, reject) => {
            mongoose.connection.once('open', resolve);
            mongoose.connection.once('error', reject);
            
            // If already connected
            if (mongoose.connection.readyState === 1) {
                resolve();
            }
        });
        
        console.log(`📡 Connected to MongoDB: ${DB_NAME}\n`);
        
        // Clear existing data
        await clearDatabase();
        
        // Create sample data
        const accountIds = await createAccounts();
        const productIds = await createProducts();
        await createStockEntries(productIds);
        await createTransactions(accountIds, productIds);
        await createRefills(accountIds);
        await createPreOrders(accountIds, productIds);
        
        // Print summary
        await printSummary(accountIds);
        
        console.log('\n✅ Development data generation complete!\n');
        
    } catch (error) {
        console.error('❌ Error generating data:', error);
        process.exit(1);
    } finally {
        await mongoose.connection.close();
        process.exit(0);
    }
}

main();
