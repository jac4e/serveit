// interface TaskEntry {
//     name: string;
//     interval: () => number;
//     isStopped: () => boolean;
//     start: () => void;
//     stop: () => void;
// }

export const tasks: Task[] = [];

export default abstract class Task {
    public stopped: boolean = true;
    private processTimer: NodeJS.Timeout | null = null;
    private interval: number; // 5 minutes
    private name: string;
    protected abstract taskHandler() : Promise<void>; // Runs every interval
    protected abstract startHandler() : void; // Runs before process is started
    protected abstract stopHandler() : void; // Runs before process is stopped

    constructor(name: string, interval: number) {
        this.interval = interval;
        this.name = name;
        tasks.push(this);
    }
    
    // isStopped() {
    //     return this.stopped;
    // }

    // getInterval() {
    //     return this.interval;
    // }

    start() {
        this.startHandler();
        this.stopped = false;
        this.processTimer = setTimeout(this.task, this.interval);
    }

    stop() {
        this.stopHandler();
        this.stopped = true;
        if (this.processTimer !== null) {
            clearTimeout(this.processTimer);
        }
    }

    protected async task() {
        if (this.stopped) {
            return;
        }
        
        await this.taskHandler()

        this.processTimer = setTimeout(this.task, 1000 * 60 * 5);
    }
}