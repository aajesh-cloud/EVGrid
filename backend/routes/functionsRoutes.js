import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import * as functions from '../controllers/functionsController.js';

const router = Router();

router.use(authenticate);

router.post('/create-booking', functions.createBooking);
router.post('/charging-session', functions.chargingSession);
router.post('/process-payment', functions.processPayment);

export default router;
