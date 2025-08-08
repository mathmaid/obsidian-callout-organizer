# Callout Organizer Plugin - Maintenance Guide

## Overview
The Callout Organizer plugin helps you manage and navigate callouts throughout your Obsidian vault. This document provides maintenance instructions for the plugin.

## Plugin Location
- **Plugin Directory**: `.obsidian/plugins/callout-organizer/`
- **Main Files**:
  - `main.ts` - Source code
  - `main.js` - Compiled plugin
  - `manifest.json` - Plugin metadata
  - `styles.css` - Plugin styling
  - `package.json` - Dependencies and build scripts

## Version Information
- **Current Version**: 1.1.0
- **Minimum Obsidian Version**: 1.0.0
- **Last Updated**: 2025-08-08

## Key Features

### 1. Callout Organization
- View callouts from current file or all files
- Filter callouts by type with visual buttons
- Search across callout titles, content, and metadata
- Drag and drop callouts to create links

### 2. Responsive Design
- Icons scale with font size (base: 18px at 14px font size)
- Square icons that maintain aspect ratio
- Font size adjustable from 8px to 24px

### 3. Navigation Enhancement
- Click to jump to callout location
- Cursor centers in editor when jumping
- Breadcrumb navigation showing file > headers > callout ID
- Visual highlight animation when navigating

## Settings Configuration

### Display Options
- **Show Filenames**: Toggle filename display in breadcrumbs
- **Show Headers (H1-H6)**: Individual control for each heading level
- **Show Callout IDs**: Display block IDs in navigation
- **Font Sizes**: Separate controls for callout content and breadcrumbs

### Search Options
- **Excluded Folders**: Comma-separated list of folders to exclude from search
- **Maximum Results**: Limit search results for performance (default: 50)
- **Search Fields**: Enable/disable searching in filenames, headers, titles, IDs, and content

### Drag Options
- **Use Embed Links**: Creates `![[file#^id]]` instead of `[[file#^id]]`
- **Invisible Embeddings**: Makes embedded callouts appear seamlessly without padding or borders
- **Hide File Names in Links**: Adds aliases to links to hide filenames (e.g., `[[file#^id|id]]`)

### Callout Options
- **Callout Colors**: Customize colors and icons for built-in and custom callout types
- **Custom CSS**: Additional CSS rules for callout styling

## Maintenance Tasks

### Regular Maintenance
1. **Clear Cache**: Click the refresh button in the plugin panel to clear the cache
2. **Update Settings**: Review and adjust search folders as your vault structure changes
3. **Icon Management**: New callout types are automatically detected and added to settings

### Troubleshooting

#### Icons Not Displaying
- Check if the icon name is valid (Lucide icons only)
- Restart Obsidian after changing icon settings
- Verify custom CSS isn't overriding icon styles

#### Performance Issues
- Reduce maximum search results if searching is slow
- Add frequently-changing folders to excluded folders
- Clear the plugin cache using the refresh button

#### Callouts Not Found
- Ensure callouts follow proper markdown syntax: `> [!type] Title`
- Check that folders aren't excluded in search settings
- Verify files have .md extension

### Development and Updates

#### Building the Plugin
```bash
cd .obsidian/plugins/callout-organizer
npm install
npm run build
```

#### File Structure
- **Source Files**: `main.ts`, `styles.css`
- **Built Files**: `main.js` (generated from main.ts)
- **Configuration**: `manifest.json`, `versions.json`

#### CSS Variables
The plugin uses these CSS variables:
- `--callout-font-size`: Controls icon sizing
- `--callout-color`: RGB values for callout colors
- `--callout-title-color`: Title text color

## Common Issues and Solutions

### Issue: Icons wrong size
**Solution**: Icons now scale with font size using CSS calc()

### Issue: Callout titles have no color
**Solution**: Added fallback to `--text-normal` if `--callout-title-color` not available

### Issue: Cursor not centered when jumping
**Solution**: Updated scrollIntoView with center parameter

### Issue: Note callout shows wrong icon
**Solution**: Default icon changed from `edit-3` to `pencil` to match Obsidian

## Configuration Files

### manifest.json
Contains plugin metadata, version, and compatibility info.

### versions.json
Maps plugin versions to minimum Obsidian versions.

### package.json
Development dependencies and build scripts.

## Best Practices

1. **Regular Backups**: Backup your vault before major plugin updates
2. **Test Changes**: Use a test vault when modifying plugin settings
3. **Performance Monitoring**: Monitor plugin performance with large vaults (1000+ files)
4. **Icon Consistency**: Use consistent icon themes across callout types
5. **Folder Organization**: Keep excluded folders list updated as vault structure changes

## Support

For issues or feature requests:
1. Check this maintenance guide first
2. Review plugin settings for configuration options
3. Try disabling and re-enabling the plugin
4. Check Obsidian developer console for error messages

## Change Log

### Version 1.1.0 (2025-08-08)

#### New Features
- **Hide File Names in Links**: Added new drag option to hide filenames in generated links by using aliases
  - When enabled, dragged callouts create links like `[[filename#^theorem-def456|theorem-def456]]`
  - Uses the actual callout ID as the alias for clean, readable links
  - Works with both regular links and embed links
  - Disabled by default to maintain backward compatibility

#### Code Improvements
- Optimized filename extraction logic for better null handling
- Enhanced drag functionality with cleaner alias generation
- Updated setting descriptions with accurate examples

### Version 1.0.1 (2025-08-07)

#### Bug Fixes
- Fixed callout icons displaying in wrong positions
- Fixed callout title colors not applying correctly  
- Fixed note callout using wrong icon (now uses correct `lucide-pencil`)
- Fixed toggle button width causing layout shifts
- Fixed icon base size from 18px to 16px for better proportions

#### Improvements
- Moved breadcrumbs to bottom of callout items for better organization
- Improved code consistency with constants for repeated SVG icons
- Removed debug logging for cleaner console output
- Enhanced visual layout and spacing

#### Technical Changes
- Created `OBSIDIAN_NOTE_ICON_SVG` constant for consistent note icon rendering
- Cleaned up placeholder comments and redundant code
- Maintained responsive icon scaling functionality

### Version 1.0.0 (2025-08-07)

### New Features
- Responsive icon sizing based on font size
- Cursor centering when jumping to callouts
- Enhanced callout title color handling

### Improvements
- Removed "Included Folders" mode (now exclude-only)
- Fixed note callout icon to use `pencil`
- Added restart notification for CSS changes
- Default "Use embed links" now enabled

### Bug Fixes
- Fixed icon sizing inconsistency
- Improved color fallbacks for callout titles
- Better folder filtering logic

### Code Quality
- Removed redundant code
- Improved consistency across components
- Updated dependencies and build process