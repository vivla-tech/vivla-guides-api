import { body, param, query } from 'express-validator';

export const idParam = [param('id').isUUID().withMessage('id debe ser UUID válido')];

export const paginationQuery = [
    query('page').optional().isInt({ gt: 0 }).withMessage('page debe ser entero positivo'),
    query('pageSize').optional().isInt({ gt: 0, lt: 101 }).withMessage('pageSize entre 1 y 100'),
];

export const stringField = (field, required = false, max = 255) => [
    required ? body(field).isString().notEmpty().withMessage(`${field} es requerido`) : body(field).optional().isString(),
    body(field).optional().isLength({ max }).withMessage(`${field} máximo ${max} caracteres`),
];

export const intField = (field, required = false) => [
    required ? body(field).isInt().withMessage(`${field} debe ser entero`) : body(field).optional().isInt(),
];

export const decimalField = (field, required = false) => [
    required ? body(field).isDecimal().withMessage(`${field} debe ser decimal`) : body(field).optional().isDecimal(),
];

export const uuidField = (field, required = false) => [
    required ? body(field).isUUID().withMessage(`${field} debe ser UUID`) : body(field).optional().isUUID(),
];
