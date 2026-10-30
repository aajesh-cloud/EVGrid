import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import * as auth from '../controllers/authController.js';

const router = Router();

router.post('/register', auth.register);
router.post('/verify-otp', auth.verifyOtp);
router.post('/resend-otp', auth.resendOtp);
router.post('/login', auth.login);
router.post('/forgot-password', auth.forgotPassword);
router.post('/reset-password', auth.resetPassword);
router.post('/logout', auth.logout);
router.get('/oauth/:provider', auth.oauthRedirect);

router.get('/me', authenticate, auth.me);
router.patch('/me', authenticate, auth.updateMe);

export default router;
