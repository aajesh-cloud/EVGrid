/**
 * API router mounted at `env.apiPrefix` (default `/api`).
 *
 *   /api/health          — system probe (public)
 *   /api/auth/*          — registration, OTP, login, profile, password reset
 *   /api/functions/*     — transactional server-side operations
 *   /api/<resource>      — standard CRUD set for every resource in the registry
 */

import { Router } from 'express';
import { buildResourceRouter } from './resourceRoutes.js';
import authRoutes from './authRoutes.js';
import functionsRoutes from './functionsRoutes.js';
import { requireRole } from '../middleware/auth.js';
import { invite } from '../controllers/usersController.js';
import { health } from '../controllers/healthController.js';
import { RESOURCE_KEYS, getResource } from '../utils/registry.js';

const router = Router();

router.get('/health', health);

router.use('/auth', authRoutes);
router.use('/functions', functionsRoutes);

// `/users` also exposes the admin-only invite helper.
const usersRouter = buildResourceRouter('users');
usersRouter.post('/invite', requireRole(['admin']), invite);
router.use('/users', usersRouter);

for (const key of RESOURCE_KEYS) {
  if (key === 'users') continue;
  router.use(getResource(key).path, buildResourceRouter(key));
}

export default router;
