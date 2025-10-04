import mongoose, { Document, Model } from 'mongoose';
import { IProductDocument, ProductTypes } from 'typesit';

const schema = new mongoose.Schema<IProductDocument, Model<IProductDocument>>({
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
        type: String,
        required: false
    },
    price: {
        type: String,
        required: true
    },
    stock: {
        type: String,
        $cond: {
            if: { $eq: ["$type", ProductTypes.Stock] },
            then: { required: true },
            else: { required: false }
        }
    },
    order: {
        supplier: {
            type: String,
            $cond: {
                if: { $eq: ["$type", ProductTypes.Order] },
                then: { required: true },
                else: { required: false }
            }
        },
        minimum: {
            type: String,
            $cond: {
                if: { $eq: ["$type", ProductTypes.Order] },
                then: { required: true },
                else: { required: false }
            }
        },
        current: {
            type: String,
            required: false
        }
    },
    type: {
        type: String,
        enum: Object.values(ProductTypes),
        required: true
    }
});

schema.index({ type: 1 });
schema.index({ price: 1 });
schema.index({ stock: 1 });

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
    if (doc.stock) {
        doc.stock = BigInt(doc.stock);
    }
    if (doc.price) {
        doc.price = BigInt(doc.price);
    }
    if (doc.order && doc.order.minimum) {
        doc.order.minimum = BigInt(doc.order.minimum);
    }
    if (doc.order && doc.order.current) {
        doc.order.current = BigInt(doc.order.current);
    }
    delete doc._id;
    delete doc.__v;
}

export default mongoose.model<IProductDocument>('Product', schema);