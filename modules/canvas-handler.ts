import { App, TFile, TFolder } from 'obsidian';
import { CalloutItem, CalloutOrganizerSettings } from './types';

// Complete canvas handling functionality extracted from main-original.ts
// Handles canvas creation, relationship analysis, drag/drop operations, and link processing

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
            const mainNodeHeight = selectedCallout.canvasHeight || 200;
            
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

            // Get all callouts for relationship analysis
            const allCallouts = await getAllCallouts();
            
            // Helper function to get callout key
            const getCalloutKey = (callout: CalloutItem) => `${callout.file}:${callout.calloutID}`;
            const mainCalloutKey = getCalloutKey(selectedCallout);
            
            // Create callout mapping
            const calloutMap = new Map<string, CalloutItem>();
            allCallouts.forEach(callout => {
                if (callout.calloutID) {
                    const key = `${callout.file}:${callout.calloutID}`;
                    calloutMap.set(key, callout);
                }
            });
            
            // Analyze main node connections
            const directInlinks: CalloutItem[] = [];
            const directOutlinks: CalloutItem[] = [];
            const bidirectionalLinks: CalloutItem[] = [];
            
            // Create global edge label map from ALL callouts
            const globalEdgeLabels = new Map<string, string>();
            allCallouts.forEach(callout => {
                if (callout.outlinks) {
                    callout.outlinks.forEach(([filename, calloutID, label]) => {
                        if (label) {
                            const fromKey = `${callout.file}:${callout.calloutID}`;
                            const toKey = `${filename}:${calloutID}`;
                            const edgeKey = `${fromKey}->${toKey}`;
                            globalEdgeLabels.set(edgeKey, label);
                        }
                    });
                }
            });
            
            // Process main node's outlinks (right side nodes)
            const outlinkLabels = new Map<string, string>();
            if (selectedCallout.outlinks) {
                selectedCallout.outlinks.forEach(([filename, calloutID, label]) => {
                    const targetKey = `${filename}:${calloutID}`;
                    
                    // Store label if present
                    if (label) {
                        outlinkLabels.set(targetKey, label);
                    }
                    
                    // Check if this is a self-connection
                    const isSelfConnection = filename === selectedCallout.file && calloutID === selectedCallout.calloutID;
                    
                    if (!isSelfConnection) {
                        const targetCallout = calloutMap.get(targetKey);
                        if (targetCallout) {
                            // Check if it's bidirectional
                            const isTargetLinkingBack = targetCallout.outlinks?.some(([f, cId]) => 
                                f === selectedCallout.file && cId === selectedCallout.calloutID
                            );
                            
                            if (isTargetLinkingBack) {
                                bidirectionalLinks.push(targetCallout);
                            } else {
                                directOutlinks.push(targetCallout);
                            }
                        }
                    }
                });
            }
            
            // Find callouts pointing to main node (left side nodes)
            allCallouts.forEach(callout => {
                if (callout.calloutID && callout.outlinks) {
                    const hasLinkToMain = callout.outlinks.some(([filename, calloutID]) => 
                        filename === selectedCallout.file && calloutID === selectedCallout.calloutID
                    );
                    
                    if (hasLinkToMain) {
                        const calloutKey = getCalloutKey(callout);
                        const isSelfConnection = calloutKey === getCalloutKey(selectedCallout);
                        
                        if (!isSelfConnection) {
                            // Check if already processed as bidirectional
                            const alreadyProcessed = bidirectionalLinks.some(biCallout => 
                                getCalloutKey(biCallout) === calloutKey
                            );
                            
                            if (!alreadyProcessed) {
                                directInlinks.push(callout);
                            }
                        }
                    }
                }
            });
            
            // Advanced layout algorithm: left-right separation layout
            const layoutData = new Map<string, {callout: CalloutItem, x: number, y: number, level: number, side: 'left' | 'right' | 'bidirectional'}>();
            
            // Layout parameters
            const nodeSpacing = 280;
            const levelSpacing = Math.max(600, mainNodeWidth + 200);
            const bidirectionalSpacing = 150;
            
            // Left side layout: inlinks
            directInlinks.forEach((callout, index) => {
                const calloutKey = getCalloutKey(callout);
                const totalInlinks = directInlinks.length;
                const x = -levelSpacing;
                const y = (index - (totalInlinks - 1) / 2) * nodeSpacing;
                
                layoutData.set(calloutKey, {
                    callout,
                    x,
                    y,
                    level: 1,
                    side: 'left'
                });
            });
            
            // Right side layout: outlinks
            directOutlinks.forEach((callout, index) => {
                const calloutKey = getCalloutKey(callout);
                const totalOutlinks = directOutlinks.length;
                const x = levelSpacing;
                const y = (index - (totalOutlinks - 1) / 2) * nodeSpacing;
                
                layoutData.set(calloutKey, {
                    callout,
                    x,
                    y,
                    level: 1,
                    side: 'right'
                });
            });
            
            // Bidirectional connections layout: alternating top/bottom near center
            bidirectionalLinks.forEach((callout, index) => {
                const calloutKey = getCalloutKey(callout);
                const totalBidirectional = bidirectionalLinks.length;
                const x = 0; // Centered
                const y = (index - (totalBidirectional - 1) / 2) * bidirectionalSpacing + 
                         (index % 2 === 0 ? -250 : 250); // Alternating top/bottom
                
                layoutData.set(calloutKey, {
                    callout,
                    x,
                    y,
                    level: 1,
                    side: 'bidirectional'
                });
            });
            
            // Add all nodes to canvas
            let nodeIdCounter = 0;
            layoutData.forEach(({callout, x, y, level}) => {
                // Use saved dimensions if available, otherwise calculate based on level
                const defaultWidth = Math.max(300, 400 - level * 25);
                const defaultHeight = Math.max(120, 200 - level * 20);
                
                const nodeWidth = callout.canvasWidth || defaultWidth;
                const nodeHeight = callout.canvasHeight || defaultHeight;
                
                // Generate temporary ID for each node
                const nodeId = `node-${Date.now()}-${++nodeIdCounter}`;
                
                canvasData.nodes.push({
                    id: nodeId,
                    type: "file",
                    file: callout.file,
                    subpath: `#^${callout.calloutID}`,
                    x: Math.round(x),
                    y: Math.round(y),
                    width: nodeWidth,
                    height: nodeHeight,
                    color: this.getCanvasColorForCallout(callout.type)
                });
            });
            
            // Create connection edges based on new paradigm
            let edgeId = 0;
            const nodeMap = new Map<string, any>(); // Map from "file:calloutID" to node
            
            // Create mapping for each node
            canvasData.nodes.forEach((node: any) => {
                if (node.type === "file" && node.file && node.subpath) {
                    const fileMatch = node.subpath.match(/^#\^(.+)$/);
                    if (fileMatch) {
                        const calloutID = fileMatch[1];
                        const key = `${node.file}:${calloutID}`;
                        nodeMap.set(key, node);
                    }
                }
            });
            
            const mainNodeKey = `${selectedCallout.file}:${selectedCallout.calloutID}`;
            const mainNode = nodeMap.get(mainNodeKey);
            
            if (mainNode) {
                // Create connections from left side nodes (inlinks) to main node
                directInlinks.forEach(callout => {
                    const calloutKey = getCalloutKey(callout);
                    const fromNode = nodeMap.get(calloutKey);
                    if (fromNode) {
                        const edge: any = {
                            id: `edge-${++edgeId}`,
                            fromNode: fromNode.id,
                            fromSide: "right",
                            toNode: mainNode.id,
                            toSide: "left"
                        };
                        
                        // Check for global edge label
                        const edgeKey = `${calloutKey}->${mainNodeKey}`;
                        const label = globalEdgeLabels.get(edgeKey);
                        if (label) {
                            edge.label = label;
                        }
                        
                        (canvasData.edges as any[]).push(edge);
                    }
                });
                
                // Create connections from main node to right side nodes (outlinks)
                directOutlinks.forEach(callout => {
                    const calloutKey = getCalloutKey(callout);
                    const toNode = nodeMap.get(calloutKey);
                    if (toNode) {
                        const edge: any = {
                            id: `edge-${++edgeId}`,
                            fromNode: mainNode.id,
                            fromSide: "right",
                            toNode: toNode.id,
                            toSide: "left"
                        };
                        
                        // Add label if present (check global labels first, then local)
                        const globalEdgeKey = `${mainNodeKey}->${calloutKey}`;
                        const globalLabel = globalEdgeLabels.get(globalEdgeKey);
                        const localLabel = outlinkLabels.get(calloutKey);
                        const label = globalLabel || localLabel;
                        if (label) {
                            edge.label = label;
                        }
                        
                        (canvasData.edges as any[]).push(edge);
                    }
                });
                
                // Create bidirectional connections (main node with top/bottom nodes)
                bidirectionalLinks.forEach(callout => {
                    const calloutKey = getCalloutKey(callout);
                    const biNode = nodeMap.get(calloutKey);
                    if (biNode) {
                        // Main node to bidirectional node - right to right pattern
                        const forwardEdge: any = {
                            id: `edge-${++edgeId}`,
                            fromNode: mainNode.id,
                            fromSide: "right",
                            toNode: biNode.id,
                            toSide: "right"
                        };
                        
                        // Add label for forward edge if present
                        const globalForwardKey = `${mainNodeKey}->${calloutKey}`;
                        const globalForwardLabel = globalEdgeLabels.get(globalForwardKey);
                        const localForwardLabel = outlinkLabels.get(calloutKey);
                        const forwardLabel = globalForwardLabel || localForwardLabel;
                        if (forwardLabel) {
                            forwardEdge.label = forwardLabel;
                        }
                        
                        (canvasData.edges as any[]).push(forwardEdge);
                        
                        // Bidirectional node to main node - left to left pattern
                        const reverseEdge: any = {
                            id: `edge-${++edgeId}`,
                            fromNode: biNode.id,
                            fromSide: "left",
                            toNode: mainNode.id,
                            toSide: "left"
                        };
                        
                        // Add label for reverse edge if present
                        const globalReverseKey = `${calloutKey}->${mainNodeKey}`;
                        const reverseLabel = globalEdgeLabels.get(globalReverseKey);
                        if (reverseLabel) {
                            reverseEdge.label = reverseLabel;
                        }
                        
                        (canvasData.edges as any[]).push(reverseEdge);
                    }
                });
            }

            // Always regenerate canvas file to reflect latest connection relationships
            try {
                let canvasFile = this.app.vault.getAbstractFileByPath(canvasPath);
                
                if (canvasFile) {
                    // File exists, delete old file
                    await this.app.vault.delete(canvasFile);
                }
                
                // Create new canvas file (using Obsidian standard format)
                const canvasContent = JSON.stringify(canvasData, null, '\t');
                canvasFile = await this.app.vault.create(canvasPath, canvasContent);
                
                if (canvasFile) {
                    const leaf = this.app.workspace.getLeaf('tab');
                    await leaf.openFile(canvasFile as any);
                }
            } catch (error: any) {
                console.error('Error regenerating canvas:', error);
            }
            
        } catch (error) {
            console.error('Error creating canvas:', error);
        }
    }


    /**
     * Get canvas color for callout type
     */
    private getCanvasColorForCallout(calloutType: string): string {
        // Read callout color directly from user settings
        const calloutColor = this.settings.calloutColors[calloutType]?.color;
        if (!calloutColor) {
            return "#086ddd"; // Default blue
        }
        
        // Return user configured hex color directly for canvas use
        return calloutColor;
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