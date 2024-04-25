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
    public name: string;
    protected abstract taskHandler() : Promise<void>; // Runs every interval
    protected abstract startHandler() : void; // Runs before process is started
    protected abstract stopHandler() : void; // Runs before process is stopped

    constructor(name: string, interval: number) {
        this.interval = interval;
        this.name = name;

        this.task = this.task.bind(this);

        tasks.push(this);

        console.log(`Task ${name} created with interval ${interval}`);
    }
    
    // isStopped() {
    //     return this.stopped;
    // }

    // getInterval() {
    //     return this.interval;
    // }

    async forceRun() {
        // clear the timer
        if (this.processTimer !== null) {
            clearTimeout(this.processTimer);
        }

        try {
            await this.taskHandler();
        } catch (error) {
            console.error(`Error running task ${this.name}: ${error}`);
        }
        this.processTimer = setTimeout(this.task, this.interval);
    }

    start() {
        try {
            this.startHandler();
        } catch (error) {
            console.error(`Error starting task ${this.name}: ${error}`);
            return;
        }
        this.stopped = false;
        this.processTimer = setTimeout(this.task, this.interval);
    }

    stop() {
        try {
            this.stopHandler();
        } catch (error) {
            console.error(`Error stopping task ${this.name}: ${error}`);
            return;
        }
        this.stopped = true;
        if (this.processTimer !== null) {
            clearTimeout(this.processTimer);
        }
    }

    protected async task() {
        if (this.stopped) {
            return;
        }
        
        try {
            await this.taskHandler();
        } catch (error) {
            console.error(`Error running task ${this.name}: ${error}`);
        }

        this.processTimer = setTimeout(this.task, this.interval);
    }
}