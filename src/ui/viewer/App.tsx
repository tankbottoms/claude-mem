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
  const [machineFilter, setMachineFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [contextPreviewOpen, setContextPreviewOpen] = useState(false);
  const [logsModalOpen, setLogsModalOpen] = useState(false);
  const [federationStatsOpen, setFederationStatsOpen] = useState(false);
  const [paginatedObservations, setPaginatedObservations] = useState<Observation[]>([]);
  const [paginatedSummaries, setPaginatedSummaries] = useState<Summary[]>([]);
  const [paginatedPrompts, setPaginatedPrompts] = useState<UserPrompt[]>([]);

  const { observations, summaries, prompts, projects, localHostname, isProcessing, queueDepth, isConnected } = useSSE();
  const { settings, saveSettings, isSaving, saveStatus } = useSettings();
  const { stats, refreshStats } = useStats();
  const { preference, resolvedTheme, setThemePreference } = useTheme();
  const pagination = usePagination(currentFilter, machineFilter);

  // Handle machine filter toggle (clicking same machine clears filter)
  const handleMachineFilter = useCallback((machine: string) => {
    setMachineFilter(prev => prev === machine ? '' : machine);
  }, []);

  // Merge SSE live data with paginated data, filtering by project, machine, and search when active
  const searchLower = searchQuery.toLowerCase().trim();

  const allObservations = useMemo(() => {
    let live = currentFilter
      ? observations.filter(o => o.project === currentFilter)
      : observations;
    if (machineFilter === '__local__') {
      live = live.filter(o => !o.source_machine);
    } else if (machineFilter) {
      live = live.filter(o => o.source_machine === machineFilter);
    }
    let merged = mergeAndDeduplicateByProject(live, paginatedObservations);
    if (searchLower) {
      merged = merged.filter(o =>
        (o.title || '').toLowerCase().includes(searchLower) ||
        (o.subtitle || '').toLowerCase().includes(searchLower) ||
        (o.narrative || '').toLowerCase().includes(searchLower) ||
        (o.facts || '').toLowerCase().includes(searchLower)
      );
    }
    return merged;
  }, [observations, paginatedObservations, currentFilter, machineFilter, searchLower]);

  const allSummaries = useMemo(() => {
    const live = currentFilter
      ? summaries.filter(s => s.project === currentFilter)
      : summaries;
    return mergeAndDeduplicateByProject(live, paginatedSummaries);
  }, [summaries, paginatedSummaries, currentFilter]);

  const allPrompts = useMemo(() => {
    const live = currentFilter
      ? prompts.filter(p => p.project === currentFilter)
      : prompts;
    return mergeAndDeduplicateByProject(live, paginatedPrompts);
  }, [prompts, paginatedPrompts, currentFilter]);

  const toggleContextPreview = useCallback(() => {
    setContextPreviewOpen(prev => !prev);
  }, []);

  const toggleLogsModal = useCallback(() => {
    setLogsModalOpen(prev => !prev);
  }, []);

  const toggleFederationStats = useCallback(() => {
    setFederationStatsOpen(prev => !prev);
  }, []);

  // Get machine count and project-machine mappings from stats
  const machineCount = stats?.federation?.machines?.length;
  const projectMachines = stats?.federation?.projectMachines;
  const machines = stats?.federation?.machines;

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
  }, [currentFilter, pagination.observations, pagination.summaries, pagination.prompts]);

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
        onFederationStatsToggle={toggleFederationStats}
        machineCount={machineCount}
      />

      <FilterBar
        projects={projects}
        currentFilter={currentFilter}
        machineFilter={machineFilter}
        searchQuery={searchQuery}
        onProjectFilter={setCurrentFilter}
        onMachineFilter={setMachineFilter}
        onSearchChange={setSearchQuery}
        projectMachines={projectMachines}
        machines={machines}
        localHostname={localHostname}
      />

      <Feed
        observations={allObservations}
        summaries={allSummaries}
        prompts={allPrompts}
        onLoadMore={handleLoadMore}
        isLoading={pagination.observations.isLoading || pagination.summaries.isLoading || pagination.prompts.isLoading}
        hasMore={pagination.observations.hasMore || pagination.summaries.hasMore || pagination.prompts.hasMore}
        onMachineFilter={handleMachineFilter}
        localHostname={localHostname}
        projectMachines={projectMachines}
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

      <FederationStatsModal
        isOpen={federationStatsOpen}
        onClose={toggleFederationStats}
        onFilterByProjectMachine={(project: string, machine: string) => {
          setCurrentFilter(project);
          setMachineFilter(machine);
          setFederationStatsOpen(false);
        }}
      />

      <LogsDrawer
        isOpen={logsModalOpen}
        onClose={toggleLogsModal}
      />
    </>
  );
}
