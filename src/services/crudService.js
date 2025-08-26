import createError from 'http-errors';
import sequelize from '../config/database.js';
import { parsePagination } from '../utils/pagination.js';

export default class CrudService {
    constructor(model, options = {}) {
        this.model = model;
        this.defaultInclude = options.include || [];
        this.defaultOrder = options.order || [['id', 'ASC']];
    }

    async list(query = {}, findOptions = {}) {
        const { offset, limit, page, pageSize } = parsePagination(query);
        const where = findOptions.where || {};
        const include = findOptions.include || this.defaultInclude;
        const order = findOptions.order || this.defaultOrder;

        const { rows, count } = await this.model.findAndCountAll({ where, include, order, offset, limit });
        return { items: rows, total: count, page, pageSize, totalPages: Math.ceil(count / pageSize) };
    }

    async getById(id, findOptions = {}) {
        const include = findOptions.include || this.defaultInclude;
        const entity = await this.model.findByPk(id, { include });
        if (!entity) throw createError(404, 'Recurso no encontrado');
        return entity;
    }

    async create(payload) {
        return sequelize.transaction(async (t) => {
            const entity = await this.model.create(payload, { transaction: t });
            return entity;
        });
    }

    async update(id, payload) {
        return sequelize.transaction(async (t) => {
            const entity = await this.model.findByPk(id, { transaction: t });
            if (!entity) throw createError(404, 'Recurso no encontrado');
            await entity.update(payload, { transaction: t });
            return entity;
        });
    }

    async remove(id) {
        return sequelize.transaction(async (t) => {
            const entity = await this.model.findByPk(id, { transaction: t });
            if (!entity) throw createError(404, 'Recurso no encontrado');
            await entity.destroy({ transaction: t });
        });
    }
}
