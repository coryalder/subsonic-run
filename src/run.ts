import { FastifyInstance } from 'fastify';
import fs from 'node:fs/promises';
import path from 'node:path';
import yaml from 'js-yaml';

async function loadPrograms() {
  const filePath = path.join(process.cwd(), 'programs.yaml');
  const content = await fs.readFile(filePath, 'utf8');
  return yaml.load(content) as any[];
}

export default async function runRoutes(fastify: FastifyInstance) {
  // Create Run Page
  fastify.get('/create-run', async (request, reply) => {
    const programs = await loadPrograms();
    return reply.view('create-run.njk', { programs });
  });

  // View Runs Page
  fastify.get('/runs', async (request, reply) => {
    const dataDir = path.join(process.cwd(), 'data');
    let runs: any[] = [];
    
    try {
      await fs.mkdir(dataDir, { recursive: true });
      const files = await fs.readdir(dataDir);
      const jsonFiles = files.filter(f => f.endsWith('.json') && f.startsWith('run-'));
      
      const runPromises = jsonFiles.map(async (file) => {
        const content = await fs.readFile(path.join(dataDir, file), 'utf-8');
        return { ...JSON.parse(content), id: file.replace('.json', '') };
      });
      
      runs = await Promise.all(runPromises);
      // Sort by start time descending
      runs.sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
    } catch (err) {
      fastify.log.error(err);
    }
    
    return reply.view('runs.njk', { runs });
  });

  // Run Details Page
  fastify.get('/run/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const dataDir = path.join(process.cwd(), 'data');
    const filePath = path.join(dataDir, `${id}.json`);

    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const run = JSON.parse(content);
      
      // Load program details
      const programs = await loadPrograms();
      const program = programs.find(p => p.id === run.programId);
      
      return reply.view('run-detail.njk', { 
        run: { ...run, id, program } 
      });
    } catch (err) {
      fastify.log.error(err);
      return reply.status(404).send('Run not found');
    }
  });

  // Start Run Handler
  fastify.post('/start-run', async (request, reply) => {
    const { name, programId } = request.body as { name: string, programId: string };
    
    const runData = {
      name,
      programId,
      startTime: new Date().toISOString()
    };

    const dataDir = path.join(process.cwd(), 'data');
    const fileName = `run-${Date.now()}.json`;
    const filePath = path.join(dataDir, fileName);

    try {
      await fs.mkdir(dataDir, { recursive: true });
      await fs.writeFile(filePath, JSON.stringify(runData, null, 2));
    } catch (err) {
      fastify.log.error(err);
      return reply.status(500).send('Failed to save run data');
    }

    // Set HX-Redirect header for HTMX to handle the redirect
    reply.header('HX-Redirect', '/runs');
    return reply.status(204).send();
  });
}
