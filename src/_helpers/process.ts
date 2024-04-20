export default abstract class Processor {
    public isStopped: boolean = true;
    private processTimer: NodeJS.Timeout | null = null;
    private interval: number; // 5 minutes
    protected abstract processHandler() : Promise<void>; // Runs every interval
    protected abstract startHandler() : void; // Runs before process is started
    protected abstract stopHandler() : void; // Runs before process is stopped

    constructor(interval: number) {
        this.interval = interval;
    }

    start() {
        this.startHandler();
        this.isStopped = false;
        this.processTimer = setTimeout(this.process, this.interval);
    }

    stop() {
        this.stopHandler();
        this.isStopped = true;
        if (this.processTimer !== null) {
            clearTimeout(this.processTimer);
        }
    }

    async process() {
        if (this.isStopped) {
            return;
        }
        
        await this.processHandler()

        this.processTimer = setTimeout(this.process, 1000 * 60 * 5);
    }
}