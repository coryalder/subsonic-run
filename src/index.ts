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
import { musicRoutes, subSonicPing} from './music.js';
import runRoutes from './run.js';
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

// Explorer route
fastify.get('/explorer', async (request, reply) => {
  let { status, connected } = await subSonicPing(subsonic);
  return reply.view('index.njk', { status, connected });
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
