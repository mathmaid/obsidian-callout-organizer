# Callout Organizer for Obsidian

A powerful plugin for organizing and navigating callouts across your Obsidian vault.

![[Pasted image 20250807135550.png]]

## Features

### 🎯 Smart Callout Organization
- **Current File View**: See all callouts in the currently active file
- **Vault-Wide Search**: Search callouts across your entire vault
- **Type Filtering**: Filter callouts by type with visual buttons
- **Search Integration**: Find callouts by title, content, filename, headers, or block IDs

### 🎨 Visual Customization
- **Responsive Icons**: Icons scale with font size (16px base at 14px font) for perfect readability
- **Color Customization**: Customize colors and icons for any callout type
- **Built-in Support**: Automatic detection of Obsidian's built-in callout types with correct icons
- **Custom Callouts**: Full support for custom callout types

### 🧭 Enhanced Navigation
- **One-Click Navigation**: Click any callout to jump to its location
- **Smart Centering**: Cursor centers in the editor when navigating
- **Breadcrumb Navigation**: File > Header > Block ID hierarchy
- **Visual Feedback**: Highlight animation when jumping to callouts

### 🚀 Drag & Drop
- **Link Generation**: Drag callouts to create links automatically
- **Embed Support**: Option to create embed links (`![[...]]`) or regular links
- **Auto Block IDs**: Automatically adds block IDs when dragging callouts

## Installation

1. Download the plugin files to your vault's `.obsidian/plugins/callout-organizer/` directory
2. Reload Obsidian or restart the app
3. Enable the plugin in Settings > Community Plugins
4. Access via the ribbon icon or command palette

## Usage

### Getting Started
1. **Open the Plugin**: Click the album icon in the ribbon or use `Cmd/Ctrl + P` → "Open Callout Organizer"
2. **Switch Modes**: Toggle between "Current File" and "All Files" using the mode button
3. **Filter Types**: Click callout type buttons to show/hide specific types
4. **Search**: Use the search box to find specific callouts

### Navigation
- **Click to Jump**: Click any callout to navigate to its location
- **Breadcrumb Links**: Click filename, headers, or block IDs in the breadcrumb to jump
- **Ctrl/Cmd + Click**: Open in a new tab

### Drag & Drop
- **Create Links**: Drag any callout to your editor to create a link
- **Block IDs**: Block IDs are automatically generated when needed
- **Embed Mode**: Toggle embed links in settings for `![[...]]` vs `[[...]]` format

## Settings

### Display Options
- **Font Sizes**: Adjust callout content and breadcrumb font sizes
- **Header Levels**: Show/hide specific header levels (H1-H6)
- **Filenames & IDs**: Toggle display of filenames and block IDs

### Search Configuration
- **Excluded Folders**: Skip specific folders in vault-wide search
- **Search Fields**: Enable/disable searching in different content areas
- **Result Limits**: Control maximum number of search results

### Callout Customization
- **Colors**: Customize colors for any callout type
- **Icons**: Choose from 150+ Lucide icons
- **Custom CSS**: Add custom styling rules

## Callout Types

The plugin automatically detects and supports:

**Built-in Types**: note, info, todo, abstract, summary, tip, success, question, warning, failure, danger, bug, example, quote
**Custom Types**: Any callout type you create (e.g., `[!definition]`, `[!theorem]`)

## Responsive Design

Icons and text scale beautifully with your chosen font sizes:
- **Base Size**: 16px icons at 14px font size  
- **Scaling**: Icons automatically resize when you change font sizes
- **Square Icons**: Maintained aspect ratio at all sizes

## Performance

Optimized for large vaults:
- **Smart Caching**: 5-minute cache for vault-wide searches
- **Debounced Search**: Smooth search experience
- **Result Limits**: Configurable limits prevent performance issues
- **Folder Exclusion**: Skip large folders to improve performance

## Compatibility

- **Obsidian Version**: 1.0.0+
- **Platform**: Desktop and mobile
- **Themes**: Compatible with all themes
- **Other Plugins**: Works alongside other callout-related plugins

## Development

### Building from Source
```bash
npm install
npm run build
```

### File Structure
- `main.ts` - Plugin source code
- `styles.css` - Styling and layout
- `manifest.json` - Plugin metadata

### CSS Variables
The plugin uses these CSS variables for theming:
- `--callout-font-size` - Controls icon sizing
- `--callout-color` - Callout border/accent colors
- `--callout-title-color` - Title text color

## Troubleshooting

### Common Issues

**Icons not showing**: Restart Obsidian after changing icon settings  
**Slow performance**: Reduce search result limits or exclude large folders  
**Callouts not found**: Ensure proper syntax `> [!type] Title`  
**Wrong colors**: Check custom CSS isn't overriding plugin styles  

### Debug Steps
1. Check Obsidian developer console for errors
2. Try disabling and re-enabling the plugin
3. Verify callout syntax matches markdown standards
4. Clear plugin cache using the refresh button

## Support

For issues, questions, or feature requests, please check:
1. This README for common solutions
2. Plugin settings for configuration options
3. Obsidian community forums for general support

## License

MIT License - see LICENSE file for details

## Changelog

### Version 1.0.1
- 🐛 **Bug Fixes**:
  - Fixed callout icons displaying correctly
  - Fixed callout title colors using proper callout colors
  - Fixed note callout icon to use correct `lucide-pencil`
  - Fixed toggle button width preventing layout shifts
  - Fixed icon base size for better visual proportions (16px)
- ✨ **Improvements**:
  - Moved breadcrumbs to bottom for better organization
  - Enhanced visual layout and spacing
  - Improved code consistency and performance

### Version 1.0.0
- 🎉 **Initial Release**
- ✨ **New Features**:
  - Responsive icon sizing
  - Cursor centering on navigation
  - Enhanced color handling
  - Drag & drop link creation
- 🔧 **Improvements**:
  - Simplified folder filtering (exclude-only)
  - Better default settings
  - Improved code consistency
- 🐛 **Bug Fixes**:
  - Fixed note callout icon
  - Resolved title color issues
  - Better icon sizing

---

**Made with ❤️ for the Obsidian community**
