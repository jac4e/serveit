import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import Account from './account.model';
import { beforeAll, afterAll, beforeEach, afterEach, describe, expect, it } from '@jest/globals';
import { IAccount, IAccountDocument, Roles } from 'typesit';



describe('Account model', () => {
  let mongoServer: MongoMemoryServer;
  let validAccount1: Omit<IAccount, 'id' | 'balance'> & {
    hash: string;
    sessionid: string;
};
  let validAccount2: Omit<IAccount, 'id' | 'balance'> & {
    hash: string;
    sessionid: string;
};

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
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

  beforeEach(async () => {
    validAccount1 = {
      role: Roles.Member,
      username: 'testuser1',
      email: 'test1@example.com',
      hash: 'hash123',
      firstName: 'Test',
      lastName: 'User',
      sessionid: '1234567890',
      gid: '1234567890',
      notify: false,
    };
    validAccount2 = {
      role: Roles.Member,
      username: 'testuser2',
      email: 'test2@example.com',
      hash: 'hash123',
      firstName: 'Test',
      lastName: 'User',
      sessionid: '1234567891',
      gid: '1234567891',
      notify: true,
    };
  });

  it('should not create a new account', async () => {
    const accountData = {
      email: 'test@example.com',
      hash: 'hash123',
    };
    const account = new Account(accountData);
    await expect(account.save()).rejects.toThrow(mongoose.Error.ValidationError);
  });

  it('should not save an account with a duplicate email', async () => {
    const accountData1 = validAccount1;
    let accountData2 = validAccount2;
    accountData2.email = accountData1.email;
    console.log(accountData1.email, accountData2.email);

    const account1 = new Account(accountData1);
    await account1.save();
    const account2 = new Account(accountData2);
    await expect(account2.save()).rejects.toThrow();
  });

  it('should not save an account without a role', async () => {
    const accountData: any = validAccount1;
    delete accountData.role;
    const account = new Account(accountData);
    await expect(account.save()).rejects.toThrow(mongoose.Error.ValidationError);
  });

  it('should not save an account without a username', async () => {
    const accountData: any = validAccount1;
    delete accountData.username;
    const account = new Account(accountData);
    await expect(account.save()).rejects.toThrow(mongoose.Error.ValidationError);
  });

  it('should not save an account without a first name', async () => {
    const accountData: any = validAccount1;
    delete accountData.firstName;
    const account = new Account(accountData);
    await expect(account.save()).rejects.toThrow(mongoose.Error.ValidationError);
  });

  it('should not save an account without a last name', async () => {
    const accountData: any = validAccount1;
    delete accountData.lastName;
    const account = new Account(accountData);
    await expect(account.save()).rejects.toThrow(mongoose.Error.ValidationError);
  });

  it('should not save an account without an email', async () => {
    const accountData: any = validAccount1;
    delete accountData.email;
    const account = new Account(accountData);
    await expect(account.save()).rejects.toThrow(mongoose.Error.ValidationError);
  });

  it('should not save an account without a hash', async () => {
    const accountData: any = validAccount1;
    delete accountData.hash;
    const account = new Account(accountData);
    await expect(account.save()).rejects.toThrow(mongoose.Error.ValidationError);
  });

  it('should not save an account without a session ID', async () => {
    const accountData: any = validAccount1;
    delete accountData.sessionid;
    const account = new Account(accountData);
    await expect(account.save()).rejects.toThrow(mongoose.Error.ValidationError);
  });

  it('should not save an account with an invalid role', async () => {
    const accountData: any = validAccount1;
    accountData.role = 'invalidrole';
    const account = new Account(accountData);
    await expect(account.save()).rejects.toThrow(mongoose.Error.ValidationError);
  });

  // it('should not save an account with an invalid email', async () => {
  //   const accountData: any = validAccount1;
  //   accountData.email = 'invalidemail@invalid.invalid';
  //   const account = new Account(accountData);
  //   await expect(account.save()).rejects.toThrow(mongoose.Error.ValidationError);
  // });

  // it('should not save an account with an invalid session ID', async () => {
  //   const accountData = {
  //     role: 'user',
  //     username: 'testuser',
  //     email: 'test@example.com',
  //     hash: 'hash123',
  //     firstName: 'Test',
  //     lastName: 'User',
  //     sessionid: '',
  //   };
  //   const account = new Account(accountData);
  //   await expect(account.save()).rejects.toThrow(mongoose.Error.ValidationError);
  // });

  it('should not save an account with a duplicate session ID', async () => {
    const account1 = new Account(validAccount1);
    await account1.save();
    const accountData2: any = validAccount2;
    accountData2.sessionid = validAccount1.sessionid;
    const account2 = new Account(accountData2);
    await expect(account2.save()).rejects.toThrow();
  });

  it('should not save an account with a duplicate username', async () => {
    const account1 = new Account(validAccount1);
    await account1.save();
    const accountData2: any = validAccount2;
    accountData2.username = validAccount1.username;
    const account2 = new Account(accountData2);
    await expect(account2.save()).rejects.toThrow();
  });

  it('should not save an account with a duplicate GID', async () => {
    const account1 = new Account(validAccount1);
    await account1.save();
    const accountData2: any = validAccount2;
    accountData2.gid = validAccount1.gid;
    const account2 = new Account(accountData2);
    await expect(account2.save()).rejects.toThrow();
  });

  it('should save valid account', async () => {
    console.log(validAccount1);
    const account1 = new Account(validAccount1);
    await expect(account1.save()).resolves.not.toThrow();
    const account2 = new Account(validAccount2);
    await expect(account2.save()).resolves.not.toThrow();
  });
});