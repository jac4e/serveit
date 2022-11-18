import mongoose from 'mongoose';
import {config} from '../configuration/config.js';

if (config.database.user !== ''){
    mongoose.connect(`mongodb://${config.database.user}:${config.database.pass}@${config.database.url}:${config.database.port}/${config.database.name}`);
} else{
    mongoose.connect(`mongodb://${config.database.url}:${config.database.port}/${config.database.name}`);
}
const db = mongoose.connection;
db.on('error', (error) => {
    logger.error(error)
});
db.once('open', function callback () {
  logger.info("Mongodb connection is open");
});

import account from '../_models/account.model.js';
import product from '../_models/product.model.js';
import transaction from '../_models/transaction.model.js';
import logger from './logger.js';

export default { account, product, transaction };