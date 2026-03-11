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
  slowDuration: number;
  fastDuration: number;
}

export enum RunStatus {
  PENDING = 'pending',
  DOWNLOADING = 'downloading',
  STITCHING = 'stitching',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

export interface Run {
  id?: string;
  name: string;
  programId: string;
  startTime: string;
  program?: Program;
  songs?: { 
    id: string, 
    status: 'fast' | 'slow',
    title?: string,
    artist?: string,
    duration?: number,
    bpm?: number
  }[];
  status: RunStatus;
  outputPath?: string;
  updatedAt?: string;
  stitchedAt?: string;
}
