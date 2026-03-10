import { FastifyInstance } from 'fastify';
import fs from 'node:fs/promises';
import path from 'node:path';
import SubsonicAPI from 'subsonic-api';
import { Program, Run } from './types.js';
import { processRun } from './processor.js';
import { loadPrograms } from './programs.js';

export default async function runRoutes(fastify: FastifyInstance, options: { subsonic: SubsonicAPI }) {
  const { subsonic } = options;

  // Create Run Page
  fastify.get('/create-run', async (request, reply) => {
    const programs = await loadPrograms();
    return reply.view('create-run.njk', { programs });
  });

  // View Runs Page
  fastify.get('/runs', async (request, reply) => {
    const dataDir = path.join(process.cwd(), 'data');
    let runs: Run[] = [];
    
    try {
      await fs.mkdir(dataDir, { recursive: true });
      const files = await fs.readdir(dataDir);
      const jsonFiles = files.filter(f => f.endsWith('.json') && f.startsWith('run-'));
      
      const runPromises = jsonFiles.map(async (file) => {
        const content = await fs.readFile(path.join(dataDir, file), 'utf-8');
        const data = JSON.parse(content) as Run;
        return { ...data, id: file.replace('.json', '') };
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
      const run = JSON.parse(content) as Run;
      
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
    const { name, programId, songIds, songStatuses, songTitles, songArtists, songDurations, songBpms } = request.body as { 
      name: string, 
      programId: string, 
      songIds?: string | string[],
      songStatuses?: string | string[],
      songTitles?: string | string[],
      songArtists?: string | string[],
      songDurations?: string | string[],
      songBpms?: string | string[]
    };
    
    // Ensure all are arrays
    const ids = Array.isArray(songIds) ? songIds : (songIds ? [songIds] : []);
    const statuses = Array.isArray(songStatuses) ? songStatuses : (songStatuses ? [songStatuses] : []);
    const titles = Array.isArray(songTitles) ? songTitles : (songTitles ? [songTitles] : []);
    const artists = Array.isArray(songArtists) ? songArtists : (songArtists ? [songArtists] : []);
    const durations = Array.isArray(songDurations) ? songDurations : (songDurations ? [songDurations] : []);
    const bpms = Array.isArray(songBpms) ? songBpms : (songBpms ? [songBpms] : []);

    const songs = ids.map((id, i) => ({
      id,
      status: (statuses[i] || 'slow') as 'fast' | 'slow',
      title: titles[i],
      artist: artists[i],
      duration: parseInt(durations[i] as string) || 0,
      bpm: parseInt(bpms[i] as string) || 0
    }));

    const runData: Run = {
      name,
      programId,
      startTime: new Date().toISOString(),
      songs,
      status: 'pending'
    };

    const dataDir = path.join(process.cwd(), 'data');
    const runId = `run-${Date.now()}`;
    const fileName = `${runId}.json`;
    const filePath = path.join(dataDir, fileName);

    try {
      await fs.mkdir(dataDir, { recursive: true });
      await fs.writeFile(filePath, JSON.stringify(runData, null, 2));
      
      // Trigger background processing (no await)
      processRun(runId, subsonic).catch(err => {
        fastify.log.error(`Background processing failed for ${runId}:`, err);
      });
    } catch (err) {
      fastify.log.error(err);
      return reply.status(500).send('Failed to save run data');
    }

    // Set HX-Redirect header for HTMX to handle the redirect
    reply.header('HX-Redirect', '/runs');
    return reply.status(204).send();
  });

  // Regenerate Run Handler
  fastify.post('/run/:id/regenerate', async (request, reply) => {
    const { id } = request.params as { id: string };

    try {
      // Trigger background processing (no await)
      processRun(id, subsonic).catch(err => {
        fastify.log.error(`Background processing failed for ${id}:`, err);
      });
    } catch (err) {
      fastify.log.error(err);
      return reply.status(500).send('Failed to start regeneration');
    }

    // Set HX-Redirect header for HTMX to handle the redirect
    reply.header('HX-Redirect', `/run/${id}`);
    return reply.status(204).send();
  });

  // Run Status fragment (for HTMX refresh)
  fastify.get('/run/:id/status', async (request, reply) => {
    const { id } = request.params as { id: string };
    const dataDir = path.join(process.cwd(), 'data');
    const filePath = path.join(dataDir, `${id}.json`);

    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const run = JSON.parse(content) as Run;
      return reply.view('_run-status.njk', { run: { ...run, id } });
    } catch (err) {
      fastify.log.error(err);
      return reply.status(500).send('Error fetching status');
    }
  });

}
