import { App, TFile } from 'obsidian';
import { CalloutCache, CalloutItem } from './types';
import { timestampToReadable, readableToTimestamp } from './utils';
import { CACHE_VERSION, PLUGIN_FOLDER, CACHE_FILENAME } from './constants';

export class CacheManager {
    private app: App;
    private cacheOperationLock: Promise<any> | null = null;
    private incrementalUpdateQueue: Map<string, TFile> = new Map();
    private incrementalUpdateTimer: NodeJS.Timeout | null = null;
    private readonly INCREMENTAL_UPDATE_DELAY = 1000;

    constructor(app: App) {
        this.app = app;
    }

    getCacheFilePath(): string {
        return `.obsidian/plugins/${PLUGIN_FOLDER}/${CACHE_FILENAME}`;
    }

    async loadCalloutCache(): Promise<CalloutCache | null> {
        // Wait for any ongoing cache operations to complete
        if (this.cacheOperationLock) {
            await this.cacheOperationLock;
        }

        try {
            const cacheFilePath = this.getCacheFilePath();
            
            // Use Obsidian's vault adapter instead of Node.js fs
            const adapter = this.app.vault.adapter;
            const exists = await adapter.exists(cacheFilePath);
            if (!exists) {
                return null;
            }

            const cacheContent = await adapter.read(cacheFilePath);
            
            // Validate JSON before parsing
            let cache: CalloutCache;
            try {
                cache = JSON.parse(cacheContent);
                if (!cache || typeof cache !== 'object' || !Array.isArray(cache.callouts)) {
                    throw new Error('Invalid cache structure');
                }
            } catch (parseError) {
                console.warn('Failed to parse cache file, will regenerate:', parseError);
                return null;
            }

            // Note: calloutCreationTimes is deprecated but we preserve it for backward compatibility

            // Convert old numeric timestamps to readable format
            if (cache.fileModTimes) {
                const convertedFileModTimes: Record<string, string> = {};
                for (const [filePath, time] of Object.entries(cache.fileModTimes)) {
                    if (typeof time === 'number') {
                        // Old format: numeric timestamp
                        convertedFileModTimes[filePath] = timestampToReadable(time);
                    } else {
                        // New format: already readable
                        convertedFileModTimes[filePath] = time as string;
                    }
                }
                cache.fileModTimes = convertedFileModTimes;
            }

            // Convert old numeric timestamps in callouts to readable format
            if (cache.callouts) {
                for (const callout of cache.callouts) {
                    if (callout.fileModTime && typeof callout.fileModTime === 'number') {
                        callout.fileModTime = timestampToReadable(callout.fileModTime as any);
                    }
                    if (callout.calloutCreatedTime && typeof callout.calloutCreatedTime === 'number') {
                        callout.calloutCreatedTime = timestampToReadable(callout.calloutCreatedTime as any);
                    }
                    if (callout.calloutModifyTime && typeof callout.calloutModifyTime === 'number') {
                        callout.calloutModifyTime = timestampToReadable(callout.calloutModifyTime as any);
                    }
                }
            }

            // Validate cache version and vault path
            if (cache.version !== CACHE_VERSION) {
                return null;
            }

            const currentVaultPath = this.app.vault.getName() || '';
            if (cache.vaultPath !== currentVaultPath) {
                return null;
            }

            return cache;
        } catch (error) {
            console.warn('Failed to load callout cache:', error);
            return null;
        }
    }

    async saveCalloutCache(callouts: CalloutItem[], shouldSkipFile: (filePath: string, searchMode?: boolean) => boolean): Promise<boolean> {
        // Create a lock to prevent concurrent cache operations
        const saveOperation = async (): Promise<boolean> => {
            try {
                // Collect file modification times in readable format
                const fileModTimes: Record<string, string> = {};
                const files = this.app.vault.getMarkdownFiles();
                
                for (const file of files) {
                    if (!shouldSkipFile(file.path, true)) {
                        fileModTimes[file.path] = timestampToReadable(file.stat.mtime);
                    }
                }

                const cache: CalloutCache = {
                    version: CACHE_VERSION,
                    timestamp: Date.now(),
                    vaultPath: this.app.vault.getName() || '',
                    callouts,
                    fileModTimes
                };

                // Save using Obsidian's vault adapter instead of Node.js fs
                const cacheFilePath = this.getCacheFilePath();
                
                // Custom JSON formatting to keep arrays compact
                const cacheContent = JSON.stringify(cache, null, 2)
                    .replace(/"headers":\s*\[\s*([^\]]*?)\s*\]/g, (match, content) => {
                        // Format headers array on single line
                        const cleanContent = content.replace(/\s*,\s*/g, ', ').replace(/\n\s*/g, '');
                        return `"headers": [${cleanContent}]`;
                    })
                    .replace(/"headerLevels":\s*\[\s*([^\]]*?)\s*\]/g, (match, content) => {
                        // Format headerLevels array on single line
                        const cleanContent = content.replace(/\s*,\s*/g, ', ').replace(/\n\s*/g, '');
                        return `"headerLevels": [${cleanContent}]`;
                    });

                // Ensure the directory exists
                const adapter = this.app.vault.adapter;
                const pluginDir = `.obsidian/plugins/${PLUGIN_FOLDER}`;
                if (!(await adapter.exists(pluginDir))) {
                    await adapter.mkdir(pluginDir);
                }

                await adapter.write(cacheFilePath, cacheContent);
                return true;
            } catch (error) {
                console.error('Failed to save callout cache:', error);
                return false;
            }
        };

        // Set the lock and execute the operation
        this.cacheOperationLock = saveOperation();
        const result = await this.cacheOperationLock;
        this.cacheOperationLock = null;
        
        return result;
    }

    async isCacheValid(cache: CalloutCache, shouldSkipFile: (filePath: string, searchMode?: boolean) => boolean): Promise<boolean> {
        if (!cache) {
            return false;
        }

        try {
            // Quick check: if too many files are pending incremental updates, invalidate cache
            if (this.incrementalUpdateQueue.size > 10) {
                return false;
            }
            
            // Check if any files have been modified since cache was created
            const modifiedFiles: string[] = [];
            for (const [filePath, cachedModTime] of Object.entries(cache.fileModTimes)) {
                const file = this.app.vault.getAbstractFileByPath(filePath);
                if (file instanceof TFile) {
                    if (file.stat.mtime > readableToTimestamp(cachedModTime)) {
                        modifiedFiles.push(filePath);
                    }
                } else {
                    return false;
                }
            }

            // If only a few files are modified, consider cache still valid for incremental updates
            if (modifiedFiles.length > 0 && modifiedFiles.length <= 5) {
                // Queue these files for incremental update
                modifiedFiles.forEach(filePath => {
                    const file = this.app.vault.getAbstractFileByPath(filePath) as TFile;
                    if (file) {
                        this.queueIncrementalUpdate(file);
                    }
                });
                return true; // Cache is valid, but will be updated incrementally
            } else if (modifiedFiles.length > 5) {
                return false; // Too many changes, full refresh needed
            }

            // Check for new files (limit check to avoid performance issues)
            const currentFiles = this.app.vault.getMarkdownFiles();
            let newFileCount = 0;
            for (const file of currentFiles) {
                if (!shouldSkipFile(file.path, true) && !cache.fileModTimes.hasOwnProperty(file.path)) {
                    newFileCount++;
                    if (newFileCount <= 3) {
                        this.queueIncrementalUpdate(file);
                    } else {
                        return false; // Too many new files
                    }
                }
            }

            return true;
        } catch (error) {
            console.warn('Error validating cache:', error);
            return false;
        }
    }
    
    // Incremental cache update methods
    private queueIncrementalUpdate(file: TFile) {
        this.incrementalUpdateQueue.set(file.path, file);
        
        // Debounce incremental updates
        if (this.incrementalUpdateTimer) {
            clearTimeout(this.incrementalUpdateTimer);
        }
        
        this.incrementalUpdateTimer = setTimeout(() => {
            this.processIncrementalUpdates();
        }, this.INCREMENTAL_UPDATE_DELAY);
    }
    
    private async processIncrementalUpdates() {
        if (this.incrementalUpdateQueue.size === 0) {
            return;
        }
        
        try {
            const cache = await this.loadCalloutCache();
            if (!cache) {
                return; // No cache to update
            }
            
            const filesToUpdate = Array.from(this.incrementalUpdateQueue.values());
            this.incrementalUpdateQueue.clear();
            
            // Import CalloutParser temporarily for incremental updates
            const { CalloutParser } = await import('./callout-parser');
            const parser = new CalloutParser(this.app, {} as any); // Settings not needed for parsing
            
            // Update callouts for modified files
            for (const file of filesToUpdate) {
                try {
                    // Remove old callouts from this file
                    cache.callouts = cache.callouts.filter(callout => callout.file !== file.path);
                    
                    // Add new callouts from this file
                    const newCallouts = await parser.extractCalloutsFromFile(file, cache);
                    cache.callouts.push(...newCallouts);
                    
                    // Update file modification time
                    cache.fileModTimes[file.path] = timestampToReadable(file.stat.mtime);
                } catch (error) {
                    console.warn(`Error updating callouts for file ${file.path}:`, error);
                }
            }
            
            // Save updated cache
            await this.saveIncrementalCache(cache);
            
        } catch (error) {
            console.error('Error processing incremental updates:', error);
            // Clear the queue on error
            this.incrementalUpdateQueue.clear();
        }
    }
    
    private async saveIncrementalCache(cache: CalloutCache): Promise<boolean> {
        try {
            cache.timestamp = Date.now();
            
            const cacheFilePath = this.getCacheFilePath();
            const cacheContent = JSON.stringify(cache, null, 2)
                .replace(/"headers":\s*\[\s*([^\]]*)\s*\]/g, (match, content) => {
                    const cleanContent = content.replace(/\s*,\s*/g, ', ').replace(/\n\s*/g, '');
                    return `"headers": [${cleanContent}]`;
                })
                .replace(/"headerLevels":\s*\[\s*([^\]]*)\s*\]/g, (match, content) => {
                    const cleanContent = content.replace(/\s*,\s*/g, ', ').replace(/\n\s*/g, '');
                    return `"headerLevels": [${cleanContent}]`;
                });
            
            const adapter = this.app.vault.adapter;
            await adapter.write(cacheFilePath, cacheContent);
            return true;
        } catch (error) {
            console.error('Failed to save incremental cache update:', error);
            return false;
        }
    }

}