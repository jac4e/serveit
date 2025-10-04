import mongoose, { Model, Schema } from 'mongoose';
import { IRefillDocument, LedgerType, RefillMethods, RefillStatus } from 'typesit';

const schema = new Schema<IRefillDocument, Model<IRefillDocument>>({
    type: {
        type: String,
        enum: [LedgerType.Refill],
        required: true,
        default: LedgerType.Refill,
    },
    account: {
        type: String,
        trim: true,
        required: true,
        ref: 'Account'
    },
    method: {
        type: String,
        trim: true,
        required: true,
        enum: Object.values(RefillMethods)
    },
    amount: {
        type: String,
        trim: true,
        required: true
    },
    cost: {
        type: String,
        trim: true,
        required: true
    },
    reference: {
        type: String,
        trim: true,
        unique: true,
        required: true
    },
    status: {
        type: String,
        trim: true,
        required: true,
        enum: Object.values(RefillStatus)
    },
    description: {
        type: String,
        trim: true
    }
}, {
    timestamps: {
        createdAt: 'createdAt',
        updatedAt: 'updatedAt',
    }
});

schema.index({ status: 1 });

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
    doc.amount = BigInt(doc.amount);
    doc.cost = BigInt(doc.cost);
    if (doc.createdAt && !(doc.createdAt instanceof Date)) {
        doc.createdAt = new Date(doc.createdAt);
    }
    if (doc.updatedAt && !(doc.updatedAt instanceof Date)) {
        doc.updatedAt = new Date(doc.updatedAt);
    }
    delete doc._id;
    delete doc.__v;
}

export default mongoose.model('Refill', schema);
