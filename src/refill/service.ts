import { IRefill, IRefillForm, ITransactionForm, RefillMethods, RefillStatus, Roles, TransactionType } from "typesit";
import db from "../_helpers/db.js";
import email from "../_tasks/email.js";
import accountService from "../account/service.js";
import Transaction from "../_helpers/transaction.js";
import { randomUUID } from "crypto";
import Stripe from 'stripe';
import {__envConfig} from '..//configuration/config.js';
import { datamigration } from "googleapis/build/src/apis/datamigration/index.js";

const stripe = new Stripe(__envConfig.backend.stripeSecret);

const Refill = db.refill;

async function getRefillHistory(id: string): Promise<IRefill[]> {
    return await Refill.find({
        account: id
    }).sort({
        date: -1
    }).lean<IRefill[]>();
}

async function create(data: IRefillForm): Promise<IRefill> {
    // Check amount is valid
    if (BigInt(data.amount) < 50n && data.method !== RefillMethods.Cash) {
        throw 'Minimum refill amount for non-cash transactions is 50';
    }

    const refill = new Refill(data);
    refill.status = RefillStatus.Pending;
    refill.dateCreated = new Date();
    refill.dateUpdated = new Date();

    // Payment logic
    if (refill.method === RefillMethods.Stripe) {
        refill.cost = BigInt(Math.round((Number(refill.amount) + 30) / (1 - 0.029)));

        // Create stripe checkout session
        const session = await stripe.checkout.sessions.create({
            metadata: {
                ["amt"]: String(refill.amount),
            },
            line_items: [{
                price_data: {
                    currency: 'cad',
                    product_data: {
                        name: 'Phrydge Account Refill',
                    },
                    unit_amount: Number(refill.amount),
                },
                quantity: 1,
            },
            {
                price_data: {
                    currency: 'cad',
                    product_data: {
                        name: 'Online Service Fee',
                    },
                    // 2.9% + 30 cents
                    unit_amount: Number(refill.cost) -  Number(refill.amount),
                },
                quantity: 1,
            }
        ],
            client_reference_id: refill.id,
            mode: 'payment',
            success_url: `${__envConfig.backend.url}/account/refill?success=true&refill=${refill._id}`,
            cancel_url: `${__envConfig.backend.url}/account/refill?success=false&refill=${refill._id}`,
        });
        refill.reference = session.id;
    } else if (refill.method === RefillMethods.Etransfer) {
        refill.cost = refill.amount;
        // Etransfer payment logic
        refill.reference = randomUUID();
    } else if (refill.method === RefillMethods.Cash) {
        refill.cost = refill.amount;
        refill.reference = randomUUID();
    } else if (refill.method === RefillMethods.CreditCard) {
        refill.cost = BigInt(Math.round((Number(refill.amount) + 5 + 16) / (1 - 0.027)));
        refill.reference = randomUUID();
    } else if (refill.method === RefillMethods.DebitCard) {
        refill.cost = BigInt(Math.round((Number(refill.amount) + 15 + 16)));
        refill.reference = randomUUID();
    }

    await refill.save().catch(err => {
        throw err;
    }).then(async () => {
        // Notify user of refill
        const subject = `Spendit - New Refill Requested`;
        const message = `Hi ${refill.account},\n Your refill of ${refill.amount} on ${refill.dateCreated} with ${refill.method} has been created!`
        const account = await accountService.getById(refill.account);
        
        email.send(account, 'Spendit - New Refill Requested', `A new refill of ${refill.amount} on ${refill.dateCreated} with ${refill.method} has been requested!`);
        email.sendAll(Roles.Admin, 'New Pending Refill Requested', `A new refill of ${refill.amount} on ${refill.dateCreated} with ${refill.method} has been requested by ${account.username} <${account.email}>!`);
        return;
    });

    return Refill.findById(refill._id).lean<IRefill>();
}

async function getAll(): Promise<IRefill[]> {
    return await Refill.find().lean<IRefill[]>();
}

async function getById(id: string): Promise<IRefill> {
    return await Refill.findById(id).lean<IRefill>();
}

async function updateById(id: string, data: Partial<IRefill>): Promise<IRefill> {
    data = {
        ...data,
        dateUpdated: new Date()
    }
    const updatedData = await Refill.findByIdAndUpdate(id, data, {
        new: true
    }).lean<IRefill>();

    // Email user
    const account = await accountService.getById(updatedData.account);
    // if (updatedData.status === RefillStatus.Complete && data.status != updatedData.status) {
    //     email.send(account, 'Refill Request Completed', `Your refill of ${updatedData.amount} on ${updatedData.dateCreated} with ${updatedData.method} has been completed!`);
    //     // Create transaction
    //     const transaction: ITransactionForm = {
    //         accountid: updatedData.account,
    //         type: TransactionType.Credit,
    //         total: String(updatedData.amount).replace('.', ''),
    //         reason: `${updatedData.method}: ${updatedData.reference}`,
    //         products: [],
    //     }
    // } else if (updatedData.status === RefillStatus.Cancelled && data.status != updatedData.status) {
    //     email.send(account, 'Refill Request Cancelled', `Your refill of ${updatedData.amount} on ${updatedData.dateCreated} with ${updatedData.method} has been cancelled!`);
    // } else if (updatedData.status === RefillStatus.Failed && data.status != updatedData.status) {
    //     email.send(account, 'Refill Request Failed', `Your refill of ${updatedData.amount} on ${updatedData.dateCreated} with ${updatedData.method} has failed!`);
    // } else {
    //     email.send(account, 'Refill Request Updated', `Your refill of ${updatedData.amount} on ${updatedData.dateCreated} with ${updatedData.method} has been updated!`);
    // }
    // Email user
    email.send(account, 'Refill Request Updated', `Your refill of ${updatedData.amount} on ${updatedData.dateCreated} with ${updatedData.method} has been updated.`);
    return updatedData;
}

async function getPendingRefills(method: RefillMethods): Promise<IRefill[]> {
    return await Refill.find({
        status: RefillStatus.Pending,
        method: method
    }).lean<IRefill[]>();
}

// async function completeRefill(refillid: string, amount: bigint, reference: string, note?: string): Promise<void> {
async function completeRefill(refillid: string, {amount, reference, note}: {amount?: bigint, reference?: string, note?: string}): Promise<void> {
    // Verify refillid exists and is pending
    const refill = await Refill.findById(refillid);
    if (refill === null) {
        throw 'Refill not found';
    }
    if (refill.status !== RefillStatus.Pending) {
        throw 'Refill is not pending';
    }

    // Verify amount matches if provided
    if (amount && BigInt(refill.amount) !== amount) {
        throw 'Amount does not match';
    }

    // Create transaction
    const transaction: ITransactionForm = {
        accountid: refill.account,
        type: TransactionType.Credit,
        total: String(refill.amount).replace('.', ''),
        reason: `${refill.method} Refill: ${reference || refill.reference}`,
        products: [],
    }

    // Create transaction
    Transaction.create(transaction).catch(err => {
        throw err;
    });

    // Update refill status
    refill.status = RefillStatus.Complete;
    refill.reference = reference || refill.reference;
    refill.dateUpdated = new Date();
    refill.note = note;
    await refill.save();

    // Email user
    const account = await accountService.getById(refill.account);
    email.send(account, 'Refill Request Completed', `Your refill of ${refill.amount} on ${refill.dateCreated} with ${refill.method} has been completed!`);
}

// async function failRefill(refillid: string, reference: string, note?: string): Promise<void> {
// Make reference optional
async function failRefill(refillid: string, {reference, note}: {reference?: string, note?: string} = {}): Promise<void> {
    // Verify refillid exists and is pending
    const refill = await Refill.findById(refillid);
    if (refill === null) {
        throw 'Refill not found';
    }
    if (refill.status !== RefillStatus.Pending) {
        throw 'Refill is not pending';
    }

    // Update refill status
    refill.status = RefillStatus.Failed;
    refill.reference = reference || refill.reference;
    refill.note = note;
    refill.dateUpdated = new Date();
    await refill.save();

    // Email user
    const account = await accountService.getById(refill.account);
    email.send(account, 'Refill Request Failed', `Your refill of ${refill.amount} on ${refill.dateCreated} with ${refill.method} has failed!`);
}

// async function cancelRefill(id: string, note?: string): Promise<void> {
async function cancelRefill(id: string, {note}: {note?: string} = {}): Promise<void> {
    const refill = await Refill.findById(id);
    if (refill === null) {
        throw 'Refill not found';
    }
    refill.status = RefillStatus.Cancelled;
    refill.dateUpdated = new Date();
    refill.note = note;
    await refill.save();

    // Email user
    const account = await accountService.getById(refill.account);
    email.send(account, 'Refill Request Cancelled', `Your refill of ${refill.amount} on ${refill.dateCreated} with ${refill.method} has been cancelled!`);
}

function verifyStripeWebhook(sig: string, payload: string | Buffer): Stripe.Event {
    try {
        return stripe.webhooks.constructEvent(payload, sig, __envConfig.backend.stripeWebhookSecret);
    } catch (err) {
        throw err;
    }
}

export default {
    create,
    getAll,
    getById,
    updateById,
    getRefillHistory,
    cancelRefill,
    completeRefill,
    failRefill,
    verifyStripeWebhook
};