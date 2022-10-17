import mongoose, { Document, Types, Model, Schema } from 'mongoose';
import validator from 'validator';
import { ICartItem, IProduct, IProductLean } from './product.model';

export enum TransactionType {
    Debit = 'debit',
    Credit = 'credit'
}

export interface ITransaction extends Document {
    date: Date;
    accountid: string;
    type: TransactionType;
    reason: string;
    products: ITransactionItem[];
    total: string;
}

export interface ITransactionLean {
    id: ITransaction['id'];
    date: ITransaction['date'];
    accountid?: ITransaction['accountid'];
    type: ITransaction['type'];
    reason: ITransaction['reason'];
    products: ITransaction['products'];
    total: bigint;
}

export interface ITransactionForm {
    accountid: ITransaction['accountid'];
    type: ITransaction['type'];
    reason: ITransaction['reason'];
    products: ITransaction['products'];
    total: string;
}

export interface ITransactionItem {
    name: IProduct['name'];
    description: IProduct['description'];
    price:  string;
    amount:  string;
    total:  string;
}

const schema = new Schema<ITransaction, Model<ITransaction>>({
    date: {
        type: Date,
        default: Date.now
    },
    accountid: {
        type: String,
        required: true
    },
    // toid: { type: String, required: true },
    type: {
        type: String,
        required: true
    },
    reason: {
        type: String,
        required: true
    },
    products: [{
        type: Object,
        required: true
    }],
    total: {
        type: String,
        required: true
    },
    // hash: { type: String, required: true}
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
    doc.id = doc._id.toString();
    doc.total = BigInt(doc.total);
    delete doc._id;
    delete doc.__v;
}

export default mongoose.model('Transaction', schema);