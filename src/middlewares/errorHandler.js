export function errorHandler(err, _req, res, _next) {
    const status = err.status || err.statusCode || 500;
    const message = err.message || 'Error interno del servidor';
    const details = err.errors || undefined;

    if (process.env.NODE_ENV !== 'test') {
        // eslint-disable-next-line no-console
        console.error('[ERROR]', status, message, details || '');
    }

    res.status(status).json({
        success: false,
        error: {
            message,
            ...(details ? { details } : {}),
        },
    });
}
