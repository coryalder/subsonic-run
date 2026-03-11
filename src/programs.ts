import fs from 'node:fs/promises';
import path from 'node:path';
import yaml from 'js-yaml';
import { Program } from './types.js';

const PROGRAMS_DIR = path.join(process.cwd(), 'data', 'programs');
const PROGRAMS_YAML_PATH = path.join(process.cwd(), 'programs.yaml');

/**
 * Helper function to calculate slowDuration and fastDuration for a program.
 * It also ensures program.id is a string, as it might be missing or number from YAML.
 */
function _calculateDurations(program: Omit<Program, 'slowDuration' | 'fastDuration'>): Program {
  const slowDuration = program.intervals
    .filter(i => ['walk', 'warmup', 'cooldown'].includes(i.type))
    .reduce((sum, i) => sum + i.duration, 0);
  const fastDuration = program.intervals
    .filter(i => i.type === 'run')
    .reduce((sum, i) => sum + i.duration, 0);

  return {
    ...program,
    slowDuration,
    fastDuration,
  };
}

/**
 * Checks if any program JSON files exist in the data directory.
 */
async function programExistsInDataDir(): Promise<boolean> {
  try {
    await fs.mkdir(PROGRAMS_DIR, { recursive: true });
    const files = await fs.readdir(PROGRAMS_DIR);
    return files.some(f => f.startsWith('program-') && f.endsWith('.json'));
  } catch (error) {
    console.error('Error checking data directory for programs:', error);
    return false;
  }
}

export async function saveProgram(program: Omit<Program, 'slowDuration' | 'fastDuration'> | Program): Promise<void> {
  await fs.mkdir(PROGRAMS_DIR, { recursive: true });
  
  const programWithDurations = ('slowDuration' in program && 'fastDuration' in program) 
    ? program 
    : _calculateDurations(program);

  const filePath = path.join(PROGRAMS_DIR, `program-${programWithDurations.id}.json`);
  await fs.writeFile(filePath, JSON.stringify(programWithDurations, null, 2));
}

export async function loadPrograms(): Promise<Program[]> {
  await fs.mkdir(PROGRAMS_DIR, { recursive: true });
  let programs: Program[] = [];

  if (await programExistsInDataDir()) {
    // Load from JSON files in data directory
    const files = await fs.readdir(PROGRAMS_DIR);
    const programFiles = files.filter(f => f.startsWith('program-') && f.endsWith('.json'));

    const programPromises = programFiles.map(async (file) => {
      const content = await fs.readFile(path.join(PROGRAMS_DIR, file), 'utf-8');
      const programData = JSON.parse(content) as Program;
      return _calculateDurations(programData); // Recalculate for robustness
    });
    programs = await Promise.all(programPromises);
  } else {
    // Populate from programs.yaml if no programs found in data directory
    try {
      console.log("copying programs from programs.yaml to data directory...");
      const content = await fs.readFile(PROGRAMS_YAML_PATH, 'utf8');
      const programsFromYaml = yaml.load(content) as Omit<Program, 'slowDuration' | 'fastDuration'>[];

      if (programsFromYaml && programsFromYaml.length > 0) {
        for (const program of programsFromYaml) {
          const fullProgram = _calculateDurations(program);
          await saveProgram(fullProgram); // Save to JSON file
          programs.push(fullProgram);
        }
      }
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        console.warn('programs.yaml not found, starting with no programs.');
      } else {
        console.error('Error loading programs from programs.yaml:', error);
      }
    }
  }
  
  // Sort programs by name for consistent display
  programs.sort((a, b) => a.name.localeCompare(b.name));
  return programs;
}
