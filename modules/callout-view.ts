import { ItemView, WorkspaceLeaf, Component, setIcon, MarkdownView, MarkdownRenderer } from 'obsidian';
import { CalloutItem, CalloutOrganizerSettings } from './types';
import { VIEW_TYPE_CALLOUT_ORGANIZER, OBSIDIAN_NOTE_ICON_SVG } from './constants';
import { filterHeadersBySettings, readableToTimestamp } from './utils';

// This is a simplified version of the CalloutOrganizerView class
// The full implementation would need to be extracted method by method from main.ts
// This provides the basic structure for the refactoring

export class CalloutOrganizerView extends ItemView {
    plugin: any; // CalloutOrganizerPlugin - will be typed properly when main.ts is refactored
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
    private readonly RENDER_BATCH_SIZE = 20;
    private readonly MIN_RENDER_INTERVAL = 100;
    
    // DOM element cache for performance
    private cachedTypeSelectorContainer: HTMLElement | null = null;
    private topBarElement: HTMLElement | null = null;
    private calloutContainerElement: HTMLElement | null = null;
    private readonly SEARCH_DEBOUNCE_DELAY = 200;
    private readonly RENDER_DEBOUNCE_DELAY = 150;

    constructor(leaf: WorkspaceLeaf, plugin: any, mode: 'current' | 'search' = 'current') {
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
        
        await this.refreshCallouts();
    }

    async refreshCallouts() {
        if (this.searchMode === 'current') {
            this.callouts = await this.plugin.extractCurrentFileCallouts();
        } else if (this.searchMode === 'search') {
            // Load callouts from cache
            const cache = await this.plugin.loadCalloutCache();
            if (cache && cache.callouts) {
                this.callouts = cache.callouts;
            } else {
                this.callouts = [];
            }
        }
        
        // Update type selectors when callouts change
        if (this.cachedTypeSelectorContainer) {
            this.setupTypeSelectors(this.cachedTypeSelectorContainer);
        }
        
        const container = this.containerEl.querySelector('.callout-container');
        if (container) {
            await this.renderCallouts(container as HTMLElement);
        }
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
        
        // Update search input when mode changes
        if (this.searchQuery === '') {
            searchInput.value = '';
        }
        
        // Right side buttons container
        const rightButtons = firstLine.createEl("div", { cls: "callout-right-buttons" });
        
        // Refresh button
        const refreshBtn = rightButtons.createEl("button", {
            cls: "callout-refresh-button"
        });
        setIcon(refreshBtn, "refresh-cw");
        
        refreshBtn.onmousedown = async (e) => {
            e.preventDefault(); // Prevent focus issues
            if (this.searchMode === 'search') {
                // Force refresh by rescanning all files and updating cache
                if (this.plugin.refreshAllCallouts) {
                    await this.plugin.refreshAllCallouts();
                }
                
                // Then load from cache
                await this.refreshCallouts();
            } else {
                // For current file mode, refresh and also rebuild cache
                if (this.plugin.refreshAllCallouts) {
                    await this.plugin.refreshAllCallouts();
                }
                
                // Then refresh current file view
                await this.refreshCallouts();
            }
        };
        
        // Second line: type selectors
        const secondLine = container.createEl("div", { cls: "callout-top-bar-line-2" });
        const typeSelectors = secondLine.createEl("div", { cls: "callout-type-selectors" });
        this.cachedTypeSelectorContainer = typeSelectors;
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
            
            toggleButton.onmousedown = (e) => {
                e.preventDefault(); // Prevent focus issues
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
            // For built-in callouts, check if user has actually customized the icon
            let iconName: string;
            if (this.plugin.isBuiltinCalloutType(type)) {
                const defaultIcon = this.plugin.getDefaultIconForCalloutType(type);
                const currentIcon = this.plugin.settings.calloutColors[type]?.icon;
                // Only use custom icon if it's different from the default
                iconName = (currentIcon && currentIcon !== defaultIcon) ? currentIcon : defaultIcon;
            } else {
                // For custom callouts, use the icon from settings or fallback
                iconName = this.plugin.settings.calloutColors[type]?.icon || 
                           this.plugin.settings.calloutColors['note']?.icon || 'pencil';
            }
            
            if (iconName && iconName !== 'none') {
                const iconEl = button.createEl("span", { cls: "callout-type-icon" });
                
                // Special handling for pencil icon to ensure we get the correct lucide-pencil
                if (iconName === 'pencil') {
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
            
            if (this.activeFilters.has(type)) {
                button.addClass('active');
            }
            
            // Add type name
            button.createEl("span", { text: type });
            
            // Click handler using onmousedown for consistency with original
            button.onmousedown = (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                if (this.activeFilters.has(type)) {
                    this.activeFilters.delete(type);
                    button.removeClass('active');
                } else {
                    this.activeFilters.add(type);
                    button.addClass('active');
                }
                
                // Update Select All button
                const toggleButton = container.querySelector('.callout-clear-all-button') as HTMLButtonElement;
                if (toggleButton) {
                    const allSelected = this.activeFilters.size === uniqueTypes.length;
                    toggleButton.textContent = allSelected ? "Clear All" : "Select All";
                }
                
                this.debouncedRender();
            };
        });
    }

    private renderFilteredCallouts() {
        const container = this.containerEl.querySelector('.callout-container');
        if (container) {
            this.renderCallouts(container as HTMLElement);
        }
    }

    private debouncedSearch() {
        if (this.searchDebounceTimer) {
            clearTimeout(this.searchDebounceTimer);
        }
        
        // Adaptive debouncing based on result size
        const delay = this.callouts.length > 100 ? this.SEARCH_DEBOUNCE_DELAY * 2 : this.SEARCH_DEBOUNCE_DELAY;
        
        this.searchDebounceTimer = setTimeout(() => {
            this.searchDebounceTimer = null;
            const calloutContainer = this.calloutContainerElement || this.containerEl.querySelector('.callout-container') as HTMLElement;
            if (calloutContainer) {
                this.renderCallouts(calloutContainer);
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
            this.renderCallouts(calloutContainer as HTMLElement);
        }
    }

    getSearchPlaceholder(): string {
        if (this.searchMode === 'current') {
            return 'Search current file...';
        }
        return 'Search all callouts...';
    }

    // Math processing for MathJax integration
    private processMathForElement(element: HTMLElement) {
        try {
            // Check if MathJax is available
            const mathJax = (window as any).MathJax;
            if (mathJax && mathJax.typesetPromise) {
                // Use MathJax 3 API
                mathJax.typesetPromise([element]).catch((error: any) => {
                    console.warn('MathJax processing failed:', error);
                });
            } else if (mathJax && mathJax.Hub) {
                // Use MathJax 2 API
                mathJax.Hub.Queue(["Typeset", mathJax.Hub, element]);
            }
        } catch (error) {
            console.warn('Math processing error:', error);
        }
    }

    // Canvas integration method
    async openCalloutCanvas(callout: CalloutItem) {
        if (this.plugin.createCalloutGraphCanvas) {
            await this.plugin.createCalloutGraphCanvas(callout);
        }
    }

    async renderCallouts(container: HTMLElement) {
        container.empty();
        
        const calloutsList = container.createEl("div", { cls: "callouts-list" });
        const filteredCallouts = this.getFilteredCallouts();
        
        if (filteredCallouts.length === 0) {
            const emptyMessage = calloutsList.createEl("div", { 
                cls: "callout-empty-message",
                text: "No callouts found"
            });
            return;
        }
        
        // Sort callouts based on mode
        const sortedCallouts = [...filteredCallouts].sort((a, b) => {
            if (this.searchMode === 'search') {
                // In all files mode, sort by callout modification time (recent first)
                const aModTime = a.calloutModifyTime || a.fileModTime || '1970-01-01 00:00:00';
                const bModTime = b.calloutModifyTime || b.fileModTime || '1970-01-01 00:00:00';
                return readableToTimestamp(bModTime) - readableToTimestamp(aModTime);
            } else {
                // In current file mode, sort by line number
                return a.lineNumber - b.lineNumber;
            }
        });
        
        for (const callout of sortedCallouts) {
            // Use the same class structure as the original
            const calloutEl = calloutsList.createEl("div", { 
                cls: "callout-organizer-item callout",
                attr: { 'data-callout': callout.type }
            });
            
            // Make entire callout clickable and draggable
            calloutEl.style.cursor = "pointer";
            calloutEl.draggable = true;
            
            // Add drag functionality
            let pendingCalloutId: string | null = null;
            
            calloutEl.ondragstart = (e) => {
                if (e.dataTransfer) {
                    // Check if we need to generate a new callout ID
                    let calloutID = callout.calloutID;
                    
                    if (!calloutID) {
                        calloutID = this.plugin.generateCalloutId(callout);
                        callout.calloutID = calloutID;
                        pendingCalloutId = calloutID || null; // Store for later addition to file
                    }
                    
                    // Generate link text based on settings
                    let linkText: string;
                    const fileNamePart = callout.file.replace(/\.md$/, '');
                    const linkTarget = `${fileNamePart}#^${calloutID}`;

                    if (this.plugin.settings.useEmbedLinks) {
                        // Use embed format: ![[...]]
                        if (this.plugin.settings.hideFileNamesInLinks) {
                            linkText = `![[${linkTarget}|${calloutID}]]`; // Hide filename with alias
                        } else {
                            linkText = `![[${linkTarget}]]`; // Show full path
                        }
                    } else {
                        // Use regular link format: [[...]]
                        if (this.plugin.settings.hideFileNamesInLinks) {
                            linkText = `[[${linkTarget}|${calloutID}]]`; // Hide filename with alias
                        } else {
                            linkText = `[[${linkTarget}]]`; // Show full path
                        }
                    }
                    e.dataTransfer.setData('text/plain', linkText);
                    
                    e.dataTransfer.effectAllowed = 'copy';
                    
                    // Add visual feedback during drag
                    calloutEl.style.opacity = '0.5';
                }
            };
            
            calloutEl.ondragend = () => {
                // Restore opacity after drag
                calloutEl.style.opacity = '1';
                
                // Add callout ID to file after drag is complete (prevents infinite loop)
                if (pendingCalloutId) {
                    // Use setTimeout to ensure this happens after the drag operation is fully complete
                    setTimeout(async () => {
                        try {
                            await this.plugin.addCalloutIdToCallout(callout, pendingCalloutId!);
                            // Update cache after successful ID addition
                            await this.plugin.saveCalloutCache(this.callouts);
                            pendingCalloutId = null;
                        } catch (error) {
                            console.error('Error adding callout ID to file:', error);
                            // Reset the callout ID if we failed to add it to the file
                            callout.calloutID = undefined;
                            pendingCalloutId = null;
                        }
                    }, 100); // Small delay to ensure drag operation is complete
                }
            };
            
            // Header with type and title (matching original structure)
            const header = calloutEl.createEl("div", { cls: "callout-organizer-header" });
            header.style.display = "flex";
            header.style.alignItems = "center";
            header.style.gap = "8px";
            
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
                // For built-in callouts, check if user has actually customized the icon
                let iconName: string;
                if (this.plugin.isBuiltinCalloutType(callout.type)) {
                    const defaultIcon = this.plugin.getDefaultIconForCalloutType(callout.type);
                    const currentIcon = this.plugin.settings.calloutColors[callout.type]?.icon;
                    // Only use custom icon if it's different from the default
                    iconName = (currentIcon && currentIcon !== defaultIcon) ? currentIcon : defaultIcon;
                } else {
                    // For custom callouts, use the icon from settings or fallback
                    iconName = this.plugin.settings.calloutColors[callout.type]?.icon || 
                               this.plugin.settings.calloutColors['note']?.icon || 'pencil';
                }
                
                if (iconName && iconName !== 'none') {
                    const iconEl = titleEl.createEl("span", { cls: "callout-title-icon" });
                    
                    // Special handling for pencil icon to ensure we get the correct lucide-pencil
                    if (iconName === 'pencil') {
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
                }).catch((error) => {
                    console.warn('Failed to render callout title:', error);
                    // Fallback to plain text
                    titleEl.textContent = displayTitle;
                    titleEl.style.color = calloutColor;
                });
            }
            
            // Add canvas button for all callouts
            {
                const canvasBtn = header.createEl("button", { 
                    cls: "callout-canvas-button",
                    title: "Open in Canvas"
                });
                setIcon(canvasBtn, "layout-dashboard");
                canvasBtn.style.marginLeft = "auto";
                canvasBtn.style.padding = "4px";
                canvasBtn.style.border = "none";
                canvasBtn.style.background = "var(--interactive-normal)";
                canvasBtn.style.borderRadius = "4px";
                canvasBtn.style.cursor = "pointer";
                canvasBtn.style.display = "flex";
                canvasBtn.style.alignItems = "center";
                canvasBtn.style.justifyContent = "center";
                canvasBtn.style.width = "24px";
                canvasBtn.style.height = "24px";
                
                canvasBtn.onmouseover = () => {
                    canvasBtn.style.background = "var(--interactive-hover)";
                };
                canvasBtn.onmouseleave = () => {
                    canvasBtn.style.background = "var(--interactive-normal)";
                };
                
                canvasBtn.onclick = (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    this.openCalloutCanvas(callout);
                };
            }
            
            // Content with full markdown support (matching original)
            const content = calloutEl.createEl("div", { cls: "callout-organizer-content" });
            
            // Render full markdown content with math support
            MarkdownRenderer.render(this.app, callout.content, content, callout.file, this.component).then(() => {
                // Process math after MarkdownRenderer has completed
                this.processMathForElement(content);
            }).catch((error) => {
                console.warn('Failed to render callout content:', error);
                // Fallback to plain text
                content.textContent = callout.content;
            });
            
            // Build hierarchical breadcrumb (at the bottom, matching original implementation)
            const breadcrumb = calloutEl.createEl("div", { cls: "callout-organizer-breadcrumb" });
            
            // Add filename if enabled in settings
            if (this.plugin.settings.showFilenames && callout.file) {
                const fileParts = callout.file?.split('/');
                const filename = fileParts?.pop()?.replace(/\.md$/, '') || callout.file || 'Unknown';
                const fileLink = breadcrumb.createEl("a", { 
                    text: filename,
                    href: "#",
                    cls: "callout-organizer-file-link"
                });
                fileLink.onclick = (e) => {
                    e.preventDefault();
                    if (this.plugin.openFile) {
                        this.plugin.openFile(callout.file, callout.lineNumber, e.ctrlKey || e.metaKey);
                    }
                };
            }
            
            // Add heading hierarchy from stored headers, filtered by settings
            if (callout.headers && callout.headers.length > 0) {
                const filteredHeaders = filterHeadersBySettings(callout.headers, callout.headerLevels, this.plugin.settings);
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
                        if (this.plugin.openFile) {
                            this.plugin.openFile(callout.file, callout.lineNumber, e.ctrlKey || e.metaKey);
                        }
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
                    if (this.plugin.openFile) {
                        this.plugin.openFile(callout.file, callout.lineNumber, e.ctrlKey || e.metaKey);
                    }
                };
            }
            
            // Click handler to open file
            calloutEl.onclick = async (e) => {
                // Don't trigger if clicking on links in breadcrumb
                if ((e.target as HTMLElement).tagName === 'A') {
                    return;
                }
                e.preventDefault();
                if (this.plugin.openFile) {
                    await this.plugin.openFile(callout.file, callout.lineNumber, e.ctrlKey || e.metaKey);
                }
            };
        }
    }

    getFilteredCallouts(): CalloutItem[] {
        // If no filters are active, return empty array (show nothing)
        if (this.activeFilters.size === 0) {
            return [];
        }
        
        // Apply type filters
        let filteredCallouts = this.callouts.filter(callout => 
            this.activeFilters.has(callout.type.toLowerCase())
        );
        
        // Apply search query
        if (this.searchQuery.trim()) {
            const query = this.searchQuery.toLowerCase();
            const keywords = query.split(/\s+/).filter(k => k.length > 0);
            const settings = this.plugin.settings; // Cache settings reference
            
            filteredCallouts = filteredCallouts.filter(callout => {
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
        
        // Apply maximum results limit only in search mode (all files mode)
        if (this.searchMode === 'search' && filteredCallouts.length > this.plugin.settings.maxSearchResults) {
            filteredCallouts = filteredCallouts.slice(0, this.plugin.settings.maxSearchResults);
        }
        
        return filteredCallouts;
    }

    async onClose() {
        this.component.unload();
        
        if (this.refreshDebounceTimer) {
            clearTimeout(this.refreshDebounceTimer);
            this.refreshDebounceTimer = null;
        }
        if (this.searchDebounceTimer) {
            clearTimeout(this.searchDebounceTimer);
            this.searchDebounceTimer = null;
        }
    }

    // TODO: The following methods need to be extracted from main.ts:
    // - setupTypeSelectors
    // - renderSingleCallout  
    // - generateCalloutId
    // - addCalloutIdToCallout
    // - openFile
    // - openCalloutCanvas
    // - highlightLine
    // - groupCallouts
    // - filterHeadersBySettings
    // - getHeadingHierarchy
    // - detectAndAddNewCalloutTypes
    // And many more rendering and interaction methods
}