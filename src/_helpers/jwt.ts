import { expressjwt, Request } from 'express-jwt';
import { Jwt } from 'jsonwebtoken';
import config from '../config.js';
import db from './db.js';

const Account = db.account;

export default function jwtAuthGuard() {
    const secret = config.secret;
    return expressjwt({ secret: secret,algorithms: ['HS256'], isRevoked: isRevokedCallback }).unless({
        path: [
            // public routes that don't require authentication
            '/api/status',
            '/api/store/products',
            '/api/accounts/auth',
            '/api/accounts/register',
        ]
    });
}

// (req: express.Request, token: jwt.Jwt | undefined) =>

async function isRevokedCallback(req: Request, token: undefined | Jwt): Promise<boolean> {
    if (token === undefined) {
        // Token not defined
        // Not sure what to do here
        return false;
    }
    const account = await Account.findById(token.payload.sub);
    // revoke token if user no longer exists
    if (!account) {
        return true;
    }
    // revoke if account session id != payload session id
    if ((account.sessionid || '') !== token.payload['sid']) {
        return true;
    }
    return false;
};