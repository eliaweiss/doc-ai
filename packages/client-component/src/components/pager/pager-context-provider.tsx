"use client";

import {
  createContext,
  useContext,
  ReactNode,
  useState,
  useCallback,
} from "react";

export enum SortOrder {
  ASC = "asc",
  DESC = "desc",
}

export interface PagerState {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  sortOrder: SortOrder;
  sortBy: string;
}

export interface PagerContextType extends PagerState {
  setPage: (page: number) => void;
  setPageSize: (pageSize: number) => void;
  setTotalItems: (total: number) => void;
  nextPage: () => void;
  previousPage: () => void;
  firstPage: () => void;
  lastPage: () => void;
  getSqlPaginationParams: () => { limit: number; offset: number };
  reset: () => void;
  updateData: (data: Partial<PagerState>) => void;
  setSortOrder: (value: SortOrder) => void;
}

const initialState: PagerState = {
  page: 1,
  pageSize: 10,
  totalItems: 0,
  totalPages: 0,
  hasNextPage: false,
  hasPreviousPage: false,
  sortOrder: SortOrder.DESC,
  sortBy: "createdAt",
};

const PagerContext = createContext<PagerContextType | undefined>(undefined);

export interface PagerProviderProps {
  children: ReactNode;
  initialPage?: number;
  initialPageSize?: number;
}

export function PagerProvider({
  children,
  initialPage = 1,
  initialPageSize = 10,
}: PagerProviderProps) {
  const [state, setState] = useState<PagerState>({
    ...initialState,
    page: initialPage,
    pageSize: initialPageSize,
  });

  const updateData = ({
    page,
    pageSize,
    totalItems,
    totalPages,
  }: Partial<PagerState>) => {
    const newState = { ...state };
    if (page) {
      newState.page = page;
    }
    if (pageSize) {
      newState.pageSize = pageSize;
    }
    if (totalItems) {
      newState.totalItems = totalItems;
    }
    if (totalPages) {
      newState.totalPages = totalPages;
    }
    setState(() => calculateDerivedState(newState));
  };

  const calculateDerivedState = useCallback(
    (newState: Partial<PagerState>) => {
      const updatedState = { ...state, ...newState };
      const totalPages = Math.max(
        1,
        Math.ceil(updatedState.totalItems / updatedState.pageSize)
      );

      return {
        ...updatedState,
        totalPages,
        hasNextPage: updatedState.page < totalPages,
        hasPreviousPage: updatedState.page > 1,
      };
    },
    [state]
  );

  const setPage = useCallback(
    (page: number) => {
      const newPage = Math.max(1, page);
      setState((prevState) =>
        calculateDerivedState({ ...prevState, page: newPage })
      );
    },
    [calculateDerivedState]
  );

  const setPageSize = useCallback(
    (pageSize: number) => {
      const newPageSize = Math.max(1, pageSize);
      setState((prevState) => {
        const newState = calculateDerivedState({
          ...prevState,
          pageSize: newPageSize,
        });
        // Adjust current page if needed after page size change
        const adjustedPage = Math.min(newState.page, newState.totalPages);
        return { ...newState, page: adjustedPage };
      });
    },
    [calculateDerivedState]
  );

  const setTotalItems = useCallback(
    (total: number) => {
      setState((prevState) => {
        const newState = calculateDerivedState({
          ...prevState,
          totalItems: total,
        });
        // Adjust current page if needed after total count change
        const adjustedPage = Math.min(newState.page, newState.totalPages);
        return { ...newState, page: adjustedPage };
      });
    },
    [calculateDerivedState]
  );

  const nextPage = useCallback(() => {
    if (state.hasNextPage) {
      setPage(state.page + 1);
    }
  }, [state.hasNextPage, state.page, setPage]);

  const previousPage = useCallback(() => {
    if (state.hasPreviousPage) {
      setPage(state.page - 1);
    }
  }, [state.hasPreviousPage, state.page, setPage]);

  const firstPage = useCallback(() => {
    setPage(1);
  }, [setPage]);

  const lastPage = useCallback(() => {
    setPage(state.totalPages);
  }, [state.totalPages, setPage]);

  const getSqlPaginationParams = useCallback(() => {
    const limit = state.pageSize;
    const offset = (state.page - 1) * state.pageSize;
    return { limit, offset };
  }, [state.page, state.pageSize]);

  const reset = useCallback(() => {
    setState({
      ...initialState,
      page: initialPage,
      pageSize: initialPageSize,
    });
  }, [initialPage, initialPageSize]);

  const setSortOrder = (value: SortOrder) => {
    setState((prevState) => ({
      ...prevState,
      sortOrder: value,
    }));
  };

  const value: PagerContextType = {
    ...state,
    setPage,
    setPageSize,
    setTotalItems,
    nextPage,
    previousPage,
    firstPage,
    lastPage,
    getSqlPaginationParams,
    reset,
    updateData,
    setSortOrder,
  };

  return (
    <PagerContext.Provider value={value}>{children}</PagerContext.Provider>
  );
}

export function usePager(): PagerContextType {
  const context = useContext(PagerContext);
  if (context === undefined) {
    throw new Error("usePager must be used within a PagerProvider");
  }
  return context;
}
