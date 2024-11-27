import mongoose, { Model, Schema, Document } from 'mongoose';
import { IRefillDocument, RefillMethods, RefillStatus } from 'typesit';

const schema = new Schema<IRefillDocument, Model<IRefillDocument>>({
    account: {
        type: String,
        trim: true,
        required: true
    },
    method: {
        type: String,
        trim: true,
        required: true,
        enum: RefillMethods
    },
    amount: {
        type: String,
        trim: true,
        required: true
    },
    date_created: {
        type: Date,
        default: Date.now
    },
    date_updated: {
        type: Date,
        default: Date.now,
    },
    status: {
        type: String,
        trim: true,
        required: true,
        enum: RefillStatus
    },
    note: {
        type: String,
        trim: true
    }
});
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
    delete doc._id;
    delete doc.__v;
}

export default mongoose.model('Refill', schema);