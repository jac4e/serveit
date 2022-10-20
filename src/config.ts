import { IAccountForm, Roles } from 'typesit';
import { Secret } from 'jsonwebtoken'

// Check for env vars
if (process.env.DB_URL === undefined){
    throw "DB_URL environment variable not found"
}
if (process.env.DB_PORT === undefined){
    throw "DB_PORT environment variable not found"
}
if (process.env.BACKEND_URL === undefined){
    throw "BACKEND_URL environment variable not found"
}
if (process.env.BACKEND_PORT === undefined){
    throw "BACKEND_PORT environment variable not found"
}
if (process.env.FRONTEND_URL === undefined){
    throw "FRONTEND_URL environment variable not found"
}
if (process.env.ADMIN_USER === undefined){
    throw "ADMIN_USER environment variable not found"
}
if (process.env.ADMIN_EMAIL === undefined){
    throw "ADMIN_EMAIL environment variable not found"
}
if (process.env.ADMIN_FIRST === undefined){
    throw "ADMIN_FIRST environment variable not found"
}
if (process.env.ADMIN_LAST === undefined){
    throw "ADMIN_LAST environment variable not found"
}
if (process.env.ADMIN_PASSWORD === undefined){
    throw "ADMIN_PASSWORD environment variable not found"
}
if (process.env.JWT_SECRET === undefined){
    throw "JWT_SECRET environment variable not found"
}

// Set constants
const DB_URL = process.env.DB_URL
const DB_PORT = process.env.DB_PORT
const DB_USER = ''
const DB_PASS = ''
const BACKEND_URL = process.env.BACKEND_URL
const BACKEND_PORT = process.env.BACKEND_PORT
const FRONTEND_URL = process.env.FRONTEND_URL
const ADMIN_USER = process.env.ADMIN_USER
const ADMIN_EMAIL = process.env.ADMIN_EMAIL
const ADMIN_FIRST = process.env.ADMIN_FIRST
const ADMIN_LAST = process.env.ADMIN_LAST
const ADMIN_PASS = process.env.ADMIN_PASSWORD
const JWT_SECRET = process.env.JWT_SECRET

// export required constants
export const db = {
    user: DB_USER,
    pass: DB_PASS,
    url: DB_URL,
    port: DB_PORT,
    name: 'spendit-db'
}

export const account: IAccountForm = {
    username: ADMIN_USER,
    password: ADMIN_PASS,
    lastName: ADMIN_FIRST,
    firstName: ADMIN_LAST,
    email: ADMIN_EMAIL,
    role: Roles.Admin
}

export const port = parseInt(BACKEND_PORT);

export const secret = JWT_SECRET as Secret;

export default { db, account, secret, port }