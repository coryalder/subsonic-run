import fs from 'node:fs/promises';
import path from 'node:path';
import yaml from 'js-yaml';
import { Program } from './types.js';

export async function loadPrograms(): Promise<Program[]> {
  const filePath = path.join(process.cwd(), 'programs.yaml');
  const content = await fs.readFile(filePath, 'utf8');
  const programs = yaml.load(content) as Program[];
  
  return programs.map(p => ({
    ...p,
    slowDuration: p.intervals
        .filter(i => ['walk', 'warmup', 'cooldown'].includes(i.type))
        .reduce((sum, i) => sum + i.duration, 0),
    fastDuration: p.intervals
        .filter(i => i.type === 'run')
        .reduce((sum, i) => sum + i.duration, 0)
  }));
}

export async function saveProgram(program: Omit<Program, 'slowDuration' | 'fastDuration'>): Promise<void> {
  const filePath = path.join(process.cwd(), 'programs.yaml');
  const content = await fs.readFile(filePath, 'utf8');
  const programs = yaml.load(content) as any[];
  
  programs.push(program);
  
  await fs.writeFile(filePath, yaml.dump(programs));
}
