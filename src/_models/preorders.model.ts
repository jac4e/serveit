import mongoose, { Document, Model } from 'mongoose';
import { IPreOrder, PreOrderStatus } from 'typesit';

const schema = new mongoose.Schema<IPreOrder, Model<IPreOrder>>({
    date: {
        type: Date,
        required: true,
        default: Date.now
    },
    lastUpdated: {
        type: Date,
        required: true,
        default: Date.now
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
    }
});

schema.set('toJSON', {
    virtuals: true,
    transform: (doc) => {
        if (!doc) return;
        doc.id = doc._id.toString();
        delete doc._id;
        delete doc.__v;
    }
});

export default mongoose.model<IPreOrder>('PreOrder', schema);