import mongoose, { Document, Model } from 'mongoose';
import { Roles, IAccountDocument } from 'typesit';

const schema = new mongoose.Schema<IAccountDocument, Model<IAccountDocument>>({
    role: { type: String, trim: true, enum: Roles, required: true },
    username: { type: String, trim: true, unique: true, required: true },
    firstName: { type: String, trim: true, required: true },
    lastName: { type: String, trim: true, required: true },
    email: { type: String, trim: true, required: true },
    hash: { type: String, trim: true, required: true },
    sessionid: { type: String, trim: true, unique: true, required: true },
    notify: { type: Boolean, default: false },
    gid: {
        type: String,
        index: {
            unique: true,
            trim: true,
            partialFilterExpression: { gid: { $type: "string" } }
        }
    }
});

schema.set('toJSON', {
    virtuals: true,
    versionKey: false,
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
    delete doc._id;
    delete doc.__v;
    delete doc.hash;
    delete doc.sessionid;
}

export default mongoose.model('Account', schema);