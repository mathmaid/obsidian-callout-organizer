import { App, TFile, TFolder } from 'obsidian';
import { CalloutItem, CalloutCache, CalloutOrganizerSettings, HeadingInfo } from './types';
import { timestampToReadable, readableToTimestamp, hasCalloutChanged } from './utils';
import { HEADING_REGEX, CALLOUT_REGEX, BLOCK_ID_REGEX } from './constants';

export class CalloutParser {
    private app: App;
    private settings: CalloutOrganizerSettings;
    private loadCalloutCache?: () => Promise<CalloutCache | null>;

    constructor(app: App, settings: CalloutOrganizerSettings) {
        this.app = app;
        this.settings = settings;
    }

    setCacheLoader(loadCalloutCache: () => Promise<CalloutCache | null>) {
        this.loadCalloutCache = loadCalloutCache;
    }

    async extractCurrentFileCallouts(): Promise<CalloutItem[]> {
        const activeFile = this.app.workspace.getActiveFile();
        if (!activeFile || !activeFile.path.endsWith('.md')) {
            return [];
        }
        
        return await this.extractCalloutsFromFile(activeFile);
    }

    async extractAllCallouts(loadCache: () => Promise<CalloutCache | null>, isCacheValid: (cache: CalloutCache) => Promise<boolean>): Promise<CalloutItem[]> {
        // Try to load from cache first
        const cache = await loadCache();
        if (cache && await isCacheValid(cache)) {
            // Sort callouts by modification time (recent first) for search mode
            const sortedCallouts = [...cache.callouts].sort((a, b) => {
                const aModTime = a.calloutModifyTime || a.fileModTime || '1970-01-01 00:00:00';
                const bModTime = b.calloutModifyTime || b.fileModTime || '1970-01-01 00:00:00';
                return readableToTimestamp(bModTime) - readableToTimestamp(aModTime);
            });
            return sortedCallouts;
        }

        // Cache miss or invalid, scan all files
        const callouts = await this.scanAllCallouts();
        return callouts;
    }

    async scanAllCallouts(): Promise<CalloutItem[]> {
        const callouts: CalloutItem[] = [];
        const files = this.app.vault.getMarkdownFiles();
        const currentFile = this.app.workspace.getActiveFile();
        const processedFiles = new Set<string>();
        
        // Load existing cache for change detection
        const existingCache = this.loadCalloutCache ? await this.loadCalloutCache() : null;
        
        // Always process current file first to ensure it's included in search results
        if (currentFile && currentFile.path.endsWith('.md')) {
            const currentFileCallouts = await this.extractCalloutsFromFile(currentFile, existingCache);
            callouts.push(...currentFileCallouts);
            processedFiles.add(currentFile.path);
        }
        
        // Process all other files
        for (const file of files) {
            // Skip if already processed (current file) or should be excluded
            if (processedFiles.has(file.path) || this.shouldSkipFile(file.path, true)) continue;
            
            const fileCallouts = await this.extractCalloutsFromFile(file, existingCache);
            callouts.push(...fileCallouts);
            processedFiles.add(file.path);
        }
        
        return callouts;
    }

    async extractCalloutsFromFile(file: TFile, existingCache?: CalloutCache | null): Promise<CalloutItem[]> {
        const content = await this.app.vault.read(file);
        const lines = content.split('\n');
        const callouts: CalloutItem[] = [];
        const fileModTime = file.stat.mtime;
        
        // Pre-calculate all headers once for this file (performance optimization)
        const allHeaders: HeadingInfo[] = [];
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (line.startsWith('#')) {
                const headingMatch = line.match(HEADING_REGEX);
                if (headingMatch) {
                    allHeaders.push({
                        title: headingMatch[2].trim(),
                        level: headingMatch[1].length,
                        lineNumber: i + 1
                    });
                }
            }
        }
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            
            // Quick check: only process lines that start with '>' 
            if (!line.startsWith('>')) continue;
            
            // Match callout pattern: > [!type] Title
            const calloutMatch = line.match(CALLOUT_REGEX);
            if (calloutMatch) {
                const type = calloutMatch[1].toLowerCase();
                const title = calloutMatch[2].trim();
                const contentLines: string[] = [];
                let calloutID = '';
                
                // Extract callout content
                let j = i + 1;
                for (; j < lines.length; j++) {
                    const nextLine = lines[j];
                    if (nextLine.startsWith('>')) {
                        // Check if this line starts a new callout
                        if (nextLine.includes('[!')) {
                            const nextCalloutMatch = nextLine.match(CALLOUT_REGEX);
                            if (nextCalloutMatch) {
                                // This is the start of a new callout, stop here
                                break;
                            }
                        }
                        
                        // This is regular callout content
                        const contentLine = nextLine.replace(/^>\s?/, '');
                        
                        // Check for callout ID
                        const blockMatch = contentLine.match(BLOCK_ID_REGEX);
                        if (blockMatch) {
                            calloutID = blockMatch[1];
                            const cleanContent = contentLine.replace(/\s*\^[\w-]+\s*$/, '');
                            if (cleanContent) contentLines.push(cleanContent);
                        } else {
                            contentLines.push(contentLine);
                        }
                    } else if (nextLine.trim() === '') {
                        // Continue for empty lines
                    } else {
                        // This is regular content that ends the callout
                        break;
                    }
                }
                
                // Update i to skip the lines we've already processed
                i = j - 1; // -1 because the for loop will increment i
                
                // Extract headers for this callout using pre-calculated headers (performance optimization)
                const currentLineNumber = i + 1;
                const relevantHeaders = allHeaders.filter(header => header.lineNumber <= currentLineNumber);
                
                // Build hierarchy by keeping only the most recent heading at each level
                const hierarchy: HeadingInfo[] = [];
                for (const heading of relevantHeaders) {
                    while (hierarchy.length > 0 && hierarchy[hierarchy.length - 1].level >= heading.level) {
                        hierarchy.pop();
                    }
                    hierarchy.push(heading);
                }
                
                const currentTime = Date.now();
                const currentReadableTime = timestampToReadable(currentTime);
                const fileModTimeReadable = timestampToReadable(fileModTime);
                
                // Create preliminary callout item for comparison
                const preliminaryCallout: CalloutItem = {
                    file: file.path,
                    type,
                    title,
                    content: contentLines.join('\n').trim(),
                    lineNumber: currentLineNumber,
                    fileModTime: fileModTimeReadable
                };
                
                // Determine creation and modification times with smart change detection
                let creationTime: string;
                let modificationTime: string;
                
                if (calloutID && existingCache?.callouts) {
                    // Find existing callout to compare content and get creation time
                    const existingCallout = existingCache.callouts.find(c => 
                        c.calloutID === calloutID && c.file === file.path
                    );
                    
                    if (existingCallout) {
                        // This callout already exists, keep the original creation time
                        creationTime = existingCallout.calloutCreatedTime || currentReadableTime;
                        
                        if (hasCalloutChanged(preliminaryCallout, existingCallout)) {
                            // Content has changed, update modification time
                            modificationTime = currentReadableTime;
                        } else {
                            // Content hasn't changed, keep existing modification time
                            modificationTime = existingCallout.calloutModifyTime || currentReadableTime;
                        }
                    } else {
                        // New callout with ID
                        creationTime = currentReadableTime;
                        modificationTime = currentReadableTime;
                    }
                } else {
                    // For callouts without IDs: use fileModTime for both created and modified times
                    creationTime = fileModTimeReadable;
                    modificationTime = fileModTimeReadable;
                }
                
                // Create final callout item
                const calloutItem: CalloutItem = {
                    file: file.path,
                    type,
                    title,
                    content: contentLines.join('\n').trim(),
                    lineNumber: currentLineNumber,
                    fileModTime: fileModTimeReadable,
                    calloutCreatedTime: creationTime,
                    calloutModifyTime: modificationTime
                };
                
                // Add optional properties only if they exist to save memory
                if (calloutID) calloutItem.calloutID = calloutID;
                if (hierarchy.length > 0) {
                    calloutItem.headers = hierarchy.map(h => h.title);
                    calloutItem.headerLevels = hierarchy.map(h => h.level);
                }
                
                // Extract outlinks from callout content
                const outlinks = this.extractOutlinksFromContent(calloutItem.content);
                if (outlinks.length > 0) {
                    calloutItem.outlinks = outlinks;
                }
                
                callouts.push(calloutItem);
            }
        }
        
        return callouts;
    }


    shouldSkipFile(filePath: string, searchMode: boolean = false): boolean {
        // In current file mode, never skip files
        if (!searchMode) return false;
        
        // In search mode, apply folder filtering
        const folders = this.settings.excludedFolders;
        if (folders.length === 0) return false;
        
        return folders.some(folder => 
            filePath.startsWith(folder + '/') || filePath === folder
        );
    }


    /**
     * Extract outlinks from callout content
     */
    extractOutlinksFromContent(content: string): [string, string, string?][] {
        const outlinks: [string, string, string?][] = [];
        
        // Match patterns like [[filename#^calloutID]] or [[filename#^calloutID|label]]
        const linkRegex = /\[\[([^\]]+?)#\^([^\]|]+?)(?:\|([^\]]+?))?\]\]/g;
        
        let match;
        while ((match = linkRegex.exec(content)) !== null) {
            let filename = match[1];
            const calloutID = match[2];
            const label = match[3];
            
            // Ensure filename has .md extension
            if (!filename.endsWith('.md')) {
                filename = `${filename}.md`;
            }
            
            outlinks.push([filename, calloutID, label]);
        }
        
        return outlinks;
    }

    /**
     * Generate a unique callout ID based on content and type
     */
    generateCalloutId(callout: CalloutItem): string {
        // Create ID with type prefix for better organization
        const typePrefix = callout.type.toLowerCase().substring(0, 3);
        const randomSuffix = Math.random().toString(36).substr(2, 6);
        return `${typePrefix}-${randomSuffix}`;
    }
}