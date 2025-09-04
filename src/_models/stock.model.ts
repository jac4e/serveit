import mongoose, { Document, Model } from 'mongoose';
import { IStockEntryDocument, StockEntryType } from 'typesit';

const schema = new mongoose.Schema<IStockEntryDocument, Model<IStockEntryDocument>>({
    date: {
        type: Date,
        required: true,
        default: Date.now
    },
    productId: {
        type: String,
        required: true,
        ref: 'Product'
    },
    cost: {
        type: String,
        required: true
    },
    type: {
        type: String,
        enum: Object.values(StockEntryType),
        required: true
    },
    delta: {
        type: String,
        required: true
    },
    notes: {
        type: String,
        required: false
    }
});

schema.index({ productid: 1 });
schema.index({ date: 1 });

schema.set('toJSON', {
    virtuals: true,
    transform: (doc) => {
        if (!doc) return;
        doc.id = doc._id.toString();
        doc.cost = BigInt(doc.cost);
        doc.delta = BigInt(doc.delta);
        delete doc._id;
        delete doc.__v;
    }
});

export default mongoose.model<IStockEntryDocument>('StockEntry', schema);