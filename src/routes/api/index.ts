import express from 'express';
import accounts from './account/index.js'
import admin from './admin/index.js'
import store from './store/index.js'
import refills from './refill/index.js'
import jwtAuthGuard from '../../middleware/jwt-auth.js';
import cors from 'cors';
import { __pkg } from '../../config/config.js';
import { registerRoute } from '../../utils/openapi-docs.js';

const router = express.Router();

router.use(cors());
router.use(jwtAuthGuard());

// ============================================================================
// System Routes
// ============================================================================

registerRoute('GET', '/api', '/status', {
    summary: 'Get API status',
    description: 'Check if the API is reachable and get the current version.',
    tags: ['System'],
    security: false,
    responses: {
        200: { 
            description: 'API is reachable; returns current version string',
            content: {
                'text/plain': {
                    schema: { type: 'string' }
                }
            }
        }
    }
});
router.get('/status', (req, res) => {
  res.status(200).send(`Version: ${__pkg.version}`);
});

router.use('/admin', admin)
router.use('/accounts', accounts)
router.use('/store', store)
router.use('/refills', refills)

export default router;
