import { App } from 'obsidian';
import { CalloutColors, CalloutOrganizerSettings } from './types';

export class ColorManager {
    private app: App;
    private settings: CalloutOrganizerSettings;

    constructor(app: App, settings: CalloutOrganizerSettings) {
        this.app = app;
        this.settings = settings;
    }

    async initializeCalloutColors(
        getAllCalloutTypesInVault: () => Promise<Set<string>>,
        getAllCalloutTypesFromCache: () => Promise<Set<string>>,
        saveSettings: () => Promise<void>
    ) {
        try {
            // Get callout types from both vault scanning and cached data
            const vaultTypes = await getAllCalloutTypesInVault();
            const cachedTypes = await getAllCalloutTypesFromCache();
            
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
                await saveSettings();
            }
        } catch (error) {
            console.error('Error initializing callout colors:', error);
        }
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
        
        // If we got a hex value directly, return it
        if (colorValue && colorValue.startsWith('#')) {
            return colorValue;
        }
        
        // Fallback to default color
        return this.getDefaultColorForCalloutType(type);
    }

    isBuiltinCalloutType(type: string): boolean {
        // Define all built-in Obsidian callout types - exact list (NO academic callouts)
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
        
        return builtinTypes.has(type.toLowerCase().trim());
    }

    hexToRgb(hex: string): string {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        if (result) {
            return `${parseInt(result[1], 16)},${parseInt(result[2], 16)},${parseInt(result[3], 16)}`;
        }
        return '0,0,0'; // fallback to black
    }

    async getAllCalloutTypesInVault(shouldSkipFile: (filePath: string, searchMode?: boolean) => boolean): Promise<Set<string>> {
        const calloutTypes = new Set<string>();
        const files = this.app.vault.getMarkdownFiles();
        
        const calloutRegex = /^>\s*\[!([^\]]+)\]/gm;
        
        for (const file of files) {
            if (shouldSkipFile(file.path, true)) continue;
            
            try {
                const content = await this.app.vault.read(file);
                let match;
                while ((match = calloutRegex.exec(content)) !== null) {
                    const rawType = match[1];
                    // Handle types with + or - modifiers (e.g., "note+" or "warning-")
                    const type = rawType.replace(/[+-]$/, '').toLowerCase().trim();
                    if (type) {
                        calloutTypes.add(type);
                    }
                }
            } catch (error) {
                console.warn(`Error reading file ${file.path}:`, error);
            }
        }
        
        return calloutTypes;
    }

    generateCalloutCSS(): string {
        let css = '';
        
        // Add font size styles and native callout support (matching original exactly)
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
}

/* Icon Selector Modal Styles */
.icon-selector-modal {
    max-width: 500px;
    max-height: 600px;
    overflow: hidden;
}

.icon-selector-title {
    text-align: center;
    margin: 0 0 20px 0;
    color: var(--text-normal);
    font-size: 20px;
    font-weight: 600;
}

.icon-selector-search {
    margin-bottom: 16px;
}

.icon-selector-search-input {
    width: 100%;
    padding: 8px 12px;
    border: 1px solid var(--background-modifier-border);
    border-radius: 6px;
    background: var(--background-primary);
    color: var(--text-normal);
    font-size: 14px;
    box-sizing: border-box;
}

.icon-selector-search-input:focus {
    outline: none;
    border-color: var(--interactive-accent);
    box-shadow: 0 0 0 2px rgba(var(--interactive-accent-rgb), 0.2);
}

.icon-selector-clear-container {
    margin-bottom: 16px;
    text-align: center;
}

.icon-selector-clear-button {
    padding: 8px 16px;
    background: var(--background-modifier-error);
    border: 1px solid var(--text-error);
    border-radius: 6px;
    color: var(--text-error);
    cursor: pointer;
    font-size: 14px;
    font-weight: 500;
    transition: all 0.2s ease;
}

.icon-selector-clear-button:hover {
    background: var(--text-error);
    color: var(--text-on-accent);
    transform: translateY(-1px);
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
}

.icon-selector-icons {
    max-height: 400px;
    overflow-y: auto;
    border: 1px solid var(--background-modifier-border);
    border-radius: 6px;
    background: var(--background-primary);
    padding: 8px;
}

.icon-selector-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(40px, 1fr));
    gap: 6px;
}

.icon-selector-icon-button {
    width: 40px;
    height: 40px;
    border: 1px solid var(--background-modifier-border);
    border-radius: 6px;
    background: var(--background-primary);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.2s ease;
    position: relative;
}

.icon-selector-icon-button:hover {
    background: var(--background-modifier-hover);
    border-color: var(--background-modifier-border-hover);
    transform: scale(1.05);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.icon-selector-icon-button.selected {
    background: var(--interactive-accent);
    border-color: var(--interactive-accent);
    color: var(--text-on-accent);
    box-shadow: 0 0 0 2px rgba(var(--interactive-accent-rgb), 0.3);
}

.icon-selector-icon-button.selected:hover {
    background: var(--interactive-accent-hover);
    border-color: var(--interactive-accent-hover);
}

.icon-selector-icon-button svg {
    width: 20px;
    height: 20px;
}

.icon-selector-icon-button .no-icon-indicator {
    font-size: 16px;
    font-weight: bold;
    color: var(--text-muted);
}

.icon-selector-icon-button.selected .no-icon-indicator {
    color: var(--text-on-accent);
}

`;
        
        // Generate CSS for each callout type - both built-in and custom
        for (const [type, colors] of Object.entries(this.settings.calloutColors)) {
            const rgbColor = this.hexToRgb(colors.color);
            const iconName = colors.icon || 'pencil';
            
            if (this.isBuiltinCalloutType(type)) {
                // For built-in callouts, only override if user has customized them
                const defaultColor = this.getDefaultColorForCalloutType(type);
                const defaultIcon = this.getDefaultIconForCalloutType(type);
                const hasCustomColor = colors.color !== defaultColor;
                const hasCustomIcon = colors.icon !== defaultIcon;
                
                if (hasCustomColor || hasCustomIcon) {
                    // User has customized this built-in callout, apply globally with high specificity
                    css += `
/* User-customized built-in callout: ${type} */
.callout[data-callout="${type}"] {
    --callout-color: ${rgbColor} !important;
    --callout-border-color: ${rgbColor} !important;
    --callout-title-color: ${rgbColor} !important;
    ${iconName !== 'none' ? `--callout-icon: lucide-${iconName} !important;` : '--callout-icon: none !important;'}
}`;
                }
                
                // Always add filter button styling
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
        
        return css;
    }

    async cleanupUnusedCalloutTypes(
        getAllCalloutTypesInVault: () => Promise<Set<string>>,
        getAllCalloutTypesFromCache: () => Promise<Set<string>>,
        saveSettings: () => Promise<void>
    ): Promise<{removed: string[], kept: string[]}> {
        try {
            // Get all actually used callout types
            const vaultTypes = await getAllCalloutTypesInVault();
            const cachedTypes = await getAllCalloutTypesFromCache();
            const usedTypes = new Set([...vaultTypes, ...cachedTypes]);
            
            // Get all callout types currently in settings
            const settingsTypes = new Set(Object.keys(this.settings.calloutColors));
            
            const removed: string[] = [];
            const kept: string[] = [];
            
            // Check each type in settings
            for (const type of settingsTypes) {
                const isBuiltin = this.isBuiltinCalloutType(type);
                const isUsed = usedTypes.has(type);
                
                if (!isBuiltin && !isUsed) {
                    // Remove unused custom types
                    delete this.settings.calloutColors[type];
                    removed.push(type);
                } else {
                    kept.push(type);
                }
            }
            
            // Save settings if any types were removed
            if (removed.length > 0) {
                await saveSettings();
                console.log(`Callout Organizer: Cleaned up ${removed.length} unused callout types:`, removed);
            }
            
            return { removed, kept };
        } catch (error) {
            console.error('Error cleaning up unused callout types:', error);
            return { removed: [], kept: Object.keys(this.settings.calloutColors) };
        }
    }

    injectCustomCSS(customCSS?: string): void {
        // Remove existing style element if it exists
        const existingStyle = document.getElementById('callout-organizer-styles');
        if (existingStyle) {
            existingStyle.remove();
        }

        // Create new style element
        const styleElement = document.createElement('style');
        styleElement.id = 'callout-organizer-styles';
        
        let css = this.generateCalloutCSS();
        
        // Add better embeddings CSS if enabled
        if (this.settings.invisibleEmbeddings) {
            css += `
/* Better Embeddings */
.markdown-embed {
    padding: 0;
    border: 0;
}`;
        }
        
        if (customCSS) {
            css += '\n' + customCSS;
        }
        
        styleElement.textContent = css;
        document.head.appendChild(styleElement);
    }
}