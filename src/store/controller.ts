import express from 'express';
import Guard from 'express-jwt-permissions';
import storeService from './service.js';

const router = express.Router();
const guard = Guard();

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
    storeService.createProduct(req.body)
        .then(() => res.json({}))
        .catch(err => next(err))
}

function updateProductById(req, res, next) {
    storeService.updateProductById(req.params['productId'],req.body)
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
    storeService.purchaseCart(req.user, req.body.cart).then(() => res.json({})).catch(err => next(err));
}

export default router;