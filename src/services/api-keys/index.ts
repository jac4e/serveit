import { createHash, randomBytes } from 'crypto';
import db from '../../core/db/index.js';
import { IApiKey } from 'typesit';

const ApiKey = db.apiKey;

function generateApiKey(): string {
    const raw = randomBytes(32).toString('base64url');
    return `ak_${raw}`;
}

function hashApiKey(apiKey: string): string {
    return createHash('sha256').update(apiKey).digest('hex');
}

async function createForUser(userId: string, name: string, createdBy: string): Promise<{ apiKey: string; key: IApiKey }> {
    if (!name?.trim()) {
        throw 'api key name is required';
    }

    const apiKey = generateApiKey();
    const keyHash = hashApiKey(apiKey);

    const doc = new ApiKey({
        userId,
        name: name.trim(),
        keyHash,
        createdBy,
        lastUsedAt: null
    });

    await doc.save();

    const saved = await ApiKey.findById(doc._id).lean<IApiKey | null>();
    if (!saved) {
        throw new Error('API key not found after creation');
    }

    return { apiKey, key: saved };
}

async function listByUser(userId: string): Promise<IApiKey[]> {
    return await ApiKey.find({ userId }).sort({ createdAt: -1 }).lean<IApiKey[]>();
}

async function deleteByName(userId: string, name: string): Promise<void> {
    const result = await ApiKey.deleteOne({ userId, name });
    if (result.deletedCount === 0) {
        throw 'api key not found';
    }
}

async function clearAllByUser(userId: string): Promise<number> {
    const result = await ApiKey.deleteMany({ userId });
    return result.deletedCount ?? 0;
}

async function authenticate(apiKey: string): Promise<IApiKey> {
    if (!apiKey || typeof apiKey !== 'string') {
        throw 'api key is required';
    }

    const keyHash = hashApiKey(apiKey);
    const key = await ApiKey.findOne({ keyHash }).lean<IApiKey | null>();
    if (!key) {
        throw 'api key not found';
    }

    await ApiKey.updateOne({ keyHash }, { $set: { lastUsedAt: new Date() } });

    return key;
}

export default {
    createForUser,
    listByUser,
    deleteByName,
    clearAllByUser,
    authenticate,
};
