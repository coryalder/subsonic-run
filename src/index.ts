import Fastify from 'fastify';
import SubsonicAPI from 'subsonic-api';
import * as av from 'node-av';
import path from 'path';
import { fileURLToPath } from 'url';
import view from '@fastify/view';
import nunjucks from 'nunjucks';
import fastifyStatic from '@fastify/static';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const fastify = Fastify({
  logger: true
});

// Register static files (for HTMX)
fastify.register(fastifyStatic, {
  root: path.join(__dirname, '../node_modules/htmx.org/dist'),
  prefix: '/static/',
});

// Register Nunjucks
fastify.register(view, {
  engine: {
    nunjucks: nunjucks
  },
  root: path.join(__dirname, 'views'),
});

// Basic route
fastify.get('/', async (request, reply) => {
  return reply.view('index.njk');
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
