import { jest } from '@jest/globals';
import fs from 'node:fs/promises';
import path from 'node:path';
import yaml from 'js-yaml';
import { loadPrograms, saveProgram, _calculateDurations, _resetCache } from '../src/programs.js';
import { IntervalType, Program } from '../src/types.js';

describe('programs.ts non-route functions', () => {
  let fsMkdirSpy: jest.SpiedFunction<typeof fs.mkdir>;
  let fsReaddirSpy: jest.SpiedFunction<typeof fs.readdir>;
  let fsReadFileSpy: jest.SpiedFunction<typeof fs.readFile>;
  let fsWriteFileSpy: jest.SpiedFunction<typeof fs.writeFile>;
  let consoleLogSpy: jest.SpiedFunction<typeof console.log>;

  beforeEach(() => {
    _resetCache();
    jest.restoreAllMocks();
    
    // Default mocks
    fsMkdirSpy = jest.spyOn(fs, 'mkdir').mockResolvedValue(undefined as never);
    fsReaddirSpy = jest.spyOn(fs, 'readdir').mockResolvedValue([]);
    fsReadFileSpy = jest.spyOn(fs, 'readFile').mockResolvedValue('[]');
    fsWriteFileSpy = jest.spyOn(fs, 'writeFile').mockResolvedValue(undefined);
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  describe('_calculateDurations', () => {
    it('should calculate slow and fast durations correctly', () => {
      const partialProgram = {
        id: 'prog1',
        name: 'Test Program',
        difficulty: 1,
        description: 'A test program',
        intervals: [
          { type: IntervalType.WARMUP, duration: 300 },
          { type: IntervalType.RUN, duration: 600 },
          { type: IntervalType.WALK, duration: 120 },
          { type: IntervalType.RUN, duration: 600 },
          { type: IntervalType.COOLDOWN, duration: 300 },
        ],
      };

      const result = _calculateDurations(partialProgram);

      expect(result.slowDuration).toBe(300 + 120 + 300); // 720
      expect(result.fastDuration).toBe(600 + 600); // 1200
      expect(result.id).toBe('prog1');
    });

    it('should return 0 durations if no intervals provided', () => {
      const partialProgram = {
        id: 'prog2',
        name: 'Empty Program',
        difficulty: 1,
        description: '',
        intervals: [],
      };

      const result = _calculateDurations(partialProgram);
      expect(result.slowDuration).toBe(0);
      expect(result.fastDuration).toBe(0);
    });
  });

  describe('saveProgram', () => {
    it('should write program to file and call loadPrograms to update cache', async () => {
      // Mock readdir to return empty so loadPrograms doesn't fail
      fsReaddirSpy.mockResolvedValue([]);
      
      const newProgram = {
        id: 'new1',
        name: 'New Program',
        difficulty: 2,
        description: 'New',
        intervals: [],
        slowDuration: 0,
        fastDuration: 0,
      };

      await saveProgram(newProgram);

      expect(fsMkdirSpy).toHaveBeenCalledWith(expect.any(String), { recursive: true });
      expect(fsWriteFileSpy).toHaveBeenCalledTimes(1);
      
      const args = fsWriteFileSpy.mock.calls[0];
      expect(args[0]).toContain('program-new1.json');
      expect(args[1]).toBe(JSON.stringify(newProgram, null, 2));

      // Re-reading happens implicitly due to reload cache
      expect(fsReaddirSpy).toHaveBeenCalled();
    });

    it('should skip cache reload when skipReload is true', async () => {
      const newProgram = {
        id: 'new2',
        name: 'New Program 2',
        difficulty: 2,
        description: 'New 2',
        intervals: [],
        slowDuration: 0,
        fastDuration: 0,
      };

      await saveProgram(newProgram, true);

      expect(fsWriteFileSpy).toHaveBeenCalledTimes(1);
      // It won't call readdir because it skips loadPrograms
      expect(fsReaddirSpy).not.toHaveBeenCalled();
    });
  });

  describe('loadPrograms', () => {
    it('should load programs from JSON files', async () => {
      const prog1 = { id: 'p1', name: 'B Prog', intervals: [], slowDuration: 0, fastDuration: 0 };
      const prog2 = { id: 'p2', name: 'A Prog', intervals: [], slowDuration: 0, fastDuration: 0 };

      // Cast as any because fs.Dirent is usually returned, but string is also accepted
      fsReaddirSpy.mockResolvedValue(['program-p1.json', 'program-p2.json', 'other.txt'] as any);
      
      fsReadFileSpy.mockImplementation((filePath) => {
        if (filePath.toString().includes('program-p1.json')) return Promise.resolve(JSON.stringify(prog1));
        if (filePath.toString().includes('program-p2.json')) return Promise.resolve(JSON.stringify(prog2));
        return Promise.resolve('');
      });

      const programs = await loadPrograms();

      expect(programs).toHaveLength(2);
      // It should sort by name: A Prog first
      expect(programs[0].name).toBe('A Prog');
      expect(programs[1].name).toBe('B Prog');
      expect(fsReadFileSpy).toHaveBeenCalledTimes(2);
    });

    it('should return cached programs on subsequent calls without forceRefresh', async () => {
      fsReaddirSpy.mockResolvedValue(['program-1.json'] as any);
      fsReadFileSpy.mockResolvedValue(JSON.stringify({ id: '1', name: 'P1', intervals: [] }));

      const p1 = await loadPrograms();
      expect(fsReaddirSpy).toHaveBeenCalledTimes(1);

      fsReaddirSpy.mockClear();
      fsReadFileSpy.mockClear();

      const p2 = await loadPrograms();
      expect(fsReaddirSpy).not.toHaveBeenCalled();
      expect(p2).toBe(p1); // Same reference
    });

    it('should refresh cache when forceRefresh is true', async () => {
      fsReaddirSpy.mockResolvedValue(['program-1.json'] as any);
      fsReadFileSpy.mockResolvedValue(JSON.stringify({ id: '1', name: 'P1', intervals: [] }));

      await loadPrograms();
      expect(fsReaddirSpy).toHaveBeenCalledTimes(1);
      fsReaddirSpy.mockClear();

      const p2 = await loadPrograms(true);
      expect(fsReaddirSpy).toHaveBeenCalledTimes(1); // Should hit fs again
      expect(p2).toHaveLength(1);
    });

    it('should fallback to programs.yaml if no json files found', async () => {
      fsReaddirSpy.mockResolvedValue([]); // No JSON files

      const yamlData = `
- id: yaml1
  name: Yaml Program
  difficulty: 3
  description: From yaml
  intervals:
    - type: run
      duration: 60
`;
      // When reading programs.yaml, return the yaml string
      fsReadFileSpy.mockImplementation((filePath) => {
        if (filePath.toString().includes('programs.yaml')) {
          return Promise.resolve(yamlData);
        }
        return Promise.reject(new Error('File not found'));
      });

      const programs = await loadPrograms();

      expect(programs).toHaveLength(1);
      expect(programs[0].id).toBe('yaml1');
      expect(programs[0].fastDuration).toBe(60);

      // It should also save the program implicitly
      expect(fsWriteFileSpy).toHaveBeenCalledTimes(1);
      const args = fsWriteFileSpy.mock.calls[0];
      expect(args[0]).toContain('program-yaml1.json');
    });

    it('should handle missing programs.yaml gracefully', async () => {
      fsReaddirSpy.mockResolvedValue([]);
      
      const error = new Error('ENOENT') as any;
      error.code = 'ENOENT';
      fsReadFileSpy.mockRejectedValue(error);

      // suppress console warn during test
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

      const programs = await loadPrograms();

      expect(programs).toEqual([]);
      expect(warnSpy).toHaveBeenCalledWith('programs.yaml not found, starting with no programs.');
      
      warnSpy.mockRestore();
    });
  });
});
