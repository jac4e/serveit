import express from 'express';
import accounts from './account/controller.js';
import admin from './admin/controller.js';
import store from './store/controller.js';
import jwtAuthGuard from './_helpers/jwt.js';

// import guard from 'express-jwt-permissions';
import bodyParser from 'body-parser';
import cors from 'cors'

const router = express.Router();
router.use(bodyParser.urlencoded({
  extended: true
}));
router.use(bodyParser.json());
router.use(cors());
router.use(jwtAuthGuard());

router.get('/status', (req, res) => {
  res.status(200).send('200');
});
router.use('/admin', admin)
router.use('/accounts', accounts)
router.use('/store', store)

export default router;