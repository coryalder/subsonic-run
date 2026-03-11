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
      updatedAt: new Date().toISOString(),
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
      const dataDir = path.join(process.cwd(), 'data');
      const filePath = path.join(dataDir, `${id}.json`);
      const content = await fs.readFile(filePath, 'utf-8');
      const run = JSON.parse(content) as Run;
      
      run.status = 'pending';
      await fs.writeFile(filePath, JSON.stringify(run, null, 2));

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

  // Send to Subsonic (Copy to Library + Scan)
  fastify.post('/run/:id/send-to-subsonic', async (request, reply) => {
    const { id } = request.params as { id: string };
    const targetDir = process.env.MUSIC_LIBRARY_PATH;

    if (!targetDir) {
      fastify.log.error('MUSIC_LIBRARY_PATH environment variable is not set');
      return reply.status(500).send({ error: 'Server configuration error: MUSIC_LIBRARY_PATH not set' });
    }

    const dataDir = path.join(process.cwd(), 'data');
    const runFilePath = path.join(dataDir, `${id}.json`);
    const sourceFilePath = path.join(process.cwd(), 'output', `${id}.mp3`);

    try {
      const content = await fs.readFile(runFilePath, 'utf-8');
      const run = JSON.parse(content) as Run;

      if (run.status !== 'completed' || !run.outputPath) {
        return reply.status(400).send({ error: 'Run is not completed yet' });
      }

      // Ensure target directory exists
      await fs.mkdir(targetDir, { recursive: true });

      // Copy file to target directory
      const fileName = `${run.name.replace(/[/\\?%*:|"<>]/g, '-')}_${id}.mp3`;
      const destinationPath = path.join(targetDir, fileName);
      
      await fs.copyFile(sourceFilePath, destinationPath);
      fastify.log.info(`Copied run ${id} to ${destinationPath}`);

      // Trigger Subsonic Scan
      const scanResponse = await subsonic.startScan();
      if (scanResponse.status === 'ok') {
        return reply.status(200).send({ success: true });
      } else {
        fastify.log.error({ scanResponse }, 'Subsonic scan failed');
        return reply.status(200).send({ success: true, warning: 'File copied but scan trigger failed' });
      }

    } catch (err) {
      fastify.log.error(err);
      return reply.status(500).send({ error: 'Failed to send to music library' });
    }
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

  // Update Run Title
  fastify.post('/run/:id/update-title', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { name } = request.body as { name?: string };
    const dataDir = path.join(process.cwd(), 'data');
    const filePath = path.join(dataDir, `${id}.json`);

    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const run = JSON.parse(content) as Run;
      
      if (name !== undefined && name.trim() !== '') {
        run.name = name.trim();
        run.updatedAt = new Date().toISOString();
        await fs.writeFile(filePath, JSON.stringify(run, null, 2));
      }

      const programs = await loadPrograms();
      run.program = programs.find(p => p.id === run.programId);

      const template = request.headers['hx-request'] ? '_run-detail.njk' : 'run-detail.njk';
      return reply.view(template, { run: { ...run, id } });
    } catch (err) {
      fastify.log.error(err);
      return reply.status(500).send('Error updating title');
    }
  });

  // Reorder Songs
  fastify.post('/run/:id/reorder-songs', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { direction, index } = request.body as { direction: 'up' | 'down', index: number };
    const dataDir = path.join(process.cwd(), 'data');
    const filePath = path.join(dataDir, `${id}.json`);

    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const run = JSON.parse(content) as Run;
      if (!run.songs) return reply.status(400).send('No songs to reorder');

      const i = Number(index);
      const status = run.songs[i].status;
      
      let targetIndex = -1;
      if (direction === 'up') {
        for (let j = i - 1; j >= 0; j--) {
          if (run.songs[j].status === status) {
            targetIndex = j;
            break;
          }
        }
      } else if (direction === 'down') {
        for (let j = i + 1; j < run.songs.length; j++) {
          if (run.songs[j].status === status) {
            targetIndex = j;
            break;
          }
        }
      }

      if (targetIndex !== -1) {
        [run.songs[i], run.songs[targetIndex]] = [run.songs[targetIndex], run.songs[i]];
      }

      run.updatedAt = new Date().toISOString();
      await fs.writeFile(filePath, JSON.stringify(run, null, 2));
      
      const programs = await loadPrograms();
      run.program = programs.find(p => p.id === run.programId);
      
      const template = request.headers['hx-request'] ? '_run-detail.njk' : 'run-detail.njk';
      return reply.view(template, { run: { ...run, id } });
    } catch (err) {
      fastify.log.error(err);
      return reply.status(500).send('Error reordering songs');
    }
  });

  // Toggle Song Status
  fastify.post('/run/:id/toggle-song-status', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { index } = request.body as { index: number };
    const dataDir = path.join(process.cwd(), 'data');
    const filePath = path.join(dataDir, `${id}.json`);

    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const run = JSON.parse(content) as Run;
      if (!run.songs) return reply.status(400).send('No songs to toggle');

      const i = Number(index);
      run.songs[i].status = run.songs[i].status === 'fast' ? 'slow' : 'fast';

      run.updatedAt = new Date().toISOString();
      await fs.writeFile(filePath, JSON.stringify(run, null, 2));
      
      const programs = await loadPrograms();
      run.program = programs.find(p => p.id === run.programId);
      
      const template = request.headers['hx-request'] ? '_run-detail.njk' : 'run-detail.njk';
      return reply.view(template, { run: { ...run, id } });
    } catch (err) {
      fastify.log.error(err);
      return reply.status(500).send('Error toggling song status');
    }
  });

}
