import mongoose, { Document } from 'mongoose';
import validator from 'validator';

export interface IProduct extends Document{
    name: string;
    description?: string;
    image?: string;
    price:  string;
    stock:  string;
}

export interface IProductLean {
    id: IProduct['id'];
    name: IProduct['name'];
    description: IProduct['description'];
    image : IProduct['image'];
    price:  bigint;
    stock:  bigint;
}

export interface IProductForm {
    name: IProduct['name'];
    description: IProduct['description'];
    image : IProduct['image'];
    price:  bigint;
    stock:  bigint;
}

export interface ICartItem {
    name: IProduct['name'];
    description: IProduct['description'];
    price:  bigint;
    amount:  bigint;
    total:  bigint;
}

export interface ICartSerialized {
    id: IProduct['id'];
    amount:  ICartItem['amount'];
}

const schema = new mongoose.Schema<IProduct>({
    name: {
        type: String,
        unique: true,
        required: true
    },
    description: {
        type: String,
        required: false
    },
    image: {
        type: String
    },
    price: {
        type: String,
        required: true
    },
    stock: {
        type: String,
        required: true
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
    doc.id = doc._id.toString();
    doc.stock = BigInt(doc.stock)
    doc.price = BigInt(doc.price)
    delete doc._id;
    delete doc.__v;
}

export default mongoose.model('Product', schema);