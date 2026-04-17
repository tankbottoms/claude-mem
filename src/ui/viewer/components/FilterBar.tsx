import React, { useState, useEffect, useCallback, useRef } from 'react';
import { MachineStats } from '../types';
import { getMachineColor } from '../utils/machines';

interface FilterBarProps {
  projects: string[];
  projectFilter: string;
  onProjectFilterChange: (project: string) => void;
  machineFilter: string;
  onMachineFilterChange: (machine: string) => void;
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
  machines: MachineStats[];
}

const LS_KEY_MACHINE = 'claude-mem-filter-machine';

export function FilterBar({
  projects,
  projectFilter,
  onProjectFilterChange,
  machineFilter,
  onMachineFilterChange,
  searchQuery,
  onSearchQueryChange,
  machines,
}: FilterBarProps) {
  const [localSearch, setLocalSearch] = useState(searchQuery);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  // Restore persisted machine filter on mount
  useEffect(() => {
    const saved = localStorage.getItem(LS_KEY_MACHINE);
    if (saved && !machineFilter) {
      onMachineFilterChange(saved);
    }
  }, []);

  // Debounced search
  const handleSearchChange = useCallback((value: string) => {
    setLocalSearch(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      onSearchQueryChange(value);
    }, 300);
  }, [onSearchQueryChange]);

  const handleMachineClick = useCallback((machine: string) => {
    const next = machineFilter === machine ? '' : machine;
    onMachineFilterChange(next);
    if (next) {
      localStorage.setItem(LS_KEY_MACHINE, next);
    } else {
      localStorage.removeItem(LS_KEY_MACHINE);
    }
  }, [machineFilter, onMachineFilterChange]);

  return (
    <div className="filter-bar">
      <div className="filter-bar-inner">
        {/* Project pills */}
        <div className="filter-row">
          <span className="filter-label">Project</span>
          <div className="filter-pills">
            <span
              className={`filter-pill ${!projectFilter ? 'active' : ''}`}
              onClick={() => onProjectFilterChange('')}
            >
              All
            </span>
            {projects.map(p => (
              <span
                key={p}
                className={`filter-pill ${projectFilter === p ? 'active' : ''}`}
                onClick={() => onProjectFilterChange(p)}
              >
                {p}
              </span>
            ))}
          </div>
        </div>

        {/* Machine chips */}
        {machines.length > 0 && (
          <div className="filter-row">
            <span className="filter-label">Machine</span>
            <div className="filter-pills">
              {machines.map(m => {
                const color = getMachineColor(m.machine);
                const isActive = machineFilter === m.machine;
                return (
                  <span
                    key={m.machine}
                    className={`machine-chip ${isActive ? 'active' : ''}`}
                    style={{
                      background: color.bg,
                      color: color.text,
                      borderColor: color.border,
                    }}
                    onClick={() => handleMachineClick(m.machine)}
                    title={`${m.count.toLocaleString()} observations`}
                  >
                    <i className="fat fa-server" style={{ fontSize: '10px', marginRight: '4px' }}></i>
                    {m.machine}
                  </span>
                );
              })}
            </div>
          </div>
        )}

        {/* Search */}
        <div className="filter-row">
          <span className="filter-label">Search</span>
          <div className="filter-search-wrapper">
            <i className="fat fa-search search-icon"></i>
            <input
              type="text"
              className="filter-search-input"
              placeholder="Search observations..."
              value={localSearch}
              onChange={e => handleSearchChange(e.target.value)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
