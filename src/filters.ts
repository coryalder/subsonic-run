
import nunjucks from 'nunjucks';

export const AddCustomFilters = (env: nunjucks.Environment) => {
    env.addFilter('formatDuration', (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    });

    env.addFilter('date', (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleString();
    });
    
    env.addFilter('filterByStatus', (songs: any[], status: string) => {
        return (songs || []).filter(s => s.status === status);
    });
    
    env.addFilter('sumDurations', (songs: any[]) => {
        return (songs || []).reduce((sum, s) => sum + (s.duration || 0), 0);
    });
    
    env.addFilter('sumIntervals', (intervals: any[]) => {
        return (intervals || []).reduce((sum, i) => sum + (i.duration || 0), 0);
    });
    
    env.addFilter('isModified', (run: any) => {
        if (run.status !== 'completed' || !run.updatedAt) return false;
        const stitchTime = run.stitchedAt ? new Date(run.stitchedAt).getTime() : 0;
        return new Date(run.updatedAt).getTime() > stitchTime;
    });
}