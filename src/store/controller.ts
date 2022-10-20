import express from 'express';
import Guard from 'express-jwt-permissions';
import { isICartSerialized, isIProduct, isIProductForm } from 'typesit';
import storeService from './service.js';

const router = express.Router();
const guard = Guard({
    requestProperty: 'auth',
    permissionsProperty: 'permissions'
  });

// Routes
router.get('/products', getProducts)
router.post('/purchase', purchase)

router.post('/products', createProduct)
router.put('/products/:productId', guard.check('admin'), updateProductById)
router.get('/products/:productId', getProductById)
router.delete('/products/:productId', guard.check('admin'), deleteProductById)

function getProducts(req, res, next) {
    storeService.getAllProducts()
        .then(resp => res.json(resp))
        .catch(err => next(err))
}

function createProduct(req, res, next) {
    // Check if body is an IProductForm type
    const data = req.body;
    console.log(data)
    if(!isIProductForm(data)){
        console.log(data)
        throw 'request body is of wrong type, must be IProductForm'
    }
    storeService.createProduct(data)
        .then(() => res.json({}))
        .catch(err => next(err))
}

function updateProductById(req, res, next) {
    const data = req.body;
    if(!isIProductForm(data)){
        throw 'request body is of wrong type, must be IProductForm'
    }
    storeService.updateProductById(req.params['productId'],data)
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
    // console.log("purchasing")
    const data = req.body;
    if(!isICartSerialized(data)){
        throw 'request body is of wrong type, must be ICartSerialized'
    }
    storeService.purchaseCart(req.auth, data).then(() => res.json({})).catch(err => next(err));
}

export default router;