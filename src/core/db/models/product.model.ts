import mongoose, { Model, Schema } from 'mongoose';
import { IProductDocument, ProductCategories, ProductTypes } from 'typesit';

const orderSchema = new Schema({
    supplier: {
        type: String,
        required: true
    },
    minimum: {
        type: String,
        required: true
    },
    current: {
        type: String,
        required: false,
        default: undefined
    }
}, { _id: false });

const schema = new mongoose.Schema<IProductDocument, Model<IProductDocument>>({
    name: {
        type: String,
        unique: true,
        required: true
    },
    category: {
        type: String,
        enum: Object.values(ProductCategories),
        required: true
    },
    description: {
        type: String,
        required: false
    },
    image: {
        type: String,
        required: false
    },
    price: {
        type: String,
        required: true
    },
    stock: {
        type: String,
        required: function (this: IProductDocument) {
            return this.type === ProductTypes.Stock;
        },
        default: undefined
    },
    order: {
        type: orderSchema,
        required: function (this: IProductDocument) {
            return this.type === ProductTypes.Order;
        },
        default: undefined
    },
    type: {
        type: String,
        enum: Object.values(ProductTypes),
        required: true
    }
});

schema.index({ type: 1 });
schema.index({ price: 1 });
schema.index({ stock: 1 }, { partialFilterExpression: { type: ProductTypes.Stock } });

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
    if (doc.stock !== undefined && doc.stock !== null) {
        doc.stock = BigInt(doc.stock);
    }
    if (doc.price) {
        doc.price = BigInt(doc.price);
    }
    if (doc.order && doc.order.minimum !== undefined && doc.order.minimum !== null) {
        doc.order.minimum = BigInt(doc.order.minimum);
    }
    if (doc.order && doc.order.current !== undefined && doc.order.current !== null) {
        doc.order.current = BigInt(doc.order.current);
    }
    delete doc._id;
    delete doc.__v;
}

export default mongoose.model<IProductDocument>('Product', schema);
