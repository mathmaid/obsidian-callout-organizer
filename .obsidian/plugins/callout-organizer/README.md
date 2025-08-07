# Callout Organizer Plugin

A powerful Obsidian plugin for organizing, navigating, and customizing callouts across your entire vault. Perfect for academic notes, documentation, and content management.

## 🌟 Key Features

- **🔄 Dual View Modes**: Switch between Current File and All Files search modes
- **🔍 Advanced Search**: Search across filenames, headers, callout titles, IDs, and content
- **📎 Drag & Drop**: Create embed or regular links by dragging callouts
- **🎨 Custom Styling**: Customize colors and icons for all callout types (including math callouts)
- **👻 Invisible Embeddings**: Make embedded callouts appear seamlessly without borders (enabled by default)
- **📋 Flexible Display Options**: Control which headers and elements to show in navigation
- **⚡ Real-time Updates**: Live refresh and caching for optimal performance
- **🧮 Academic Support**: Built-in support for mathematical callouts (theorem, lemma, definition, etc.)

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

## 📚 Supported Callout Types

The plugin automatically detects and provides default styling for:

### Standard Obsidian Callouts
- **Blue**: note, info, todo
- **Teal**: abstract, summary, tldr, tip, hint, important
- **Green**: success, check, done
- **Orange**: question, help, faq, warning, caution, attention
- **Red**: failure, fail, missing, danger, error, bug
- **Purple**: example
- **Gray**: quote, cite

### Academic/Mathematical Callouts
- **theorem** 🔥 - Orange theme with zap icon
- **lemma** 💡 - Yellow theme with lightbulb icon
- **proposition** ⭐ - Purple theme with star icon
- **definition** 📖 - Blue theme with book-open icon
- **corollary** ➡️ - Pink theme with arrow-right icon
- **conjecture** ❓ - Pink theme with help-circle icon
- **remark** 💬 - Red theme with message-circle icon
- **exercise** 🏋️ - Pink theme with dumbbell icon
- **problem** 🧩 - Pink theme with puzzle icon

## 🔧 Troubleshooting

### Common Issues

1. **Callouts not appearing**: Check if folders are excluded in Search Options
2. **Custom colors not applying**: Try restarting Obsidian for CSS changes to take effect
3. **Search results empty**: Verify search fields are enabled in settings
4. **Performance issues**: Reduce max search results or exclude large folders

### Performance Tips

- Use folder exclusions for large vaults (>1000 files)
- Enable "Group by Type" for better organization
- Adjust max search results based on your needs
- Use specific search terms for better performance

## 🔄 Version History

### v1.1.0 (Current)
- ✨ Added invisible embeddings feature (enabled by default)
- 🌍 Custom CSS now applies globally to all callouts
- 🐛 Fixed reset button page jumping issue
- 📂 Reorganized settings hierarchy
- 🧮 Added support for mathematical/academic callout types
- 📚 Comprehensive documentation and README

### v1.0.1
- 🐛 Bug fixes and stability improvements

### v1.0.0
- 🎉 Initial release with core functionality

## 🤝 Contributing

Contributions are welcome! Please feel free to submit pull requests or open issues on the [GitHub repository](https://github.com/mathmaid/obsidian-callout-organizer).

## 📄 License

MIT License - see LICENSE file for details.

## 🙏 Acknowledgments

- Built for the Obsidian community
- Inspired by academic note-taking workflows
- Special thanks to users providing feedback and suggestions