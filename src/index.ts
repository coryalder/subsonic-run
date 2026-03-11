import Fastify from 'fastify';
import SubsonicAPI from 'subsonic-api';
import * as av from 'node-av';
import path from 'path';
import { fileURLToPath } from 'url';
import view from '@fastify/view';
import nunjucks from 'nunjucks';
import fastifyStatic from '@fastify/static';
import formbody from '@fastify/formbody';
import 'dotenv/config';
import musicRoutes from './music.js';
import runRoutes from './run.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const fastify = Fastify({
  logger: true
});

fastify.register(formbody);

const subsonic = new SubsonicAPI({
  url: process.env.SUBSONIC_URL || '',
  auth: {
    username: process.env.SUBSONIC_USER || '',
    password: process.env.SUBSONIC_PASS || '',
  }
});

// Register static files (for HTMX)
fastify.register(fastifyStatic, {
  root: path.join(__dirname, '../node_modules/htmx.org/dist'),
  prefix: '/static/',
});

// Register output directory as static for direct playback
fastify.register(fastifyStatic, {
  root: path.join(process.cwd(), 'output'),
  prefix: '/output/',
  decorateReply: false
});

// Register Nunjucks
const env = nunjucks.configure(path.join(__dirname, 'views'), {
  autoescape: true,
  noCache: true // Useful for development
});


fastify.register(view, {
  engine: {
    nunjucks: nunjucks
  },
  options: {
    onConfigure: (env: nunjucks.Environment) => {
      env.addFilter('formatDuration', (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
      });
      env.addFilter('date', (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleString();
      });
      env.addFilter('filterByStatus', (songs: any[], status: string) => {
        return (songs || []).filter(s => s.status === status);
      });
      env.addFilter('sumDurations', (songs: any[]) => {
        return (songs || []).reduce((sum, s) => sum + (s.duration || 0), 0);
      });
      env.addFilter('sumIntervals', (intervals: any[]) => {
        return (intervals || []).reduce((sum, i) => sum + (i.duration || 0), 0);
      });
      env.addFilter('isModified', (run: any) => {
        if (run.status !== 'completed' || !run.updatedAt) return false;
        const stitchTime = run.stitchedAt ? new Date(run.stitchedAt).getTime() : 0;
        return new Date(run.updatedAt).getTime() > stitchTime;
      });
    }
  },
  root: path.join(__dirname, 'views')
});

// Register Music Routes
fastify.register(musicRoutes, { subsonic });

// Register Run Routes
fastify.register(runRoutes, { subsonic });

// Basic route
fastify.get('/', async (request, reply) => {
  let status = 'Connecting...';
  let connected = false;
  try {
    const response = await subsonic.ping();
    if (response.status === 'ok') {
      status = `Connected to Subsonic (${process.env.SUBSONIC_URL})`;
      connected = true;
    } else {
      status = `Error: ${response.status}`;
    }
  } catch (err) {
    status = 'Connection failed';
  }
  return reply.view('index.njk', { status, connected });
});

// HTMX route
fastify.get('/clicked', async (request, reply) => {
  return '<p>HTMX content loaded successfully!</p>';
});

const start = async () => {
  try {
    await fastify.listen({ port: 3000, host: '0.0.0.0' });
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
