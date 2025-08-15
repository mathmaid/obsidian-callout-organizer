import { Modal, App, setIcon } from 'obsidian';
import { OBSIDIAN_NOTE_ICON_SVG, LUCIDE_ICON_CLASSIFICATIONS } from './constants';

interface IconData {
    name: string;
    classifications: string[];
}

export class IconSelectorModal extends Modal {
    private onSelectIcon: (iconName: string) => void;
    private currentIcon: string;
    private searchInput: HTMLInputElement;
    private iconContainer: HTMLElement;
    private allIcons: IconData[];
    private lucideIcons: Record<string, string[]> = {};

    constructor(app: App, currentIcon: string, onSelectIcon: (iconName: string) => void) {
        super(app);
        this.currentIcon = currentIcon || 'none';
        this.onSelectIcon = onSelectIcon;
        this.initializeIcons();
    }

    private initializeIcons() {
        // Use embedded icon data
        this.lucideIcons = LUCIDE_ICON_CLASSIFICATIONS;
        
        // Convert to IconData array and add the 'none' option
        this.allIcons = [
            { name: 'none', classifications: [] },
            ...Object.entries(this.lucideIcons).map(([name, classifications]) => ({
                name,
                classifications
            }))
        ];
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass('icon-selector-modal');

        // Modal title
        const title = contentEl.createEl('h2', { text: 'Select Icon', cls: 'icon-selector-title' });

        // Search container
        const searchContainer = contentEl.createDiv({ cls: 'icon-selector-search-container' });
        this.searchInput = searchContainer.createEl('input', {
            type: 'text',
            placeholder: 'Search icons...',
            cls: 'icon-selector-search-input'
        });
        
        // Tip container
        const tipContainer = contentEl.createDiv({ cls: 'icon-selector-tip' });
        tipContainer.createEl('span', { text: 'Search icons on ' });
        const link = tipContainer.createEl('a', {
            text: 'https://lucide.dev/icons/',
            href: 'https://lucide.dev/icons/',
            cls: 'icon-selector-link'
        });
        link.setAttribute('target', '_blank');
        link.setAttribute('rel', 'noopener noreferrer');
        
        // Add event listener
        this.searchInput.addEventListener('input', () => {
            this.filterIcons();
        });

        // Clear Icon button
        const clearButtonContainer = contentEl.createDiv({ cls: 'icon-selector-clear-container' });
        const clearButton = clearButtonContainer.createEl('button', {
            text: 'Clear Icon',
            cls: 'icon-selector-clear-button'
        });
        clearButton.addEventListener('click', () => {
            this.selectIcon('none');
        });

        // Icons container
        this.iconContainer = contentEl.createDiv({ cls: 'icon-selector-icons' });

        // Show all icons by default
        this.showAllIcons();

        // ESC key support
        this.scope.register([], 'Escape', () => {
            this.close();
        });
    }

    private showAllIcons() {
        this.iconContainer.empty();
        this.createIconGrid(this.allIcons);
    }

    private createIconGrid(icons: IconData[]) {
        const grid = this.iconContainer.createDiv({ cls: 'icon-selector-grid' });

        icons.forEach(iconData => {
            const iconName = iconData.name;
            const classifications = iconData.classifications;
            
            const iconButton = grid.createEl('button', {
                cls: `icon-selector-icon-button ${iconName === this.currentIcon ? 'selected' : ''}`,
                attr: { 'data-icon': iconName }
            });

            // Add the icon directly to the button
            if (iconName === 'none') {
                iconButton.createEl('span', { text: '∅', cls: 'no-icon-indicator' });
            } else {
                // Special handling for pencil icon
                if (iconName === 'pencil') {
                    iconButton.innerHTML = OBSIDIAN_NOTE_ICON_SVG;
                } else {
                    setIcon(iconButton, iconName);
                }
            }

            // Set tooltip with only classifications
            const tooltipText = iconName === 'none' 
                ? 'No Icon' 
                : (classifications && classifications.length > 0 ? 'Categories: ' + classifications.join(', ') : '');
            if (tooltipText) {
                iconButton.setAttribute('title', tooltipText);
            }

            iconButton.addEventListener('click', () => {
                this.selectIcon(iconName);
            });
        });
    }

    private filterIcons() {
        const searchTerm = this.searchInput.value.toLowerCase();
        
        const filtered = this.allIcons.filter(iconData => {
            // Text search filter (name or classification)
            return !searchTerm || 
                iconData.name.toLowerCase().includes(searchTerm) ||
                iconData.classifications.some(classification => 
                    classification.toLowerCase().includes(searchTerm)
                );
        });
        
        this.iconContainer.empty();
        this.createIconGrid(filtered);
    }

    private selectIcon(iconName: string) {
        // Call the callback
        this.onSelectIcon(iconName);
        
        // Close modal after selection
        this.close();
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}