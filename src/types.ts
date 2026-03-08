export interface Interval {
  type: 'warmup' | 'run' | 'walk' | 'cooldown';
  duration: number; // in seconds
}

export interface Program {
  id: string;
  name: string;
  difficulty: number;
  description: string;
  intervals: Interval[];
  totalDuration?: number; // Total seconds
}

export interface Run {
  id?: string;
  name: string;
  programId: string;
  startTime: string;
  program?: Program;
  songs?: { id: string, status: 'fast' | 'slow' }[];
  status: 'pending' | 'downloading' | 'stitching' | 'completed' | 'failed';
  outputPath?: string;
}
