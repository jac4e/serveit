import { IAccountForm, Roles } from 'typeit';
import { Secret } from 'jsonwebtoken'

// Check for env vars
if (process.env.ADMIN_PASSWORD === undefined){
    throw "Admin password environment variable is undefined"
}
if (process.env.JWT_SECRET === undefined){
    throw "Admin password environment variable is undefined"
}

const db = {
    user: "",
    pass: "",
    url: "localhost",
    port: "27017",
    name: "spendit-db"
}

const account: IAccountForm = {
    username: "dev",
    password: process.env.ADMIN_PASSWORD,
    lastName: "dev",
    firstName: "dev",
    email: "doesnotexist@ualberta.ca",
    role: Roles.Admin
}

const port = 3000;

const secret = process.env.JWT_SECRET as Secret;

export default { db, account, secret, port }