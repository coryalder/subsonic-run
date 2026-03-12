import Fastify from 'fastify';
import SubsonicAPI from 'subsonic-api';
import path from 'path';
import { fileURLToPath } from 'url';
import view from '@fastify/view';
import nunjucks from 'nunjucks';
import fastifyStatic from '@fastify/static';
import formbody from '@fastify/formbody';
import 'dotenv/config';
import { musicRoutes, subSonicPing} from './music.js';
import runRoutes from './run.js';
import { programRoutes, loadPrograms } from './programs.js';
import { AddCustomFilters } from './filters.js';

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

// Register public directory for custom scripts
fastify.register(fastifyStatic, {
  root: path.join(process.cwd(), 'public'),
  prefix: '/public/',
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
    onConfigure: AddCustomFilters
  },
  root: path.join(__dirname, 'views')
});

// Register Music Routes
fastify.register(musicRoutes, { subsonic });

// Register Run Routes
fastify.register(runRoutes, { subsonic });

// Register Program Routes
fastify.register(programRoutes);

// Explorer route
fastify.get('/explorer', async (request, reply) => {
  let { status, connected } = await subSonicPing(subsonic);
  return reply.view('index.njk', { status, connected });
});

// About route
fastify.get('/about', async (request, reply) => {
  const config = {
    musicLibraryPath: process.env.MUSIC_LIBRARY_PATH || 'Not set',
    subsonicUrl: process.env.SUBSONIC_URL || 'Not set',
    subsonicUser: process.env.SUBSONIC_USER || 'Not set',
  };
  return reply.view('about.njk', { config });
});

const start = async () => {
  try {
    await loadPrograms(); // Initial load to cache programs in memory
    await fastify.listen({ port: 3000, host: '0.0.0.0' });
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
