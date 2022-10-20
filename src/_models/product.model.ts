import mongoose, { Document, Model } from 'mongoose';
import { IProductDocument } from 'typesit';

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