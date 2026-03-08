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
    }
  },
  root: path.join(__dirname, 'views')
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

// Artists fragment
fastify.get('/artists', async (request, reply) => {
  const artistsResponse = await subsonic.getArtists();
  let artists: any[] = [];
  if (artistsResponse.status === 'ok' && artistsResponse.artists?.index) {
    artists = artistsResponse.artists.index.flatMap(i => i.artist);
  }
  return reply.view('artists.njk', { artists, currentView: 'artists' });
});

// Artist detail (albums)
fastify.get('/artist/:id', async (request, reply) => {
  const { id } = request.params as { id: string };
  const response = await subsonic.getArtist({ id });
  let artist = null;
  let albums: any[] = [];
  if (response.status === 'ok') {
    artist = response.artist;
    albums = response.artist.album || [];
  }
  return reply.view('albums.njk', { artist, albums, currentView: 'artists' });
});

// Albums list (general)
fastify.get('/albums', async (request, reply) => {
  const response = await subsonic.getAlbumList({ type: 'newest', size: 50 });
  let albums: any[] = [];
  if (response.status === 'ok' && response.albumList?.album) {
    albums = response.albumList.album;
  }
  return reply.view('albums.njk', { albums, title: 'Newest Albums', currentView: 'albums' });
});

// Album detail (songs)
fastify.get('/album/:id', async (request, reply) => {
  const { id } = request.params as { id: string };
  const response = await subsonic.getAlbum({ id });
  let album = null;
  let songs: any[] = [];
  if (response.status === 'ok') {
    album = response.album;
    songs = response.album.song || [];
  }
  return reply.view('songs.njk', { album, songs, currentView: 'albums' });
});

// Playlists list
fastify.get('/playlists', async (request, reply) => {
  const response = await subsonic.getPlaylists();
  let playlists: any[] = [];
  if (response.status === 'ok' && response.playlists.playlist) {
    playlists = response.playlists.playlist;
  }
  return reply.view('playlists.njk', { playlists, currentView: 'playlists' });
});

// Playlist detail (songs)
fastify.get('/playlist/:id', async (request, reply) => {
  const { id } = request.params as { id: string };
  const response = await subsonic.getPlaylist({ id });
  let playlist = null;
  let songs: any[] = [];
  if (response.status === 'ok') {
    playlist = response.playlist;
    songs = response.playlist.entry || [];
  }
  return reply.view('songs.njk', { playlist, songs, currentView: 'playlists' });
});

// Search functionality
fastify.get('/search', async (request, reply) => {
  const { query } = request.query as { query: string };
  if (!query) {
    // If query is empty, return to artists or just show empty result
    return reply.view('artists.njk', { artists: [], currentView: 'artists' });
  }

  const response = await subsonic.search3({ query });
  let artists: any[] = [];
  let albums: any[] = [];
  let songs: any[] = [];

  if (response.status === 'ok' && response.searchResult3) {
    artists = response.searchResult3.artist || [];
    albums = response.searchResult3.album || [];
    songs = response.searchResult3.song || [];
  }

  return reply.view('search.njk', { artists, albums, songs, query });
});

// HTMX route
fastify.get('/clicked', async (request, reply) => {
  return '<p>HTMX content loaded successfully!</p>';
});

// Artwork proxy route
fastify.get('/artwork/:id', async (request, reply) => {
  const { id } = request.params as { id: string };
  try {
    const response = await subsonic.getCoverArt({ id });
    
    if (!response.ok) {
      return reply.status(response.status).send('Failed to fetch artwork');
    }

    const contentType = response.headers.get('content-type') || 'image/jpeg';
    const buffer = await response.arrayBuffer();
    
    return reply.type(contentType).send(Buffer.from(buffer));
  } catch (err) {
    fastify.log.error(err);
    return reply.status(500).send('Internal Server Error');
  }
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
