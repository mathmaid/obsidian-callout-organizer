import { App, TFile } from 'obsidian';
import { CalloutItem, CalloutOrganizerSettings } from './types';

// This is a simplified version of the canvas handling functionality
// The full implementation would need to be extracted from main.ts
// This provides the basic structure for the refactoring

export class CanvasHandler {
    private app: App;
    private settings: CalloutOrganizerSettings;

    constructor(app: App, settings: CalloutOrganizerSettings) {
        this.app = app;
        this.settings = settings;
    }

    /**
     * Register canvas drop handler to fix node IDs
     */
    registerCanvasDropHandler(callback: (event: DragEvent) => void): void {
        document.addEventListener('drop', callback, true);
    }

    /**
     * Handle canvas drop events
     */
    handleCanvasDrop(event: DragEvent): void {
        // Check if this is a canvas
        const target = event.target as HTMLElement;
        const canvasEl = target.closest('.canvas-node-container, .canvas-wrapper, .view-content[data-type="canvas"]');
        
        if (!canvasEl || !event.dataTransfer) return;
        
        const canvasNodeProps = event.dataTransfer.getData('text/canvas-node-props');
        if (canvasNodeProps) {
            try {
                const props = JSON.parse(canvasNodeProps);
                // Use requestAnimationFrame to prevent ResizeObserver loops
                requestAnimationFrame(() => {
                    this.performCanvasOperations(canvasEl, props);
                });
            } catch (error) {
                console.error('Error parsing canvas node props:', error);
            }
        }
    }

    /**
     * Perform canvas operations in a controlled manner to prevent ResizeObserver loops
     */
    private async performCanvasOperations(canvasEl: Element, props: any): Promise<void> {
        try {
            // Batch DOM operations to prevent layout thrashing
            await this.fixCanvasNodeId(canvasEl, props);
            
            // Use another frame for the next operation to prevent cascading layout changes
            requestAnimationFrame(() => {
                this.removeDuplicateTextNodes(canvasEl, props);
                
                // Final operation after all DOM changes are complete
                requestAnimationFrame(() => {
                    this.deselectAllCanvasNodes();
                });
            });
        } catch (error) {
            console.error('Error performing canvas operations:', error);
        }
    }

    /**
     * Open callout in canvas view
     */
    async openCalloutCanvas(callout: CalloutItem, generateCalloutId: (callout: CalloutItem) => string, addCalloutIdToCallout: (callout: CalloutItem, id: string) => Promise<void>): Promise<void> {
        try {
            // Generate callout ID if it doesn't exist
            if (!callout.calloutID) {
                const newCalloutID = generateCalloutId(callout);
                callout.calloutID = newCalloutID;
                
                try {
                    // Add the ID to the file
                    await addCalloutIdToCallout(callout, newCalloutID);
                } catch (error) {
                    console.error('Error adding callout ID to file:', error);
                    // Reset the callout ID if we failed to add it to the file
                    callout.calloutID = undefined;
                    return;
                }
            }

            // TODO: Create canvas with callout and its relationships
            // This would need to be implemented with the full canvas creation logic
            console.log('Opening canvas for callout:', callout);
            
        } catch (error) {
            console.error('Error opening callout canvas:', error);
        }
    }

    /**
     * Extract callout info from canvas filename
     */
    extractCalloutFromCanvasName(canvasFileName: string): { filename: string; calloutID: string } | null {
        // Expected format: filename_calloutID.canvas
        const match = canvasFileName.match(/^(.+)_([^_]+)\.canvas$/);
        if (match) {
            return {
                filename: match[1] + '.md',
                calloutID: match[2]
            };
        }
        return null;
    }

    /**
     * Helper function to deselect all canvas nodes
     */
    private deselectAllCanvasNodes(): void {
        try {
            const activeLeaf = this.app.workspace.getActiveViewOfType('canvas' as any);
            if (!activeLeaf) return;

            // TODO: Implement canvas node deselection logic
            // This would need access to the canvas view internals
            
        } catch (error) {
            console.error('Error deselecting canvas nodes:', error);
        }
    }

    /**
     * Fix canvas node ID to use file+subpath format
     */
    private async fixCanvasNodeId(canvasEl: Element, props: any): Promise<void> {
        // TODO: Implement canvas node ID fixing logic
        // This would need to modify the canvas data structure
        console.log('Fixing canvas node ID:', props);
    }

    /**
     * Remove duplicate text nodes from canvas
     */
    private removeDuplicateTextNodes(canvasEl: Element, props: any): void {
        // TODO: Implement duplicate text node removal logic
        console.log('Removing duplicate text nodes:', props);
    }

    /**
     * Create a canvas with callout connections (complete implementation from original)
     */
    async createCalloutGraphCanvas(selectedCallout: CalloutItem, 
                                   getAllCallouts: () => Promise<CalloutItem[]>): Promise<void> {
        try {
            // Include filename in naming to avoid duplicates
            const sourceFilename = selectedCallout.file?.split('/').pop()?.replace('.md', '') || 'unknown';
            const canvasFileName = `callout_${sourceFilename}_${selectedCallout.calloutID || Date.now()}.canvas`;
            const canvasPath = `${this.settings.canvasStorageFolder}/${canvasFileName}`;
            
            // Ensure canvas storage folder exists
            const canvasFolder = this.app.vault.getAbstractFileByPath(this.settings.canvasStorageFolder);
            if (!canvasFolder) {
                await this.app.vault.createFolder(this.settings.canvasStorageFolder);
            }
            
            // Create base canvas data structure
            const mainNodeId = `node-${Date.now()}-main`;
            const mainNodeWidth = selectedCallout.canvasWidth || 400;
            const mainNodeHeight = selectedCallout.canvasHeight || 180;
            
            const canvasData = {
                nodes: [
                    {
                        id: mainNodeId,
                        type: "file",
                        file: selectedCallout.file,
                        subpath: `#^${selectedCallout.calloutID}`,
                        x: 0,
                        y: 0,
                        width: mainNodeWidth,
                        height: mainNodeHeight,
                        color: this.getCanvasColorForCallout(selectedCallout.type)
                    }
                ],
                edges: []
            };

            // Add related callouts and create connections
            const allCallouts = await getAllCallouts();
            const relatedCallouts = this.findRelatedCallouts(selectedCallout, allCallouts);
            
            // Layout related callouts around the main callout
            this.layoutRelatedCallouts(canvasData, mainNodeId, relatedCallouts, selectedCallout);
            
            // Create or update canvas file
            const existingCanvas = this.app.vault.getAbstractFileByPath(canvasPath);
            if (existingCanvas instanceof TFile) {
                await this.app.vault.modify(existingCanvas, JSON.stringify(canvasData, null, 2));
            } else {
                await this.app.vault.create(canvasPath, JSON.stringify(canvasData, null, 2));
            }
            
            // Open the canvas
            const canvasFile = this.app.vault.getAbstractFileByPath(canvasPath);
            if (canvasFile instanceof TFile) {
                const leaf = this.app.workspace.getLeaf(false);
                await leaf.openFile(canvasFile);
            }
            
        } catch (error) {
            console.error('Error creating callout graph canvas:', error);
        }
    }

    /**
     * Find callouts related to the selected callout through outlinks
     */
    private findRelatedCallouts(selectedCallout: CalloutItem, allCallouts: CalloutItem[]): CalloutItem[] {
        const related: CalloutItem[] = [];
        const selectedKey = `${selectedCallout.file}:${selectedCallout.calloutID}`;
        
        // Create callout map for quick lookup
        const calloutMap = new Map<string, CalloutItem>();
        allCallouts.forEach(callout => {
            if (callout.calloutID) {
                const key = `${callout.file}:${callout.calloutID}`;
                calloutMap.set(key, callout);
            }
        });
        
        // Find outlinks from selected callout
        if (selectedCallout.outlinks) {
            selectedCallout.outlinks.forEach(([filename, calloutID]) => {
                const targetKey = `${filename}:${calloutID}`;
                const targetCallout = calloutMap.get(targetKey);
                if (targetCallout && targetKey !== selectedKey) {
                    related.push(targetCallout);
                }
            });
        }
        
        // Find inlinks to selected callout
        allCallouts.forEach(callout => {
            if (callout.calloutID && callout.outlinks) {
                const hasLinkToSelected = callout.outlinks.some(([filename, calloutID]) => 
                    filename === selectedCallout.file && calloutID === selectedCallout.calloutID
                );
                
                if (hasLinkToSelected) {
                    const calloutKey = `${callout.file}:${callout.calloutID}`;
                    if (calloutKey !== selectedKey && !related.some(r => `${r.file}:${r.calloutID}` === calloutKey)) {
                        related.push(callout);
                    }
                }
            }
        });
        
        return related;
    }

    /**
     * Layout related callouts around the main callout in a circular pattern
     */
    private layoutRelatedCallouts(canvasData: any, mainNodeId: string, relatedCallouts: CalloutItem[], selectedCallout: CalloutItem): void {
        const radius = 400;
        const angleStep = relatedCallouts.length > 0 ? (2 * Math.PI) / relatedCallouts.length : 0;
        
        relatedCallouts.forEach((callout, index) => {
            const angle = index * angleStep;
            const x = Math.cos(angle) * radius;
            const y = Math.sin(angle) * radius;
            
            const nodeId = `node-${Date.now()}-${index}`;
            
            // Add node
            canvasData.nodes.push({
                id: nodeId,
                type: "file",
                file: callout.file,
                subpath: `#^${callout.calloutID}`,
                x: x,
                y: y,
                width: callout.canvasWidth || 350,
                height: callout.canvasHeight || 150,
                color: this.getCanvasColorForCallout(callout.type)
            });
            
            // Add edge
            canvasData.edges.push({
                id: `edge-${Date.now()}-${index}`,
                fromNode: mainNodeId,
                fromSide: "right",
                toNode: nodeId,
                toSide: "left"
            });
        });
    }

    /**
     * Get canvas color for callout type
     */
    private getCanvasColorForCallout(calloutType: string): string {
        // Color mapping for canvas nodes
        const colorMap: Record<string, string> = {
            'note': '#086ddd',
            'info': '#086ddd',
            'tip': '#00a86b',
            'important': '#00a86b',
            'success': '#00a86b',
            'warning': '#ff9500',
            'caution': '#ff9500',
            'danger': '#e13238',
            'error': '#e13238',
            'example': '#7c3aed',
            'quote': '#6b7280'
        };
        
        return colorMap[calloutType.toLowerCase()] || '#6b7280';
    }

    /**
     * Analyze canvas files for link relationships
     */
    async analyzeCanvasLinks(callouts: CalloutItem[]): Promise<CalloutItem[]> {
        try {
            const updatedCallouts = callouts.map(callout => ({
                ...callout,
                outlinks: [...(callout.outlinks || [])]
            }));
            
            // Find all canvas files
            const canvasFiles = this.app.vault.getFiles().filter(file => file.extension === 'canvas');
            
            for (const canvasFile of canvasFiles) {
                try {
                    const canvasContent = await this.app.vault.read(canvasFile);
                    const canvasData = JSON.parse(canvasContent);
                    
                    // Process canvas connections
                    if (canvasData.edges && canvasData.nodes) {
                        this.processCanvasEdges(canvasData, updatedCallouts);
                    }
                } catch (error) {
                    console.warn(`Failed to parse canvas file ${canvasFile.path}:`, error);
                }
            }
            
            return updatedCallouts;
        } catch (error) {
            console.error('Error analyzing canvas links:', error);
            return callouts;
        }
    }

    /**
     * Process edges from canvas data and add to callout outlinks
     */
    private processCanvasEdges(canvasData: any, callouts: CalloutItem[]): void {
        const nodeMap = new Map();
        
        // Map node IDs to their file/subpath information
        canvasData.nodes.forEach((node: any) => {
            if (node.type === 'file' && node.file && node.subpath) {
                nodeMap.set(node.id, {
                    file: node.file,
                    calloutID: node.subpath.replace('#^', '')
                });
            }
        });
        
        // Process edges to create outlinks
        canvasData.edges.forEach((edge: any) => {
            const fromNode = nodeMap.get(edge.fromNode);
            const toNode = nodeMap.get(edge.toNode);
            
            if (fromNode && toNode) {
                // Find the source callout and add the target as an outlink
                const sourceCallout = callouts.find(c => 
                    c.file === fromNode.file && c.calloutID === fromNode.calloutID
                );
                
                if (sourceCallout) {
                    if (!sourceCallout.outlinks) {
                        sourceCallout.outlinks = [];
                    }
                    
                    // Avoid duplicates
                    const exists = sourceCallout.outlinks.some(([file, id]) => 
                        file === toNode.file && id === toNode.calloutID
                    );
                    
                    if (!exists) {
                        sourceCallout.outlinks.push([toNode.file, toNode.calloutID, edge.label]);
                    }
                }
            }
        });
    }
}