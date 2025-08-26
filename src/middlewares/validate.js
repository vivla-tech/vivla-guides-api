import { validationResult } from 'express-validator';

export const validate = (req, _res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        const details = errors.array().map((e) => ({ field: e.param, message: e.msg }));
        const err = new Error('Datos inválidos');
        err.status = 422;
        err.errors = details;
        return next(err);
    }
    return next();
};
