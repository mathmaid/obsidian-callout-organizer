# Callout Organizer Plugin - Maintenance Guide

This document provides guidance for maintaining and developing the Callout Organizer plugin.

## 🏗️ Project Structure

```
callout-organizer/
├── main.ts                 # Main plugin source code
├── main.js                 # Compiled JavaScript (generated)
├── manifest.json          # Plugin manifest
├── package.json           # Node.js dependencies and scripts
├── styles.css             # Plugin-specific styles
├── tsconfig.json          # TypeScript configuration
├── esbuild.config.mjs     # Build configuration
├── README.md              # User documentation
├── MAINTENANCE.md         # This file
├── CHANGELOG.md           # Version history
└── versions.json          # Version compatibility
```

## 🔧 Development Setup

### Prerequisites
- Node.js (v16+)
- npm
- TypeScript knowledge
- Obsidian API familiarity

### Installation
```bash
# Clone or download the plugin
cd callout-organizer

# Install dependencies
npm install

# Development build (watch mode)
npm run dev

# Production build
npm run build
```

## 📝 Key Components

### 1. CalloutOrganizerView Class
- **Purpose**: Main UI component for the plugin
- **Location**: `main.ts` lines ~87-1129
- **Key Methods**:
  - `setupTopBar()`: Creates search interface
  - `renderCallouts()`: Renders callout list
  - `openFile()`: Navigation functionality

### 2. CalloutOrganizerPlugin Class
- **Purpose**: Core plugin logic
- **Location**: `main.ts` lines ~1131-1643
- **Key Methods**:
  - `extractCalloutsFromFile()`: Parses callouts from files
  - `injectCustomCalloutCSS()`: Applies custom styling
  - `initializeCalloutColors()`: Sets up color schemes

### 3. CalloutOrganizerSettingTab Class
- **Purpose**: Settings UI
- **Location**: `main.ts` lines ~1646-2243
- **Key Methods**:
  - `display()`: Creates settings interface
  - `createDynamicCalloutColorSettings()`: Color customization

## 🎨 Styling System

### CSS Injection
- Custom CSS is injected via `injectCustomCalloutCSS()`
- Applies globally to all callouts (`.callout` selector)
- Includes callout colors, invisible embeddings, and custom CSS

### Color Management
- Default colors defined in `getDefaultColorForCalloutType()`
- Supports both built-in and academic callout types
- Colors are stored as hex values, converted to RGB for CSS

## 🔄 Version Management

### Version Bumping Process
1. Update version in `manifest.json`
2. Update version in `package.json`
3. Document changes in README.md version history
4. Build and test the plugin
5. Copy distribution files to project root

### Semantic Versioning
- **Patch (x.x.1)**: Bug fixes, minor improvements
- **Minor (x.1.x)**: New features, significant enhancements
- **Major (1.x.x)**: Breaking changes, major redesigns

## 🧪 Testing Checklist

### Before Release
- [ ] Test dual view modes (Current File / All Files)
- [ ] Verify search functionality across all fields
- [ ] Test drag & drop with both embed and regular links
- [ ] Check color customization for built-in and custom callouts
- [ ] Verify invisible embeddings toggle
- [ ] Test reset buttons don't cause page jumping
- [ ] Check performance with large vaults
- [ ] Validate settings persistence
- [ ] Test mathematical callout types

### Performance Testing
- [ ] Test with vaults >1000 files
- [ ] Verify search debouncing works
- [ ] Check memory usage with large caches
- [ ] Test folder exclusion performance

## 🐛 Common Issues & Solutions

### Issue: Custom colors not applying
**Solution**: Check CSS injection order, ensure proper RGB conversion

### Issue: Search performance slow
**Solution**: Implement/verify debouncing, check cache invalidation

### Issue: Settings not persisting
**Solution**: Verify `saveSettings()` calls, check data structure

### Issue: Icons not displaying
**Solution**: Check Lucide icon names, verify setIcon calls

## 📊 Performance Considerations

### Caching Strategy
- Cache all callouts for 5 minutes in search mode
- Limit cache size to 1000 items
- Debounce search input (200ms)
- Debounce render operations (150ms)

### Memory Management
- Clear caches on plugin unload
- Use WeakMap for temporary DOM references
- Limit search results to configurable maximum

## 🔀 Adding New Features

### New Callout Types
1. Add to `getDefaultColorForCalloutType()`
2. Add to `getDefaultIconForCalloutType()`
3. Update README.md documentation
4. Test with real examples

### New Settings
1. Add to `CalloutOrganizerSettings` interface
2. Add to `DEFAULT_SETTINGS` object
3. Create UI in `display()` method
4. Handle setting changes appropriately

## 📦 Build & Distribution

### Build Process
```bash
# Type check and build
npm run build

# This runs:
# 1. tsc -noEmit -skipLibCheck (type checking)
# 2. node esbuild.config.mjs production (bundling)
```

### Distribution Files
Copy these files to project root:
- `main.js` (compiled plugin)
- `manifest.json` (plugin metadata)
- `styles.css` (plugin styles)

## 🔍 Debugging Tips

### Enable Console Logging
- Uncomment debug logs in production code temporarily
- Use browser dev tools for DOM inspection
- Monitor network requests for file operations

### Common Debug Points
- Callout extraction regex patterns
- CSS injection timing
- Settings save/load operations
- Cache invalidation logic

## 📚 Resources

- [Obsidian Plugin API](https://github.com/obsidianmd/obsidian-api)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Lucide Icons](https://lucide.dev/)
- [CSS Custom Properties](https://developer.mozilla.org/en-US/docs/Web/CSS/--*)

## 🤝 Contributing

When contributing:
1. Follow existing code style
2. Add JSDoc comments for new methods
3. Update tests and documentation
4. Test thoroughly before submitting
5. Update this maintenance guide if needed

## 📞 Support

For technical issues:
- Check console for error messages
- Review this maintenance guide
- Consult Obsidian Plugin API documentation
- Open issues on GitHub with detailed reproduction steps