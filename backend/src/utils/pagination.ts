export interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export function pagination(page: number, pageSize: number, total: number): Pagination {
  return {
    page,
    pageSize,
    total,
    totalPages: total === 0 ? 0 : Math.ceil(total / pageSize),
  };
}
