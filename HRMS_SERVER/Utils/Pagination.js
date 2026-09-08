/**
 * Standard pagination and response formatter utility.
 */
export const getPagination = (reqQuery) => {
  const page = Math.max(1, parseInt(reqQuery.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(reqQuery.limit, 10) || 10));
  const skip = (page - 1) * limit;

  const sortBy = reqQuery.sortBy || "createdAt";
  const sortOrder = reqQuery.sortOrder === "asc" ? 1 : -1;
  const sort = { [sortBy]: sortOrder };

  return { page, limit, skip, sort };
};

export const formatPaginatedResponse = ({ data, total, page, limit }) => {
  const totalPages = Math.ceil(total / limit) || 1;
  return {
    success: true,
    data,
    pagination: {
      totalRecords: total,
      currentPage: page,
      totalPages,
      pageSize: limit,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    },
  };
};
