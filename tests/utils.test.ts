import { FastifyRequest } from 'fastify';
import { paginateNoData, paginateWithData } from '../src/utils.js';

describe('paginateNoData', () => {
  it('should return default pagination when query parameters are missing', () => {
    const request = { query: {} } as FastifyRequest;
    
    const result = paginateNoData(request);

    expect(result).toEqual({
      offset: 0,
      size: 12,
      nextOffset: 12,
      prevOffset: 0,
      hasPrev: false,
    });
  });

  it('should parse provided offset and size correctly', () => {
    const request = { query: { offset: 5, size: 10 } } as unknown as FastifyRequest;
    
    const result = paginateNoData(request);

    expect(result).toEqual({
      offset: 5,
      size: 10,
      nextOffset: 15,
      prevOffset: 0, // 5 - 10 = -5, max(0, -5) = 0
      hasPrev: true,
    });
  });

  it('should parse provided string numbers', () => {
    const request = { query: { offset: '20', size: '5' } } as unknown as FastifyRequest;
    
    const result = paginateNoData(request);

    expect(result).toEqual({
      offset: 20,
      size: 5,
      nextOffset: 25,
      prevOffset: 15,
      hasPrev: true,
    });
  });

  it('should not return a negative prevOffset', () => {
    const request = { query: { offset: 2, size: 5 } } as unknown as FastifyRequest;
    
    const result = paginateNoData(request);

    expect(result.prevOffset).toBe(0);
  });
});

describe('paginateWithData', () => {
  it('should paginate an array and determine hasMore correctly (when exact size matches)', () => {
    const data = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const request = { query: { offset: 0, size: 5 } } as unknown as FastifyRequest;

    const result = paginateWithData(request, data);

    expect(result).toEqual({
      offset: 0,
      size: 5,
      paginatedData: [1, 2, 3, 4, 5],
      nextOffset: 5,
      prevOffset: 0,
      hasMore: true,
      hasPrev: false,
    });
  });

  it('should handle last page correctly (hasMore false)', () => {
    const data = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const request = { query: { offset: 5, size: 5 } } as unknown as FastifyRequest;

    const result = paginateWithData(request, data);

    expect(result).toEqual({
      offset: 5,
      size: 5,
      paginatedData: [6, 7, 8, 9, 10],
      nextOffset: 10,
      prevOffset: 0,
      hasMore: false, // 10 < 10 is false
      hasPrev: true,
    });
  });

  it('should handle uneven last page (hasMore false)', () => {
    const data = [1, 2, 3, 4, 5, 6, 7];
    const request = { query: { offset: 5, size: 5 } } as unknown as FastifyRequest;

    const result = paginateWithData(request, data);

    expect(result).toEqual({
      offset: 5,
      size: 5,
      paginatedData: [6, 7],
      nextOffset: 10,
      prevOffset: 0,
      hasMore: false,
      hasPrev: true,
    });
  });

  it('should return empty paginatedData if offset is beyond data length', () => {
    const data = [1, 2, 3];
    const request = { query: { offset: 10, size: 5 } } as unknown as FastifyRequest;

    const result = paginateWithData(request, data);

    expect(result).toEqual({
      offset: 10,
      size: 5,
      paginatedData: [],
      nextOffset: 15,
      prevOffset: 5,
      hasMore: false,
      hasPrev: true,
    });
  });

  it('should work with default size 12', () => {
    const data = Array.from({ length: 20 }, (_, i) => i);
    const request = { query: {} } as FastifyRequest;

    const result = paginateWithData(request, data);

    expect(result.paginatedData.length).toBe(12);
    expect(result.hasMore).toBe(true);
  });
});
