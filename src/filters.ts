import nunjucks from 'nunjucks';

export function formatDuration(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleString();
}

export function formatRfc822Date(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toUTCString();
}

export function filterByStatus(songs: any[], status: string): any[] {
    return (songs || []).filter(s => s.status === status);
}

export function sumDurations(songs: any[]): number {
    return (songs || []).reduce((sum, s) => sum + (s.duration || 0), 0);
}

export function sumIntervals(intervals: any[]): number {
    return (intervals || []).reduce((sum, i) => sum + (i.duration || 0), 0);
}

export function isModified(run: any): boolean {
    if (run.status !== 'completed' || !run.updatedAt) return false;
    const stitchTime = run.stitchedAt ? new Date(run.stitchedAt).getTime() : 0;
    return new Date(run.updatedAt).getTime() > stitchTime;
}

export const AddCustomFilters = (env: nunjucks.Environment) => {
    env.addFilter('formatDuration', formatDuration);
    env.addFilter('date', formatDate);
    env.addFilter('rfc822Date', formatRfc822Date);
    env.addFilter('filterByStatus', filterByStatus);
    env.addFilter('sumDurations', sumDurations);
    env.addFilter('sumIntervals', sumIntervals);
    env.addFilter('isModified', isModified);
}