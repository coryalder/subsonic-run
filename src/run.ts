import { FastifyInstance } from 'fastify';

export default async function runRoutes(fastify: FastifyInstance) {
  // Create Run Page
  fastify.get('/create-run', async (request, reply) => {
    const programs = [
      { id: 'p1', title: 'Beginner 5K', duration: '30m', description: 'Alternating walking and running' },
      { id: 'p2', title: 'Tempo Run', duration: '45m', description: 'Steady pace with intensity intervals' },
      { id: 'p3', title: 'Speed Intervals', duration: '40m', description: 'High-intensity bursts with recovery' },
      { id: 'p4', title: 'Endurance Build', duration: '60m', description: 'Longer blocks of steady running' }
    ];
    return reply.view('createRun.njk', { programs });
  });

  // Start Run Handler
  fastify.post('/start-run', async (request, reply) => {
    const { name, programId } = request.body as { name: string, programId: string };
    return `
      <div style="background: white; border-radius: 12px; padding: 2rem; border: 1px solid #ddd; text-align: center;">
        <h2 style="color: #1db954;">Run Started!</h2>
        <p><strong>Name:</strong> ${name}</p>
        <p><strong>Program ID:</strong> ${programId}</p>
        <a href="/" style="display: inline-block; margin-top: 1.5rem; color: #1db954; text-decoration: none; font-weight: bold;">&larr; Return to Library</a>
      </div>
    `;
  });
}
