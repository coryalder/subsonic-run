import { FastifyInstance } from 'fastify';
import fs from 'node:fs/promises';
import path from 'node:path';

export default async function runRoutes(fastify: FastifyInstance) {
  // Create Run Page
  fastify.get('/create-run', async (request, reply) => {
    const programs = [
      { id: 'p1', title: 'Beginner 5K', duration: '30m', description: 'Alternating walking and running' },
      { id: 'p2', title: 'Tempo Run', duration: '45m', description: 'Steady pace with intensity intervals' },
      { id: 'p3', title: 'Speed Intervals', duration: '40m', description: 'High-intensity bursts with recovery' },
      { id: 'p4', title: 'Endurance Build', duration: '60m', description: 'Longer blocks of steady running' }
    ];
    return reply.view('createRun.njk', { programs });
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
