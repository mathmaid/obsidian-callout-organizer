# Callout Organizer Plugin

Organize and manage callouts of all types across your Obsidian vault with enhanced navigation, search, and customization features.

## Features

- **Dual View Modes**: Switch between Current File and All Files search modes
- **Advanced Search**: Search across filenames, headers, callout titles, IDs, and content
- **Drag & Drop**: Create embed or regular links by dragging callouts
- **Custom Styling**: Customize colors and icons for all callout types
- **Invisible Embeddings**: Make embedded callouts appear seamlessly without borders
- **Flexible Display Options**: Control which headers and elements to show in navigation
- **Real-time Updates**: Live refresh and caching for optimal performance

## Installation

1. Download the latest release
2. Extract the files to your `.obsidian/plugins/callout-organizer/` folder
3. Enable the plugin in Obsidian settings
4. Access via the ribbon icon or command palette

## Usage

### Basic Navigation
- Click the album icon in the ribbon to open the Callout Organizer
- Toggle between "Current File" and "All Files" modes
- Use the search bar to find specific callouts
- Click on any callout to navigate to its location

### Drag & Drop
- Drag any callout to create embed or regular links
- Enable "Invisible Embeddings" for seamless embedded callouts
- Block IDs are automatically generated when needed

## Recommended CSS Snippets

These CSS snippets can be added to the "Custom Callout CSS" setting and will apply to **all callouts** throughout Obsidian, including those in the editor and the plugin view.

### Enhanced Callout Styling
Add these CSS snippets to the "Custom Callout CSS" setting for improved appearance:

```css
/* Rounded corners and subtle shadow */
border-radius: 8px;
box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);

/* Improved spacing */
margin: 16px 0;
padding: 16px;

/* Smooth hover effect */
transition: all 0.2s ease;

/* Hover highlight */
&:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
}
```

### Compact Layout
For a more compact display across all callouts:

```css
/* Reduce padding and margins */
margin: 8px 0;
padding: 12px;

/* Smaller font size for content */
font-size: 0.9em;

/* Tighter line height */
line-height: 1.4;
```

### Minimal Style
For a clean, minimal appearance throughout Obsidian:

```css
/* Remove background and use only border */
background: transparent;
border-left: 3px solid var(--callout-color);
border-radius: 0;
box-shadow: none;

/* Minimal padding */
padding: 8px 12px;
```

### Glass Effect
For a modern glass-like appearance:

```css
/* Glass morphism effect */
background: rgba(255, 255, 255, 0.1);
backdrop-filter: blur(10px);
border: 1px solid rgba(255, 255, 255, 0.2);
border-radius: 12px;
box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);

/* Subtle hover effect */
transition: all 0.3s ease;
&:hover {
    background: rgba(255, 255, 255, 0.15);
    transform: translateY(-2px);
}
```

## Configuration

### Display Options
- Control which header levels (H1-H6) appear in navigation
- Show/hide filenames and callout IDs
- Adjust font sizes for callouts and breadcrumbs

### Search Options  
- Configure which fields to include in search
- Set maximum search results limit
- Exclude specific folders from search

### Drag Options
- Choose between embed links (`![[]]`) or regular links (`[[]]`)
- Enable invisible embeddings for seamless appearance

### Callout Customization
- Customize colors and icons for built-in and custom callout types
- Add custom CSS for advanced styling
- Reset individual callouts to defaults

## Tips & Tricks

1. **Performance**: Use folder exclusions to improve search performance in large vaults
2. **Organization**: Enable "Group by Type" for better organization in All Files mode
3. **Navigation**: Use Ctrl/Cmd+Click to open callouts in new tabs
4. **Styling**: Combine custom CSS with color customization for unique appearances
5. **Search**: Use multiple keywords for more precise search results

## Support

For issues, feature requests, or contributions, visit the [GitHub repository](https://github.com/mathmaid/obsidian-callout-organizer).

## License

MIT License - see LICENSE file for details.