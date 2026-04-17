import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Header } from './components/Header';
import { FilterBar } from './components/FilterBar';
import { Feed } from './components/Feed';
import { ContextSettingsModal } from './components/ContextSettingsModal';
import { LogsDrawer } from './components/LogsModal';
import { FederationStatsModal } from './components/FederationStatsModal';
import { useSSE } from './hooks/useSSE';
import { useSettings } from './hooks/useSettings';
import { useStats } from './hooks/useStats';
import { usePagination } from './hooks/usePagination';
import { useTheme } from './hooks/useTheme';
import { Observation, Summary, UserPrompt } from './types';
import { mergeAndDeduplicateByProject } from './utils/data';

export function App() {
  const [currentFilter, setCurrentFilter] = useState('');
  const [contextPreviewOpen, setContextPreviewOpen] = useState(false);
  const [logsModalOpen, setLogsModalOpen] = useState(false);
  const [federationModalOpen, setFederationModalOpen] = useState(false);
  const [machineFilter, setMachineFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [paginatedObservations, setPaginatedObservations] = useState<Observation[]>([]);
  const [paginatedSummaries, setPaginatedSummaries] = useState<Summary[]>([]);
  const [paginatedPrompts, setPaginatedPrompts] = useState<UserPrompt[]>([]);

  const { observations, summaries, prompts, projects, isProcessing, queueDepth, isConnected } = useSSE();
  const { settings, saveSettings, isSaving, saveStatus } = useSettings();
  const { stats, refreshStats } = useStats();
  const { preference, resolvedTheme, setThemePreference } = useTheme();
  const pagination = usePagination(currentFilter, machineFilter);

  const federationMachines = stats?.federation?.machines || [];

  // Merge SSE live data with paginated data, filtering by project and search
  const allObservations = useMemo(() => {
    const live = currentFilter
      ? observations.filter(o => o.project === currentFilter)
      : observations;
    let merged = mergeAndDeduplicateByProject(live, paginatedObservations);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      merged = merged.filter(o =>
        (o.title && o.title.toLowerCase().includes(q)) ||
        (o.subtitle && o.subtitle.toLowerCase().includes(q))
      );
    }
    return merged;
  }, [observations, paginatedObservations, currentFilter, searchQuery]);

  const allSummaries = useMemo(() => {
    const live = currentFilter
      ? summaries.filter(s => s.project === currentFilter)
      : summaries;
    let merged = mergeAndDeduplicateByProject(live, paginatedSummaries);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      merged = merged.filter(s =>
        (s.investigated && s.investigated.toLowerCase().includes(q)) ||
        (s.learned && s.learned.toLowerCase().includes(q)) ||
        (s.completed && s.completed.toLowerCase().includes(q))
      );
    }
    return merged;
  }, [summaries, paginatedSummaries, currentFilter, searchQuery]);

  const allPrompts = useMemo(() => {
    const live = currentFilter
      ? prompts.filter(p => p.project === currentFilter)
      : prompts;
    return mergeAndDeduplicateByProject(live, paginatedPrompts);
  }, [prompts, paginatedPrompts, currentFilter]);

  // Toggle modals
  const toggleContextPreview = useCallback(() => {
    setContextPreviewOpen(prev => !prev);
  }, []);

  const toggleLogsModal = useCallback(() => {
    setLogsModalOpen(prev => !prev);
  }, []);

  const toggleFederationModal = useCallback(() => {
    setFederationModalOpen(prev => !prev);
  }, []);

  const handleFilterByProjectMachine = useCallback((project: string, machine: string) => {
    setCurrentFilter(project);
    setMachineFilter(machine);
    setFederationModalOpen(false);
  }, []);

  // Handle loading more data
  const handleLoadMore = useCallback(async () => {
    try {
      const [newObservations, newSummaries, newPrompts] = await Promise.all([
        pagination.observations.loadMore(),
        pagination.summaries.loadMore(),
        pagination.prompts.loadMore()
      ]);

      if (newObservations.length > 0) {
        setPaginatedObservations(prev => [...prev, ...newObservations]);
      }
      if (newSummaries.length > 0) {
        setPaginatedSummaries(prev => [...prev, ...newSummaries]);
      }
      if (newPrompts.length > 0) {
        setPaginatedPrompts(prev => [...prev, ...newPrompts]);
      }
    } catch (error) {
      console.error('Failed to load more data:', error);
    }
  }, [currentFilter, machineFilter, pagination.observations, pagination.summaries, pagination.prompts]);

  // Reset paginated data and load first page when filter changes
  useEffect(() => {
    setPaginatedObservations([]);
    setPaginatedSummaries([]);
    setPaginatedPrompts([]);
    handleLoadMore();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentFilter, machineFilter]);

  return (
    <>
      <Header
        isConnected={isConnected}
        isProcessing={isProcessing}
        queueDepth={queueDepth}
        themePreference={preference}
        onThemeChange={setThemePreference}
        onContextPreviewToggle={toggleContextPreview}
        federationMachineCount={federationMachines.length}
        onFederationClick={toggleFederationModal}
      />

      <FilterBar
        projects={projects}
        projectFilter={currentFilter}
        onProjectFilterChange={setCurrentFilter}
        machineFilter={machineFilter}
        onMachineFilterChange={setMachineFilter}
        searchQuery={searchQuery}
        onSearchQueryChange={setSearchQuery}
        machines={federationMachines}
      />

      <Feed
        observations={allObservations}
        summaries={allSummaries}
        prompts={allPrompts}
        onLoadMore={handleLoadMore}
        isLoading={pagination.observations.isLoading || pagination.summaries.isLoading || pagination.prompts.isLoading}
        hasMore={pagination.observations.hasMore || pagination.summaries.hasMore || pagination.prompts.hasMore}
      />

      <ContextSettingsModal
        isOpen={contextPreviewOpen}
        onClose={toggleContextPreview}
        settings={settings}
        onSave={saveSettings}
        isSaving={isSaving}
        saveStatus={saveStatus}
      />

      <button
        className="console-toggle-btn"
        onClick={toggleLogsModal}
        title="Toggle Console"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="4 17 10 11 4 5"></polyline>
          <line x1="12" y1="19" x2="20" y2="19"></line>
        </svg>
      </button>

      <LogsDrawer
        isOpen={logsModalOpen}
        onClose={toggleLogsModal}
      />

      <FederationStatsModal
        isOpen={federationModalOpen}
        onClose={toggleFederationModal}
        onFilterByProjectMachine={handleFilterByProjectMachine}
      />
    </>
  );
}
