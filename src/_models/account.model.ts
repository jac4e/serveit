import mongoose, { Document } from 'mongoose';
import validator from 'validator';

export enum Roles {
    Unverified = 'usnverified',
    User = 'user',
    Admin = 'admin'
}

export interface IAccount extends Document {
    role: Roles;
    username: string;
    firstName:  string;
    lastName:  string;
    email:  string;
    hash:  string;
    sessionid: string;
    gid?: string;
}

export interface IAccountForm {
    username: IAccount['username'];
    firstName:  IAccount['firstName'];
    lastName:  IAccount['lastName'];
    email:  IAccount['email'];
    role:  IAccount['role'];
    password: string;
    gid?: IAccount['gid'];
}

export interface IAccountLean {
    username: IAccount['username'];
    firstName:  IAccount['firstName'];
    lastName:  IAccount['lastName'];
    email:  IAccount['email'];
    role:  IAccount['role'];
    balance: bigint;
    id: IAccount['id'];
}

export interface IAccountLogin {
    username: IAccount['username'];
    password: string;
}

const schema = new mongoose.Schema({
    role: { type: String, enum: Roles, required: true },
    username: { type: String, unique: true, required: true},
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    email: { type: String, required: true },
    hash: { type: String, required: true },
    sessionid: { type: String, unique: true, required: true },
    gid: { type: String, unique: true }
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

export default mongoose.model<IAccount>('Account',schema);