import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import Account from './account.model';
import { beforeAll, afterAll, beforeEach, afterEach, describe, expect, it } from '@jest/globals';

describe('Account model', () => {
  let mongoServer: MongoMemoryServer;

  beforeAll(async () => {
    mongoServer = new MongoMemoryServer();
    const mongoUri = await mongoServer.getUri();
    await mongoose.connect(mongoUri);
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  afterEach(async () => {
    await Account.deleteMany({});
  });

  it('should not create and a new account', async () => {
    const accountData = {
      email: 'test@example.com',
      hash: 'hash123',
    };
    const account = new Account(accountData);
    const savedAccount = await account.save();
    expect(savedAccount._id).toBeDefined();
    expect(savedAccount.email).toBe(accountData.email);
    expect(savedAccount.hash).toBe(accountData.hash);
  });

  it('should not save an account with a duplicate email', async () => {
    const accountData = {
      email: 'test@example.com',
      hash: 'hash123',
    };
    const account1 = new Account(accountData);
    await account1.save();
    const account2 = new Account(accountData);
    await expect(account2.save()).rejects.toThrow(mongoose.Error.ValidationError);
  });

  it('should not save an account without a role', async () => {
    const accountData = {
      email: 'test@example.com',
      hash: 'hash123',
    };
    const account = new Account(accountData);
    await expect(account.save()).rejects.toThrow(mongoose.Error.ValidationError);
  });

  it('should not save an account without a username', async () => {
    const accountData = {
      role: 'user',
      email: 'test@example.com',
      hash: 'hash123',
    };
    const account = new Account(accountData);
    await expect(account.save()).rejects.toThrow(mongoose.Error.ValidationError);
  });

  it('should not save an account without a first name', async () => {
    const accountData = {
      role: 'user',
      username: 'testuser',
      email: 'test@example.com',
      hash: 'hash123',
    };
    const account = new Account(accountData);
    await expect(account.save()).rejects.toThrow(mongoose.Error.ValidationError);
  });

  it('should not save an account without a last name', async () => {
    const accountData = {
      role: 'user',
      username: 'testuser',
      email: 'test@example.com',
      hash: 'hash123',
      firstName: 'Test',
    };
    const account = new Account(accountData);
    await expect(account.save()).rejects.toThrow(mongoose.Error.ValidationError);
  });

  it('should not save an account without an email', async () => {
    const accountData = {
      role: 'user',
      username: 'testuser',
      hash: 'hash123',
      firstName: 'Test',
      lastName: 'User',
    };
    const account = new Account(accountData);
    await expect(account.save()).rejects.toThrow(mongoose.Error.ValidationError);
  });

  it('should not save an account without a hash', async () => {
    const accountData = {
      role: 'user',
      username: 'testuser',
      email: 'test@example.com',
      firstName: 'Test',
      lastName: 'User',
    };
    const account = new Account(accountData);
    await expect(account.save()).rejects.toThrow(mongoose.Error.ValidationError);
  });

  it('should not save an account without a session ID', async () => {
    const accountData = {
      role: 'user',
      username: 'testuser',
      email: 'test@example.com',
      hash: 'hash123',
      firstName: 'Test',
      lastName: 'User',
    };
    const account = new Account(accountData);
    await expect(account.save()).rejects.toThrow(mongoose.Error.ValidationError);
  });

  it('should not save an account with an invalid role', async () => {
    const accountData = {
      role: 'invalid',
      username: 'testuser',
      email: 'test@example.com',
      hash: 'hash123',
      firstName: 'Test',
      lastName: 'User',
      sessionid: '1234567890',
    };
    const account = new Account(accountData);
    await expect(account.save()).rejects.toThrow(mongoose.Error.ValidationError);
  });

  it('should not save an account with an invalid email', async () => {
    const accountData = {
      role: 'user',
      username: 'testuser',
      email: 'invalidemail',
      hash: 'hash123',
      firstName: 'Test',
      lastName: 'User',
      sessionid: '1234567890',
    };
    const account = new Account(accountData);
    await expect(account.save()).rejects.toThrow(mongoose.Error.ValidationError);
  });

  it('should not save an account with an invalid session ID', async () => {
    const accountData = {
      role: 'user',
      username: 'testuser',
      email: 'test@example.com',
      hash: 'hash123',
      firstName: 'Test',
      lastName: 'User',
      sessionid: '',
    };
    const account = new Account(accountData);
    await expect(account.save()).rejects.toThrow(mongoose.Error.ValidationError);
  });

  it('should not save an account with a duplicate session ID', async () => {
    const accountData1 = {
      role: 'user',
      username: 'testuser1',
      email: 'test1@example.com',
      hash: 'hash123',
      firstName: 'Test',
      lastName: 'User',
      sessionid: '1234567890',
    };
    const account1 = new Account(accountData1);
    await account1.save();
    const accountData2 = {
      role: 'user',
      username: 'testuser2',
      email: 'test2@example.com',
      hash: 'hash123',
      firstName: 'Test',
      lastName: 'User',
      sessionid: '1234567890',
    };
    const account2 = new Account(accountData2);
    await expect(account2.save()).rejects.toThrow(mongoose.Error.ValidationError);
  });

  it('should not save an account with a duplicate username', async () => {
    const accountData1 = {
      role: 'user',
      username: 'testuser',
      email: 'test1@example.com',
      hash: 'hash123',
      firstName: 'Test',
      lastName: 'User',
      sessionid: '1234567890',
    };
    const account1 = new Account(accountData1);
    await account1.save();
    const accountData2 = {
      role: 'user',
      username: 'testuser',
      email: 'test2@example.com',
      hash: 'hash123',
      firstName: 'Test',
      lastName: 'User',
      sessionid: '1234567891',
    };
    const account2 = new Account(accountData2);
    await expect(account2.save()).rejects.toThrow(mongoose.Error.ValidationError);
  });

  it('should not save an account with a duplicate GID', async () => {
    const accountData1 = {
      role: 'user',
      username: 'testuser1',
      email: 'test1@example.com',
      hash: 'hash123',
      firstName: 'Test',
      lastName: 'User',
      sessionid: '1234567890',
      gid: '1234567890',
    };
    const account1 = new Account(accountData1);
    await account1.save();
    const accountData2 = {
      role: 'user',
      username: 'testuser2',
      email: 'test2@example.com',
      hash: 'hash123',
      firstName: 'Test',
      lastName: 'User',
      sessionid: '1234567891',
      gid: '1234567890',
    };
    const account2 = new Account(accountData2);
    await expect(account2.save()).rejects.toThrow(mongoose.Error.ValidationError);
  });

  it('should save an account with a unique GID', async () => {
    const accountData1 = {
      role: 'user',
      username: 'testuser1',
      email: 'test1@example.com',
      hash: 'hash123',
      firstName: 'Test',
      lastName: 'User',
      sessionid: '1234567890',
      gid: '1234567890',
    };
    const account1 = new Account(accountData1);
    await account1.save();
    const accountData2 = {
      role: 'user',
      username: 'testuser2',
      email: 'test2@example.com',
      hash: 'hash123',
      firstName: 'Test',
      lastName: 'User',
      sessionid: '1234567891',
      gid: '1234567891',
    };
    const account2 = new Account(accountData2);
    const savedAccount = await account2.save();
    expect(savedAccount._id).toBeDefined();
    expect(savedAccount.gid).toBe(accountData2.gid);
  });
});