import { App, Plugin, WorkspaceLeaf, TFile, Notice } from 'obsidian';

// Import our modularized components
import { CalloutOrganizerSettings, CalloutItem, CalloutCache } from './modules/types';
import { DEFAULT_SETTINGS, VIEW_TYPE_CALLOUT_ORGANIZER } from './modules/constants';
import { CacheManager } from './modules/cache';
import { CalloutParser } from './modules/callout-parser';
import { CalloutOrganizerView } from './modules/callout-view';
import { CalloutOrganizerSettingTab } from './modules/settings';
import { CanvasHandler } from './modules/canvas-handler';
import { ColorManager } from './modules/color-manager';

export default class CalloutOrganizerPlugin extends Plugin {
    settings!: CalloutOrganizerSettings;
    
    // Modular components
    private cacheManager!: CacheManager;
    private calloutParser!: CalloutParser;
    private canvasHandler!: CanvasHandler;
    private colorManager!: ColorManager;
    
    // Plugin state
    private styleElement: HTMLStyleElement | null = null;
    private originalErrorHandler: OnErrorEventHandler | null = null;

    async onload() {
        await this.loadSettings();

        // Initialize modular components
        this.cacheManager = new CacheManager(this.app);
        this.calloutParser = new CalloutParser(this.app, this.settings);
        this.canvasHandler = new CanvasHandler(this.app, this.settings);
        this.colorManager = new ColorManager(this.app, this.settings);

        // Set up cache loader for the parser
        this.calloutParser.setCacheLoader(() => this.cacheManager.loadCalloutCache());

        // Add ResizeObserver error handler to suppress loop warnings
        this.setupResizeObserverErrorHandler();

        // Register view
        this.registerView(
            VIEW_TYPE_CALLOUT_ORGANIZER,
            (leaf) => new CalloutOrganizerView(leaf, this, 'current')
        );
        
        // Register canvas drop handler
        this.canvasHandler.registerCanvasDropHandler(this.handleCanvasDrop.bind(this));

        // Add ribbon icon and commands
        this.addRibbonIcon('album', 'Open Callout Organizer', () => {
            this.activateCalloutOrganizer();
        });

        this.addCommand({
            id: 'open-callout-organizer',
            name: 'Open Callout Organizer',
            callback: () => {
                this.activateCalloutOrganizer();
            }
        });

        // Add settings tab
        this.addSettingTab(new CalloutOrganizerSettingTab(this.app, this));
        
        // Initialize callout colors
        await this.colorManager.initializeCalloutColors(
            () => this.colorManager.getAllCalloutTypesInVault(this.calloutParser.shouldSkipFile.bind(this.calloutParser)),
            () => this.getAllCalloutTypesFromCache(),
            () => this.saveSettings()
        );
        
        // Inject custom CSS
        this.injectCustomCalloutCSS();
    }

    async onunload() {
        this.app.workspace.detachLeavesOfType(VIEW_TYPE_CALLOUT_ORGANIZER);
        
        // Restore original error handler
        if (this.originalErrorHandler !== null) {
            window.onerror = this.originalErrorHandler;
        }

        // Remove custom styles
        if (this.styleElement) {
            this.styleElement.remove();
        }
    }

    // Settings management
    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }

    // View management
    async activateCalloutOrganizer() {
        const { workspace } = this.app;

        let leaf: WorkspaceLeaf | null = null;
        const leaves = workspace.getLeavesOfType(VIEW_TYPE_CALLOUT_ORGANIZER);

        if (leaves.length > 0) {
            leaf = leaves[0];
        } else {
            leaf = workspace.getLeftLeaf(false);
            if (leaf) {
                await leaf.setViewState({ type: VIEW_TYPE_CALLOUT_ORGANIZER, active: true });
            }
        }

        if (leaf) {
            workspace.revealLeaf(leaf);
        }
    }

    getCalloutView(): CalloutOrganizerView | null {
        const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_CALLOUT_ORGANIZER);
        if (leaves.length > 0) {
            return leaves[0].view as CalloutOrganizerView;
        }
        return null;
    }

    // Delegate parsing methods to CalloutParser
    async extractCurrentFileCallouts(): Promise<CalloutItem[]> {
        return this.calloutParser.extractCurrentFileCallouts();
    }

    async extractAllCallouts(): Promise<CalloutItem[]> {
        return this.calloutParser.extractAllCallouts(
            () => this.cacheManager.loadCalloutCache(),
            (cache) => this.cacheManager.isCacheValid(cache, this.calloutParser.shouldSkipFile.bind(this.calloutParser))
        );
    }

    async scanAllCallouts(): Promise<CalloutItem[]> {
        return this.calloutParser.scanAllCallouts();
    }

    async refreshAllCallouts(): Promise<CalloutItem[]> {
        const callouts = await this.calloutParser.scanAllCallouts();
        await this.cacheManager.saveCalloutCache(callouts, this.calloutParser.shouldSkipFile.bind(this.calloutParser));
        
        // Auto-cleanup unused callout types from settings
        const cleanupResult = await this.colorManager.cleanupUnusedCalloutTypes(
            () => this.colorManager.getAllCalloutTypesInVault(this.calloutParser.shouldSkipFile.bind(this.calloutParser)),
            () => this.getAllCalloutTypesFromCache(),
            () => this.saveSettings()
        );
        
        // Reinitialize colors for any new callout types discovered during refresh
        await this.colorManager.initializeCalloutColors(
            () => this.colorManager.getAllCalloutTypesInVault(this.calloutParser.shouldSkipFile.bind(this.calloutParser)),
            () => this.getAllCalloutTypesFromCache(),
            () => this.saveSettings()
        );
        
        // Re-inject CSS to apply new colors immediately
        this.injectCustomCalloutCSS();
        
        return callouts;
    }

    // Delegate cache methods to CacheManager
    async loadCalloutCache(): Promise<CalloutCache | null> {
        return this.cacheManager.loadCalloutCache();
    }

    async saveCalloutCache(callouts: CalloutItem[]): Promise<boolean> {
        return this.cacheManager.saveCalloutCache(callouts, this.calloutParser.shouldSkipFile.bind(this.calloutParser));
    }

    // Delegate color management to ColorManager
    async getAllCalloutTypesInVault(): Promise<Set<string>> {
        return this.colorManager.getAllCalloutTypesInVault(this.calloutParser.shouldSkipFile.bind(this.calloutParser));
    }

    async getAllCalloutTypesFromCache(): Promise<Set<string>> {
        const calloutTypes = new Set<string>();
        const cache = await this.cacheManager.loadCalloutCache();
        
        if (cache && cache.callouts) {
            for (const callout of cache.callouts) {
                calloutTypes.add(callout.type.toLowerCase().trim());
            }
        }
        
        return calloutTypes;
    }

    getDefaultColorForCalloutType(type: string): string {
        return this.colorManager.getDefaultColorForCalloutType(type);
    }

    getDefaultIconForCalloutType(type: string): string {
        return this.colorManager.getDefaultIconForCalloutType(type);
    }

    getObsidianCalloutColor(type: string): string {
        return this.colorManager.getObsidianCalloutColor(type);
    }

    isBuiltinCalloutType(type: string): boolean {
        return this.colorManager.isBuiltinCalloutType(type);
    }

    injectCustomCalloutCSS(): void {
        this.colorManager.injectCustomCSS(this.settings.customCalloutCSS);
    }

    // Canvas integration
    private handleCanvasDrop(event: DragEvent): void {
        this.canvasHandler.handleCanvasDrop(event);
    }

    // File navigation
    async openFile(filename: string, lineNumber?: number, newTab?: boolean) {
        const file = this.app.vault.getAbstractFileByPath(filename);
        if (file instanceof TFile) {
            let leaf;
            if (newTab) {
                leaf = this.app.workspace.getLeaf('tab');
            } else {
                leaf = this.app.workspace.getLeaf(false);
            }
            await leaf.openFile(file);
            
            if (lineNumber) {
                const view = leaf.view;
                if (view && 'editor' in view) {
                    const editor = (view as any).editor;
                    if (editor) {
                        editor.setCursor(lineNumber - 1, 0);
                        editor.scrollIntoView({ from: { line: lineNumber - 1, ch: 0 }, to: { line: lineNumber - 1, ch: 0 } }, true);
                        
                        // Add highlight animation
                        setTimeout(() => {
                            this.highlightLine(editor, lineNumber - 1);
                        }, 100);
                    }
                }
            }
        }
    }

    private highlightLine(editor: unknown, lineNumber: number) {
        try {
            // Type guard for editor object
            if (!editor || typeof editor !== 'object' || !('lineInfo' in editor)) {
                return;
            }
            
            const lineInfo = (editor as any).lineInfo(lineNumber);
            if (!lineInfo) return;
            
            // Create a highlight decoration
            const markEl = document.createElement('div');
            markEl.className = 'callout-organizer-highlight';
            markEl.style.cssText = `
                position: absolute;
                left: 0;
                right: 0;
                background-color: var(--text-selection);
                opacity: 0.7;
                pointer-events: none;
                animation: callout-highlight-pulse 3s ease-out;
            `;
            
            // Add CSS animation if not already added
            if (!document.getElementById('callout-organizer-highlight-css')) {
                const style = document.createElement('style');
                style.id = 'callout-organizer-highlight-css';
                style.textContent = `
                    @keyframes callout-highlight-pulse {
                        0% { opacity: 0.7; background-color: var(--text-selection); }
                        50% { opacity: 0.4; background-color: var(--text-accent); }
                        100% { opacity: 0; background-color: var(--text-selection); }
                    }
                `;
                document.head.appendChild(style);
            }
            
            // Remove highlight after animation
            setTimeout(() => {
                if (markEl.parentNode) {
                    markEl.parentNode.removeChild(markEl);
                }
            }, 3000);
            
        } catch (error) {
            console.warn('Error highlighting line:', error);
        }
    }

    // Error handling setup
    private setupResizeObserverErrorHandler() {
        // Store the original error handler
        this.originalErrorHandler = window.onerror;
        
        window.onerror = (message, source, lineno, colno, error) => {
            // Suppress ResizeObserver loop errors as they're usually harmless
            if (typeof message === 'string' && 
                message.includes('ResizeObserver loop completed with undelivered notifications')) {
                return true; // Prevent the error from being logged
            }
            
            // Call the original handler for other errors
            if (this.originalErrorHandler) {
                return this.originalErrorHandler(message, source, lineno, colno, error);
            }
            
            return false;
        };
    }

    // Additional methods that may be needed by the view
    generateCalloutId(callout: CalloutItem): string {
        return this.calloutParser.generateCalloutId(callout);
    }

    async addCalloutIdToCallout(callout: CalloutItem, calloutID: string): Promise<void> {
        try {
            const file = this.app.vault.getAbstractFileByPath(callout.file);
            if (!(file instanceof TFile)) {
                console.error(`File not found: ${callout.file}`);
                return;
            }

            const content = await this.app.vault.read(file);
            if (!content && content !== '') {
                console.error(`Failed to read file: ${callout.file}`);
                return;
            }
            const lines = content.split('\n');
            
            // Find the specific callout by matching type and content
            let calloutStartLine = -1;
            let calloutEndLine = -1;
            
            // Search for callouts that match the type and content
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                
                // Check if this is a callout header with matching type
                const calloutMatch = line.match(/^>\s*\[!([^\]]+)\]/);
                if (calloutMatch) {
                    const foundType = calloutMatch[1].toLowerCase();
                    
                    // Check if type matches
                    if (foundType === callout.type.toLowerCase()) {
                        // Found a potential match, now check the content
                        let currentCalloutContent = '';
                        let currentCalloutEndLine = i;
                        
                        // Collect the callout content
                        for (let j = i; j < lines.length; j++) {
                            if (lines[j].startsWith('>')) {
                                // Remove the '>' prefix and trim
                                const contentLine = lines[j].substring(1).trim();
                                if (contentLine && !contentLine.startsWith('[!') && !contentLine.startsWith('^')) {
                                    currentCalloutContent += contentLine + ' ';
                                }
                                currentCalloutEndLine = j;
                            } else {
                                // End of callout - stop at first non-'>' line
                                break;
                            }
                        }
                        
                        // Clean up the content for comparison
                        currentCalloutContent = currentCalloutContent.trim();
                        const expectedContent = callout.content.replace(/\s+/g, ' ').trim();
                        
                        // Check if content matches (allow for some flexibility in whitespace)
                        if (currentCalloutContent === expectedContent || 
                            currentCalloutContent.includes(expectedContent.substring(0, Math.min(50, expectedContent.length)))) {
                            calloutStartLine = i;
                            calloutEndLine = currentCalloutEndLine;
                            break;
                        }
                    }
                }
            }
            
            if (calloutStartLine === -1) {
                console.warn(`Could not find matching callout for type "${callout.type}" in ${callout.file}`);
                return;
            }
            
            // Check if this callout already has an ID (check both inside and outside the callout)
            let hasExistingId = false;
            
            // Check inside the callout for > ^id format
            for (let i = calloutStartLine; i <= calloutEndLine; i++) {
                if (lines[i] && lines[i].match(/^>\s*\^/)) {
                    hasExistingId = true;
                    break;
                }
            }
            
            // Also check outside the callout for ^id format
            if (!hasExistingId) {
                for (let i = calloutEndLine + 1; i < Math.min(calloutEndLine + 3, lines.length); i++) {
                    if (lines[i] && lines[i].startsWith('^')) {
                        hasExistingId = true;
                        break;
                    }
                }
            }
            
            if (hasExistingId) {
                console.log(`Callout already has an ID, skipping: ${callout.file}`);
                return;
            }
            
            // Insert the ID INSIDE the callout (with > prefix) immediately after the last content line
            // Find the actual last line with content (skip any existing empty > lines)
            let lastContentLine = calloutEndLine;
            while (lastContentLine >= calloutStartLine && lines[lastContentLine].trim() === '>') {
                lastContentLine--;
            }
            
            const insertIndex = lastContentLine + 1;
            lines.splice(insertIndex, 0, `> ^${calloutID}`);
            
            const newContent = lines.join('\n');
            await this.app.vault.modify(file, newContent);
            
            // Update the callout object
            callout.calloutID = calloutID;
            
        } catch (error) {
            console.error('Error adding callout ID:', error);
        }
    }

    async openCalloutCanvas(callout: CalloutItem): Promise<void> {
        try {
            // Generate callout ID if it doesn't exist
            if (!callout.calloutID) {
                const newCalloutID = this.generateCalloutId(callout);
                callout.calloutID = newCalloutID;
                
                try {
                    // Add the ID to the file
                    await this.addCalloutIdToCallout(callout, newCalloutID);
                    // Update cache after successful ID addition - get all callouts to save properly
                    const allCallouts = await this.extractAllCallouts();
                    await this.saveCalloutCache(allCallouts);
                } catch (error) {
                    console.error('Error adding callout ID to file:', error);
                    // Reset the callout ID if we failed to add it to the file
                    callout.calloutID = undefined;
                    return;
                }
            }

            // Use comprehensive canvas generation with relationship analysis
            await this.createCalloutGraphCanvas(callout);
            
        } catch (error) {
            console.error('Error opening callout canvas:', error);
        }
    }

    async createCalloutGraphCanvas(callout: CalloutItem): Promise<void> {
        return this.canvasHandler.createCalloutGraphCanvas(callout, () => this.extractAllCallouts());
    }
    
    // TODO: The following methods still need full implementation:
    // - All the complex canvas operations and analysis
    // - Many view rendering methods that are still in the original CalloutOrganizerView
    
    // These are the main methods that would need to be gradually extracted from the original main.ts
    // The current refactoring provides the basic structure and separates the major concerns
}