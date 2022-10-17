import mongoose, { Document } from 'mongoose';
import validator from 'validator';

export enum Roles {
    Unverified = 'unverified',
    User = 'user',
    Admin = 'admin'
}

export interface IAccount extends Document {
    role: Roles;
    username: string;
    firstName: string;
    lastName: string;
    email: string;
    hash: string;
    sessionid: string;
    gid?: string;
}

export interface IAccountForm {
    username: IAccount['username'];
    firstName: IAccount['firstName'];
    lastName: IAccount['lastName'];
    email: IAccount['email'];
    role: IAccount['role'];
    password: string;
    gid?: IAccount['gid'];
}

export interface IAccountLean {
    username: IAccount['username'];
    firstName: IAccount['firstName'];
    lastName: IAccount['lastName'];
    email: IAccount['email'];
    role: IAccount['role'];
    balance: bigint;
    id: IAccount['id'];
}

export interface IAccountLogin {
    username: IAccount['username'];
    password: string;
}

const schema = new mongoose.Schema({
    role: { type: String, trim: true, enum: Roles, required: true },
    username: { type: String, trim: true, unique: true, required: true },
    firstName: { type: String, trim: true, required: true },
    lastName: { type: String, trim: true, required: true },
    email: { type: String, trim: true, required: true },
    hash: { type: String, trim: true, required: true },
    sessionid: { type: String, trim: true, unique: true, required: true },
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
    doc.id = doc._id.toString();
    delete doc._id;
    delete doc.__v;
    delete doc.hash;
    delete doc.sessionid;
}

export default mongoose.model<IAccount>('Account', schema);