import db from '../../core/db/index.js';
import { JwtPayload } from 'jsonwebtoken';
import transactionService from '../transactions/index.js';
import accountService from '../account/index.js';
import { ICartItem, ICartItemSerialized, ICartSerialized, IProduct, IProductDocument, IProductForm, isIProduct, ITransactionForm, ITransactionItem, ProductTypes, Roles, TransactionType } from 'typesit';
import email from '../tasks/email.js';

const Product = db.product;

async function getAllProducts(): Promise<IProduct[]> {
    return await Product.find({}).lean<IProduct[]>();
}

async function getProductById(productId: IProduct['id']): Promise<IProduct> {
    return await Product.findById(productId).lean<IProduct>();
}

async function createProduct(productParam: IProductForm): Promise<void> {
    // validate
    if (await Product.findOne<IProductDocument>({
        name: productParam.name
    })) {
        throw `Product '${productParam.name}' already exists`;
    }
    const product = new Product(productParam);

    await product.save();
}

async function updateProductById(id: IProduct['id'], productParam: IProductForm): Promise<void> {
    // logger.debug(id, productParam)
    let product = await Product.findById<IProductDocument>(id)
    // logger.debug(product)
    if (!product) {
        throw `Product '${id}' does not exist`;
    }
    // idk which one to use
    product.set(productParam);
    // product.updateOne(productParam);
    // logger.debug(Object.getOwnPropertyNames(product))
    // update product
    // for (const key in productParam) {
    //     // logger.debug(key)
    //     // logger.debug(product._doc.hasOwnProperty(key))
    //     if (product._doc.hasOwnProperty(key)) {
    //         // logger.debug(product[key], productParam[key])
    //         product[key] = productParam[key]
    //     }
    // }
    product.save()
}
async function deleteProductById(id: IProduct['id']): Promise<void> {
    await Product.deleteOne({_id: id})
}

async function purchaseCart(payload: JwtPayload, cartSerialized: ICartSerialized): Promise<void> {
    if (!payload.sub) {
        throw 'User is not found in token';
    }

    if (cartSerialized.length < 1) {
        throw 'Cart is empty';
    }

    const productIds = cartSerialized.map((item: ICartItemSerialized): IProduct['id'] => item.id);
    const productStock = await Product.find({ '_id': { $in: productIds }, type: ProductTypes.Stock }).lean<IProduct<ProductTypes.Stock>[]>();
    const productOrder = await Product.find({ '_id': { $in: productIds }, type: ProductTypes.Order }).lean<IProduct<ProductTypes.Order>[]>();

    if ((productStock.length + productOrder.length) !== cartSerialized.length) {
        throw 'Some products could not be found';
    }

    const cart: ICartItem[] = [...productStock, ...productOrder].map((product: IProduct): ICartItem => {
        // find cart item by the product id
        const cartItem = cartSerialized.find((item: ICartItemSerialized): boolean => item.id === product.id);
        
        if (!cartItem) {
            throw `Product with id: ${product.id} could not be found in cart`;
        }

        if (isIProduct(product, ProductTypes.Stock) && BigInt(cartItem.amount) > BigInt(product.stock)) {
            throw `Product ${product.name} does not have enough stock left`;
        }
        
        return {
            ...product,
            price: BigInt(product.price),
            amount: BigInt(cartItem.amount),
            total: BigInt(product.price) * BigInt(cartItem.amount)
        }
    });

    const sum = cart.reduce((acc: bigint, item: ICartItem): bigint => acc + item.total, BigInt(0));
    // for (const item of cartSerialized) {
    //     const productIndex = products.findIndex((product) => product.id === item.id);
    //     const product = products[productIndex];
    //     const cartItem = cart[productIndex];

    //     if (!product) {
    //         throw `Product with id: ${item.id} could not be found`;
    //     }

    //     cartItem.amount = BigInt(item.amount);
    //     if (isIProduct(product, ProductTypes.Stock) && cartItem.amount > BigInt(product.stock)) {
    //         throw `Product ${cartItem.name} does not have enough stock left`;
    //     }

    //     cartItem.total = cartItem.amount * cartItem.price;
    //     sum += cartItem.total;
    // }

    const transactionParams: ITransactionForm = {
        accountId: payload.sub,
        type: TransactionType.Debit,
        reason: 'Web Purchase',
        products: cart.map((cartItem: ICartItem): ITransactionItem => ({
            total: cartItem.total.toString(),
            amount: cartItem.amount.toString(),
            name: cartItem.name,
            description: cartItem.description,
            price: cartItem.price.toString()
        })),
        total: sum.toString()
    };

    await accountService.pay(sum, payload.sub);
    await transactionService.create(transactionParams);

    // for (const item of cart) {
    //     const productIndex = products.findIndex((product) => product.id === item.id);
    //     const product = products[productIndex];

    //     product.stock = (BigInt(product.stock) - item.amount).toString();
    //     if (product.stock === '0') {
    //         const subject = `Spendit - ${product.name} is Out of Stock`;
    //         const message = `Hi Admins,\nThe last ${product.name} has just been purchased.`;
    //         await email.sendAll(Roles.Admin, subject, message);
    //     }

    //     await Product.updateOne({ _id: product.id }, { stock: product.stock });
    // }

    for (const item of cart) {
        // Update stock
        if (isIProduct(item, ProductTypes.Stock)) {
            item.stock = item.stock - item.amount;
            if (item.stock === 0n) {
                const subject = `Spendit - ${item.name} is Out of Stock`;
                const message = `Hi Admins,\nThe last ${item.name} has just been purchased.`;
                await email.sendAll(Roles.Admin, subject, message);
            }

            await Product.updateOne({ _id: item.id }, { stock: item.stock });
        // Create order and check if minimum is met
        } else if (isIProduct(item, ProductTypes.Order)) {
            // TODO: Add order model so we can add an order here
            if (item.order.current + item.amount >= item.order.minimum) {
                const subject = `Spendit - ${item.name} has fufilled its minimum order quantity`;
                const message = `Hi Admins,\n${item.name} should now be ordered.`;
                await email.sendAll(Roles.Admin, subject, message);
            }
        }
    }
}

export default { getAllProducts, deleteProductById, purchaseCart, createProduct, getProductById, updateProductById}
