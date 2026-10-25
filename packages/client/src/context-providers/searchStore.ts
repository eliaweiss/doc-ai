import { create } from "zustand";
import type {
  SearchableEntityOption,
  EntitySearchState,
  FieldDefinition,
  EntityResponseList,
} from "@zdocs/types";
import { fetchSearchableEntities } from "../utilities/api/fetchSearchableEntities";
import { searchByEntityApi } from "../utilities/api/searchByEntity";

const DEFAULT_LIMIT = 50;

interface SearchStore {
  // Available entities from the backend
  availableEntities: SearchableEntityOption[];
  entitiesLoading: boolean;
  entitiesError: string | null;

  // Selected entity keys in user-selected order
  selectedEntityKeys: string[];

  // Selected entities in user-selected order
  selectedEntities: SearchableEntityOption[];

  // Current search query
  query: string;

  // Date range filter
  dateFrom: Date | null;
  dateTo: Date | null;

  // Exact match mode - disables fuzzy/trigram matching
  exactMatch: boolean;

  // Per-entity search states (keyed by entity key)
  entityStates: Record<string, EntitySearchState>;

  // Entity schemas (keyed by entity key)
  entitySchemas: Record<string, FieldDefinition[]>;

  // Actions
  loadEntities: (orgId: string) => Promise<void>;
  setSelectedEntityKeys: (keys: string[]) => void;
  toggleEntitySelection: (key: string) => void;
  setQuery: (query: string) => void;
  setDateRange: (from: Date | null, to: Date | null) => void;
  setExactMatch: (exactMatch: boolean) => void;
  search: (orgId: string) => Promise<void>;
  fetchMore: (orgId: string, schemaType: string) => Promise<void>;
  clearResults: () => void;
}

const createInitialEntityState = (
  entity: SearchableEntityOption
): EntitySearchState => ({
  entity,
  results: [],
  total: 0,
  hasMore: false,
  loading: false,
  error: null,
  offset: 0,
});

/**
 * Get the default date range: first of month 3 months ago to today
 */
function getDefaultDateRange(): { from: Date; to: Date } {
  const now = new Date();
  const to = now;

  // Go back 3 months and set to first of month
  const from = new Date(now.getFullYear(), now.getMonth() - 3, 1);

  return { from, to };
}

const defaultDateRange = getDefaultDateRange();

export const useSearchStore = create<SearchStore>((set, get) => ({
  // Initial state
  availableEntities: [],
  entitiesLoading: false,
  entitiesError: null,
  selectedEntityKeys: [],
  selectedEntities: [],
  query: "",
  dateFrom: defaultDateRange.from,
  dateTo: defaultDateRange.to,
  exactMatch: false,
  entityStates: {},
  entitySchemas: {},

  // Load available entities for the org
  loadEntities: async (orgId: string) => {
    set({ entitiesLoading: true, entitiesError: null });
    try {
      const entities = await fetchSearchableEntities(orgId);
      set({
        availableEntities: entities,
        entitiesLoading: false,
      });
    } catch (error) {
      set({
        entitiesError:
          error instanceof Error ? error.message : "Failed to load entities",
        entitiesLoading: false,
      });
    }
  },

  // Set selected entity keys (replaces current selection)
  setSelectedEntityKeys: (keys: string[]) => {
    set({ selectedEntityKeys: keys });
  },
  setSelectedEntities: (entities: SearchableEntityOption[]) => {
    set({ selectedEntities: entities });
  },

  // Toggle a single entity selection (maintains order)
  toggleEntitySelection: (key: string) => {
    const current = get().selectedEntityKeys;
    if (current.includes(key)) {
      set({ selectedEntityKeys: current.filter((k) => k !== key) });
    } else {
      set({ selectedEntityKeys: [...current, key] });
    }
  },

  // Set the search query
  setQuery: (query: string) => {
    set({ query });
  },

  // Set the date range filter
  setDateRange: (from: Date | null, to: Date | null) => {
    set({ dateFrom: from, dateTo: to });
  },

  // Set exact match mode
  setExactMatch: (exactMatch: boolean) => {
    set({ exactMatch });
  },

  // Execute parallel searches for all selected entities
  search: async (orgId: string) => {
    const { selectedEntityKeys, query, dateFrom, dateTo, exactMatch } = get();

    // NOTE: empty search are allowed
    if (selectedEntityKeys.length === 0) {
      return;
    }

    // Initialize loading states for all selected entities
    const initialStates: Record<string, EntitySearchState> = {};
    for (const schemaType of selectedEntityKeys) {
      const entity = get().availableEntities.find(
        (e) => e.schemaType === schemaType
      );
      if (!entity) continue;
      initialStates[schemaType] = {
        ...createInitialEntityState(entity),
        loading: true,
      };
    }
    set({ entityStates: initialStates });

    // Execute searches in parallel
    const searchPromises = selectedEntityKeys.map(async (schemaType) => {
      const entity = get().availableEntities.find(
        (e) => e.schemaType === schemaType
      );
      if (!entity) {
        throw new Error(`Entity ${schemaType} not found`);
      }
      try {
        const response: EntityResponseList = await searchByEntityApi(orgId, {
          query,
          entity,
          limit: DEFAULT_LIMIT,
          offset: 0,
          dateFrom: dateFrom ? dateFrom.toISOString().split("T")[0] : undefined,
          dateTo: dateTo ? dateTo.toISOString().split("T")[0] : undefined,
          exactMatch,
        });

        return { entity, response, error: null };
      } catch (error) {
        return {
          entity,
          response: null,
          error: error instanceof Error ? error.message : "Search failed",
        };
      }
    });

    // Process results as they come in
    const results = await Promise.all(searchPromises);

    const newEntityStates: Record<string, EntitySearchState> = {};
    const newEntitySchemas: Record<string, FieldDefinition[]> = {};

    for (const { entity, response, error } of results) {
      const schemaType = entity.schemaType;
      if (error || !response) {
        newEntityStates[schemaType] = {
          entity,
          results: [],
          total: 0,
          hasMore: false,
          loading: false,
          error: error || "Unknown error",
          offset: 0,
        };
      } else {
        newEntityStates[schemaType] = {
          entity,
          results: response.results,
          total: response.total,
          hasMore: response.hasMore,
          loading: false,
          error: null,
          offset: response.results.length,
        };
        // Schema is in entity.schema
        newEntitySchemas[schemaType] = entity?.schema || [];
      }
    }

    set({
      entityStates: newEntityStates,
      entitySchemas: { ...get().entitySchemas, ...newEntitySchemas },
    });
  },

  // Fetch more results for a specific entity
  fetchMore: async (orgId: string, schemaType: string) => {
    const { query, entityStates, entitySchemas, dateFrom, dateTo, exactMatch } =
      get();
    const currentState = entityStates[schemaType];

    if (!currentState || !currentState.hasMore || currentState.loading) {
      return;
    }

    // Set loading state
    set({
      entityStates: {
        ...entityStates,
        [schemaType]: { ...currentState, loading: true },
      },
    });
    const entity = get().availableEntities.find(
      (e) => e.schemaType === schemaType
    );
    if (!entity) {
      throw new Error(`Entity ${schemaType} not found`);
    }
    try {
      const response = await searchByEntityApi(orgId, {
        query,
        entity,
        limit: DEFAULT_LIMIT,
        offset: currentState.offset,
        dateFrom: dateFrom ? dateFrom.toISOString().split("T")[0] : undefined,
        dateTo: dateTo ? dateTo.toISOString().split("T")[0] : undefined,
        exactMatch,
      });

      set({
        entityStates: {
          ...get().entityStates,
          [schemaType]: {
            entity: entity,
            results: [...currentState.results, ...response.results],
            total: response.total,
            hasMore: response.hasMore,
            loading: false,
            error: null,
            offset: currentState.offset + response.results.length,
          },
        },
        entitySchemas: {
          ...entitySchemas,
          // Schema is in entity.schema (from API route)
          [schemaType]: entity.schema,
        },
      });
    } catch (error) {
      set({
        entityStates: {
          ...get().entityStates,
          [schemaType]: {
            ...currentState,
            loading: false,
            error:
              error instanceof Error ? error.message : "Failed to fetch more",
          },
        },
      });
    }
  },

  // Clear all results
  clearResults: () => {
    set({
      entityStates: {},
      entitySchemas: {},
    });
  },
}));
