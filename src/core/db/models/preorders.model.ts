import mongoose, { Model, Schema } from 'mongoose';
import { IPreOrder, IPreOrderDocument, LedgerType, PreOrderStatus } from 'typesit';

const schema = new Schema<IPreOrderDocument, Model<IPreOrderDocument>>({
    type: {
        type: String,
        enum: [LedgerType.PreOrder],
        required: true,
        default: LedgerType.PreOrder
    },
    accountId: {
        type: String,
        required: true,
        ref: 'Account'
    },
    productId: {
        type: String,
        required: true,
        ref: 'Product'
    },
    amount: {
        type: String,
        required: true
    },
    status: {
        type: String,
        enum: Object.values(PreOrderStatus),
        required: true,
        default: PreOrderStatus.Unordered
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

function transformDoc(doc: any) {
    if (!doc) {
        return;
    }
    doc.id = doc._id.toString();
    if (doc.amount !== undefined) {
        doc.amount = BigInt(doc.amount);
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

export default mongoose.model('PreOrder', schema);
