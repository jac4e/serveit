// interface TaskEntry {
//     name: string;
//     interval: () => number;
//     isStopped: () => boolean;
//     start: () => void;
//     stop: () => void;
// }
import logger from '../_helpers/logger.js';
import { randomUUID } from 'crypto';

export const tasks: Task[] = [];

export default abstract class Task {
    public stopped: boolean = true;
    private processTimer: NodeJS.Timeout | null = null;
    private interval: number; // 5 minutes
    public name: string;
    public lastRun: Date | null = null;
    public nextRun: Date | null = null;
    protected abstract taskHandler() : Promise<void>; // Runs every interval
    protected abstract startHandler() : void; // Runs before process is started
    protected abstract stopHandler() : void; // Runs before process is stopped

    constructor(name: string, interval: number) {
        this.interval = interval;
        this.name = name;

        this.task = this.task.bind(this);

        tasks.push(this);

        // logger.debug(`Task ${name} created with interval ${interval}`);
    }

    log(level: string, message: string) {
        logger.log(level, message, {
                section: 'task',
                label: this.name,
            }
        );
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
            this.lastRun = new Date();
        } catch (error) {
            this.log('error', `Error running task ${this.name}: ${error}`);
        }
        this.processTimer = setTimeout(this.task, this.interval);
    }

    start() {
        try {
            this.startHandler();
        } catch (error) {
            this.log('error', `Error starting task ${this.name}: ${error}`);
            return;
        }
        this.stopped = false;
        this.nextRun = new Date(Date.now() + this.interval);
        this.processTimer = setTimeout(this.task, this.interval);
    }

    stop() {
        try {
            this.stopHandler();
        } catch (error) {
            this.log('error', `Error stopping task ${this.name}: ${error}`);
            return;
        }
        this.stopped = true;
        this.nextRun = null;
        if (this.processTimer !== null) {
            clearTimeout(this.processTimer);
        }
    }

    protected async task() {
        this.lastRun = new Date();

        if (this.stopped) {
            return;
        }
        
        try {
            await this.taskHandler();
        } catch (error) {
            this.log('error', `Error running task ${this.name}: ${error}`);
        }
        
        this.nextRun = new Date(Date.now() + this.interval);
        this.processTimer = setTimeout(this.task, this.interval);
    }
}