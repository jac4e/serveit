import mongoose from 'mongoose';
import {__envConfig} from '../configuration/config.js';

if (__envConfig.database.url === 'localhost' && __envConfig.database.user !== '') {
    mongoose.connect(`mongodb://${__envConfig.database.user}:${__envConfig.database.pass}@${__envConfig.database.url}:${__envConfig.database.port}/${__envConfig.database.name}`);
} else if (__envConfig.database.url === 'localhost') {
    mongoose.connect(`mongodb://${__envConfig.database.url}:${__envConfig.database.port}/${__envConfig.database.name}`);
} else {
    mongoose.connect(`mongodb+srv://${__envConfig.database.user}:${__envConfig.database.pass}@${__envConfig.database.url}/${__envConfig.database.name}?retryWrites=true&w=majority`);
}

const db = mongoose.connection;
db.on('error', (error) => {
    logger.error(error)
});
db.on('', (error) => {
    logger.error(error)
});
db.once('open', function callback () {
  logger.info(`Mongodb connection is open to ${__envConfig.database.url}/${__envConfig.database.name}`);
});

import account from '../_models/account.model.js';
import product from '../_models/product.model.js';
import transaction from '../_models/transaction.model.js';
import logger from './logger.js';

export default { account, product, transaction };