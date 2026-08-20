export interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface ListResponse<T> {
  data: T[];
  pagination: Pagination;
}

export interface ListQuery {
  page?: number;
  pageSize?: number;
  search?: string;
  sort?: string;
  order?: 'asc' | 'desc';
}
