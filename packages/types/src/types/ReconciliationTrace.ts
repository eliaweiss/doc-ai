
/**
 * Trace Mode types
 */

import { ReconciliationPairRef } from "./Reconciliation";

export interface TraceRequest {
    startSchemaTypes?: string[]; // Optional: filter starting entities by doc type (e.g., ["REMITTANCE"])
    startEntityIds?: string[]; // Optional: filter starting entities by entity id (e.g., ["{docId}_{collectionKey}_{index}"])
    endEntityIds?: string[]; // Optional: filter/highlight paths ending at these entity IDs
    dateFrom?: string; // Optional: ISO date - filter starting entities from this date
    dateTo?: string; // Optional: ISO date - filter starting entities to this date
    maxDepth?: number; // Default: 10
    limit?: number; // Default: 50
}

export interface MoneyFlowLink extends ReconciliationPairRef {
    id: string;
    depth: number;
    edgeType?: string | null;
    path: string[];
}

export interface MoneyFlowChain {
    startEntityId: string;
    links: MoneyFlowLink[];
    endsAtTarget: boolean;
    totalDepth: number;
}

export interface TraceResponse {
    chains: MoneyFlowChain[];
    summary: {
        totalPaths: number;
        matchingPaths: number; // Paths reaching endEntityIds
        maxDepthReached: number;
        truncated: boolean; // True if limit was hit
    };
}

