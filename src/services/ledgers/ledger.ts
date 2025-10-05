import { ILedger, ILedgerForm, LedgerType } from 'typesit';
import logger from '../../core/logger/index.js';

export interface LedgerContext {
    actorId?: string;
    correlationId?: string;
    meta?: Record<string, unknown>;
}

export interface LedgerListCriteria {
    accountId?: string;
    status?: string | string[];
    dateRange?: {
        from?: Date;
        to?: Date;
    };
    limit?: number;
}

export default abstract class Ledger<T extends ILedger = ILedger, F extends ILedgerForm = ILedgerForm> {
    protected abstract type: LedgerType;
    
    constructor() {
    }

    log(level: string, message: string, context?: LedgerContext) {
        logger.log(level, message, {
            section: 'ledger',
            type: this.type,
            actorId: context?.actorId,
            correlationId: context?.correlationId,
            ...context?.meta,
        });
    }

    // Core ledger operations that must be implemented by concrete classes
    protected abstract create(form: F, context?: LedgerContext): Promise<T>;
    protected abstract getById(id: string, context?: LedgerContext): Promise<T>;
    protected abstract list(criteria: LedgerListCriteria, context?: LedgerContext): Promise<T[]>;
    
    // Optional operations that can be overridden by concrete classes
    protected async update?(id: string, patch: Partial<T>, context?: LedgerContext): Promise<T>;

    // Hook methods that can be overridden by concrete classes
    protected async beforeCreate?(form: F, context?: LedgerContext): Promise<void>;
    protected async afterCreate?(entry: T, context?: LedgerContext): Promise<void>;
    protected async beforeUpdate?(id: string, patch: Partial<T>, context?: LedgerContext): Promise<void>;
    protected async afterUpdate?(entry: T, context?: LedgerContext): Promise<void>;

    // Public API methods that handle hooks and logging
    public async createEntry(form: F, context?: LedgerContext): Promise<T> {
        try {
            if (this.beforeCreate) {
                await this.beforeCreate(form, context);
            }

            const entry = await this.create(form, context);

            if (this.afterCreate) {
                await this.afterCreate(entry, context);
            }

            this.log('info', 'Entry created', {
                ...context,
            });

            return entry;
        } catch (error) {
            this.log('error', `Failed to create entry: ${error}`, context);
            throw error;
        }
    }

    public async getEntry(id: string, context?: LedgerContext): Promise<T> {
        try {
            return await this.getById(id, context);
        } catch (error) {
            this.log('error', `Failed to get entry: ${error}`, context);
            throw error;
        }
    }

    public async listEntries(criteria: LedgerListCriteria, context?: LedgerContext): Promise<T[]> {
        try {
            return await this.list(criteria, context);
        } catch (error) {
            this.log('error', `Failed to list entries: ${error}`, context);
            throw error;
        }
    }

    public async updateEntry(id: string, patch: Partial<T>, context?: LedgerContext): Promise<T> {
        if (!this.update) {
            throw new Error(`Ledger type '${this.type}' does not support updates`);
        }

        try {
            if (this.beforeUpdate) {
                await this.beforeUpdate(id, patch, context);
            }

            const entry = await this.update(id, patch, context);

            if (this.afterUpdate) {
                await this.afterUpdate(entry, context);
            }

            this.log('info', 'Entry updated', {
                ...context,
            });

            return entry;
        } catch (error) {
            this.log('error', `Failed to update entry: ${error}`, context);
            throw error;
        }
    }
}
