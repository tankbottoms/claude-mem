import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Header } from './components/Header';
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

  // Merge SSE live data with paginated data, filtering by project and machine when active
  const allObservations = useMemo(() => {
    let live = currentFilter
      ? observations.filter(o => o.project === currentFilter)
      : observations;
    if (machineFilter === '__local__') {
      live = live.filter(o => !o.source_machine);
    } else if (machineFilter) {
      live = live.filter(o => o.source_machine === machineFilter);
    }
    return mergeAndDeduplicateByProject(live, paginatedObservations);
  }, [observations, paginatedObservations, currentFilter, machineFilter]);

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

  // Toggle context preview modal
  const toggleContextPreview = useCallback(() => {
    setContextPreviewOpen(prev => !prev);
  }, []);

  // Toggle logs modal
  const toggleLogsModal = useCallback(() => {
    setLogsModalOpen(prev => !prev);
  }, []);

  // Toggle federation stats modal
  const toggleFederationStats = useCallback(() => {
    setFederationStatsOpen(prev => !prev);
  }, []);

  // Get machine count from stats
  const machineCount = stats?.federation?.machines?.length;

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
        projects={projects}
        currentFilter={currentFilter}
        onFilterChange={setCurrentFilter}
        isProcessing={isProcessing}
        queueDepth={queueDepth}
        themePreference={preference}
        onThemeChange={setThemePreference}
        onContextPreviewToggle={toggleContextPreview}
        onFederationStatsToggle={toggleFederationStats}
        machineCount={machineCount}
      />

      {machineFilter && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '6px 16px',
          backgroundColor: 'var(--color-card-bg, #161b22)',
          borderBottom: '1px solid var(--color-border, #30363d)',
          fontSize: '0.8rem',
          color: 'var(--color-secondary, #8b949e)',
        }}>
          <span>Filtered by machine:</span>
          <span style={{
            padding: '2px 6px',
            borderRadius: '3px',
            background: 'var(--color-type-badge-bg)',
            color: 'var(--color-type-badge-text)',
            fontFamily: 'monospace',
          }}>
            {machineFilter === '__local__' ? (localHostname || 'local') : machineFilter}
          </span>
          <span
            onClick={() => setMachineFilter('')}
            style={{ cursor: 'pointer', color: '#f85149', fontWeight: 'bold' }}
            title="Clear machine filter"
          >
            x
          </span>
        </div>
      )}

      <Feed
        observations={allObservations}
        summaries={allSummaries}
        prompts={allPrompts}
        onLoadMore={handleLoadMore}
        isLoading={pagination.observations.isLoading || pagination.summaries.isLoading || pagination.prompts.isLoading}
        hasMore={pagination.observations.hasMore || pagination.summaries.hasMore || pagination.prompts.hasMore}
        onMachineFilter={handleMachineFilter}
        localHostname={localHostname}
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
      />

      <LogsDrawer
        isOpen={logsModalOpen}
        onClose={toggleLogsModal}
      />
    </>
  );
}
