import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'planning_filters';

interface PlanningFilters {
  methodFilter: string;
  statusFilter: string;
  leagueFilter: string;
  searchQuery: string;
  historyPeriod: string;
  showHistory: boolean;
}

const defaultFilters: PlanningFilters = {
  methodFilter: 'all',
  statusFilter: 'all',
  leagueFilter: 'all',
  searchQuery: '',
  historyPeriod: 'last7',
  showHistory: false,
};

export function usePlanningFilters() {
  const [filters, setFilters] = useState<PlanningFilters>(defaultFilters);

const VALID_STATUS_FILTERS = ['all', 'pending', 'live', 'finished'];

  // Load filters from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Validate statusFilter - reset if invalid (fixes ghost 'configured' filter)
        if (parsed.statusFilter && !VALID_STATUS_FILTERS.includes(parsed.statusFilter)) {
          parsed.statusFilter = 'all';
        }
        setFilters({ ...defaultFilters, ...parsed });
      }
    } catch (e) {
      console.error('Error loading planning filters:', e);
    }
  }, []);

  // Save filters to localStorage whenever they change
  const saveFilters = useCallback((newFilters: Partial<PlanningFilters>) => {
    setFilters(prev => {
      const updated = { ...prev, ...newFilters };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch (e) {
        console.error('Error saving planning filters:', e);
      }
      return updated;
    });
  }, []);

  const setMethodFilter = useCallback((value: string) => {
    saveFilters({ methodFilter: value });
  }, [saveFilters]);

  const setStatusFilter = useCallback((value: string) => {
    saveFilters({ statusFilter: value });
  }, [saveFilters]);

  const setLeagueFilter = useCallback((value: string) => {
    saveFilters({ leagueFilter: value });
  }, [saveFilters]);

  const setSearchQuery = useCallback((value: string) => {
    saveFilters({ searchQuery: value });
  }, [saveFilters]);

  const setHistoryPeriod = useCallback((value: string) => {
    saveFilters({ historyPeriod: value });
  }, [saveFilters]);

  const setShowHistory = useCallback((value: boolean) => {
    saveFilters({ showHistory: value });
  }, [saveFilters]);

  const clearFilters = useCallback(() => {
    saveFilters({
      methodFilter: 'all',
      statusFilter: 'all',
      leagueFilter: 'all',
      searchQuery: '',
    });
  }, [saveFilters]);

  return {
    ...filters,
    setMethodFilter,
    setStatusFilter,
    setLeagueFilter,
    setSearchQuery,
    setHistoryPeriod,
    setShowHistory,
    clearFilters,
  };
}
