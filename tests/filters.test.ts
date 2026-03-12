import { 
  formatDuration, 
  formatDate, 
  formatRfc822Date,
  filterByStatus, 
  sumDurations, 
  sumIntervals, 
  isModified 
} from '../src/filters.js';

describe('filters', () => {
  describe('formatDuration', () => {
    it('should format seconds into M:SS correctly', () => {
      expect(formatDuration(0)).toBe('0:00');
      expect(formatDuration(5)).toBe('0:05');
      expect(formatDuration(59)).toBe('0:59');
      expect(formatDuration(60)).toBe('1:00');
      expect(formatDuration(65)).toBe('1:05');
      expect(formatDuration(119)).toBe('1:59');
      expect(formatDuration(120)).toBe('2:00');
      expect(formatDuration(3600)).toBe('60:00'); // No hour wrap-around by design
    });
  });

  describe('formatDate', () => {
    it('should correctly call toLocaleString on a date string', () => {
      const dateStr = '2026-03-12T10:00:00Z';
      const result = formatDate(dateStr);
      // toLocaleString output depends on the environment running the test, 
      // so we just verify it correctly evaluates to a string that contains
      // part of a date (using a regex that matches common date formats).
      // Or simply verify it doesn't throw and returns the same output as a raw Date.
      expect(result).toBe(new Date(dateStr).toLocaleString());
    });
  });

  describe('formatRfc822Date', () => {
    it('should correctly call toUTCString for podcast compatibility', () => {
      const dateStr = '2026-03-12T10:00:00Z';
      const result = formatRfc822Date(dateStr);
      expect(result).toBe(new Date(dateStr).toUTCString());
    });
  });

  describe('filterByStatus', () => {
    it('should filter items by the exact status', () => {
      const songs = [
        { id: 1, status: 'slow' },
        { id: 2, status: 'fast' },
        { id: 3, status: 'slow' }
      ];

      const slowSongs = filterByStatus(songs, 'slow');
      expect(slowSongs).toHaveLength(2);
      expect(slowSongs.map(s => s.id)).toEqual([1, 3]);

      const fastSongs = filterByStatus(songs, 'fast');
      expect(fastSongs).toHaveLength(1);
      expect(fastSongs[0].id).toBe(2);
    });

    it('should handle undefined or null input gracefully', () => {
      expect(filterByStatus(undefined as any, 'slow')).toEqual([]);
      expect(filterByStatus(null as any, 'slow')).toEqual([]);
    });
  });

  describe('sumDurations', () => {
    it('should calculate the sum of all durations', () => {
      const songs = [
        { duration: 10 },
        { duration: 20 },
        { duration: 30 }
      ];
      expect(sumDurations(songs)).toBe(60);
    });

    it('should treat missing duration properties as 0', () => {
      const songs = [
        { duration: 10 },
        { }, // missing duration
        { duration: 20 }
      ];
      expect(sumDurations(songs)).toBe(30);
    });

    it('should handle undefined or null input gracefully', () => {
      expect(sumDurations(undefined as any)).toBe(0);
      expect(sumDurations(null as any)).toBe(0);
      expect(sumDurations([])).toBe(0);
    });
  });

  describe('sumIntervals', () => {
    it('should calculate the sum of all interval durations', () => {
      const intervals = [
        { duration: 60 },
        { duration: 120 },
        { duration: 60 }
      ];
      expect(sumIntervals(intervals)).toBe(240);
    });

    it('should handle missing interval duration gracefully', () => {
      const intervals = [
        { duration: 60 },
        { },
        { duration: 120 }
      ];
      expect(sumIntervals(intervals)).toBe(180);
    });

    it('should handle undefined or null input gracefully', () => {
      expect(sumIntervals(undefined as any)).toBe(0);
      expect(sumIntervals(null as any)).toBe(0);
    });
  });

  describe('isModified', () => {
    it('should return false if status is not completed', () => {
      const run = {
        status: 'pending',
        updatedAt: '2026-03-12T10:10:00Z',
        stitchedAt: '2026-03-12T10:00:00Z'
      };
      expect(isModified(run)).toBe(false);
    });

    it('should return false if updatedAt is missing', () => {
      const run = {
        status: 'completed',
        stitchedAt: '2026-03-12T10:00:00Z'
      };
      expect(isModified(run)).toBe(false);
    });

    it('should return true if updatedAt is greater than stitchedAt', () => {
      const run = {
        status: 'completed',
        updatedAt: '2026-03-12T10:10:00Z',
        stitchedAt: '2026-03-12T10:00:00Z'
      };
      expect(isModified(run)).toBe(true);
    });

    it('should return false if updatedAt is equal to stitchedAt', () => {
      const run = {
        status: 'completed',
        updatedAt: '2026-03-12T10:00:00Z',
        stitchedAt: '2026-03-12T10:00:00Z'
      };
      expect(isModified(run)).toBe(false);
    });

    it('should return false if updatedAt is less than stitchedAt', () => {
      const run = {
        status: 'completed',
        updatedAt: '2026-03-12T10:00:00Z',
        stitchedAt: '2026-03-12T10:10:00Z'
      };
      expect(isModified(run)).toBe(false);
    });

    it('should return true if stitchedAt is missing but it is completed and has updatedAt', () => {
      const run = {
        status: 'completed',
        updatedAt: '2026-03-12T10:00:00Z'
      };
      // 0 stitchTime is always less than any valid date
      expect(isModified(run)).toBe(true);
    });
  });
});
