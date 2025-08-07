This is an Obsidian vault built for the development of the plugin callout-organizer. The plugin is located at `.obsidian/plugins/callout-organizer`. This is a semifinished product since it is inconsistent in some codes and still have some bugs. Now I want you to do the following thing:

1. Initialize the vault and create CLAUDE.md
2. Read the code comprehensively and make the code more correct, consistent, and efficient. Remove redundant codes and delete useless files. Change the version of the plugin to 1.0.0 and set all the parameters of the plugin as if I was the first time to use it (including deleting data.json of the plugin)
3. Create a maintenance instruction file in the Obsidian vault. Create a README.md file in the plugin folder.

After doing these things, git commit using message "Update 1.0.0". Then we can deal with the problems of the plugin:

-  There's a small problem. The default icon of the Obsidian builtin callout 'note' is lucide-pencil, but in the setting, the default icon displayed on the left is lucide-edit-3.

This is the icon in the Obsidian editor:

```html
<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svg-icon lucide-pencil"><path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"></path><path d="m15 5 4 4"></path></svg>
```

This is the icon the plugin use:

```html
<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svg-icon lucide-edit-3"><path d="M12 20h9"></path><path d="M16.376 3.622a1 1 0 0 1 3.002 3.002L7.368 18.635a2 2 0 0 1-.855.506l-2.872.838a.5.5 0 0 1-.62-.62l.838-2.872a2 2 0 0 1 .506-.854z"></path></svg>
```

Other icons are all correct. It seems this problem is caused by Obsidian itself. I want you to use the icon that Obsidian use for note callouts.

- I notice that the size of the icon is not consistent. The size of icons in the plugin is `16*18`. And it will not change when I change the font size of callout content in the setting. I want it to be square and rescale when I change the font size. For example, if I change the font size to 20, then the size of the icon in callout-organizer-item should be `18*20/14` (18 is the default size for font size 14). 

- Add a tip in the "Callout Options" says that you should reboot Obsidian to make some of the CSS settings take effect.

- Change the default drag options "Use embedded links" to true.

-  The callout title in callout-organizer-item do not have color.

- When jumping to the callouts, I want the cursor in the middle of the editor if possible.

- Delete the "Included Folders" mode and only use "Excluded Folders"