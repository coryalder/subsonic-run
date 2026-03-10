import { FastifyInstance } from 'fastify';
import SubsonicAPI from 'subsonic-api';
import { getCached, getCachedDisk } from './cache.js';

export default async function musicRoutes(fastify: FastifyInstance, options: { subsonic: SubsonicAPI }) {
  const { subsonic } = options;

  // Artists fragment
  fastify.get('/artists', async (request, reply) => {
    const { offset = 0, size = 12 } = request.query as { offset?: number, size?: number };
    
    const artists = await getCached('all_artists', async () => {
      const response = await subsonic.getArtists();
      if (response.status === 'ok' && response.artists?.index) {
        return response.artists.index.flatMap((i: any) => i.artist);
      }
      return [];
    });
    
    const paginatedArtists = artists.slice(Number(offset), Number(offset) + Number(size));
    const nextOffset = Number(offset) + Number(size);
    const prevOffset = Math.max(0, Number(offset) - Number(size));
    const hasMore = nextOffset < artists.length;
    const hasPrev = Number(offset) > 0;

    return reply.view('artists.njk', { 
      artists: paginatedArtists, 
      nextOffset, 
      prevOffset,
      hasMore, 
      hasPrev,
      currentView: 'artists' 
    });
  });

  // Artist detail (albums)
  fastify.get('/artist/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const data = await getCached(`artist_${id}`, () => subsonic.getArtist({ id }));
    let artist = null;
    let albums: any[] = [];
    if (data.status === 'ok') {
      artist = data.artist;
      albums = data.artist.album || [];
    }
    return reply.view('albums.njk', { artist, albums, currentView: 'artists' });
  });

  // Albums list (general)
  fastify.get('/albums', async (request, reply) => {
    const { offset = 0, size = 12 } = request.query as { offset?: number, size?: number };
    const response = await getCached(`album_list_${offset}_${size}`, () => 
      subsonic.getAlbumList({ type: 'newest', size: Number(size), offset: Number(offset) })
    );
    let albums: any[] = [];
    if (response.status === 'ok' && response.albumList?.album) {
      albums = response.albumList.album;
    }

    const nextOffset = Number(offset) + Number(size);
    const prevOffset = Math.max(0, Number(offset) - Number(size));
    const hasMore = albums.length === Number(size);
    const hasPrev = Number(offset) > 0;

    return reply.view('albums.njk', { 
      albums, 
      nextOffset, 
      prevOffset,
      hasMore, 
      hasPrev,
      title: 'Newest Albums', 
      currentView: 'albums' 
    });
  });

  // Album detail (songs)
  fastify.get('/album/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const data = await getCached(`album_${id}`, () => subsonic.getAlbum({ id }));
    let album = null;
    let songs: any[] = [];
    if (data.status === 'ok') {
      album = data.album;
      songs = data.album.song || [];
    }
    return reply.view('songs.njk', { album, songs, currentView: 'albums' });
  });

  // Playlists list
  fastify.get('/playlists', async (request, reply) => {
    const response = await getCached('playlists', () => subsonic.getPlaylists());
    let playlists: any[] = [];
    if (response.status === 'ok' && response.playlists.playlist) {
      playlists = response.playlists.playlist;
    }
    return reply.view('playlists.njk', { playlists, currentView: 'playlists' });
  });

  // Playlist detail (songs)
  fastify.get('/playlist/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const data = await getCached(`playlist_${id}`, () => subsonic.getPlaylist({ id }));
    let playlist = null;
    let songs: any[] = [];
    if (data.status === 'ok') {
      playlist = data.playlist;
      songs = data.playlist.entry || [];
    }
    return reply.view('songs.njk', { playlist, songs, currentView: 'playlists' });
  });

  // Search functionality
  fastify.get('/search', async (request, reply) => {
    const { query } = request.query as { query: string };
    if (!query) {
      return reply.view('artists.njk', { artists: [], currentView: 'artists' });
    }

    const [searchResponse, playlistsResponse] = await Promise.all([
      subsonic.search3({ query }),
      subsonic.getPlaylists()
    ]);

    let artists: any[] = [];
    let albums: any[] = [];
    let songs: any[] = [];
    let playlists: any[] = [];

    if (searchResponse.status === 'ok' && searchResponse.searchResult3) {
      artists = searchResponse.searchResult3.artist || [];
      albums = searchResponse.searchResult3.album || [];
      songs = searchResponse.searchResult3.song || [];
    }

    if (playlistsResponse.status === 'ok' && playlistsResponse.playlists?.playlist) {
      const lowerQuery = query.toLowerCase();
      playlists = playlistsResponse.playlists.playlist.filter((p: any) => 
        p.name.toLowerCase().includes(lowerQuery)
      );
    }

    return reply.view('search.njk', { artists, albums, songs, playlists, query });
  });

  // Artwork proxy route
  fastify.get('/artwork/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    
    const cacheKey = `artwork_${id}`;
    const cached = await getCachedDisk(cacheKey, async () => {
      try {
        const response = await subsonic.getCoverArt({ id });
        if (!response.ok) return null;

        const contentType = response.headers.get('content-type') || 'image/jpeg';
        const buffer = await response.arrayBuffer();
        return {
          contentType,
          data: Buffer.from(buffer).toString('base64')
        };
      } catch (err) {
        fastify.log.error(err);
        return null;
      }
    });

    if (!cached) {
      return reply.status(404).send('Artwork not found');
    }

    return reply.type(cached.contentType).send(Buffer.from(cached.data, 'base64'));
  });
}
