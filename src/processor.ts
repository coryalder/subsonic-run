import ffmpeg from 'fluent-ffmpeg';
import fs from 'node:fs/promises';
import path from 'node:path';
import SubsonicAPI from 'subsonic-api';
import { Run, RunStatus, IntervalType, IntervalTypeIsSlow } from './types.js';
import { loadPrograms } from './programs.js';

async function getSongDuration(filePath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) {
        reject(err);
      } else {
        resolve(metadata.format.duration || 0);
      }
    });
  });
}

export async function processRun(runId: string, subsonic: SubsonicAPI) {
  const dataDir = path.join(process.cwd(), 'data');
  const runFilePath = path.join(dataDir, `${runId}.json`);

  const updateStatus = async (status: Run['status'], outputPath?: string) => {
    const content = await fs.readFile(runFilePath, 'utf-8');
    const run = JSON.parse(content) as Run;
    run.status = status;

    if (outputPath) run.outputPath = outputPath;
    
    if (status === 'completed') run.stitchedAt = new Date().toISOString();
    
    await fs.writeFile(runFilePath, JSON.stringify(run, null, 2));
    console.log(`Run ${runId} status updated to: ${status}`);
  };

  try {
    const content = await fs.readFile(runFilePath, 'utf-8');
    const run = JSON.parse(content) as Run;

    const programs = await loadPrograms();
    run.program = programs.find(p => p.id === run.programId);

    if (!run.songs || run.songs.length === 0) {
      await updateStatus(RunStatus.COMPLETED);
      return;
    }

    // 1. Downloading phase
    await updateStatus(RunStatus.DOWNLOADING);
    const tempDir = path.join(process.cwd(), 'temp', runId);
    await fs.mkdir(tempDir, { recursive: true });

    const slowSongs = run.songs.filter(s => s.status === 'slow');
    const fastSongs = run.songs.filter(s => s.status === 'fast');

    for (const song of run.songs) {
      const songPath = path.join(tempDir, `${song.id}.mp3`);
      try {
        await fs.access(songPath);
        console.log(`Song ${song.id} already exists, skipping download.`);
        continue;
      } catch (error) {
        // Song doesn't exist, proceed with download
      }

      console.log(`Downloading song: ${song.id} (${song.status})`);
      const response = await subsonic.download({ id: song.id });
      if (!response.ok) {
        throw new Error(`Failed to download song ${song.id}: ${response.statusText}`);
      }
      const buffer = await response.arrayBuffer();
      await fs.writeFile(songPath, Buffer.from(buffer));
      console.log(`Song ${song.id} saved to ${songPath}`);
    }

    // 2. Stitching phase
    await updateStatus(RunStatus.STITCHING);
    
    const finalOutputPath = path.join(process.cwd(), 'output', `${runId}.mp3`);
    await fs.mkdir(path.dirname(finalOutputPath), { recursive: true });

    if (!run.program || !run.songs || run.songs.length === 0) {
        console.log('No program or songs to stitch. ' + JSON.stringify(run, null, 2));
        await updateStatus(RunStatus.COMPLETED);
        return;
    }

    let slowSongIndex = 0;
    let fastSongIndex = 0;
    let slowSongPosition = 0;
    let fastSongPosition = 0;
    const clips: string[] = [];
    let clipIndex = 0;

    for (const interval of run.program.intervals) {
      const isSlow = IntervalTypeIsSlow(interval.type);
        let remainingIntervalDuration = interval.duration;
        
        while (remainingIntervalDuration > 0) {
            let currentSong;
            let currentSongPosition;
            let songIndex;
            let songs;

            if (isSlow) {
                currentSong = slowSongs[slowSongIndex];
                currentSongPosition = slowSongPosition;
                songIndex = slowSongIndex;
                songs = slowSongs;
            } else {
                currentSong = fastSongs[fastSongIndex];
                currentSongPosition = fastSongPosition;
                songIndex = fastSongIndex;
                songs = fastSongs;
            }

            if (!currentSong) {
                console.log(`No ${isSlow ? 'slow' : 'fast'} songs available.`);
                break;
            }
            
            const songPath = path.join(tempDir, `${currentSong.id}.mp3`);
            const songDuration = await getSongDuration(songPath);
            const remainingSongDuration = songDuration - currentSongPosition;
            
            const clipDuration = Math.min(remainingIntervalDuration, remainingSongDuration);
            const clipPath = path.join(tempDir, `clip-${clipIndex++}.ts`);

            await new Promise<void>((resolve, reject) => {
                ffmpeg(songPath)
                    .setStartTime(currentSongPosition)
                    .setDuration(clipDuration)
                    .outputOptions('-c copy')
                    .output(clipPath)
                    .on('end', () => resolve())
                    .on('error', (err) => reject(err))
                    .run();
            });
            clips.push(clipPath);

            remainingIntervalDuration -= clipDuration;

            if (isSlow) {
                slowSongPosition += clipDuration;
                if (slowSongPosition >= songDuration) {
                    slowSongIndex = (slowSongIndex + 1) % slowSongs.length;
                    slowSongPosition = 0;
                }
            } else {
                fastSongPosition += clipDuration;
                if (fastSongPosition >= songDuration) {
                    fastSongIndex = (fastSongIndex + 1) % fastSongs.length;
                    fastSongPosition = 0;
                }
            }
        }
    }
    
    if (clips.length > 0) {
        if (clips.length === 1) {
            await fs.rename(clips[0], finalOutputPath);
        } else {
            const crossfadeDuration = 2;
            let complexFilter = '';
            let prevOutput = '0:a';

            for (let i = 1; i < clips.length; i++) {
                const currentInput = `${i}:a`;
                const nextOutput = `a${i}`;
                complexFilter += `[${prevOutput}][${currentInput}]acrossfade=d=${crossfadeDuration}[${nextOutput}];`;
                prevOutput = nextOutput;
            }

            const command = ffmpeg();
            clips.forEach(clip => command.input(clip));

            await new Promise<void>((resolve, reject) => {
                command
                    .complexFilter(complexFilter, prevOutput)
                    .save(finalOutputPath)
                    .on('end', () => resolve())
                    .on('error', (err) => reject(err));
            });
        }

        for (const clip of clips) {
            await fs.unlink(clip);
        }
    }
    
    // 3. Completion
    await updateStatus(RunStatus.COMPLETED, finalOutputPath);
    
    // Clean up temp files
    //await fs.rm(tempDir, { recursive: true, force: true });

  } catch (err) {
    console.error(`Error processing run ${runId}:`, err);
    await updateStatus(RunStatus.FAILED);
  }
}
