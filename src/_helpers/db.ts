import mongoose from 'mongoose';
import {config} from '../configuration/config.js';

if (config.database.url === 'localhost' && config.database.user !== '') {
    mongoose.connect(`mongodb://${config.database.user}:${config.database.pass}@${config.database.url}:${config.database.port}/${config.database.name}`);
} else if (config.database.url === 'localhost') {
    mongoose.connect(`mongodb://${config.database.url}:${config.database.port}/${config.database.name}`);
} else {
    mongoose.connect(`mongodb+srv://${config.database.user}:${config.database.pass}@${config.database.url}/${config.database.name}?retryWrites=true&w=majority`);
}

const db = mongoose.connection;
db.on('error', (error) => {
    logger.error(error)
});
db.on('', (error) => {
    logger.error(error)
});
db.once('open', function callback () {
  logger.info(`Mongodb connection is open to ${config.database.url}/${config.database.name}`);
});

import account from '../_models/account.model.js';
import product from '../_models/product.model.js';
import transaction from '../_models/transaction.model.js';
import logger from './logger.js';

export default { account, product, transaction };