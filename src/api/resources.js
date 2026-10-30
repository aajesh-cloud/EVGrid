/**
 * Generic REST resource factory.
 *
 * Every EVGrid entity is exposed through the same small surface so page
 * components never build URLs themselves.
 *
 * Backend contract per resource (`/api/<path>`):
 *   GET    /<path>?<filter/sort/limit/skip>  -> { items, total }
 *   GET    /<path>/:id                       -> object
 *   POST   /<path>                           -> created object
 *   PATCH  /<path>/:id                       -> updated object
 *   DELETE /<path>/:id                       -> 204
 *   GET    /<path>/count?<filter>            -> { count }
 *   GET    /<path>/aggregate?filter&sum=a,b  -> { rows: [{ sum_a, sum_b, count }] }
 *   PATCH  /<path>/bulk  { items: [...] }    -> { items: [...] }
 */

import { request } from './client';

/** Accepts `{ items, total }`, `{ data: [...] }`, `{ results: [...] }` or a bare array. */
export function normalizePage(payload) {
  if (!payload) return { items: [], total: 0 };
  if (Array.isArray(payload)) return { items: payload, total: payload.length };
  const items = payload.items ?? payload.data ?? payload.results ?? [];
  const list = Array.isArray(items) ? items : [];
  return { items: list, total: payload.total ?? payload.count ?? list.length };
}

export function createResource(basePath) {
  const path = basePath.startsWith('/') ? basePath : `/${basePath}`;
  const at = (id) => `${path}/${encodeURIComponent(id)}`;

  return {
    /** List with optional sort/limit/skip/pagination. */
    async list(options = {}) {
      const { filter, sort, limit, skip, ...rest } = options;
      return normalizePage(
        await request(path, { query: { filter, sort, limit, skip, ...rest } })
      );
    },

    /** Filtered list: `filter({ status: 'paid' }, { sort: '-created_date', limit: 50 })`. */
    async filter(filter = {}, options = {}) {
      return this.list({ filter, ...options });
    },

    get(id) {
      return request(at(id));
    },

    create(data) {
      return request(path, { method: 'POST', body: data });
    },

    update(id, data) {
      return request(at(id), { method: 'PATCH', body: data });
    },

    async delete(id) {
      await request(at(id), { method: 'DELETE' });
      return true;
    },

    async count(filter = {}) {
      const payload = await request(`${path}/count`, { query: { filter } });
      if (typeof payload === 'number') return payload;
      return payload?.count ?? payload?.total ?? 0;
    },

    /** Aggregate sums: `aggregate({ query: { status: 'paid' }, sum: ['amount'] })`. */
    async aggregate({ query: filter = {}, sum = [] } = {}) {
      const payload = await request(`${path}/aggregate`, {
        query: { filter, sum: sum.join(',') },
      });
      const rows = payload?.rows ?? payload?.data ?? (Array.isArray(payload) ? payload : []);
      return { rows: Array.isArray(rows) ? rows : [] };
    },

    bulkUpdate(items = []) {
      return request(`${path}/bulk`, { method: 'PATCH', body: { items } });
    },

    bulkCreate(items = []) {
      return request(`${path}/bulk`, { method: 'POST', body: { items } });
    },
  };
}
