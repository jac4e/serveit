import mongoose, { Model, Schema } from 'mongoose';
import { IProductDocument, IStockEntryDocument, ProductCategories, ProductTypedPropertiesDocument, ProductTypes } from 'typesit';

const orderSchema = new Schema<ProductTypedPropertiesDocument[ProductTypes.Order]>({
    supplier: {
        type: String,
        required: true
    },
    minimum: {
        type: String,
        required: true
    }
}, { _id: false });

const schema = new mongoose.Schema<IProductDocument, Model<IProductDocument>>({
    name: {
        type: String,
        unique: true,
        required: true
    },
    category: {
        type: String,
        enum: Object.values(ProductCategories),
        required: true
    },
    description: {
        type: String,
        required: false
    },
    image: {
        type: String,
        required: false
    },
    price: {
        type: String,
        required: true
    },
    order: {
        type: orderSchema,
        required: function (this: IProductDocument) {
            return this.type === ProductTypes.Order;
        },
        default: undefined
    },

    type: {
        type: String,
        enum: Object.values(ProductTypes),
        required: true
    }
});

schema.index({ type: 1 });
schema.index({ price: 1 });

schema.virtual('stockEntries', {
    ref: 'StockEntry',
    localField: '_id',
    foreignField: 'productId',
    justOne: false,
    options: { sort: { createdAt: -1 } }
});

schema.virtual('orderEntries', {
    ref: 'PreOrder',
    localField: '_id',
    foreignField: 'productId',  
    justOne: false,
    options: { sort: { createdAt: -1 } }
});

schema.virtual('stock').get(function(this: mongoose.Document & IProductDocument & { stockEntries?: any[] }) {
    if (!this.stockEntries || !Array.isArray(this.stockEntries)) {
        return { amount: 0n, cost: 0n };
    }
    
    const amount = this.stockEntries.reduce((sum, entry) => 
        sum + BigInt(entry.amount), 0n);
    const cost = this.stockEntries.reduce((sum, entry) => 
        sum + (BigInt(entry.amount) * BigInt(entry.unitPrice)), 0n);
    
    return { amount, cost };
});

schema.virtual('orderWithCurrent').get(function(this: mongoose.Document & IProductDocument & { orderEntries?: any[], order?: any }) {
    if (this.type !== ProductTypes.Order || !this.order) {
        return null;
    }
    
    let current = 0n;
    if (this.orderEntries && Array.isArray(this.orderEntries)) {
        current = this.orderEntries
            .filter(entry => entry.status === 'pending')
            .reduce((sum, entry) => sum + BigInt(entry.amount), 0n);
    }
    
    return {
        ...this.order.toObject(),
        current
    };
});

schema.set('toJSON', {
    virtuals: true,
    transform: transformDoc
});

schema.post(['find', 'findOne', 'findOneAndUpdate'], function (res) {
    if (!this.mongooseOptions().lean) {
        return;
    }
    if (Array.isArray(res)) {
        res.forEach(transformDoc);
        return;
    }
    transformDoc(res);
});

function transformDoc(doc) {
    if (!doc) {
        return;
    }
    doc.id = doc._id.toString();

    if (doc.price) {
        doc.price = BigInt(doc.price);
    }

    // Calculate stock object from stockEntries
    if (doc.stockEntries && Array.isArray(doc.stockEntries)) {
        const amount = doc.stockEntries.reduce((sum, entry: IStockEntryDocument) => 
            sum + BigInt(entry.delta), 0n);
        const cost = doc.stockEntries.reduce((sum, entry: IStockEntryDocument) => 
            sum + (BigInt(entry.delta) * BigInt(entry.cost ?? "0")), 0n);
        doc.stock = { amount, cost };
    }

    // Enhance order with current if applicable
    if (doc.type === ProductTypes.Order && doc.order) {
        doc.order.minimum = BigInt(doc.order.minimum);
        
        let current = 0n;
        if (doc.orderEntries && Array.isArray(doc.orderEntries)) {
            current = doc.orderEntries
                .filter(entry => entry.status === 'pending')
                .reduce((sum, entry) => sum + BigInt(entry.amount), 0n);
        }
        doc.order.current = current;
    }

    // Clean up mongoose specific fields
    delete doc.stockEntries;
    delete doc.orderEntries;

    delete doc._id;
    delete doc.__v;
}

export default mongoose.model<IProductDocument>('Product', schema);
