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
    doc.total = BigInt(doc.total);
    delete doc._id;
    delete doc.__v;
}

export default mongoose.model<IStockEntryDocument>('StockEntry', schema);