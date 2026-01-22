import mongoose, { Model } from 'mongoose';
import { IApiKeyDocument } from 'typesit';

const schema = new mongoose.Schema<IApiKeyDocument, Model<IApiKeyDocument>>({
    userId: { type: String, required: true, index: true },
    name: { type: String, required: true },
    keyHash: { type: String, required: true },
    createdBy: { type: String, required: true },
    lastUsedAt: { type: Date, default: null }
}, {
    timestamps: {
        createdAt: 'createdAt',
        updatedAt: 'updatedAt'
    }
});

schema.index({ userId: 1, name: 1 }, { unique: true });
schema.index({ keyHash: 1 }, { unique: true });

schema.set('toJSON', {
    virtuals: true,
    versionKey: false,
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
    delete doc._id;
    delete doc.__v;
    delete doc.keyHash;
    delete doc.createdBy;
}

export default mongoose.model('ApiKey', schema);
