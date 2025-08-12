import { App, Plugin, PluginSettingTab, Setting, TFile, Modal, WorkspaceLeaf, ItemView, Notice, MarkdownRenderer, Component, setIcon, MarkdownView } from 'obsidian';

// Constants for consistent icon rendering
const OBSIDIAN_NOTE_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svg-icon lucide-pencil"><path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"></path><path d="m15 5 4 4"></path></svg>`;

interface CalloutColors {
    color: string; // Hex color like "#2ea4e5"
    icon: string; // Lucide icon name like "info" or ""
}

interface CalloutCache {
    version: string;
    timestamp: number;
    vaultPath: string;
    callouts: CalloutItem[];
    fileModTimes: Record<string, string>; // file path -> modification time (readable format)
    calloutCreationTimes: Record<string, string>; // callout signature -> creation time (readable format)
}

interface CalloutOrganizerSettings {
    excludedFolders: string[];
    groupByType: boolean;
    searchInFilenames: boolean;
    searchInCalloutTitles: boolean;
    searchInCalloutIds: boolean;
    searchInCalloutContent: boolean;
    maxSearchResults: number;
    // Cache settings
    enableFileCache: boolean;
    // Display options
    showFilenames: boolean;
    showH1Headers: boolean;
    showH2Headers: boolean;
    showH3Headers: boolean;
    showH4Headers: boolean;
    showH5Headers: boolean;
    showH6Headers: boolean;
    showCalloutIds: boolean;
    calloutFontSize: number;
    breadcrumbFontSize: number;
    // Drag options
    useEmbedLinks: boolean;
    invisibleEmbeddings: boolean;
    hideFileNamesInLinks: boolean;
    // Callout options
    customCalloutCSS: string;
    // Callout color customization
    calloutColors: Record<string, CalloutColors>;
}

const DEFAULT_SETTINGS: CalloutOrganizerSettings = {
    excludedFolders: [],
    groupByType: false, // Show in file order by default
    searchInFilenames: true,
    searchInCalloutTitles: true,
    searchInCalloutIds: true,
    searchInCalloutContent: true,
    maxSearchResults: 50,
    // Cache settings
    enableFileCache: true,
    // Display options - show all by default
    showFilenames: true,
    showH1Headers: true,
    showH2Headers: true,
    showH3Headers: true,
    showH4Headers: true,
    showH5Headers: true,
    showH6Headers: true,
    showCalloutIds: true,
    calloutFontSize: 14,
    breadcrumbFontSize: 12,
    // Drag options
    useEmbedLinks: true, // Use embed links by default
    invisibleEmbeddings: true, // Enable invisible embeddings by default
    hideFileNamesInLinks: false, // Hide file names in links by default (disabled)
    // Callout options
    customCalloutCSS: '',
    // Callout colors will be dynamically populated based on detected callouts in vault
    calloutColors: {}
};

interface CalloutItem {
    file: string;
    type: string;
    title: string;
    content: string;
    calloutID?: string;  // Unique identifier for the callout (replaces blockId)
    lineNumber: number;
    headers?: string[];
    headerLevels?: number[];
    fileModTime?: string; // Human-readable file modification time (YYYY-MM-DD HH:mm:ss)
    calloutCreatedTime?: string; // Human-readable time when callout was first created (YYYY-MM-DD HH:mm:ss)
    calloutModifyTime?: string;  // Human-readable time when callout was last modified (YYYY-MM-DD HH:mm:ss)
}

interface HeadingInfo {
    title: string;
    level: number;
    lineNumber: number;
}

const VIEW_TYPE_CALLOUT_ORGANIZER = "callout-organizer";

// Utility functions for time formatting
function timestampToReadable(timestamp: number): string {
    const date = new Date(timestamp);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

function readableToTimestamp(readable: string): number {
    return new Date(readable).getTime();
}

// Helper function to check if callout content has changed
function hasCalloutChanged(newCallout: CalloutItem, existingCallout: CalloutItem): boolean {
    return newCallout.type !== existingCallout.type ||
           newCallout.title !== existingCallout.title ||
           newCallout.content !== existingCallout.content;
}

class CalloutOrganizerView extends ItemView {
    plugin: CalloutOrganizerPlugin;
    callouts: CalloutItem[] = [];
    component: Component;
    activeFilters: Set<string> = new Set();
    searchMode: 'current' | 'search';
    searchQuery: string = '';
    
    // Debouncing and performance optimizations
    private refreshDebounceTimer: NodeJS.Timeout | null = null;
    private searchDebounceTimer: NodeJS.Timeout | null = null;
    private lastRenderTime: number = 0;
    private readonly DEBOUNCE_DELAY = 300;
    private readonly RENDER_BATCH_SIZE = 20; // Batch DOM operations
    private readonly MIN_RENDER_INTERVAL = 100;
    
    // DOM element cache for performance
    private cachedTypeSelectorContainer: HTMLElement | null = null;
    
    // Performance optimization: cache DOM elements
    private topBarElement: HTMLElement | null = null;
    private calloutContainerElement: HTMLElement | null = null;
    private readonly SEARCH_DEBOUNCE_DELAY = 200;
    private readonly RENDER_DEBOUNCE_DELAY = 150;

    constructor(leaf: WorkspaceLeaf, plugin: CalloutOrganizerPlugin, mode: 'current' | 'search' = 'current') {
        super(leaf);
        this.plugin = plugin;
        this.component = new Component();
        this.searchMode = mode;
    }

    getViewType() {
        return VIEW_TYPE_CALLOUT_ORGANIZER;
    }

    getDisplayText() {
        return this.searchMode === 'search' ? "Callout Search" : "Callout View";
    }

    getIcon() {
        return "album";
    }

    async onOpen() {
        this.component.load();
        const container = this.containerEl.children[1];
        container.empty();
        
        // Top bar with mode toggle, search, and type selectors
        const topBar = container.createEl("div", { cls: "callout-top-bar" });
        this.setupTopBar(topBar);
        
        const calloutContainer = container.createEl("div", { cls: "callout-container" });
        this.renderCallouts(calloutContainer);
        
        // Auto-refresh event listeners removed - callouts will only update when refresh button is clicked
        
        await this.refreshCallouts();
    }

    async refreshCallouts() {
        // Always read from JSON file instead of memory cache
        if (this.searchMode === 'current') {
            this.callouts = await this.plugin.extractCurrentFileCallouts();
        } else if (this.searchMode === 'search') {
            // Load callouts from JSON file only
            const cache = await this.plugin.loadCalloutCache();
            if (cache && cache.callouts) {
                this.callouts = cache.callouts;
            } else {
                this.callouts = [];
            }
        }
        
        // Check for new callout types and add them to settings
        await this.detectAndAddNewCalloutTypes();
        
        // Update type selectors to include new types (cached)
        if (!this.cachedTypeSelectorContainer) {
            this.cachedTypeSelectorContainer = this.containerEl.querySelector('.callout-type-selectors') as HTMLElement;
        }
        if (this.cachedTypeSelectorContainer) {
            this.setupTypeSelectors(this.cachedTypeSelectorContainer);
        }
        
        const container = this.containerEl.querySelector('.callout-container');
        if (container) {
            await this.renderCallouts(container as HTMLElement);
        }
    }

    // Helper method to detect and add new callout types to settings
    private async detectAndAddNewCalloutTypes() {
        const currentTypes = new Set(this.callouts.map(c => c.type.toLowerCase().trim()));
        let settingsChanged = false;
        
        for (const type of currentTypes) {
            if (!this.plugin.settings.calloutColors[type]) {
                // Add new callout type with fallback to note type colors
                const noteColor = this.plugin.settings.calloutColors['note']?.color || '#086DDD';
                const noteIcon = this.plugin.settings.calloutColors['note']?.icon || 'pencil';
                
                this.plugin.settings.calloutColors[type] = {
                    color: noteColor,
                    icon: noteIcon
                };
                settingsChanged = true;
            }
        }
        
        if (settingsChanged) {
            await this.plugin.saveSettings();
            // Update CSS to include the new types
            this.plugin.injectCustomCalloutCSS();
        }
    }

    async getHeadingHierarchy(callout: CalloutItem): Promise<HeadingInfo[]> {
        const activeFile = this.app.workspace.getActiveFile();
        if (!activeFile) {
            return [];
        }
        
        const content = await this.app.vault.read(activeFile);
        const lines = content.split('\n');
        const headings: HeadingInfo[] = [];
        
        // Extract all headings before this callout
        for (let i = 0; i < callout.lineNumber - 1; i++) {
            const line = lines[i].trim();
            const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
            if (headingMatch) {
                const level = headingMatch[1].length;
                const title = headingMatch[2].trim();
                
                headings.push({
                    title,
                    level,
                    lineNumber: i + 1
                });
            }
        }
        
        // Build hierarchy by keeping only the most recent heading at each level
        const hierarchy: HeadingInfo[] = [];
        for (const heading of headings) {
            // Remove any headings at this level or deeper
            while (hierarchy.length > 0 && hierarchy[hierarchy.length - 1].level >= heading.level) {
                hierarchy.pop();
            }
            hierarchy.push(heading);
        }
        
        return hierarchy;
    }


    filterHeadersBySettings(headers: string[], headerLevels?: number[]): string[] {
        if (!headerLevels || headers.length !== headerLevels.length) {
            return headers; // Return all headers if levels not available
        }
        
        const filtered: string[] = [];
        for (let i = 0; i < headers.length; i++) {
            const level = headerLevels[i];
            let shouldInclude = false;
            
            switch (level) {
                case 1:
                    shouldInclude = this.plugin.settings.showH1Headers;
                    break;
                case 2:
                    shouldInclude = this.plugin.settings.showH2Headers;
                    break;
                case 3:
                    shouldInclude = this.plugin.settings.showH3Headers;
                    break;
                case 4:
                    shouldInclude = this.plugin.settings.showH4Headers;
                    break;
                case 5:
                    shouldInclude = this.plugin.settings.showH5Headers;
                    break;
                case 6:
                    shouldInclude = this.plugin.settings.showH6Headers;
                    break;
                default:
                    shouldInclude = true; // Include unknown levels by default
            }
            
            if (shouldInclude) {
                filtered.push(headers[i]);
            }
        }
        
        return filtered;
    }

    getSearchPlaceholder(): string {
        if (this.searchMode === 'current') {
            return 'Search current file...';
        }
        
        const enabledFields: string[] = [];
        if (this.plugin.settings.searchInFilenames) enabledFields.push('files');
        if (this.plugin.settings.searchInCalloutTitles) enabledFields.push('callout titles');
        if (this.plugin.settings.searchInCalloutIds) enabledFields.push('callout IDs');
        if (this.plugin.settings.searchInCalloutContent) enabledFields.push('callout content');
        
        if (enabledFields.length === 0) {
            return 'Search disabled - enable search fields in settings';
        }
        
        return 'Search all files...';
    }


    setupTopBar(container: HTMLElement) {
        container.empty();
        
        // First line: controls
        const firstLine = container.createEl("div", { cls: "callout-top-bar-line-1" });
        
        // Mode toggle button (left)
        const modeToggleBtn = firstLine.createEl("button", {
            text: this.searchMode === 'current' ? "Current File" : "All Files",
            cls: "callout-mode-toggle-button"
        });
        
        modeToggleBtn.onmousedown = async (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            if (this.searchMode === 'current') {
                this.searchMode = 'search';
                modeToggleBtn.textContent = "All Files";
            } else {
                this.searchMode = 'current';
                modeToggleBtn.textContent = "Current File";
                // Clear search query when switching to current file mode
                this.searchQuery = '';
            }
            
            // Clear existing filters and refresh callouts first
            this.activeFilters.clear();
            await this.refreshCallouts();
            
            // Now select all available callout types from refreshed data
            const uniqueTypes = new Set(this.callouts.map(callout => callout.type));
            uniqueTypes.forEach(type => this.activeFilters.add(type));
            
            await this.refreshCallouts();
        };
        
        // Search input (center)
        const searchInput = firstLine.createEl("input", {
            type: "text",
            placeholder: this.getSearchPlaceholder(),
            cls: "callout-search-input",
            value: this.searchQuery
        });
        
        searchInput.oninput = () => {
            this.searchQuery = searchInput.value;
            this.debouncedSearch();
        };
        
        // Right side buttons container
        const rightButtons = firstLine.createEl("div", { cls: "callout-right-buttons" });
        
        // Refresh button
        const refreshBtn = rightButtons.createEl("button", {
            cls: "callout-refresh-button"
        });
        setIcon(refreshBtn, "refresh-cw");
        
        refreshBtn.onclick = async () => {
            if (this.searchMode === 'search') {
                // Force refresh by rescanning all files and updating cache
                await this.plugin.refreshAllCallouts();
                
                // Then load from JSON file (not memory)
                await this.refreshCallouts();
                console.log('Callouts refreshed and saved to JSON file!');
                
            } else {
                // For current file mode, refresh and also rebuild cache
                
                // First rebuild the cache by scanning all files
                await this.plugin.refreshAllCallouts();
                
                // Then refresh current file view
                await this.refreshCallouts();
                console.log('Current file callouts refreshed! Cache updated.');
            }
        };
        
        // Second line: type selectors
        const secondLine = container.createEl("div", { cls: "callout-top-bar-line-2" });
        const typeSelectors = secondLine.createEl("div", { cls: "callout-type-selectors" });
        this.setupTypeSelectors(typeSelectors);
    }

    setupTypeSelectors(container: HTMLElement) {
        container.empty();
        
        // Get unique callout types from current callouts
        const uniqueTypes = [...new Set(this.callouts.map(c => c.type))].sort();
        
        if (uniqueTypes.length === 0) {
            container.createEl("p", { text: "No callout types found", cls: "callout-empty-message" });
            return;
        }
        
        // If no filters are active, show all types by default
        if (this.activeFilters.size === 0) {
            uniqueTypes.forEach(type => this.activeFilters.add(type));
        }
        
        // Add Select All/Clear All toggle button at the beginning
        if (uniqueTypes.length > 0) {
            const allSelected = this.activeFilters.size === uniqueTypes.length;
            const toggleButton = container.createEl("button", {
                text: allSelected ? "Clear All" : "Select All",
                cls: "callout-clear-all-button"
            });
            
            toggleButton.onclick = (e) => {
                e.stopPropagation();
                const currentlyAllSelected = this.activeFilters.size === uniqueTypes.length;
                
                if (currentlyAllSelected) {
                    // Clear all
                    this.activeFilters.clear();
                    
                    // Update all button states
                    const allButtons = container.querySelectorAll('.callout-type-selector');
                    allButtons.forEach(btn => btn.removeClass('active'));
                    
                    toggleButton.textContent = "Select All";
                } else {
                    // Select all
                    this.activeFilters.clear();
                    uniqueTypes.forEach(type => this.activeFilters.add(type));
                    
                    // Update all button states
                    const allButtons = container.querySelectorAll('.callout-type-selector');
                    allButtons.forEach(btn => btn.addClass('active'));
                    
                    toggleButton.textContent = "Clear All";
                }
                
                this.debouncedRender();
            };
        }
        
        // Create type selector buttons directly
        uniqueTypes.forEach(type => {
            const button = container.createEl("button", { 
                cls: `callout-type-selector callout-filter-${type}`
            });
            
            // Add icon if available, fallback to "note" type icon
            const iconName = this.plugin.settings.calloutColors[type]?.icon || 
                           this.plugin.settings.calloutColors['note']?.icon || 'pencil';
            if (iconName && iconName !== 'none') {
                const iconEl = button.createEl("span", { cls: "callout-type-icon" });
                
                // Special handling for note callout to ensure we get the correct lucide-pencil
                if ((type === 'note' && iconName === 'pencil') || (iconName === 'pencil')) {
                    // Use the hardcoded SVG for pencil to avoid setIcon issues
                    iconEl.innerHTML = OBSIDIAN_NOTE_ICON_SVG;
                } else {
                    setIcon(iconEl, iconName);
                }
                
                iconEl.style.marginRight = "4px";
                iconEl.style.width = "calc(var(--callout-font-size, 14px) * 16 / 14)";
                iconEl.style.height = "calc(var(--callout-font-size, 14px) * 16 / 14)";
                iconEl.style.display = "inline-flex";
                iconEl.style.alignItems = "center";
            }
            
            // Add text
            button.createEl("span", { 
                text: type.charAt(0).toUpperCase() + type.slice(1),
                cls: "callout-type-text"
            });
            
            if (this.activeFilters.has(type)) {
                button.addClass("active");
            }
            
            button.onclick = (e) => {
                e.stopPropagation();
                if (this.activeFilters.has(type)) {
                    this.activeFilters.delete(type);
                } else {
                    this.activeFilters.add(type);
                }
                
                // Update button state
                if (this.activeFilters.has(type)) {
                    button.addClass("active");
                } else {
                    button.removeClass("active");
                }
                
                // Update toggle button text based on current state
                const toggleButton = container.querySelector('.callout-clear-all-button') as HTMLElement;
                if (toggleButton) {
                    const allSelected = this.activeFilters.size === uniqueTypes.length;
                    toggleButton.textContent = allSelected ? "Clear All" : "Select All";
                }
                
                this.debouncedRender();
            };
        });
    }


    getFilteredCallouts(): CalloutItem[] {
        if (this.activeFilters.size === 0) {
            return [];
        }
        
        let filtered = this.callouts.filter(callout => this.activeFilters.has(callout.type));
        
        
        // Apply search query in both modes
        if (this.searchQuery.trim()) {
            const query = this.searchQuery.toLowerCase();
            const keywords = query.split(/\s+/).filter(k => k.length > 0);
            const settings = this.plugin.settings; // Cache settings reference
            
            filtered = filtered.filter(callout => {
                // Build search text efficiently by concatenating enabled fields
                let searchText = '';
                
                if (this.searchMode === 'search') {
                    // In search mode, use settings configuration
                    if (settings.searchInFilenames) {
                        searchText += callout.file.toLowerCase() + ' ';
                    }
                    if (settings.searchInCalloutTitles) {
                        searchText += callout.title.toLowerCase() + ' ';
                    }
                    if (settings.searchInCalloutIds && callout.calloutID) {
                        searchText += callout.calloutID.toLowerCase() + ' ';
                    }
                    if (settings.searchInCalloutContent) {
                        searchText += callout.content.toLowerCase() + ' ';
                    }
                } else {
                    // In current file mode, search all fields
                    searchText += callout.file.toLowerCase() + ' ';
                    if (callout.headers) {
                        searchText += callout.headers.join(' ').toLowerCase() + ' ';
                    }
                    searchText += callout.title.toLowerCase() + ' ';
                    if (callout.calloutID) {
                        searchText += callout.calloutID.toLowerCase() + ' ';
                    }
                    searchText += callout.content.toLowerCase() + ' ';
                }
                
                // All keywords must be present (AND logic)
                return keywords.every(keyword => searchText.includes(keyword));
            });
        }
        
        // Apply maximum results limit only in search mode
        if (this.searchMode === 'search' && filtered.length > this.plugin.settings.maxSearchResults) {
            filtered = filtered.slice(0, this.plugin.settings.maxSearchResults);
        }
        
        return filtered;
    }

    async renderCalloutsList(container: HTMLElement) {
        container.empty();
        
        // Add ghost prompt showing callout count
        const totalCallouts = this.callouts.length;
        const location = this.searchMode === 'search' ? 'the vault' : 'current file';
        const ghostPrompt = container.createEl("div", { 
            text: `There are ${totalCallouts} callouts in ${location}`,
            cls: "callout-count-ghost-prompt"
        });
        
        const filteredCallouts = this.getFilteredCallouts();
        
        if (filteredCallouts.length === 0) {
            let message = "No callouts found.";
            if (this.activeFilters.size === 0) {
                message = "No callout types selected.";
            } else if (this.searchQuery.trim()) {
                message = `No callouts found matching "${this.searchQuery}".`;
            } else {
                message = "No callouts found for selected types.";
            }
            container.createEl("p", { text: message, cls: "callout-empty-message" });
            return;
        }

        let calloutsToRender: CalloutItem[];
        
        if (this.plugin.settings.groupByType) {
            const grouped = this.groupFilteredCallouts(filteredCallouts);
            for (const [type, callouts] of Object.entries(grouped)) {
                container.createEl("h3", { 
                    text: type.charAt(0).toUpperCase() + type.slice(1) + "s",
                    cls: `callout-organizer-type-header callout-organizer-type-header-${type}`
                });
                
                for (const callout of callouts) {
                    await this.renderSingleCallout(container, callout);
                }
            }
        } else {
            // Sort based on mode
            calloutsToRender = [...filteredCallouts].sort((a, b) => {
                if (this.searchMode === 'search') {
                    // In search mode, sort by callout modification time (recent first)
                    const aModTime = a.calloutModifyTime || a.fileModTime || '1970-01-01 00:00:00';
                    const bModTime = b.calloutModifyTime || b.fileModTime || '1970-01-01 00:00:00';
                    return readableToTimestamp(bModTime) - readableToTimestamp(aModTime);
                } else {
                    // In current file mode, sort by line number
                    return a.lineNumber - b.lineNumber;
                }
            });
            for (const callout of calloutsToRender) {
                await this.renderSingleCallout(container, callout);
            }
        }
    }

    async renderCallouts(container: HTMLElement) {
        // Update top bar
        const topBar = this.containerEl.querySelector('.callout-top-bar') as HTMLElement;
        if (topBar) {
            this.setupTopBar(topBar);
        }
        
        // Type selectors are now part of the top bar, so they're updated when setupTopBar is called
        
        // Render the callout list
        await this.renderCalloutsList(container);
        
        // Let Obsidian's MarkdownRenderer handle math naturally - no additional processing needed
    }

    async renderSingleCallout(container: HTMLElement, callout: CalloutItem) {
        const calloutEl = container.createEl("div", { cls: "callout-organizer-item" });
        
        // Use consistent callout structure for all types
        calloutEl.addClass("callout");
        calloutEl.setAttr("data-callout", callout.type);
        
        // Add search mode class for styling
        if (this.searchMode === 'search') {
            calloutEl.addClass('callout-organizer-search-mode');
        }
        
        // Make entire callout clickable and draggable
        calloutEl.style.cursor = "pointer";
        calloutEl.draggable = true;
        
        calloutEl.onclick = (e) => {
            // Don't trigger if clicking on links in breadcrumb
            if ((e.target as HTMLElement).tagName === 'A') {
                return;
            }
            e.preventDefault();
            this.openFile(callout.file, callout.lineNumber, e.ctrlKey || e.metaKey);
        };
        
        // Add drag functionality
        calloutEl.ondragstart = (e) => {
            if (e.dataTransfer) {
                // Check if we need to generate a new callout ID
                let calloutID = callout.calloutID;
                let needsNewId = false;
                
                if (!calloutID) {
                    calloutID = this.generateCalloutId(callout);
                    callout.calloutID = calloutID;
                    needsNewId = true;
                }
                
                // Create the link using only filename (without folder path)
                const useEmbed = this.plugin.settings.useEmbedLinks;
                const filenameWithExt = callout.file.split('/').pop() || callout.file;
                const filename = filenameWithExt.replace(/\.md$/, '');
                
                let linkText: string;
                if (this.plugin.settings.hideFileNamesInLinks) {
                    // Generate alias to hide filename
                    const alias = this.generateCalloutAlias(callout, calloutID);
                    linkText = useEmbed ? `![[${filename}#^${calloutID}|${alias}]]` : `[[${filename}#^${calloutID}|${alias}]]`;
                } else {
                    linkText = useEmbed ? `![[${filename}#^${calloutID}]]` : `[[${filename}#^${calloutID}]]`;
                }
                
                e.dataTransfer.setData('text/plain', linkText);
                e.dataTransfer.effectAllowed = 'copy';
                
                // Add visual feedback during drag
                calloutEl.style.opacity = '0.5';
                
                // Queue callout ID addition without blocking UI
                if (needsNewId && calloutID) {
                    queueMicrotask(() => {
                        this.addCalloutIdToCallout(callout, calloutID!).catch(error => {
                            console.error('Error adding callout ID to file:', error);
                        });
                    });
                }
            }
        };
        
        calloutEl.ondragend = () => {
            // Restore opacity after drag
            calloutEl.style.opacity = '1';
        };
        
        const header = calloutEl.createEl("div", { cls: "callout-organizer-header" });
        
        // Use callout title if available, otherwise use callout type
        const displayTitle = callout.title || callout.type.charAt(0).toUpperCase() + callout.type.slice(1);
        
        if (displayTitle) {
            const titleEl = header.createEl("span", { 
                cls: "callout-organizer-title"
            });
            
            // Get callout color for styling, fallback to "note" type color
            const calloutColor = this.plugin.settings.calloutColors[callout.type]?.color || 
                                this.plugin.settings.calloutColors['note']?.color || 'var(--callout-title-color)';
            
            // Always add icon (for both custom titles and type titles), fallback to "note" type icon
            const iconName = this.plugin.settings.calloutColors[callout.type]?.icon || 
                           this.plugin.settings.calloutColors['note']?.icon || 'pencil';
            if (iconName && iconName !== 'none') {
                const iconEl = titleEl.createEl("span", { cls: "callout-title-icon" });
                
                // Special handling for note callout to ensure we get the correct lucide-pencil
                if ((callout.type === 'note' && iconName === 'pencil') || (iconName === 'pencil')) {
                    // Use the hardcoded SVG for pencil to avoid setIcon issues
                    iconEl.innerHTML = OBSIDIAN_NOTE_ICON_SVG;
                } else {
                    setIcon(iconEl, iconName);
                }
                
                iconEl.style.marginRight = "6px";
                iconEl.style.width = "calc(var(--callout-font-size, 14px) * 16 / 14)";
                iconEl.style.height = "calc(var(--callout-font-size, 14px) * 16 / 14)";
                iconEl.style.display = "inline-flex";
                iconEl.style.alignItems = "center";
                iconEl.style.color = calloutColor;
            }
            
            // Apply callout color to title text
            titleEl.style.color = calloutColor;
            
            // Render title with math support
            MarkdownRenderer.render(this.app, displayTitle, titleEl, callout.file, this.component).then(() => {
                // Process math in title after MarkdownRenderer has completed
                this.processMathForElement(titleEl);
                // Reapply color after markdown rendering
                titleEl.style.color = calloutColor;
            });
        }
        
        const content = calloutEl.createEl("div", { cls: "callout-organizer-content" });
        
        // Render full markdown content with math support
        MarkdownRenderer.render(this.app, callout.content, content, callout.file, this.component).then(() => {
            // Process math after MarkdownRenderer has completed
            this.processMathForElement(content);
        });
        
        // Build hierarchical breadcrumb (moved to bottom)
        const breadcrumb = calloutEl.createEl("div", { cls: "callout-organizer-breadcrumb" });
        
        // Add filename if enabled in settings
        if (this.plugin.settings.showFilenames) {
            const fileParts = callout.file?.split('/');
            const filename = fileParts?.pop()?.replace(/\.md$/, '') || callout.file || 'Unknown';
            const fileLink = breadcrumb.createEl("a", { 
                text: filename,
                href: "#",
                cls: "callout-organizer-file-link"
            });
            fileLink.onclick = (e) => {
                e.preventDefault();
                this.openFile(callout.file, callout.lineNumber, e.ctrlKey || e.metaKey);
            };
        }
        
        // Add heading hierarchy from stored headers, filtered by settings
        if (callout.headers && callout.headers.length > 0) {
            const filteredHeaders = this.filterHeadersBySettings(callout.headers, callout.headerLevels);
            for (const headerTitle of filteredHeaders) {
                if (breadcrumb.children.length > 0) {
                    breadcrumb.createEl("span", { 
                        text: " > ",
                        cls: "callout-organizer-breadcrumb-separator"
                    });
                }
                
                const headingLink = breadcrumb.createEl("a", {
                    text: headerTitle,
                    href: "#",
                    cls: "callout-organizer-heading-link"
                });
                headingLink.onclick = (e) => {
                    e.preventDefault();
                    this.openFile(callout.file, callout.lineNumber, e.ctrlKey || e.metaKey);
                };
            }
        }
        
        // Add callout-id if present and enabled in settings
        if (callout.calloutID && this.plugin.settings.showCalloutIds) {
            if (breadcrumb.children.length > 0) {
                breadcrumb.createEl("span", { 
                    text: " > ",
                    cls: "callout-organizer-breadcrumb-separator"
                });
            }
            const blockLink = breadcrumb.createEl("a", {
                text: `^${callout.calloutID}`,
                href: "#",
                cls: "callout-organizer-callout-id"
            });
            blockLink.onclick = (e) => {
                e.preventDefault();
                this.openFile(callout.file, callout.lineNumber, e.ctrlKey || e.metaKey);
            };
        }
    }

    groupCallouts(): Record<string, CalloutItem[]> {
        return this.groupFilteredCallouts(this.callouts);
    }

    groupFilteredCallouts(callouts: CalloutItem[]): Record<string, CalloutItem[]> {
        const grouped: Record<string, CalloutItem[]> = {};
        
        callouts.forEach(callout => {
            if (!grouped[callout.type]) {
                grouped[callout.type] = [];
            }
            grouped[callout.type].push(callout);
        });
        
        Object.keys(grouped).forEach(type => {
            grouped[type].sort((a, b) => {
                if (this.searchMode === 'search') {
                    // In search mode, sort by callout modification time (recent first)
                    const aModTime = a.calloutModifyTime || a.fileModTime || '1970-01-01 00:00:00';
                    const bModTime = b.calloutModifyTime || b.fileModTime || '1970-01-01 00:00:00';
                    return readableToTimestamp(bModTime) - readableToTimestamp(aModTime);
                } else {
                    // In current file mode, sort by line number
                    return a.lineNumber - b.lineNumber;
                }
            });
        });
        
        return grouped;
    }




    generateCalloutAlias(_callout: CalloutItem, calloutID: string): string {
        // Generate alias using only the callout ID
        // e.g., "theorem-def456", "note-abc123", "example-xyz789"
        return calloutID;
    }

    generateCalloutId(callout: CalloutItem): string {
        // Generate 6-character random alphanumeric ID in format: type-******
        const type = callout.type.toLowerCase();
        const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
        let randomChars = '';
        for (let i = 0; i < 6; i++) {
            randomChars += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return `${type}-${randomChars}`;
    }


    async addCalloutIdToCallout(callout: CalloutItem, calloutID: string): Promise<void> {
        try {
            const file = this.app.vault.getAbstractFileByPath(callout.file);
            if (!(file instanceof TFile)) {
                new Notice(`File not found: ${callout.file}`);
                return;
            }

            const content = await this.app.vault.read(file);
            if (!content && content !== '') {
                new Notice(`Failed to read file: ${callout.file}`);
                return;
            }
            const lines = content.split('\n');
            
            // Find the callout starting from the callout header line
            let lastCalloutLineIndex = -1;
            let actualStartLine = -1;
            
            
            // Search for the actual callout line around the expected position
            // Sometimes line numbers can be off due to file modifications
            // For long callouts, the stored line might be in the middle or end
            const expectedLine = callout.lineNumber - 1;
            const searchRange = 10; // Search 10 lines above and below for long callouts
            
            // Search strategy: try exact line first, then search backwards (up), then forwards (down)
            const linesToSearch = [expectedLine]; // Start with exact line
            
            // Add lines going backwards (upwards) - prioritize this since headers are usually earlier
            for (let i = 1; i <= searchRange; i++) {
                if (expectedLine - i >= 0) {
                    linesToSearch.push(expectedLine - i);
                }
            }
            
            // Add lines going forwards (downwards)
            for (let i = 1; i <= searchRange; i++) {
                if (expectedLine + i < lines.length) {
                    linesToSearch.push(expectedLine + i);
                }
            }
            
            for (const lineIndex of linesToSearch) {
                const line = lines[lineIndex];
                
                // Check if this line matches our callout
                const calloutMatch = line.trim().match(/^>\s*\[!([^\]]+)\]\s*(.*)/);
                if (calloutMatch) {
                    const foundType = calloutMatch[1];
                    const foundTitle = calloutMatch[2].trim();
                    
                    // Check if this matches our target callout (by type and title)
                    if (foundType.toLowerCase() === callout.type.toLowerCase()) {
                        // For better matching, also compare titles if available
                        if (callout.title && foundTitle) {
                            // Use a more flexible title comparison
                            const normalizedCalloutTitle = callout.title.trim().toLowerCase();
                            const normalizedFoundTitle = foundTitle.trim().toLowerCase();
                            
                            if (normalizedCalloutTitle === normalizedFoundTitle || 
                                normalizedCalloutTitle.includes(normalizedFoundTitle) ||
                                normalizedFoundTitle.includes(normalizedCalloutTitle)) {
                                actualStartLine = lineIndex;
                                lastCalloutLineIndex = lineIndex;
                                break;
                            }
                        } else {
                            // If no title to compare, use the closest match by type
                            actualStartLine = lineIndex;
                            lastCalloutLineIndex = lineIndex;
                            break;
                        }
                    }
                }
            }
            
            // If we found the callout, determine its extent
            if (actualStartLine >= 0) {
                // Find the extent of this specific callout
                for (let i = actualStartLine + 1; i < lines.length; i++) {
                    const line = lines[i];
                    
                    if (line.startsWith('>')) {
                        // Check if this line starts a new callout
                        // Updated regex to support Unicode characters (including Chinese)
                        const newCalloutMatch = line.trim().match(/^>\s*\[!([^\]]+)\]/);
                        if (newCalloutMatch) {
                            // This is a new callout, stop here (don't include it)
                            break;
                        } else {
                            // This is still part of our callout
                            lastCalloutLineIndex = i;
                        }
                    } else {
                        // Non-callout line, we've reached the end of our callout
                        break;
                    }
                }
            }
            
            // Add block ID at the end of the callout if it doesn't already have one
            if (lastCalloutLineIndex >= 0) {
                // Check if the callout already has any block ID
                let hasBlockId = false;
                for (let i = actualStartLine; i <= lastCalloutLineIndex; i++) {
                    if (lines[i] && lines[i].match(/>\s*\^[\w-]+/)) {
                        hasBlockId = true;
                        break;
                    }
                }
                
                if (!hasBlockId) {
                    // Add the callout ID as a new line at the end of the callout
                    lines.splice(lastCalloutLineIndex + 1, 0, `> ^${calloutID}`);
                    
                    // Add empty line after the callout if there isn't one
                    if (lastCalloutLineIndex + 2 < lines.length && lines[lastCalloutLineIndex + 2].trim() !== '') {
                        lines.splice(lastCalloutLineIndex + 2, 0, '');
                    } else if (lastCalloutLineIndex + 2 >= lines.length) {
                        // If this is the end of the file, add empty line
                        lines.push('');
                    }
                    
                    // Write the modified content back to the file
                    await this.app.vault.modify(file, lines.join('\n'));
                    
                    // Update the callout cache to reflect the change
                    callout.calloutID = calloutID;
                }
            }
        } catch (error) {
            console.error('Error adding callout ID to callout:', error);
            new Notice('Failed to add callout ID to callout');
        }
    }

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

    highlightLine(editor: unknown, lineNumber: number) {
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
                z-index: 1;
            `;
            
            // Add CSS animation if not already added
            if (!document.getElementById('callout-organizer-highlight-style')) {
                const style = document.createElement('style');
                style.id = 'callout-organizer-highlight-style';
                style.textContent = `
                @keyframes callout-highlight-pulse {
                    0% { opacity: 0.8; transform: scale(1.02); }
                    50% { opacity: 0.5; }
                    100% { opacity: 0; transform: scale(1); }
                }
                .callout-organizer-highlight {
                    border-radius: 3px;
                }
                `;
                document.head.appendChild(style);
            }
            
            // Position the highlight with better error handling
            const editorWithDisplay = editor as any;
            if (editorWithDisplay.display && editorWithDisplay.display.lineDiv && editorWithDisplay.display.lineDiv.children) {
                const lineEl = editorWithDisplay.display.lineDiv.children[lineNumber];
                if (lineEl && markEl) {
                    lineEl.style.position = 'relative';
                    lineEl.appendChild(markEl);
                    
                    // Remove after animation
                    setTimeout(() => {
                        if (markEl && markEl.parentNode) {
                            markEl.parentNode.removeChild(markEl);
                        }
                    }, 3000);
                }
            }
        } catch (error) {
            console.warn('Failed to highlight line:', error);
        }
    }

    // Performance optimization methods
    private debouncedSearch() {
        if (this.searchDebounceTimer) {
            clearTimeout(this.searchDebounceTimer);
        }
        
        // Adaptive debouncing based on result size
        const delay = this.callouts.length > 100 ? this.SEARCH_DEBOUNCE_DELAY * 2 : this.SEARCH_DEBOUNCE_DELAY;
        
        this.searchDebounceTimer = setTimeout(() => {
            const calloutContainer = this.calloutContainerElement || this.containerEl.querySelector('.callout-container') as HTMLElement;
            if (calloutContainer) {
                this.renderCalloutsList(calloutContainer);
            }
        }, delay);
    }

    private debouncedRender() {
        const now = Date.now();
        if (now - this.lastRenderTime < this.MIN_RENDER_INTERVAL) {
            return;
        }
        this.lastRenderTime = now;
        
        const calloutContainer = this.containerEl.querySelector('.callout-container');
        if (calloutContainer) {
            this.renderCalloutsList(calloutContainer as HTMLElement);
        }
    }



    private processMathForElement(element: HTMLElement) {
        // Process math for individual callout elements
        try {
            const mathJax = (window as any).MathJax;
            if (mathJax?.typesetPromise) {
                // First, check if there are any math elements that need processing
                const mathElements = element.querySelectorAll('.math, mjx-container, [data-math], .cm-math');
                if (mathElements.length > 0) {
                    mathJax.typesetPromise([element]).then(() => {
                    // Ensure proper styling of math elements
                    element.querySelectorAll('mjx-container').forEach((mjx: Element) => {
                        const mjxElement = mjx as HTMLElement;
                        if (mjxElement.getAttribute('display') === 'true') {
                            mjxElement.style.display = 'block';
                            mjxElement.style.textAlign = 'center';
                            mjxElement.style.margin = '1em 0';
                        } else {
                            mjxElement.style.display = 'inline';
                            mjxElement.style.margin = '0';
                        }
                    });
                    }).catch(() => {
                        // Silent catch - let Obsidian handle errors
                    });
                }
            }
        } catch (error) {
            // Silently handle any errors in math processing
            console.warn('Math processing error:', error);
        }
    }

    async onClose() {
        // Clean up timers
        if (this.refreshDebounceTimer) {
            clearTimeout(this.refreshDebounceTimer);
            this.refreshDebounceTimer = null;
        }
        if (this.searchDebounceTimer) {
            clearTimeout(this.searchDebounceTimer);
            this.searchDebounceTimer = null;
        }
        
        // Clear cached DOM elements
        this.cachedTypeSelectorContainer = null;
        this.topBarElement = null;
        this.calloutContainerElement = null;
        
        // Comprehensive cleanup to free memory
        this.callouts = [];
        this.activeFilters.clear();
        
        // Clean up component
        this.component?.unload();
    }
}

export default class CalloutOrganizerPlugin extends Plugin {
    // Static regex patterns for better performance
    static readonly HEADING_REGEX = /^(#{1,6})\s+(.+)$/;
    static readonly CALLOUT_REGEX = /^>\s*\[!([^\]]+)\]\s*(.*?)$/;
    static readonly BLOCK_ID_REGEX = /\^([\w-]+)\s*$/;
    static readonly CONTENT_EXTRACT_REGEX = /^>\s?/;
    
    // Cache constants
    static readonly CACHE_VERSION = "1.3";
    static readonly PLUGIN_FOLDER = "callout-organizer";
    static readonly CACHE_FILENAME = "callouts.json";
    
    settings: CalloutOrganizerSettings;
    private cacheOperationLock: Promise<any> | null = null;
    private styleElement: HTMLStyleElement | null = null;

    async onload() {
        await this.loadSettings();

        this.registerView(
            VIEW_TYPE_CALLOUT_ORGANIZER,
            (leaf) => new CalloutOrganizerView(leaf, this, 'current')
        );

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




        this.addSettingTab(new CalloutOrganizerSettingTab(this.app, this));
        
        // Auto-detect and populate callout colors on startup
        await this.initializeCalloutColors();
        
        // Inject custom callout colors CSS
        this.injectCustomCalloutCSS();
    }

    async initializeCalloutColors() {
        try {
            // Get callout types from both vault scanning and cached data
            const vaultTypes = await this.getAllCalloutTypesInVault();
            const cachedTypes = await this.getAllCalloutTypesFromCache();
            
            // Combine both sets to ensure we have all callout types
            const detectedTypes = new Set([...vaultTypes, ...cachedTypes]);
            let settingsChanged = false;
            
            for (const type of detectedTypes) {
                if (!this.settings.calloutColors[type]) {
                    if (this.isBuiltinCalloutType(type)) {
                        // For built-in callouts, try to get Obsidian's actual colors first
                        const obsidianColor = this.getObsidianCalloutColor(type);
                        this.settings.calloutColors[type] = { 
                            color: obsidianColor,
                            icon: this.getDefaultIconForCalloutType(type)
                        };
                    } else {
                        // For custom callouts, use defaults
                        this.settings.calloutColors[type] = { 
                            color: this.getDefaultColorForCalloutType(type),
                            icon: this.getDefaultIconForCalloutType(type)
                        };
                    }
                    settingsChanged = true;
                } else if (!this.settings.calloutColors[type].icon) {
                    // Add icon to existing entries that don't have it
                    this.settings.calloutColors[type].icon = this.getDefaultIconForCalloutType(type);
                    settingsChanged = true;
                }
            }
            
            if (settingsChanged) {
                await this.saveSettings();
                // Regenerate CSS to include newly detected callouts
                this.injectCustomCalloutCSS();
            }
        } catch (error) {
            console.error('Error initializing callout colors:', error);
        }
    }

    private hexToRgb(hex: string): string {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        if (result) {
            return `${parseInt(result[1], 16)},${parseInt(result[2], 16)},${parseInt(result[3], 16)}`;
        }
        return '0,0,0'; // fallback to black
    }

    // Get callout types from cached JSON data
    async getAllCalloutTypesFromCache(): Promise<Set<string>> {
        const calloutTypes = new Set<string>();
        const cache = await this.loadCalloutCache();
        
        if (cache && cache.callouts) {
            for (const callout of cache.callouts) {
                calloutTypes.add(callout.type.toLowerCase().trim());
            }
            // Cached callout types loaded successfully
        } else {
            // No cached callouts found
        }
        
        return calloutTypes;
    }

    async getAllCalloutTypesInVault(): Promise<Set<string>> {
        const calloutTypes = new Set<string>();
        const files = this.app.vault.getMarkdownFiles();
        
        const calloutRegex = /^>\s*\[!([^\]]+)\]/gm;
        
        for (const file of files) {
            if (this.shouldSkipFile(file.path, true)) continue;
            
            try {
                const content = await this.app.vault.read(file);
                let match;
                let iterations = 0;
                const MAX_ITERATIONS = 1000; // Prevent infinite loops
                
                // Reset regex lastIndex to prevent issues
                calloutRegex.lastIndex = 0;
                
                while ((match = calloutRegex.exec(content)) !== null && iterations < MAX_ITERATIONS) {
                    const type = match[1].toLowerCase().trim();
                    calloutTypes.add(type);
                    iterations++;
                    
                    // Additional safety check for zero-width matches
                    if (match.index === calloutRegex.lastIndex) {
                        calloutRegex.lastIndex++;
                    }
                }
            } catch (error) {
                console.warn(`Failed to read file ${file.path} for callout scanning:`, error);
                continue;
            }
        }
        
        return calloutTypes;
    }

    isBuiltinCalloutType(type: string): boolean {
        // Define all built-in Obsidian callout types - exact list
        const builtinTypes = new Set([
            // Blue family
            'note', 'info', 'todo',
            // Teal family
            'abstract', 'summary', 'tldr', 'tip', 'hint', 'important',
            // Green family
            'success', 'check', 'done',
            // Orange family  
            'question', 'help', 'faq', 'warning', 'caution', 'attention',
            // Red family
            'failure', 'fail', 'missing', 'danger', 'error', 'bug',
            // Purple family
            'example',
            // Gray family
            'quote', 'cite'
        ]);
        
        return builtinTypes.has(type.toLowerCase());
    }

    getDefaultColorForCalloutType(type: string): string {
        // Define builtin callout colors - exact Obsidian defaults
        const builtinColors: Record<string, string> = {
            // Blue family
            'note': '#086DDD', 'info': '#086DDD', 'todo': '#086DDD',
            // Teal family  
            'abstract': '#00BFBC', 'summary': '#00BFBC', 'tldr': '#00BFBC',
            'tip': '#00BFBC', 'hint': '#00BFBC', 'important': '#00BFBC',
            // Green family
            'success': '#08B94E', 'check': '#08B94E', 'done': '#08B94E',
            // Orange family
            'question': '#EC7500', 'help': '#EC7500', 'faq': '#EC7500',
            'warning': '#EC7500', 'caution': '#EC7500', 'attention': '#EC7500',
            // Red family
            'failure': '#E93147', 'fail': '#E93147', 'missing': '#E93147',
            'danger': '#E93147', 'error': '#E93147', 'bug': '#E93147',
            // Purple family
            'example': '#7852EE',
            // Gray family
            'quote': '#9E9E9E', 'cite': '#9E9E9E',
            // Mathematical/Academic callouts (supporting academic workflows)
            'theorem': '#F19837', 'lemma': '#F5CA00', 'proposition': '#A28AE5',
            'definition': '#2EA4E5', 'corollary': '#E56EEE', 'conjecture': '#FF6699',
            'remark': '#FF6666', 'exercise': '#FF6699', 'problem': '#FF6699'
        };
        
        // Return builtin color if available, otherwise default to note color
        return builtinColors[type] || '#086DDD';
    }

    getDefaultIconForCalloutType(type: string): string {
        // Define builtin callout icons - exact Obsidian defaults
        const builtinIcons: Record<string, string> = {
            // Blue family
            'note': 'pencil', 'info': 'info', 'todo': 'check-circle-2',
            // Teal family
            'abstract': 'clipboard-list', 'summary': 'clipboard-list', 'tldr': 'clipboard-list',
            'tip': 'flame', 'hint': 'flame', 'important': 'flame',
            // Green family
            'success': 'check', 'check': 'check', 'done': 'check',
            // Orange family
            'question': 'help-circle', 'help': 'help-circle', 'faq': 'help-circle',
            'warning': 'alert-triangle', 'caution': 'alert-triangle', 'attention': 'alert-triangle',
            // Red family
            'failure': 'x', 'fail': 'x', 'missing': 'x',
            'danger': 'zap', 'error': 'zap', 'bug': 'bug',
            // Purple family
            'example': 'list',
            // Gray family
            'quote': 'quote', 'cite': 'quote',
            // Mathematical/Academic callouts (common in academic vaults)
            'theorem': 'zap', 'lemma': 'lightbulb', 'proposition': 'star',
            'definition': 'book-open', 'corollary': 'arrow-right', 'conjecture': 'help-circle',
            'remark': 'message-circle', 'exercise': 'dumbbell', 'problem': 'puzzle'
        };
        
        // Return builtin icon if available, otherwise default to note icon
        return builtinIcons[type] || 'pencil';
    }

    getObsidianCalloutColor(type: string): string {
        // Create a temporary callout element to get computed styles
        const tempCallout = document.createElement('div');
        tempCallout.className = 'callout';
        tempCallout.setAttribute('data-callout', type);
        tempCallout.style.position = 'absolute';
        tempCallout.style.left = '-9999px';
        tempCallout.style.opacity = '0';
        document.body.appendChild(tempCallout);
        
        const computedStyle = getComputedStyle(tempCallout);
        const colorValue = computedStyle.getPropertyValue('--callout-color').trim();
        
        document.body.removeChild(tempCallout);
        
        // If we got a CSS variable value like "68,138,255", convert to hex
        if (colorValue && colorValue.includes(',')) {
            const colorParts = colorValue.split(',').map(x => parseInt(x.trim()));
            if (colorParts.length >= 3 && colorParts.every(x => !isNaN(x) && x >= 0 && x <= 255)) {
                const [r, g, b] = colorParts;
                return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
            }
        }
        
        // Fallback to stored color if we can't get computed color
        return this.settings.calloutColors[type]?.color || '#448aff';
    }

    injectCustomCalloutCSS() {
        // Remove existing style element if it exists
        if (this.styleElement) {
            this.styleElement.remove();
        }

        // Create new style element
        this.styleElement = document.createElement('style');
        this.styleElement.id = 'callout-organizer-custom-styles';
        
        let css = '';
        
        // Add font size styles and native callout support
        css += `
.callout-organizer-item {
    font-size: ${this.settings.calloutFontSize}px;
    --callout-font-size: ${this.settings.calloutFontSize}px;
}

.callout-organizer-breadcrumb {
    font-size: ${this.settings.breadcrumbFontSize}px;
}

/* Let native callouts in organizer use their natural styling */
.callout-organizer-item.callout {
    /* Minimal override - only set margin for organizer spacing */
    margin: 8px 0;
}`;
        
        // Generate CSS for each callout type - both built-in and custom
        for (const [type, colors] of Object.entries(this.settings.calloutColors)) {
            const rgbColor = this.hexToRgb(colors.color);
            const iconName = colors.icon || 'none';
            
            if (this.isBuiltinCalloutType(type)) {
                // For built-in callouts, only override if user has customized them
                const defaultColor = this.getDefaultColorForCalloutType(type);
                const defaultIcon = this.getDefaultIconForCalloutType(type);
                const hasCustomColor = colors.color !== defaultColor;
                const hasCustomIcon = colors.icon !== defaultIcon;
                
                
                if (hasCustomColor || hasCustomIcon) {
                    // User has customized this built-in callout, apply globally with high specificity
                    css += `
/* User customized built-in callout: ${type} */
.callout[data-callout="${type}"].callout,
.callout-organizer-item.callout[data-callout="${type}"] {`;
                    if (hasCustomColor) {
                        css += `
    --callout-color: ${rgbColor} !important;
    --callout-border-color: ${rgbColor} !important;
    --callout-title-color: ${rgbColor} !important;`;
                    }
                    if (hasCustomIcon) {
                        css += `
    --callout-icon: ${iconName === 'none' ? 'none' : `lucide-${iconName}`} !important;`;
                    }
                    css += `
}`;
                }
                
                // Always style the filter buttons with current colors
                css += `
.callout-filter-${type}.active {
    background: rgba(${rgbColor}, 0.2);
    border-color: rgb(${rgbColor});
    color: rgb(${rgbColor});
}`;
            } else {
                // For custom callouts, provide essential styling with high specificity
                css += `
/* Custom callout styling for ${type} */
.callout[data-callout="${type}"].callout,
.callout-organizer-item.callout[data-callout="${type}"] {
    --callout-color: ${rgbColor} !important;
    --callout-border-color: ${rgbColor} !important;
    --callout-title-color: ${rgbColor} !important;
    --callout-icon: ${iconName === 'none' ? 'none' : `lucide-${iconName}`} !important;
}

.callout-filter-${type}.active {
    background: rgba(${rgbColor}, 0.2);
    border-color: rgb(${rgbColor});
    color: rgb(${rgbColor});
}`;
            }
        }
        
        // Add custom CSS if specified (applies to all callouts globally)
        if (this.settings.customCalloutCSS) {
            css += `
/* Custom Callout CSS - Global */
.callout {
    ${this.settings.customCalloutCSS}
}`;
        }
        
        // Add invisible embeddings CSS if enabled
        if (this.settings.invisibleEmbeddings) {
            css += `
/* Invisible Embeddings */
.markdown-embed {
    padding: 0;
    border: 0;
}`;
        }
        
        this.styleElement.textContent = css;
        document.head.appendChild(this.styleElement);
    }


    async activateCalloutOrganizer() {
        this.app.workspace.detachLeavesOfType(VIEW_TYPE_CALLOUT_ORGANIZER);

        const rightLeaf = this.app.workspace.getRightLeaf(false);
        if (rightLeaf) {
            await rightLeaf.setViewState({
                type: VIEW_TYPE_CALLOUT_ORGANIZER,
                active: true,
            });
            
            // Set the view to current mode by default (user can toggle to search mode within the view)
            const view = rightLeaf.view as CalloutOrganizerView;
            if (view) {
                view.searchMode = 'current';
            }
        }

        const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_CALLOUT_ORGANIZER);
        if (leaves.length > 0) {
            this.app.workspace.revealLeaf(leaves[0]);
        }
    }

    getCalloutView(): CalloutOrganizerView | null {
        const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_CALLOUT_ORGANIZER);
        if (leaves.length > 0) {
            return leaves[0].view as CalloutOrganizerView;
        }
        return null;
    }

    async extractCurrentFileCallouts(): Promise<CalloutItem[]> {
        const activeFile = this.app.workspace.getActiveFile();
        if (!activeFile || !activeFile.path.endsWith('.md')) {
            return [];
        }
        
        // Load cache once for current file extraction
        const existingCache = await this.loadCalloutCache();
        return await this.extractCalloutsFromFile(activeFile, existingCache);
    }

    async extractAllCallouts(): Promise<CalloutItem[]> {
        console.log('=== extractAllCallouts called ===');
        
        // Try to load from cache first
        if (this.settings.enableFileCache) {
            console.log('File cache is enabled, checking for existing cache...');
            const cache = await this.loadCalloutCache();
            if (cache && await this.isCacheValid(cache)) {
                console.log(`✅ Using cached callouts: ${cache.callouts.length} items`);
                // Sort callouts by modification time (recent first) for search mode
                const sortedCallouts = [...cache.callouts].sort((a, b) => {
                    const aModTime = a.calloutModifyTime || a.fileModTime || '1970-01-01 00:00:00';
                    const bModTime = b.calloutModifyTime || b.fileModTime || '1970-01-01 00:00:00';
                    return readableToTimestamp(bModTime) - readableToTimestamp(aModTime);
                });
                return sortedCallouts;
            } else {
                console.log('❌ Cache invalid or not found, will scan files');
            }
        } else {
            console.log('File cache is disabled');
        }

        // Cache miss or invalid, scan all files
        console.log('📁 Scanning all files for callouts...');
        const callouts = await this.scanAllCallouts();
        
        // Save to cache if enabled
        if (this.settings.enableFileCache) {
            console.log('💾 Saving to cache...');
            const saveResult = await this.saveCalloutCache(callouts);
            if (saveResult) {
                console.log(`✅ Saved ${callouts.length} callouts to cache`);
            } else {
                console.log('❌ Failed to save to cache');
            }
        }

        return callouts;
    }

    async scanAllCallouts(): Promise<CalloutItem[]> {
        const callouts: CalloutItem[] = [];
        const files = this.app.vault.getMarkdownFiles();
        const currentFile = this.app.workspace.getActiveFile();
        const processedFiles = new Set<string>();
        
        // Load existing cache once for all files (performance fix)
        const existingCache = await this.loadCalloutCache();
        
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

    async refreshAllCallouts(): Promise<CalloutItem[]> {
        console.log('Refreshing callouts - rescanning all files...');
        const callouts = await this.scanAllCallouts();
        
        // Update cache
        if (this.settings.enableFileCache) {
            await this.saveCalloutCache(callouts);
            console.log(`Updated cache with ${callouts.length} callouts`);
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

    // Create a unique signature for a callout to track its creation time
    private createCalloutSignature(filePath: string, calloutID?: string): string {
        // If callout has an ID, use file + calloutID for unique identification
        if (calloutID) {
            return `${filePath}:${calloutID}`;
        }
        // Fallback: generate a temporary ID based on file hash and timestamp
        // This will be replaced with a real calloutID when the callout gets one
        const tempId = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        return `${filePath}:${tempId}`;
    }

    async extractCalloutsFromFile(file: TFile, existingCache?: CalloutCache | null): Promise<CalloutItem[]> {
        const content = await this.app.vault.read(file);
        const lines = content.split('\n');
        const callouts: CalloutItem[] = [];
        const fileModTime = file.stat.mtime;
        
        // Use provided cache or load it if not provided (for backward compatibility)
        if (existingCache === undefined) {
            existingCache = await this.loadCalloutCache();
        }
        
        // Use static regex patterns for better performance
        const headingRegex = CalloutOrganizerPlugin.HEADING_REGEX;
        const calloutRegex = CalloutOrganizerPlugin.CALLOUT_REGEX;
        const blockIdRegex = CalloutOrganizerPlugin.BLOCK_ID_REGEX;
        
        // Pre-calculate all headers once for this file (performance optimization)
        const allHeaders: HeadingInfo[] = [];
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (line.startsWith('#')) {
                const headingMatch = line.match(headingRegex);
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
            const calloutMatch = line.match(calloutRegex);
            if (calloutMatch) {
                const type = calloutMatch[1].toLowerCase();
                
                // No type filtering needed as we removed showCalloutTypes
                
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
                            const nextCalloutMatch = nextLine.match(calloutRegex);
                            if (nextCalloutMatch) {
                                // This is the start of a new callout, stop here
                                break;
                            }
                        }
                        
                        // This is regular callout content
                        const contentLine = nextLine.replace(/^>\s?/, '');
                        
                        // Check for callout ID
                        const blockMatch = contentLine.match(blockIdRegex);
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
                
                // Create callout signature for time tracking
                // If callout has an ID, use that for tracking, otherwise use content-based fallback
                let calloutSignature: string;
                if (calloutID) {
                    calloutSignature = this.createCalloutSignature(file.path, calloutID);
                } else {
                    // Fallback to content-based signature for callouts without IDs
                    calloutSignature = `${file.path}:${currentLineNumber}:${type}:${title}`;
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
                
                if (calloutID) {
                    // For callouts with IDs: use proper time tracking
                    if (existingCache?.calloutCreationTimes?.[calloutSignature]) {
                        // This callout already exists, keep the original creation time
                        creationTime = existingCache.calloutCreationTimes[calloutSignature];
                        
                        // Find existing callout to compare content
                        const existingCallout = existingCache.callouts?.find(c => 
                            c.calloutID === calloutID && c.file === file.path
                        );
                        
                        if (existingCallout && hasCalloutChanged(preliminaryCallout, existingCallout)) {
                            // Content has changed, update modification time
                            modificationTime = currentReadableTime;
                        } else {
                            // Content hasn't changed, keep existing modification time
                            modificationTime = existingCallout?.calloutModifyTime || currentReadableTime;
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
                
                callouts.push(calloutItem);
            }
        }
        
        return callouts;
    }

    // Cache management methods
    getCacheFilePath(): string {
        return `.obsidian/plugins/${CalloutOrganizerPlugin.PLUGIN_FOLDER}/${CalloutOrganizerPlugin.CACHE_FILENAME}`;
    }

    async loadCalloutCache(): Promise<CalloutCache | null> {
        if (!this.settings.enableFileCache) {
            return null;
        }

        // Wait for any ongoing cache operations to complete
        if (this.cacheOperationLock) {
            await this.cacheOperationLock;
        }

        try {
            const cacheFilePath = this.getCacheFilePath();
            console.log(`Attempting to load cache from: ${cacheFilePath}`);
            
            // Use Obsidian's vault adapter instead of Node.js fs
            const adapter = this.app.vault.adapter;
            const exists = await adapter.exists(cacheFilePath);
            if (!exists) {
                console.log('Cache file does not exist');
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

            // Backward compatibility: ensure calloutCreationTimes exists and convert old numeric timestamps
            if (!cache.calloutCreationTimes) {
                cache.calloutCreationTimes = {};
            } else {
                // Convert old numeric timestamps to readable format
                const convertedTimes: Record<string, string> = {};
                for (const [signature, time] of Object.entries(cache.calloutCreationTimes)) {
                    if (typeof time === 'number') {
                        // Old format: numeric timestamp
                        convertedTimes[signature] = timestampToReadable(time);
                    } else {
                        // New format: already readable
                        convertedTimes[signature] = time as string;
                    }
                }
                cache.calloutCreationTimes = convertedTimes;
            }

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
            if (cache.version !== CalloutOrganizerPlugin.CACHE_VERSION) {
                console.log('Cache version mismatch, invalidating cache');
                return null;
            }

            const currentVaultPath = this.app.vault.getName() || '';
            if (cache.vaultPath !== currentVaultPath) {
                console.log(`Vault path changed (${cache.vaultPath} != ${currentVaultPath}), invalidating cache`);
                return null;
            }

            console.log(`✅ Successfully loaded ${cache.callouts.length} callouts from plugin folder cache`);
            return cache;
        } catch (error) {
            console.warn('Failed to load callout cache:', error);
            return null;
        }
    }

    async saveCalloutCache(callouts: CalloutItem[]): Promise<boolean> {
        if (!this.settings.enableFileCache) {
            console.log('File cache is disabled, skipping save');
            return false;
        }

        console.log(`Attempting to save ${callouts.length} callouts to cache...`);

        // Create a lock to prevent concurrent cache operations
        const saveOperation = async (): Promise<boolean> => {
            try {
            // Collect file modification times in readable format
            const fileModTimes: Record<string, string> = {};
            const files = this.app.vault.getMarkdownFiles();
            
            for (const file of files) {
                if (!this.shouldSkipFile(file.path, true)) {
                    fileModTimes[file.path] = timestampToReadable(file.stat.mtime);
                }
            }

            // Extract callout creation times from callouts
            const calloutCreationTimes: Record<string, string> = {};
            for (const callout of callouts) {
                if (callout.calloutCreatedTime) {
                    let signature: string;
                    if (callout.calloutID) {
                        signature = this.createCalloutSignature(callout.file, callout.calloutID);
                    } else {
                        // Fallback to content-based signature for callouts without IDs
                        signature = `${callout.file}:${callout.lineNumber}:${callout.type}:${callout.title}`;
                    }
                    calloutCreationTimes[signature] = callout.calloutCreatedTime!;
                }
            }

            const cache: CalloutCache = {
                version: CalloutOrganizerPlugin.CACHE_VERSION,
                timestamp: Date.now(),
                vaultPath: this.app.vault.getName() || '',
                callouts,
                fileModTimes,
                calloutCreationTimes
            };

            // Save using Obsidian's vault adapter instead of Node.js fs
            const cacheFilePath = this.getCacheFilePath();
            const cacheContent = JSON.stringify(cache, null, 2);

            console.log(`Saving cache to: ${cacheFilePath}`);

            // Ensure the directory exists
            const adapter = this.app.vault.adapter;
            const pluginDir = `.obsidian/plugins/${CalloutOrganizerPlugin.PLUGIN_FOLDER}`;
            if (!(await adapter.exists(pluginDir))) {
                await adapter.mkdir(pluginDir);
            }

            await adapter.write(cacheFilePath, cacheContent);
            console.log('✅ Cache file saved successfully to plugin folder');
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

    async isCacheValid(cache: CalloutCache): Promise<boolean> {
        if (!cache || !this.settings.enableFileCache) {
            return false;
        }

        try {
            // Check if any files have been modified since cache was created
            for (const [filePath, cachedModTime] of Object.entries(cache.fileModTimes)) {
                const file = this.app.vault.getAbstractFileByPath(filePath);
                if (file instanceof TFile) {
                    if (file.stat.mtime > readableToTimestamp(cachedModTime)) {
                        console.log(`File ${filePath} has been modified, cache invalid`);
                        return false;
                    }
                } else {
                    // File no longer exists
                    console.log(`File ${filePath} no longer exists, cache invalid`);
                    return false;
                }
            }

            // Check for new files
            const currentFiles = this.app.vault.getMarkdownFiles();
            for (const file of currentFiles) {
                if (!this.shouldSkipFile(file.path, true) && !cache.fileModTimes.hasOwnProperty(file.path)) {
                    console.log(`New file ${file.path} found, cache invalid`);
                    return false;
                }
            }

            return true;
        } catch (error) {
            console.warn('Error validating cache:', error);
            return false;
        }
    }

    onunload() {
        this.app.workspace.detachLeavesOfType(VIEW_TYPE_CALLOUT_ORGANIZER);
        
        // Clean up style element
        if (this.styleElement) {
            this.styleElement.remove();
            this.styleElement = null;
        }
        
        // Clean up highlight style element
        const highlightStyle = document.getElementById('callout-organizer-highlight-style');
        if (highlightStyle) {
            highlightStyle.remove();
        }
        
        // Clean up any remaining highlight elements
        const highlights = document.querySelectorAll('.callout-organizer-highlight');
        highlights.forEach(el => el.remove());
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }
}

class CalloutOrganizerSettingTab extends PluginSettingTab {
    plugin: CalloutOrganizerPlugin;

    constructor(app: App, plugin: CalloutOrganizerPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }


    display(): void {
        const {containerEl} = this;

        containerEl.empty();

        // Use h1 to match Obsidian's standard settings hierarchy
        containerEl.createEl('h1', {text: 'Callout Organizer Settings'});

        // Performance Options
        containerEl.createEl('h3', {text: 'Performance Options'});

        const performanceContainer = containerEl.createEl('div', {cls: 'callout-settings-indent'});

        new Setting(performanceContainer)
            .setName('Enable File Cache')
            .setDesc('Cache callouts in a file to improve startup performance. Disabling this will scan all files each time.')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.enableFileCache)
                .onChange(async (value) => {
                    this.plugin.settings.enableFileCache = value;
                    await this.plugin.saveSettings();
                    
                    if (value) {
                        new Notice('File cache enabled. Callouts will be cached for faster startup.');
                    } else {
                        new Notice('File cache disabled. Plugin will scan files on each startup.');
                        
                        // Clean up existing cache file if it exists
                        try {
                            const cacheFilePath = this.plugin.getCacheFilePath();
                            const cacheFile = this.app.vault.getAbstractFileByPath(cacheFilePath);
                            
                            if (cacheFile && cacheFile instanceof TFile) {
                                await this.app.vault.delete(cacheFile);
                                console.log('Cache file deleted via Obsidian API');
                            }
                            
                            // Also try to clean up from plugin folder using Obsidian adapter
                            const adapter = this.app.vault.adapter;
                            const pluginCachePath = this.plugin.getCacheFilePath();
                            
                            if (await adapter.exists(pluginCachePath)) {
                                await adapter.remove(pluginCachePath);
                                console.log('Plugin folder cache file also deleted');
                            }
                        } catch (error) {
                            console.warn('Failed to delete cache file:', error);
                        }
                    }
                }));


        containerEl.createEl('h3', {text: 'Display Options'});

        // Create indented container for display sub-options
        const displayContainer = containerEl.createEl('div', {cls: 'callout-settings-indent'});

        new Setting(displayContainer)
            .setName('Show Filenames')
            .setDesc('Display filenames in the breadcrumb navigation')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.showFilenames)
                .onChange(async (value) => {
                    this.plugin.settings.showFilenames = value;
                    await this.plugin.saveSettings();
                    // Refresh view
                    const view = this.plugin.getCalloutView();
                    if (view) {
                        await view.refreshCallouts();
                    }
                }));

        new Setting(displayContainer)
            .setName('Show H1 Headers')
            .setDesc('Display H1 headers (# Header) in the breadcrumb navigation')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.showH1Headers)
                .onChange(async (value) => {
                    this.plugin.settings.showH1Headers = value;
                    await this.plugin.saveSettings();
                    // Refresh view
                    const view = this.plugin.getCalloutView();
                    if (view) {
                        await view.refreshCallouts();
                    }
                }));

        new Setting(displayContainer)
            .setName('Show H2 Headers')
            .setDesc('Display H2 headers (## Header) in the breadcrumb navigation')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.showH2Headers)
                .onChange(async (value) => {
                    this.plugin.settings.showH2Headers = value;
                    await this.plugin.saveSettings();
                    // Refresh view
                    const view = this.plugin.getCalloutView();
                    if (view) {
                        await view.refreshCallouts();
                    }
                }));

        new Setting(displayContainer)
            .setName('Show H3 Headers')
            .setDesc('Display H3 headers (### Header) in the breadcrumb navigation')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.showH3Headers)
                .onChange(async (value) => {
                    this.plugin.settings.showH3Headers = value;
                    await this.plugin.saveSettings();
                    // Refresh view
                    const view = this.plugin.getCalloutView();
                    if (view) {
                        await view.refreshCallouts();
                    }
                }));

        new Setting(displayContainer)
            .setName('Show H4 Headers')
            .setDesc('Display H4 headers (#### Header) in the breadcrumb navigation')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.showH4Headers)
                .onChange(async (value) => {
                    this.plugin.settings.showH4Headers = value;
                    await this.plugin.saveSettings();
                    // Refresh view
                    const view = this.plugin.getCalloutView();
                    if (view) {
                        await view.refreshCallouts();
                    }
                }));

        new Setting(displayContainer)
            .setName('Show H5 Headers')
            .setDesc('Display H5 headers (##### Header) in the breadcrumb navigation')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.showH5Headers)
                .onChange(async (value) => {
                    this.plugin.settings.showH5Headers = value;
                    await this.plugin.saveSettings();
                    // Refresh view
                    const view = this.plugin.getCalloutView();
                    if (view) {
                        await view.refreshCallouts();
                    }
                }));

        new Setting(displayContainer)
            .setName('Show H6 Headers')
            .setDesc('Display H6 headers (###### Header) in the breadcrumb navigation')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.showH6Headers)
                .onChange(async (value) => {
                    this.plugin.settings.showH6Headers = value;
                    await this.plugin.saveSettings();
                    // Refresh view
                    const view = this.plugin.getCalloutView();
                    if (view) {
                        await view.refreshCallouts();
                    }
                }));

        new Setting(displayContainer)
            .setName('Show Callout IDs')
            .setDesc('Display callout block IDs (^callout-id) in the breadcrumb navigation')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.showCalloutIds)
                .onChange(async (value) => {
                    this.plugin.settings.showCalloutIds = value;
                    await this.plugin.saveSettings();
                    // Refresh view
                    const view = this.plugin.getCalloutView();
                    if (view) {
                        await view.refreshCallouts();
                    }
                }));

        new Setting(displayContainer)
            .setName('Callout Font Size')
            .setDesc('Font size for callout content in pixels')
            .addText(text => text
                .setPlaceholder('14')
                .setValue(this.plugin.settings.calloutFontSize.toString())
                .onChange(async (value) => {
                    const numValue = parseInt(value);
                    if (!isNaN(numValue) && numValue > 0) {
                        this.plugin.settings.calloutFontSize = numValue;
                        await this.plugin.saveSettings();
                        this.plugin.injectCustomCalloutCSS();
                    }
                }));

        new Setting(displayContainer)
            .setName('Breadcrumb Font Size')
            .setDesc('Font size for breadcrumb navigation in pixels')
            .addText(text => text
                .setPlaceholder('12')
                .setValue(this.plugin.settings.breadcrumbFontSize.toString())
                .onChange(async (value) => {
                    const numValue = parseInt(value);
                    if (!isNaN(numValue) && numValue > 0) {
                        this.plugin.settings.breadcrumbFontSize = numValue;
                        await this.plugin.saveSettings();
                        this.plugin.injectCustomCalloutCSS();
                    }
                }));

        containerEl.createEl('h3', {text: 'Drag Options'});

        // Create indented container for drag sub-options
        const dragContainer = containerEl.createEl('div', {cls: 'callout-settings-indent'});

        new Setting(dragContainer)
            .setName('Use Embed Links')
            .setDesc('Use embed links (![[...]]) instead of regular links ([[...]]) when dragging callouts')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.useEmbedLinks)
                .onChange(async (value) => {
                    this.plugin.settings.useEmbedLinks = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(dragContainer)
            .setName('Invisible Embeddings')
            .setDesc('Make embedded callouts appear seamlessly without padding or borders')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.invisibleEmbeddings)
                .onChange(async (value) => {
                    this.plugin.settings.invisibleEmbeddings = value;
                    await this.plugin.saveSettings();
                    this.plugin.injectCustomCalloutCSS();
                }));

        new Setting(dragContainer)
            .setName('Hide file names in links')
            .setDesc('When dragging callouts, hide file names by adding aliases. Example: [[filename#^theorem-def456|theorem-def456]]')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.hideFileNamesInLinks)
                .onChange(async (value) => {
                    this.plugin.settings.hideFileNamesInLinks = value;
                    await this.plugin.saveSettings();
                }));

        containerEl.createEl('h3', {text: 'Search Options'});

        // Create indented container for search sub-options  
        const searchContainer = containerEl.createEl('div', {cls: 'callout-settings-indent'});

        new Setting(searchContainer)
            .setName('Excluded Folders')
            .setDesc('Exclude these folders from search (comma-separated)')
            .addTextArea(text => text
                .setPlaceholder('folder1, folder2/subfolder')
                .setValue(this.plugin.settings.excludedFolders.join(', '))
                .onChange(async (value) => {
                    this.plugin.settings.excludedFolders = value.split(',').map(s => s.trim()).filter(s => s);
                    await this.plugin.saveSettings();
                }));

        new Setting(searchContainer)
            .setName('Maximum Search Results')
            .setDesc('Limit the number of search results to improve performance')
            .addText(text => text
                .setPlaceholder('50')
                .setValue(this.plugin.settings.maxSearchResults.toString())
                .onChange(async (value) => {
                    const numValue = parseInt(value);
                    if (!isNaN(numValue) && numValue > 0) {
                        this.plugin.settings.maxSearchResults = numValue;
                        await this.plugin.saveSettings();
                    }
                }));

        new Setting(searchContainer)
            .setName('Search in Filenames')
            .setDesc('Include file paths and names in search results')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.searchInFilenames)
                .onChange(async (value) => {
                    this.plugin.settings.searchInFilenames = value;
                    await this.plugin.saveSettings();
                    // Refresh view to update placeholder
                    const view = this.plugin.getCalloutView();
                    if (view) {
                        await view.refreshCallouts();
                    }
                }));

        new Setting(searchContainer)
            .setName('Search in Callout Titles')
            .setDesc('Include callout titles (> [!type] Callout Titles) in search results')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.searchInCalloutTitles)
                .onChange(async (value) => {
                    this.plugin.settings.searchInCalloutTitles = value;
                    await this.plugin.saveSettings();
                    // Refresh view to update placeholder
                    const view = this.plugin.getCalloutView();
                    if (view) {
                        await view.refreshCallouts();
                    }
                }));

        new Setting(searchContainer)
            .setName('Search in Callout IDs')
            .setDesc('Include callout identifiers (^callout-id) in search results')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.searchInCalloutIds)
                .onChange(async (value) => {
                    this.plugin.settings.searchInCalloutIds = value;
                    await this.plugin.saveSettings();
                    // Refresh view to update placeholder
                    const view = this.plugin.getCalloutView();
                    if (view) {
                        await view.refreshCallouts();
                    }
                }));

        new Setting(searchContainer)
            .setName('Search in Callout Content')
            .setDesc('Include callout content/body text in search results')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.searchInCalloutContent)
                .onChange(async (value) => {
                    this.plugin.settings.searchInCalloutContent = value;
                    await this.plugin.saveSettings();
                    // Refresh view to update placeholder
                    const view = this.plugin.getCalloutView();
                    if (view) {
                        await view.refreshCallouts();
                    }
                }));

        // Folder filtering settings moved to top above


        // Callout Options Section
        containerEl.createEl('h3', {text: 'Callout Options'});
        
        const calloutOptionsContainer = containerEl.createEl('div', {cls: 'callout-settings-indent'});
        
        // Add tip about restarting Obsidian
        calloutOptionsContainer.createEl('p', {
            text: '💡 Note: Some CSS changes may require restarting Obsidian to take full effect.',
            cls: 'setting-item-description'
        });
        
        // Add clickable GitHub link
        const githubLinkContainer = calloutOptionsContainer.createEl('p', {
            cls: 'setting-item-description'
        });
        githubLinkContainer.createEl('span', {
            text: 'See recommended CSS snippets and colors at: '
        });
        const githubLink = githubLinkContainer.createEl('a', {
            text: 'https://github.com/mathmaid/obsidian-callout-organizer',
            href: 'https://github.com/mathmaid/obsidian-callout-organizer'
        });
        githubLink.addEventListener('click', (e) => {
            e.preventDefault();
            window.open('https://github.com/mathmaid/obsidian-callout-organizer', '_blank');
        });
        
        // Custom CSS Section - moved to top
        calloutOptionsContainer.createEl('h4', {text: 'Custom CSS'});
        
        new Setting(calloutOptionsContainer)
            .setName('Custom Callout CSS')
            .setDesc('Add custom CSS properties that apply to ALL callouts throughout Obsidian (editor and plugin)')
            .addTextArea(text => {
                text.setPlaceholder('/* custom css snippets */');
                text.setValue(this.plugin.settings.customCalloutCSS);
                text.onChange(async (value) => {
                    this.plugin.settings.customCalloutCSS = value;
                    await this.plugin.saveSettings();
                    this.plugin.injectCustomCalloutCSS();
                });
            });
        
        // Callout Colors Section
        calloutOptionsContainer.createEl('h4', {text: 'Callout Colors'});
        // Callout Colors Section (keeping existing structure)
        
        const colorsContainer = calloutOptionsContainer.createEl('div');
        
        colorsContainer.createEl('p', {
            text: 'Customize colors for callout types found in your vault. New callout types are automatically detected.',
            cls: 'setting-item-description'
        });

        // Create simplified color settings for detected callout types
        this.createDynamicCalloutColorSettings(colorsContainer);
    }

    private async createDynamicCalloutColorSettings(container: HTMLElement) {
        // Show loading message while scanning
        const loadingEl = container.createEl('p', {text: 'Scanning vault for callout types...', cls: 'setting-item-description'});
        
        try {
            // Get all callout types from both vault and cache
            const vaultTypes = await this.plugin.getAllCalloutTypesInVault();
            const cachedTypes = await this.plugin.getAllCalloutTypesFromCache();
            const detectedTypes = new Set([...vaultTypes, ...cachedTypes]);
            const sortedTypes = Array.from(detectedTypes).sort();
            
            // Remove loading message
            loadingEl.remove();
            
            if (sortedTypes.length === 0) {
                container.createEl('p', {text: 'No callouts found in your vault.', cls: 'setting-item-description'});
                return;
            }
            
            // Ensure all detected types have colors in settings
            for (const type of sortedTypes) {
                if (!this.plugin.settings.calloutColors[type]) {
                    if (this.plugin.isBuiltinCalloutType(type)) {
                        // For built-in callouts, use actual Obsidian colors
                        const obsidianColor = this.plugin.getObsidianCalloutColor(type);
                        this.plugin.settings.calloutColors[type] = { 
                            color: obsidianColor,
                            icon: this.plugin.getDefaultIconForCalloutType(type)
                        };
                    } else {
                        // For custom callouts, use defaults
                        this.plugin.settings.calloutColors[type] = { 
                            color: this.getDefaultColorForType(type),
                            icon: this.getDefaultIconForCalloutType(type)
                        };
                    }
                } else if (!this.plugin.settings.calloutColors[type].icon) {
                    // Add icon to existing entries that don't have it
                    this.plugin.settings.calloutColors[type].icon = this.getDefaultIconForCalloutType(type);
                }
            }
            
            // Save updated settings
            await this.plugin.saveSettings();
            
            // Regenerate CSS to include newly detected callouts
            this.plugin.injectCustomCalloutCSS();
            
            // Refresh the organizer view if it's open
            const view = this.plugin.getCalloutView();
            if (view) {
                await view.refreshCallouts();
            }
            
            // Display info about detected types
            container.createEl('p', {
                text: `Found ${sortedTypes.length} callout types in your vault.`,
                cls: 'setting-item-description'
            });
            
            // Separate built-in and user callouts
            const builtinTypes = sortedTypes.filter(type => this.plugin.isBuiltinCalloutType(type));
            const userTypes = sortedTypes.filter(type => !this.plugin.isBuiltinCalloutType(type));
            
            // Display built-in callouts section
            if (builtinTypes.length > 0) {
                container.createEl('h5', {text: 'Built-in Obsidian Callouts'});
                container.createEl('p', {
                    text: `${builtinTypes.length} built-in callout types. Reset button restores Obsidian defaults.`,
                    cls: 'setting-item-description'
                });
                
                for (const type of builtinTypes) {
                    const colors = this.plugin.settings.calloutColors[type];
                    this.createCalloutSetting(container, type, colors, true);
                }
            }
            
            // Display user callouts section
            if (userTypes.length > 0) {
                container.createEl('h5', {text: 'Custom Callouts'});
                container.createEl('p', {
                    text: `${userTypes.length} custom callout types. Reset button sets to note callout defaults.`,
                    cls: 'setting-item-description'
                });
                
                for (const type of userTypes) {
                    const colors = this.plugin.settings.calloutColors[type];
                    this.createCalloutSetting(container, type, colors, false);
                }
            }
            
                
        } catch (error) {
            loadingEl.textContent = 'Error scanning vault for callouts.';
            console.error('Error scanning for callouts:', error);
        }
    }

    private createCalloutSetting(container: HTMLElement, type: string, colors: any, isBuiltin: boolean) {
                
                const setting = new Setting(container)
                    .setName(`${type.charAt(0).toUpperCase() + type.slice(1)} Callout`);

                // Add icon preview
                const iconPreview = setting.controlEl.createDiv({ cls: 'callout-icon-preview' });
                const updateIconPreview = () => {
                    iconPreview.empty();
                    if (colors.icon && colors.icon !== 'none') {
                        // Special handling for note callout to ensure we get the correct lucide-pencil
                        if (type === 'note' && colors.icon === 'pencil') {
                            iconPreview.innerHTML = OBSIDIAN_NOTE_ICON_SVG;
                        } else {
                            setIcon(iconPreview, colors.icon);
                        }
                        iconPreview.style.color = colors.color;
                    }
                };
                updateIconPreview();

                let colorPicker: any;
                let dropdownRef: any;
                
                setting
                    .addColorPicker(color => {
                        colorPicker = color;
                        return color
                        .setValue(colors.color)
                        .onChange(async (value) => {
                            this.plugin.settings.calloutColors[type].color = value;
                            await this.plugin.saveSettings();
                            this.plugin.injectCustomCalloutCSS();
                            updateIconPreview();
                            // Refresh the callout view to apply color changes immediately
                            const view = this.plugin.getCalloutView();
                            if (view) {
                                await view.refreshCallouts();
                            }
                        });
                    })
                    .addDropdown(dropdown => {
                        dropdownRef = dropdown;
                        dropdown.addOption('none', 'No Icon');
                        // Add comprehensive Lucide icons list
                        const lucideIcons = [
                            // Basic shapes and symbols
                            'circle', 'square', 'triangle', 'diamond', 'hexagon', 'star', 'heart',
                            // UI and interface
                            'pencil', 'edit', 'edit-2', 'edit-3', 'pen-tool', 'brush', 'palette',
                            'info', 'alert-circle', 'alert-triangle', 'alert-octagon', 'help-circle',
                            'question-mark', 'exclamation', 'check', 'check-circle', 'check-circle-2',
                            'x', 'x-circle', 'minus', 'minus-circle', 'plus', 'plus-circle',
                            // Files and documents
                            'file', 'file-text', 'book', 'book-open', 'notebook', 'scroll',
                            'document', 'page', 'pages', 'bookmark', 'tag', 'tags', 'clipboard-list',
                            // Communication and social
                            'message-circle', 'message-square', 'quote', 'speech', 'comment',
                            'chat', 'mail', 'phone', 'bell', 'megaphone',
                            // Technology and tools
                            'zap', 'flash', 'bolt', 'cpu', 'hard-drive', 'database', 'server',
                            'code', 'terminal', 'command', 'bug', 'wrench', 'tool', 'settings',
                            // Science and education
                            'atom', 'beaker', 'flask', 'microscope', 'telescope', 'graduation-cap',
                            'calculator', 'ruler', 'compass', 'protractor', 'formula',
                            // Nature and objects
                            'sun', 'moon', 'star-filled', 'cloud', 'umbrella', 'tree',
                            'flower', 'leaf', 'flame', 'droplet', 'snowflake',
                            // Navigation and movement
                            'arrow-up', 'arrow-down', 'arrow-left', 'arrow-right', 'navigation',
                            'compass-2', 'map', 'map-pin', 'target', 'crosshair',
                            // Time and calendar
                            'clock', 'watch', 'timer', 'calendar', 'calendar-days', 'hourglass',
                            // Media and entertainment
                            'image', 'camera', 'video', 'music', 'headphones', 'mic',
                            'play', 'pause', 'stop', 'film', 'tv',
                            // Business and finance
                            'briefcase', 'building', 'bank', 'credit-card', 'dollar-sign',
                            'trending-up', 'trending-down', 'bar-chart', 'pie-chart',
                            // Health and medical
                            'activity', 'heart-pulse', 'pill', 'syringe', 'thermometer',
                            'first-aid', 'cross', 'shield', 'shield-check',
                            // Transportation
                            'car', 'truck', 'bike', 'plane', 'ship', 'train', 'bus',
                            // Food and dining
                            'coffee', 'cup', 'utensils', 'pizza', 'apple', 'cherry',
                            // Sports and games
                            'gamepad', 'dice', 'trophy', 'medal', 'flag', 'target-2',
                            // Miscellaneous
                            'lightbulb', 'key', 'lock', 'unlock', 'eye', 'eye-off',
                            'glasses', 'gem', 'gift', 'magic-wand', 'puzzle',
                            'layers', 'layout', 'grid', 'list', 'menu', 'more-horizontal'
                        ];
                        lucideIcons.forEach(icon => {
                            dropdown.addOption(icon, icon.charAt(0).toUpperCase() + icon.slice(1).replace(/-/g, ' '));
                        });
                        dropdown.setValue(colors.icon || 'none');
                        dropdown.onChange(async (value) => {
                            this.plugin.settings.calloutColors[type].icon = value;
                            await this.plugin.saveSettings();
                            this.plugin.injectCustomCalloutCSS();
                            updateIconPreview();
                            // Refresh the callout view to apply icon changes immediately
                            const view = this.plugin.getCalloutView();
                            if (view) {
                                await view.refreshCallouts();
                            }
                        });
                        return dropdown;
                    })
                    .addButton(button => {
                        const tooltipText = isBuiltin 
                            ? 'Reset to Obsidian default color and icon'
                            : 'Reset to note callout defaults';
                        button.setTooltip(tooltipText);
                        setIcon(button.buttonEl, 'rotate-ccw');
                        button.onClick(async () => {
                            let defaultColor: string;
                            let defaultIcon: string;
                            
                            if (isBuiltin) {
                                // Use Obsidian built-in defaults
                                defaultColor = this.plugin.getDefaultColorForCalloutType(type);
                                defaultIcon = this.plugin.getDefaultIconForCalloutType(type);
                            } else {
                                // Use note callout defaults for custom callouts
                                defaultColor = this.plugin.getDefaultColorForCalloutType('note');
                                defaultIcon = this.plugin.getDefaultIconForCalloutType('note');
                            }
                            
                            this.plugin.settings.calloutColors[type].color = defaultColor;
                            this.plugin.settings.calloutColors[type].icon = defaultIcon;
                            await this.plugin.saveSettings();
                            this.plugin.injectCustomCalloutCSS();
                            
                            // Update UI components immediately
                            if (dropdownRef) dropdownRef.setValue(defaultIcon);
                            if (colorPicker) colorPicker.setValue(defaultColor);
                            updateIconPreview();
                            
                            // Refresh the callout view to apply changes immediately
                            const view = this.plugin.getCalloutView();
                            if (view) {
                                await view.refreshCallouts();
                            }
                        });
                    });
    }

    private getDefaultColorForType(type: string): string {
        // Use same defaults as main plugin method for consistency
        return this.plugin.getDefaultColorForCalloutType(type);
    }

    getDefaultIconForCalloutType(type: string): string {
        // Use same defaults as main plugin method for consistency  
        return this.plugin.getDefaultIconForCalloutType(type);
    }
}