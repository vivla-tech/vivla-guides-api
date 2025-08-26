import { ok, created, noContent } from '../utils/response.js';

export const makeCrudController = (service) => ({
    list: async (req, res, next) => {
        try {
            const result = await service.list(req.query);
            return ok(res, result.items, { page: result.page, pageSize: result.pageSize, total: result.total, totalPages: result.totalPages });
        } catch (err) { return next(err); }
    },
    getById: async (req, res, next) => {
        try {
            const item = await service.getById(req.params.id);
            return ok(res, item);
        } catch (err) { return next(err); }
    },
    create: async (req, res, next) => {
        try {
            const item = await service.create(req.body);
            return created(res, item);
        } catch (err) { return next(err); }
    },
    update: async (req, res, next) => {
        try {
            const item = await service.update(req.params.id, req.body);
            return ok(res, item);
        } catch (err) { return next(err); }
    },
    remove: async (req, res, next) => {
        try {
            await service.remove(req.params.id);
            return noContent(res);
        } catch (err) { return next(err); }
    },
});
