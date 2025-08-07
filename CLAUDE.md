# Claude Code Configuration

This is an Obsidian vault for developing the callout-organizer plugin.

## Project Structure
- `.obsidian/plugins/callout-organizer/` - Main plugin directory
- Plugin files: main.js, manifest.json, styles.css, data.json

## Development Commands
- No specific build commands (plugin is developed directly in TypeScript/JavaScript)
- Testing: Manual testing within Obsidian

## Plugin Information
- **Name**: Callout Organizer
- **Version**: 1.0.0
- **Purpose**: Organize and manage Obsidian callouts with custom icons and navigation

## Key Features
- Custom callout icons
- Callout navigation and organization
- Drag and drop functionality
- Font size responsive icons
- Folder exclusion settings

## Development Notes
- Icons should be square and scale with font size
- Default font size is 14px, icon base size is 18px
- Use lucide-pencil for note callouts (not lucide-edit-3)
- Some CSS changes require Obsidian restart to take effect

## Common Issues
- Icon inconsistencies between Obsidian builtin and plugin versions
- Icon sizing not responsive to font size changes
- Missing color styling for callout titles