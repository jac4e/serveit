import db from '../_helpers/db.js';
import { JwtPayload } from 'jsonwebtoken';
import config from '../config.js';
import transactionService from '../_helpers/transaction.js';
import accountService from '../account/service.js';
import { ICartItem, ICartSerialized, IProduct, IProductForm, IProductLean } from '../_models/product.model.js';
import { ITransactionForm, ITransactionItem, TransactionType } from '../_models/transaction.model.js';
const Product = db.product;

async function getAllProducts(): Promise<IProductLean[]> {
    return await Product.find({}).lean<IProductLean[]>();
}

async function getProductById(productId: IProduct['id']): Promise<IProductLean> {
    return await Product.findById(productId).lean<IProductLean>();
}

async function createProduct(productParam: IProductForm): Promise<void> {
    // validate
    if (await Product.findOne<IProduct>({
        name: productParam.name
    })) {
        throw `Product '${productParam.name}' already exists`;
    }
    const product = new Product(productParam);

    await product.save();
}

async function updateProductById(id: IProduct['id'], productParam: IProductForm): Promise<void> {
    // console.log(id, productParam)
    let product = await Product.findById<IProduct>(id)
    // console.log(product)
    if (!product) {
        throw `Product '${id}' does not exist`;
    }
    // idk which one to use
    product.set(productParam);
    product.updateOne(id, productParam);
    // console.log(Object.getOwnPropertyNames(product))
    // update product
    // for (const key in productParam) {
    //     // console.log(key)
    //     // console.log(product._doc.hasOwnProperty(key))
    //     if (product._doc.hasOwnProperty(key)) {
    //         // console.log(product[key], productParam[key])
    //         product[key] = productParam[key]
    //     }
    // }
    product.save()
}
async function deleteProductById(id: IProduct['id']): Promise<void> {
    await Product.deleteOne({_id: id})
}

async function purchaseCart(payload: JwtPayload, cartSerialized: ICartSerialized[]): Promise<void> {
    // cart is array of ids
    //
    //    [ ids ... ]
    //

    if(payload.sub === undefined) {
        throw 'user is not found in token'
    }

    // check product count
    // console.log("buying cart")
    if (cartSerialized.length < 1) {
        throw "Cart is empty"
    }
    const products = await Product.find({'_id': { $in: cartSerialized.map((item) => item.id) } });
    // console.log(products)
    // create cart object for invoice
    let cart = (await Product.find({'_id': { $in: cartSerialized.map((item) => item.id) } }).lean<IProductLean[]>()).map<ICartItem>(({image, id, stock, price, ...keepAttrs}) => ({...keepAttrs, price: BigInt(price), amount: 0n, total: 0n}));
    
    let sum = 0n;
    for (let index = 0; index < cartSerialized.length; index++) {
        const productIndex = products.findIndex((product) => product.id === cartSerialized[index].id)
        if(!products[productIndex]){
            throw `Product with id: ${cartSerialized[index].id} could not be found`
        }
        // calc product amt in cart

        cart[productIndex].amount = cartSerialized[index].amount;
        if (cart[productIndex].amount>BigInt(products[productIndex].stock)){
            throw `product ${cart[productIndex].name} does not have enough stock left`
        }

        cart[productIndex].total = BigInt(cart[productIndex].amount) * cart[productIndex].price;
        // calc sum
        sum += cart[productIndex].total;
    }

    // console.log(cart)

    let transactionParams: ITransactionForm = {
        accountid: payload.sub,
        type: TransactionType.Debit,
        reason: 'Web Purchase',
        products: cart.map<ITransactionItem>(({total, price, amount, ...rest}) => ({total: total.toString(), amount: amount.toString(), price: price.toString(), ...rest})),
        total: sum.toString()
    }
    // console.log(transactionParams)
    // console.log(transactionParams)
    if (await accountService.pay(sum, payload.sub) !== true){
        // payment error
        throw "Payment error"
    }

    // payment has complete, can now reduce stock levels
    for (let index = 0; index < cart.length; index++) {
        products[index].stock = (BigInt(products[index].stock) - cart[index].amount).toString();
        // console.log(products[index])
        products[index].save();
    }

    await transactionService.create(transactionParams);
}

export default { getAllProducts, deleteProductById, purchaseCart, createProduct, getProductById, updateProductById}