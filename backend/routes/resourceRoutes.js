/**
 * Builds an Express router exposing the standard CRUD set for one registry
 * resource. Route order matters: the literal paths (`/count`, `/aggregate`,
 * `/bulk`) must be declared before `/:id`.
 */

import { Router } from 'express';
import { attachResource, authenticate, requireRole } from '../middleware/auth.js';
import { getResource } from '../utils/registry.js';
import * as crud from '../controllers/crudController.js';

export function buildResourceRouter(key) {
  const resource = getResource(key);
  if (!resource) throw new Error(`Unknown resource "${key}" — add it to utils/registry.js.`);

  const router = Router();
  router.use(authenticate, attachResource(resource));

  const canRead = requireRole(resource.readRoles);
  const canWrite = requireRole(resource.writeRoles);

  router.get('/count', canRead, crud.count);
  router.get('/aggregate', canRead, crud.aggregate);
  router.get('/', canRead, crud.list);

  router.post('/bulk', canWrite, crud.bulkCreate);
  router.patch('/bulk', canWrite, crud.bulkUpdate);

  router.post('/', canWrite, crud.create);
  router.get('/:id', canRead, crud.getOne);
  router.patch('/:id', canWrite, crud.update);
  router.delete('/:id', canWrite, crud.remove);

  return router;
}
