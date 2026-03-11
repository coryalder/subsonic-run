
import { jest } from '@jest/globals';
import yaml from 'js-yaml';

// Mocks for fs and path modules - defined globally
const mockReadFile = jest.fn();
const mockWriteFile = jest.fn();
const mockPathJoin = jest.fn();

let loadPrograms: any;
let saveProgram: any;

describe('programs', () => {
  beforeEach(async () => {
    // Reset module registry to ensure fresh imports
    jest.resetModules();

    // Explicitly mock node:fs/promises and node:path using jest.doMock
    jest.doMock('node:fs/promises', () => ({
      readFile: mockReadFile,
      writeFile: mockWriteFile,
    }));

    jest.doMock('node:path', () => ({
      join: mockPathJoin,
    }));

    // Dynamically import the module under test AFTER mocks are set
    const programsModule = await import('../src/programs');
    loadPrograms = programsModule.loadPrograms;
    saveProgram = programsModule.saveProgram;

    // Reset mocks for each test
    mockReadFile.mockReset();
    mockWriteFile.mockReset();
    mockPathJoin.mockReset();

    // Default mock implementation for path.join
    mockPathJoin.mockImplementation((...args: string[]) => args.join('/'));
  });

  describe('loadPrograms', () => {
    it('should correctly load programs and calculate durations', async () => {
      const mockProgramsYaml = `
- name: Test Program 1
  description: A short test program
  intervals:
    - type: warmup
      duration: 60
    - type: run
      duration: 300
    - type: walk
      duration: 120
    - type: cooldown
      duration: 60
- name: Test Program 2
  description: Another test program
  intervals:
    - type: warmup
      duration: 30
    - type: run
      duration: 180
    - type: run
      duration: 180
    - type: cooldown
      duration: 30
`;

      mockReadFile.mockResolvedValueOnce(mockProgramsYaml);

      const programs = await loadPrograms();

      expect(programs).toHaveLength(2);

      // Verify Test Program 1
      expect(programs[0].name).toBe('Test Program 1');
      expect(programs[0].description).toBe('A short test program');
      expect(programs[0].intervals).toHaveLength(4);
      expect(programs[0].slowDuration).toBe(240); // warmup 60 + walk 120 + cooldown 60
      expect(programs[0].fastDuration).toBe(300); // run 300

      // Verify Test Program 2
      expect(programs[1].name).toBe('Test Program 2');
      expect(programs[1].description).toBe('Another test program');
      expect(programs[1].intervals).toHaveLength(4);
      expect(programs[1].slowDuration).toBe(60); // warmup 30 + cooldown 30
      expect(programs[1].fastDuration).toBe(360); // run 180 + run 180

      expect(mockPathJoin).toHaveBeenCalledWith(process.cwd(), 'programs.yaml');
      expect(mockReadFile).toHaveBeenCalledWith('/mock/path/programs.yaml', 'utf8');
    });

    it('should return an empty array if programs.yaml is empty', async () => {
      const mockEmptyProgramsYaml = ``;

      mockReadFile.mockResolvedValueOnce(mockEmptyProgramsYaml);

      const programs = await loadPrograms();

      expect(programs).toEqual([]);
      expect(mockPathJoin).toHaveBeenCalledWith(process.cwd(), 'programs.yaml');
      expect(mockReadFile).toHaveBeenCalledWith('/mock/path/programs.yaml', 'utf8');
    });

    it('should handle invalid YAML content', async () => {
      const mockInvalidProgramsYaml = `
- name: Test Program 1
  description: A short test program
  intervals:
    - type: warmup
      duration: 60
    - type: run
      duration: 300
    - type: walk
      duration: 120
    - type: cooldown
      duration: 60
  invalid_key:
    - this is not valid yaml
`;

      mockReadFile.mockResolvedValueOnce(mockInvalidProgramsYaml);

      await expect(loadPrograms()).rejects.toThrow(yaml.YAMLException);
      expect(mockPathJoin).toHaveBeenCalledWith(process.cwd(), 'programs.yaml');
      expect(mockReadFile).toHaveBeenCalledWith('/mock/path/programs.yaml', 'utf8');
    });
  });

  describe('saveProgram', () => {
    it('should save a new program to programs.yaml', async () => {
      const initialProgramsYaml = `
- name: Existing Program
  description: An existing program
  intervals:
    - type: warmup
      duration: 60
`;
      const newProgram = {
        id: 'new-program-id',
        name: 'New Program',
        description: 'A newly added program',
        difficulty: 1,
        intervals: [
          { type: 'warmup', duration: 30 },
          { type: 'run', duration: 100 },
        ],
      };
      const expectedProgramsYaml = `---
- name: Existing Program
  description: An existing program
  intervals:
    - type: warmup
      duration: 60
- id: new-program-id
  name: New Program
  description: A newly added program
  difficulty: 1
  intervals:
    - type: warmup
      duration: 30
    - type: run
      duration: 100
`;

      mockReadFile.mockResolvedValueOnce(initialProgramsYaml);
      mockWriteFile.mockResolvedValueOnce(undefined);

      await saveProgram(newProgram);

      expect(mockPathJoin).toHaveBeenCalledWith(process.cwd(), 'programs.yaml');
      expect(mockReadFile).toHaveBeenCalledWith('/mock/path/programs.yaml', 'utf8');
      expect(mockWriteFile).toHaveBeenCalledWith('/mock/path/programs.yaml', expectedProgramsYaml);
    });
  });
});
