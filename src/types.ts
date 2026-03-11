export enum IntervalType {
  WARMUP = 'warmup',
  RUN = 'run',
  WALK = 'walk',
  COOLDOWN = 'cooldown',
}

export function IntervalTypeIsSlow(type: IntervalType) {
  return [IntervalType.WALK, IntervalType.WARMUP, IntervalType.COOLDOWN].includes(type);
}

export interface Interval {
  type: IntervalType;
  duration: number; // in seconds
}

export function IntervalIsSlow(interval: Interval) {
  return IntervalTypeIsSlow(interval.type);
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
