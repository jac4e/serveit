import express from 'express';
import accounts from './account/controller.js';
import admin from './admin/controller.js';
import store from './store/controller.js';
import jwtAuthGuard from './_helpers/jwt.js';
import cors from 'cors'
import { __pkg } from './configuration/config.js';

const router = express.Router();

router.use(cors());
router.use(jwtAuthGuard());

router.get('/status', (req, res) => {
  res.status(200).send(`Version: ${__pkg.version}`);
});
router.use('/admin', admin)
router.use('/accounts', accounts)
router.use('/store', store)

export default router;