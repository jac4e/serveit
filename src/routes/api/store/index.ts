import express from 'express';
import Guard from 'express-jwt-permissions';
import { isICartSerialized, isIProduct, isIProductForm, Roles, HTTP, IProductForm, ICartSerialized, isHTTP, ProductTypes } from 'typesit';
import storeService from '../../../services/store/index.js';
import logger from '../../../core/logger/index.js';

const router = express.Router();
const guard = Guard({
    requestProperty: 'auth',
    permissionsProperty: 'permissions'
  });

// Routes
router.get('/products', getProducts)
router.post('/purchase', guard.check([[Roles.Member], [Roles.NonMember]]), purchase)

router.post('/products', createProduct)
router.put('/products/:productId', guard.check(Roles.Admin), updateProductById)
router.get('/products/:productId', getProductById)
router.delete('/products/:productId', guard.check(Roles.Admin), deleteProductById)

function getProducts(req, res, next) {
    storeService.getAllProducts()
        .then(resp => res.json(resp))
        .catch(err => next(err))
}

function createProduct(req, res, next) {
    // Check if body is an HTTP<IProductForm> type
    const data: HTTP<IProductForm> = req.body;
    // logger.debug(data)
    if(!isIProductForm(data)){
        // logger.debug(data)
        throw 'request body is of wrong type, must be IProductForm'
    }
    storeService.createProduct(data)
        .then(() => res.json({}))
        .catch(err => next(err))
}

function updateProductById(req, res, next) {
    const data = req.body;

    if(!isHTTP<IProductForm>(data)){
        throw 'request body is of wrong type, must be HTTP<IProductForm>'
    }

    const deserializedData: IProductForm = {
        name: data.name,
        price: BigInt(data.price),
        type: data.type,
        category: data.category,
        description: data.description,
        image: data.image,
    };
    
    if(deserializedData.type == ProductTypes.Order) {
        deserializedData.order = typeof data.order === 'object' && data.order ? {
            supplier: data.order.supplier,
            minimum: BigInt(data.order.minimum),
        } : undefined
    }

    // Check if deserialization worked
    if(!isIProductForm(deserializedData)){
        logger.debug(deserializedData);
        throw 'request body is of wrong type, must be IProductForm'
    }
    storeService.updateProductById(req.params['productId'],deserializedData)
        .then(() => res.json({}))
        .catch(err => next(err))
}

function getProductById(req, res, next) {
    storeService.getProductById(req.params['productId'])
        .then(resp => res.json(resp))
        .catch(err => next(err))
}

function deleteProductById(req, res, next) {
    storeService.deleteProductById(req.params['productId'])
        .then(resp => res.json(resp))
        .catch(err => next(err))
}

function purchase(req, res, next) {
    // logger.debug("purchasing")
    const data: HTTP<ICartSerialized> = req.body;
    if(!isICartSerialized(data)){
        throw 'request body is of wrong type, must be ICartSerialized'
    }
    storeService.purchaseCart(req.auth, data).then(() => res.json({})).catch(err => next(err));
}

export default router;
