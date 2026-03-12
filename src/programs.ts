import { FastifyInstance } from 'fastify';
import fs from 'node:fs/promises';
import path from 'node:path';
import yaml from 'js-yaml';
import { Program, IntervalType, IntervalIsSlow } from './types.js';

const PROGRAMS_DIR = path.join(process.cwd(), 'data', 'programs');
const PROGRAMS_YAML_PATH = path.join(process.cwd(), 'programs.yaml');

/**
 * Helper function to calculate slowDuration and fastDuration for a program.
 * It also ensures program.id is a string, as it might be missing or number from YAML.
 */
function _calculateDurations(program: Omit<Program, 'slowDuration' | 'fastDuration'>): Program {
  const slowDuration = program.intervals
    .filter(IntervalIsSlow)
    .reduce((sum, i) => sum + i.duration, 0);
  const fastDuration = program.intervals
    .filter(i => i.type === IntervalType.RUN)
    .reduce((sum, i) => sum + i.duration, 0);

  return {
    ...program,
    slowDuration,
    fastDuration,
  };
}

async function initializePrograms() {
  let programs: Program[] = [];
  // Populate from programs.yaml if no programs found in data directory
  try {
    console.log("copying programs from programs.yaml to data directory...");
    const content = await fs.readFile(PROGRAMS_YAML_PATH, 'utf8');
    const programsFromYaml = yaml.load(content) as Omit<Program, 'slowDuration' | 'fastDuration'>[];

    if (programsFromYaml && programsFromYaml.length > 0) {
      for (const program of programsFromYaml) {
        const fullProgram = _calculateDurations(program);
        await saveProgram(fullProgram, true); // Save to JSON file
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

  return programs;
}

let cachedPrograms: Program[] | null = null;

export async function loadPrograms(forceRefresh = false): Promise<Program[]> {
  if (cachedPrograms && !forceRefresh) {
    return cachedPrograms;
  }

  await fs.mkdir(PROGRAMS_DIR, { recursive: true });

  // Load from JSON files in data directory
  const files = await fs.readdir(PROGRAMS_DIR);
  const programFiles = files.filter(f => f.startsWith('program-') && f.endsWith('.json'));

  const programPromises = programFiles.map(async (file) => {
    const content = await fs.readFile(path.join(PROGRAMS_DIR, file), 'utf-8');
    const programData = JSON.parse(content) as Program;
    return _calculateDurations(programData); // Recalculate for robustness
  });

  let programs: Program[] = await Promise.all(programPromises);

  if (programs.length === 0) {
    programs = await initializePrograms();
  }
  
  // Sort programs by name for consistent display
  programs.sort((a, b) => a.name.localeCompare(b.name));
  cachedPrograms = programs;
  return programs;
}

export async function saveProgram(program: Omit<Program, 'slowDuration' | 'fastDuration'> | Program, skipReload = false): Promise<void> {
  await fs.mkdir(PROGRAMS_DIR, { recursive: true });
  const file = path.join(PROGRAMS_DIR, 'program-' + program.id + '.json');
  const content = JSON.stringify(program, null, 2);
  await fs.writeFile(file, content);

  if (!skipReload) {
    await loadPrograms(true);
  }
}

export async function programRoutes(fastify: FastifyInstance) {
  // Run Programs Page
  fastify.get('/programs', async (request, reply) => {
    const programs = await loadPrograms();
    return reply.view('programs.njk', { programs });
  });

  // Create Program Page
  fastify.get('/create-program', async (request, reply) => {
    return reply.view('create-program.njk');
  });

  // Handle Create Program Submission
  fastify.post('/create-program', async (request, reply) => {
    const { id, name, difficulty, description, types, durations } = request.body as {
      id: string;
      name: string;
      difficulty: string;
      description: string;
      types: string | string[];
      durations: string | string[];
    };

    const typesArray = Array.isArray(types) ? types : (types ? [types] : []);
    const durationsArray = Array.isArray(durations) ? durations : (durations ? [durations] : []);

    const intervals = typesArray.map((type, index) => ({
      type: type as IntervalType,
      duration: parseInt(durationsArray[index]),
    }));

    const newProgram: Omit<Program, 'slowDuration' | 'fastDuration'> = {
      id,
      name,
      difficulty: parseInt(difficulty),
      description,
      intervals,
    };

    try {
      await saveProgram(newProgram);
      reply.header('HX-Redirect', '/programs');
      return reply.status(204).send();
    } catch (err) {
      fastify.log.error(err);
      return reply.status(500).send('Failed to create program');
    }
  });
}
