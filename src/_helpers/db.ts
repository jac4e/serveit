import mongoose from 'mongoose';
import {__envConfig} from '../configuration/config.js';

const srv_string = __envConfig.database.url === 'localhost' && __envConfig.database.port !== '' ? '' : '+srv';
const account_string = __envConfig.database.user === '' ? '' : `${__envConfig.database.user}:${__envConfig.database.pass}@`;
const url_string = __envConfig.database.port === '' ? __envConfig.database.url : `${__envConfig.database.url}:${__envConfig.database.port}`;

mongoose.connect(`mongodb${srv_string}://${account_string}${url_string}/${__envConfig.database.name}?retryWrites=true&w=majority`);

const db = mongoose.connection;
db.on('error', (error) => {
    logger.error(error)
});
db.on('', (error) => {
    logger.error(error)
});
db.once('open', function callback () {
  logger.info(`Mongodb connection is open to ${url_string}/${__envConfig.database.name}`);
});

import account from '../_models/account.model.js';
import product from '../_models/product.model.js';
import transaction from '../_models/transaction.model.js';
import logger from './logger.js';

export default { account, product, transaction };