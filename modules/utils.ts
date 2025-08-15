import { CalloutItem, CalloutOrganizerSettings } from './types';

// Utility functions for time formatting
export function timestampToReadable(timestamp: number): string {
    const date = new Date(timestamp);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

export function readableToTimestamp(readable: string): number {
    return new Date(readable).getTime();
}

// Helper function to check if callout content has changed
export function hasCalloutChanged(newCallout: CalloutItem, existingCallout: CalloutItem): boolean {
    return newCallout.type !== existingCallout.type ||
           newCallout.title !== existingCallout.title ||
           newCallout.content !== existingCallout.content;
}

// Filter headers based on user settings
export function filterHeadersBySettings(headers: string[], headerLevels: number[] | undefined, settings: CalloutOrganizerSettings): string[] {
    if (!headerLevels || headers.length !== headerLevels.length) {
        return headers; // Return all headers if levels not available
    }
    
    const filtered: string[] = [];
    for (let i = 0; i < headers.length; i++) {
        const level = headerLevels[i];
        let shouldInclude = false;
        
        switch (level) {
            case 1:
                shouldInclude = settings.showH1Headers;
                break;
            case 2:
                shouldInclude = settings.showH2Headers;
                break;
            case 3:
                shouldInclude = settings.showH3Headers;
                break;
            case 4:
                shouldInclude = settings.showH4Headers;
                break;
            case 5:
                shouldInclude = settings.showH5Headers;
                break;
            case 6:
                shouldInclude = settings.showH6Headers;
                break;
            default:
                shouldInclude = true; // Include unknown levels by default
        }
        
        if (shouldInclude) {
            filtered.push(headers[i]);
        }
    }
    
    return filtered;
}