import mongoose, { Model } from 'mongoose';
import { IStockEntryDocument, LedgerType, StockEntryType } from 'typesit';

const schema = new mongoose.Schema<IStockEntryDocument, Model<IStockEntryDocument>>({
    type: {
        type: String,
        enum: [LedgerType.Stock],
        required: true,
        default: LedgerType.Stock
    },
    entryType: {
        type: String,
        enum: Object.values(StockEntryType),
        required: true
    },
    productId: {
        type: String,
        required: true,
        ref: 'Product'
    },
    cost: {
        type: String,
        required: function (this: IStockEntryDocument) {
            return this.entryType === StockEntryType.Purchase;
        },
        default: undefined
    },
    delta: {
        type: String,
        required: true
    },
    description: {
        type: String,
        required: false
    }
}, {
    timestamps: {
        createdAt: 'createdAt',
        updatedAt: 'updatedAt'
    }
});

schema.index({ productId: 1, entryType: 1 });
schema.index({ createdAt: 1 });

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
    if (doc.delta !== undefined && doc.delta !== null) {
        doc.delta = BigInt(doc.delta);
    }
    if (doc.cost !== undefined && doc.cost !== null) {
        doc.cost = BigInt(doc.cost);
    }
    if (doc.createdAt && !(doc.createdAt instanceof Date)) {
        doc.createdAt = new Date(doc.createdAt);
    }
    if (doc.updatedAt && !(doc.updatedAt instanceof Date)) {
        doc.updatedAt = new Date(doc.updatedAt);
    }
    delete doc._id;
    delete doc.__v;
}

export default mongoose.model<IStockEntryDocument>('StockEntry', schema);
