import Fastify from 'fastify';
import SubsonicAPI from 'subsonic-api';
import * as av from 'node-av';

const fastify = Fastify({
  logger: true
});

// Basic route
fastify.get('/', async (request, reply) => {
  return { hello: 'world', subsonicApiLoaded: !!SubsonicAPI };
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
