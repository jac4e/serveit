import mongoose from 'mongoose';
import config from '../config.js';
mongoose.connect(`mongodb://${config.db.url}:${config.db.port}/${config.db.name}`);

import account from '../_models/account.model.js';
import product from '../_models/product.model.js';
import transaction from '../_models/transaction.model.js';

export default { account, product, transaction };