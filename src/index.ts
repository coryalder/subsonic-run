import Fastify from 'fastify';
import SubsonicAPI from 'subsonic-api';
import * as av from 'node-av';
import path from 'path';
import { fileURLToPath } from 'url';
import view from '@fastify/view';
import nunjucks from 'nunjucks';
import fastifyStatic from '@fastify/static';
import 'dotenv/config';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const fastify = Fastify({
  logger: true
});

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

// Register Nunjucks
fastify.register(view, {
  engine: {
    nunjucks: nunjucks
  },
  root: path.join(__dirname, 'views'),
});

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
