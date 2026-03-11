import { FastifyRequest } from 'fastify';

// extracts pagination parameters from the request, and calculates next/prev offsets
export function paginateNoData<T>(request: FastifyRequest) {
  const { offset = 0, size = 12 } = request.query as { offset?: number, size?: number };

  const offsetNum = Number(offset);
  const sizeNum = Number(size);

  const nextOffset = offsetNum + sizeNum;
  const prevOffset = Math.max(0, offsetNum - sizeNum);
  const hasPrev = offsetNum > 0;

  return {
    offset: offsetNum,
    size: sizeNum,
    nextOffset,
    prevOffset,
    hasPrev
  };
}

// takes a big array, and paginates it
export function paginateWithData<T>(request: FastifyRequest, data: T[]) {
  let {
    offset,
    size,
    nextOffset,
    prevOffset,
    hasPrev
  } = paginateNoData(request);

  const paginatedData = data.slice(offset, offset + size);
  const hasMore = nextOffset < data.length;

  return {
    offset: offset,
    size: size,
    paginatedData,
    nextOffset,
    prevOffset,
    hasMore,
    hasPrev
  };
}
