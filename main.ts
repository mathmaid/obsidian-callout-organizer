import { App, Plugin, WorkspaceLeaf, TFile } from 'obsidian';

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
        // Basic implementation - this would need to be enhanced to actually modify the file
        console.log(`Would add callout ID ${calloutID} to callout in ${callout.file} at line ${callout.lineNumber}`);
        // TODO: Implement actual file modification logic
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