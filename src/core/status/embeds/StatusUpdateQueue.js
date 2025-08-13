const EventEmitter = require('events');

class StatusUpdateQueue extends EventEmitter {
    constructor() {
        super();
        this.queue = [];
        this.priorityQueue = [];
        this.currentTask = null;
        this.errorCount = 0;
        this.maxErrors = 5; // or configurable
        this.debugMode = true;
    }

    enableDebugMode() {
        this.debugMode = true;
    }

    addUpdateTask(task, priority = false) {
        if (priority) {
            this.priorityQueue.unshift(task);
        } else {
            this.queue.push(task);
        }
        
        if (!this.currentTask) {
            this.processNextTask();
        }
    }

    async processNextTask() {
        
        console.log("Proceeding with Next Task") 
        
        const nextTask = this.priorityQueue.shift() || this.queue.shift();
        
        console.log(nextTask);
        
        if (!nextTask) {
            this.currentTask = null;
            return;
        }

        this.currentTask = nextTask;
        
        try {
            if (this.debugMode) {
                console.log('[Queue] Processing task');
            }
            
            await nextTask();
            
            if (this.debugMode) {
                console.log('[Queue] Task completed successfully');
            }
            
            this.errorCount = 0; // Reset error count on success
        } catch (error) {
            this.errorCount++;
            
            if (this.debugMode) {
                console.error('[Queue] Task failed:', error);
            }
            
            if (this.errorCount >= this.maxErrors) {
                this.emit('errorLimitReached');
                return; // Stop processing further tasks
            }
        } finally {
            this.processNextTask();
        }
    }

    clear() {
        this.queue = [];
        this.priorityQueue = [];
        this.currentTask = null;
    }
    
    // Add to StatusUpdateQueue class
getStatus() {
    return {
        queueLength: this.queue.length,
        priorityQueueLength: this.priorityQueue.length,
        currentTask: Boolean(this.currentTask),
        errorCount: this.errorCount,
        maxErrors: this.maxErrors,
        debugMode: this.debugMode
    };
}
}

module.exports = StatusUpdateQueue;