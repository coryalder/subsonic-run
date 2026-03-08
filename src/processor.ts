import fs from 'node:fs/promises';
import path from 'node:path';
import SubsonicAPI from 'subsonic-api';
import { Run } from './types.js';

export async function processRun(runId: string, subsonic: SubsonicAPI) {
  const dataDir = path.join(process.cwd(), 'data');
  const runFilePath = path.join(dataDir, `${runId}.json`);

  const updateStatus = async (status: Run['status'], outputPath?: string) => {
    const content = await fs.readFile(runFilePath, 'utf-8');
    const run = JSON.parse(content) as Run;
    run.status = status;
    if (outputPath) run.outputPath = outputPath;
    await fs.writeFile(runFilePath, JSON.stringify(run, null, 2));
    console.log(`Run ${runId} status updated to: ${status}`);
  };

  try {
    const content = await fs.readFile(runFilePath, 'utf-8');
    const run = JSON.parse(content) as Run;

    if (!run.songIds || run.songIds.length === 0) {
      await updateStatus('completed');
      return;
    }

    // 1. Downloading phase
    await updateStatus('downloading');
    const tempDir = path.join(process.cwd(), 'temp', runId);
    await fs.mkdir(tempDir, { recursive: true });

    for (const songId of run.songIds) {
      console.log(`Scaffolding download for song: ${songId}`);
      // TODO: Implement actual download logic using subsonic.stream
      // const streamResponse = await subsonic.stream({ id: songId });
      // ... save to tempDir
      await new Promise(resolve => setTimeout(resolve, 500)); // Simulate work
    }

    // 2. Stitching phase
    await updateStatus('stitching');
    console.log(`Scaffolding stitching for ${run.songIds.length} songs`);
    // TODO: Implement stitching using node-av or ffmpeg
    const finalOutputPath = path.join(process.cwd(), 'output', `${runId}.mp3`);
    await fs.mkdir(path.dirname(finalOutputPath), { recursive: true });
    
    // Simulate stitching
    await new Promise(resolve => setTimeout(resolve, 2000)); 

    // 3. Completion
    await updateStatus('completed', finalOutputPath);
    
    // Clean up temp files
    await fs.rm(tempDir, { recursive: true, force: true });

  } catch (err) {
    console.error(`Error processing run ${runId}:`, err);
    await updateStatus('failed');
  }
}
