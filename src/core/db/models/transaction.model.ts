import mongoose, { Model, Schema } from 'mongoose';
import { ITransactionDocument, LedgerType, TransactionType } from 'typesit';

const transactionItemSchema = new Schema({
    name: {
        type: String,
        required: true
    },
    description: {
        type: String,
        required: false
    },
    price: {
        type: String,
        required: true
    },
    amount: {
        type: String,
        required: true
    },
    total: {
        type: String,
        required: true
    }
}, { _id: false });

const schema = new Schema<ITransactionDocument, Model<ITransactionDocument>>({
    type: {
        type: String,
        enum: [LedgerType.Transaction],
        required: true,
        default: LedgerType.Transaction
    },
    accountId: {
        type: String,
        required: true,
        ref: 'Account'
    },
    transactionType: {
        type: String,
        enum: Object.values(TransactionType),
        required: true
    },
    products: {
        type: [transactionItemSchema],
        required: true,
        validate: {
            validator: (items: unknown[]) => Array.isArray(items) && items.length > 0,
            message: 'At least one transaction item is required'
        }
    },
    total: {
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

schema.index({ accountId: 1 });
schema.index({ accountId: 1, transactionType: 1 });
schema.index({ transactionType: 1 });
schema.index({ createdAt: 1 });  

schema.set('toJSON', {
    virtuals: true,
    transform: transformDoc
})

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
    if (doc.createdAt && !(doc.createdAt instanceof Date)) {
        doc.createdAt = new Date(doc.createdAt);
    }
    if (doc.updatedAt && !(doc.updatedAt instanceof Date)) {
        doc.updatedAt = new Date(doc.updatedAt);
    }
    delete doc._id;
    delete doc.__v;
}

export default mongoose.model('Transaction', schema);
