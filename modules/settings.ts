import { App, PluginSettingTab, Setting, setIcon } from 'obsidian';
import { CalloutOrganizerSettings } from './types';
import { OBSIDIAN_NOTE_ICON_SVG } from './constants';
import { IconSelectorModal } from './icon-selector-modal';

export class CalloutOrganizerSettingTab extends PluginSettingTab {
    plugin: any; // CalloutOrganizerPlugin - properly typed in main.ts

    constructor(app: App, plugin: any) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const {containerEl} = this;

        containerEl.empty();

        // Use h1 to match Obsidian's standard settings hierarchy
        containerEl.createEl('h1', {text: 'Callout Organizer Settings'});

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
            .setName('Better Embeddings')
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
        
        const colorsContainer = calloutOptionsContainer.createEl('div');
        
        colorsContainer.createEl('p', {
            text: 'Customize colors for callout types found in your vault. New callout types are automatically detected.',
            cls: 'setting-item-description'
        });

        // Create simplified color settings for detected callout types
        this.createDynamicCalloutColorSettings(colorsContainer);
        
        // Add canvas options at the end
        this.addCanvasOptions(containerEl);
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
                const builtinSection = this.createCollapsibleSection(
                    container, 
                    'Built-in Obsidian Callouts',
                    `${builtinTypes.length} built-in callout types. Reset button restores Obsidian defaults.`,
                    'builtin-callouts'
                );
                
                for (const type of builtinTypes) {
                    const colors = this.plugin.settings.calloutColors[type];
                    this.createCalloutSetting(builtinSection.content, type, colors, true);
                }
            }
            
            // Display user callouts section
            if (userTypes.length > 0) {
                const customSection = this.createCollapsibleSection(
                    container, 
                    'Custom Callouts',
                    `${userTypes.length} custom callout types. Reset button sets to note callout defaults.`,
                    'custom-callouts'
                );
                
                for (const type of userTypes) {
                    const colors = this.plugin.settings.calloutColors[type];
                    this.createCalloutSetting(customSection.content, type, colors, false);
                }
            }
            
        } catch (error) {
            loadingEl.textContent = 'Error scanning vault for callouts.';
            console.error('Error scanning for callouts:', error);
        }
    }

    private createCollapsibleSection(container: HTMLElement, title: string, description: string, sectionId: string) {
        // Create main section container
        const sectionContainer = container.createDiv({ cls: 'callout-collapsible-section' });
        
        // Create header with clickable title
        const header = sectionContainer.createDiv({ cls: 'callout-section-header' });
        const headerButton = header.createEl('button', { 
            cls: 'callout-section-toggle',
            attr: { 'aria-expanded': 'true' }
        });
        
        // Add chevron icon
        const chevron = headerButton.createEl('span', { cls: 'callout-section-chevron' });
        chevron.innerHTML = '▼';
        
        // Add title
        headerButton.createEl('h5', { text: title, cls: 'callout-section-title' });
        
        // Create content container
        const contentContainer = sectionContainer.createDiv({ cls: 'callout-section-content' });
        
        // Add description
        contentContainer.createEl('p', {
            text: description,
            cls: 'setting-item-description'
        });
        
        // Add click handler for toggling
        headerButton.addEventListener('click', () => {
            const isExpanded = headerButton.getAttribute('aria-expanded') === 'true';
            const newState = !isExpanded;
            
            headerButton.setAttribute('aria-expanded', newState.toString());
            contentContainer.style.display = newState ? 'block' : 'none';
            chevron.innerHTML = newState ? '▼' : '▶';
            
            // Store state in localStorage for persistence
            localStorage.setItem(`callout-organizer-${sectionId}-expanded`, newState.toString());
        });
        
        // Restore saved state
        const savedState = localStorage.getItem(`callout-organizer-${sectionId}-expanded`);
        if (savedState === 'false') {
            headerButton.setAttribute('aria-expanded', 'false');
            contentContainer.style.display = 'none';
            chevron.innerHTML = '▶';
        }
        
        return {
            container: sectionContainer,
            content: contentContainer
        };
    }

    private createCalloutSetting(container: HTMLElement, type: string, colors: any, isBuiltin: boolean) {
        const setting = new Setting(container)
            .setName(`${type.charAt(0).toUpperCase() + type.slice(1)} Callout`);

        // Add icon preview
        const iconPreview = setting.controlEl.createDiv({ cls: 'callout-icon-preview' });
        const updateIconPreview = () => {
            iconPreview.empty();
            if (colors.icon && colors.icon !== 'none') {
                // Special handling for pencil icon to ensure we get the correct lucide-pencil
                if (colors.icon === 'pencil') {
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
            // Create icon selector button
            .addButton(button => {
                button.setButtonText('Select Icon');
                button.setTooltip('Click to open icon selector');
                button.onClick(async () => {
                    const modal = new IconSelectorModal(
                        this.app,
                        colors.icon || 'none',
                        async (selectedIcon: string) => {
                            this.plugin.settings.calloutColors[type].icon = selectedIcon;
                            await this.plugin.saveSettings();
                            this.plugin.injectCustomCalloutCSS();
                            updateIconPreview();
                            
                            // Refresh the callout view to apply icon changes immediately
                            const view = this.plugin.getCalloutView();
                            if (view) {
                                await view.refreshCallouts();
                            }
                        }
                    );
                    modal.open();
                });
                
                // Store reference for potential cleanup
                dropdownRef = { setValue: () => {}, el: button.buttonEl };
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

    private addCanvasOptions(containerEl: HTMLElement) {
        // Callout Connections (Beta)
        containerEl.createEl('h3', {text: 'Canvas Settings'});
        
        const canvasContainer = containerEl.createEl('div', {cls: 'callout-settings-indent'});

        new Setting(canvasContainer)
            .setName('Canvas Storage Folder')
            .setDesc('Folder where callout canvas files will be stored (relative to vault root)')
            .addText(text => text
                .setPlaceholder('Callout Connections')
                .setValue(this.plugin.settings.canvasStorageFolder)
                .onChange(async (value) => {
                    this.plugin.settings.canvasStorageFolder = value || 'Callout Connections';
                    await this.plugin.saveSettings();
                }));
    }
}