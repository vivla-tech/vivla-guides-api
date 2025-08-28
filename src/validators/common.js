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

// URL string validator (TEXT length, no hard max). Requires protocol.
export const urlField = (field, required = false) => [
    required ? body(field).isString().notEmpty().withMessage(`${field} es requerido`) : body(field).optional().isString(),
    body(field).optional().isURL({ require_protocol: true }).withMessage(`${field} debe ser URL válida`),
];

// Array of URL strings validator
export const urlArrayField = (field, required = false) => [
    required ? body(field).isArray().withMessage(`${field} debe ser un array`) : body(field).optional().isArray(),
    body(`${field}.*`).optional().isString().isURL({ require_protocol: true }).withMessage(`${field} debe contener URLs válidas`),
];
