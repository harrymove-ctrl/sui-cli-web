import fs from 'fs/promises';
import path from 'path';
import os from 'os';

export interface AnalyticsEvent {
    timestamp: number;
    type: 'command_success' | 'command_error' | 'app_start';
    command?: string;
    duration?: number;
    error?: string;
    metadata?: any;
}

export class AnalyticsService {
    private static instance: AnalyticsService;
    private logPath: string;
    private initialized: boolean = false;

    private constructor() {
        this.logPath = path.join(os.homedir(), '.sui-cli-web', 'analytics.jsonl');
    }

    public static getInstance(): AnalyticsService {
        if (!AnalyticsService.instance) {
            AnalyticsService.instance = new AnalyticsService();
        }
        return AnalyticsService.instance;
    }

    private async init() {
        if (this.initialized) return;
        try {
            const dir = path.dirname(this.logPath);
            await fs.mkdir(dir, { recursive: true });
            this.initialized = true;
        } catch (error) {
            console.error('[AnalyticsService] Failed to initialize:', error);
        }
    }

    public async track(event: Omit<AnalyticsEvent, 'timestamp'>) {
        await this.init();

        const fullEvent: AnalyticsEvent = {
            timestamp: Date.now(),
            ...event,
        };

        try {
            // Append to JSONL file
            await fs.appendFile(this.logPath, JSON.stringify(fullEvent) + '\n');
        } catch (error) {
            // Fail silently to not disrupt app flow
            console.error('[AnalyticsService] Failed to log event:', error);
        }
    }

    public async getRecentEvents(limit: number = 50): Promise<AnalyticsEvent[]> {
        await this.init();
        try {
            const content = await fs.readFile(this.logPath, 'utf-8');
            const lines = content.trim().split('\n');

            return lines
                .slice(-limit)
                .map(line => {
                    try {
                        return JSON.parse(line);
                    } catch {
                        return null;
                    }
                })
                .filter((e): e is AnalyticsEvent => e !== null)
                .reverse();
        } catch {
            return [];
        }
    }
}
