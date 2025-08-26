export function parsePagination(query) {
    const page = Math.max(parseInt(query.page, 10) || 1, 1);
    const pageSize = Math.min(Math.max(parseInt(query.pageSize, 10) || 20, 1), 100);
    const offset = (page - 1) * pageSize;
    const limit = pageSize;
    return { page, pageSize, offset, limit };
}
