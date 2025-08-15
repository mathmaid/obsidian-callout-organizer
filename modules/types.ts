export interface CalloutColors {
    color: string; // Hex color like "#2ea4e5"
    icon: string; // Lucide icon name like "info" or ""
}

export interface CalloutCache {
    version: string;
    timestamp: number;
    vaultPath: string;
    callouts: CalloutItem[];
    fileModTimes: Record<string, string>; // file path -> modification time (readable format)
    calloutCreationTimes?: Record<string, string>; // Deprecated: kept for backward compatibility
}

export interface CalloutOrganizerSettings {
    excludedFolders: string[];
    groupByType: boolean;
    searchInFilenames: boolean;
    searchInCalloutTitles: boolean;
    searchInCalloutIds: boolean;
    searchInCalloutContent: boolean;
    maxSearchResults: number;
    // Cache settings (always enabled)
    // Canvas settings
    canvasStorageFolder: string;
    // Display options
    showFilenames: boolean;
    showH1Headers: boolean;
    showH2Headers: boolean;
    showH3Headers: boolean;
    showH4Headers: boolean;
    showH5Headers: boolean;
    showH6Headers: boolean;
    showCalloutIds: boolean;
    calloutFontSize: number;
    breadcrumbFontSize: number;
    // Drag options
    useEmbedLinks: boolean;
    invisibleEmbeddings: boolean;
    hideFileNamesInLinks: boolean;
    // Callout options
    customCalloutCSS: string;
    // Callout color customization
    calloutColors: Record<string, CalloutColors>;
}

export interface CalloutConnection {
    id: string;                    // 连接唯一ID
    targetCalloutId: string;       // 目标callout ID
    connectionType?: 'relates' | 'supports' | 'follows' | 'contradicts';
    label?: string;                // 连接标签
    createdTime: string;           // 创建时间
}

export interface CalloutItem {
    file: string;
    type: string;
    title: string;
    content: string;
    calloutID?: string;  // Unique identifier for the callout (replaces blockId)
    lineNumber: number;
    headers?: string[];
    headerLevels?: number[];
    fileModTime?: string; // Human-readable file modification time (YYYY-MM-DD HH:mm:ss)
    calloutCreatedTime?: string; // Human-readable time when callout was first created (YYYY-MM-DD HH:mm:ss)
    calloutModifyTime?: string;  // Human-readable time when callout was last modified (YYYY-MM-DD HH:mm:ss)
    outlinks?: [string, string, string?][]; // Array of [filename, calloutID, label?] tuples that this callout links TO
    canvasWidth?: number;  // Canvas node width for this callout (when used as main node)
    canvasHeight?: number; // Canvas node height for this callout (when used as main node)
}

export interface HeadingInfo {
    title: string;
    level: number;
    lineNumber: number;
}

export interface IconCategory {
    name: string;
    icons: string[];
}