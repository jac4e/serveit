import mongoose from 'mongoose';
import { __envConfig } from '../../config/config.js';
import logger from '../logger/index.js';
import 'winston-mongodb';
import { transports } from 'winston';

const account_string = __envConfig.database.user === '' ? '' : `${__envConfig.database.user}:${__envConfig.database.pass}@`;
const url_string = __envConfig.database.port === '' ? __envConfig.database.url : `${__envConfig.database.url}:${__envConfig.database.port}`;

mongoose.connect(`mongodb://${account_string}${url_string}/${__envConfig.database.name}?retryWrites=true&w=majority`);

const db = mongoose.connection;
db.on('error', (error) => {
    logger.error(error)
});
db.on('', (error) => {
    logger.error(error)
});
db.once('open', function callback () {
  // Add MongoDB connection to logger
  logger.add(new transports.MongoDB({
    db: Promise.resolve(db.getClient()),
    options: { useUnifiedTopology: true },
    collection: 'log',
    level: 'info',
  }));

  logger.info(`Mongodb connection is open to ${url_string}/${__envConfig.database.name}`);
});

import account from './models/account.model.js';
import apiKey from './models/api-key.model.js';
import product from './models/product.model.js';
import transaction from './models/transaction.model.js';
import refill from './models/refill.model.js';
import stock from './models/stock.model.js';
import preorders from './models/preorders.model.js';

export default { account, apiKey, product, transaction, refill, stock, preorders };
