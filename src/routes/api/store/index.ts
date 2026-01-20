import express from 'express';
import Guard from 'express-jwt-permissions';
import { isICartSerialized, isIProduct, isIProductForm, Roles, HTTP, IProductForm, ICartSerialized, isHTTP, ProductTypes } from 'typesit';
import storeService from '../../../services/store/index.js';
import logger from '../../../core/logger/index.js';
import { registerRoute, CommonResponses, CommonParameters } from '../../../utils/openapi-docs.js';

const router = express.Router();
const guard = Guard({
    requestProperty: 'auth',
    permissionsProperty: 'permissions'
  });

// Base path for this router
const BASE_PATH = '/api/store';

// ============================================================================
// Public/Member Routes
// ============================================================================

registerRoute('GET', BASE_PATH, '/products', {
    summary: 'Get all products',
    description: 'Retrieve a list of all available products in the store.',
    tags: ['Store', 'Products'],
    responses: {
        200: { description: 'List of all products', schema: 'Product[]' }
    }
});
router.get('/products', getProducts);

registerRoute('POST', BASE_PATH, '/purchase', {
    summary: 'Purchase products',
    description: 'Complete a purchase with the items in the cart. Requires member or non-member role.',
    tags: ['Store', 'Transactions'],
    requestBody: {
        description: 'Serialized cart with product IDs and amounts',
        schema: 'CartSerialized'
    },
    responses: {
        200: { description: 'Purchase completed successfully' },
        400: { description: 'Invalid cart data or insufficient balance' },
        401: CommonResponses.Unauthorized,
        403: { description: 'Account not verified for purchases' }
    }
});
router.post('/purchase', guard.check([[Roles.Member], [Roles.NonMember]]), purchase);

registerRoute('GET', BASE_PATH, '/products/:productId', {
    summary: 'Get product by ID',
    description: 'Retrieve details of a specific product.',
    tags: ['Store', 'Products'],
    parameters: [CommonParameters.productId()],
    responses: {
        200: { description: 'Product details', schema: 'Product' },
        404: CommonResponses.NotFound
    }
});
router.get('/products/:productId', getProductById);

// ============================================================================
// Admin Routes
// ============================================================================

registerRoute('POST', BASE_PATH, '/products', {
    summary: 'Create a new product',
    description: 'Add a new product to the store. Admin only.',
    tags: ['Store', 'Products', 'Admin'],
    requestBody: {
        description: 'Product details',
        schema: 'ProductForm'
    },
    responses: {
        200: { description: 'Product created successfully' },
        400: { description: 'Invalid product data' },
        403: CommonResponses.Forbidden
    }
});
router.post('/products', createProduct);

registerRoute('PUT', BASE_PATH, '/products/:productId', {
    summary: 'Update a product',
    description: 'Update an existing product. Admin only.',
    tags: ['Store', 'Products', 'Admin'],
    parameters: [CommonParameters.productId()],
    requestBody: {
        description: 'Updated product details',
        schema: 'ProductForm'
    },
    responses: {
        200: { description: 'Product updated successfully' },
        400: { description: 'Invalid product data' },
        403: CommonResponses.Forbidden,
        404: CommonResponses.NotFound
    }
});
router.put('/products/:productId', guard.check(Roles.Admin), updateProductById);

registerRoute('DELETE', BASE_PATH, '/products/:productId', {
    summary: 'Delete a product',
    description: 'Remove a product from the store. Admin only.',
    tags: ['Store', 'Products', 'Admin'],
    parameters: [CommonParameters.productId()],
    responses: {
        200: { description: 'Product deleted successfully' },
        403: CommonResponses.Forbidden,
        404: CommonResponses.NotFound
    }
});
router.delete('/products/:productId', guard.check(Roles.Admin), deleteProductById);

function getProducts(req, res, next) {
    storeService.getAllProducts()
        .then(resp => res.json(resp))
        .catch(err => next(err))
}

function createProduct(req, res, next) {
    // Check if body is an HTTP<IProductForm> type
    const data: HTTP<IProductForm> = req.body;

    if(!isHTTP<IProductForm>(data)){
        throw 'request body is of wrong type, must be HTTP<IProductForm>'
    }

    const form: IProductForm = {
        name: data.name,
        price: BigInt(data.price),
        type: data.type,
        category: data.category,
        description: data.description,
        image: data.image,
    };

    if(form.type == ProductTypes.Order) {
        form.order = typeof data.order === 'object' && data.order ? {
            supplier: data.order.supplier,
            minimum: BigInt(data.order.minimum),
        } : undefined
    };

    // Check if deserialization worked
    if(!isIProductForm(form)){
        logger.debug(form);
        throw 'request body is of wrong type, must be IProductForm'
    }

    storeService.createProduct(form)
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

    // CartSerialized and its HTTP version have the same structure (arrays of objects with primitive properties),
    // so we can use isICartSerialized to validate.

    if(!isICartSerialized(data)){
        throw 'request body is of wrong type, must be ICartSerialized'
    }
    storeService.purchaseCart(req.auth, data).then(() => res.json({})).catch(err => next(err));
}

export default router;
