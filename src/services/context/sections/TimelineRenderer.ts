/**
 * TimelineRenderer - Renders the chronological timeline of observations and summaries
 *
 * Handles day grouping, file grouping within days, and table rendering.
 */

import type {
  ContextConfig,
  Observation,
  TimelineItem,
  SummaryTimelineItem,
} from '../types.js';
import { colors } from '../types.js';
import { formatTime, formatDate, formatDateTime, extractFirstFile, parseJsonArray, formatCompactDate, formatTime24 } from '../../../shared/timeline-formatting.js';
import * as Markdown from '../formatters/MarkdownFormatter.js';
import * as Color from '../formatters/ColorFormatter.js';

/**
 * Group timeline items by day
 */
export function groupTimelineByDay(timeline: TimelineItem[]): Map<string, TimelineItem[]> {
  const itemsByDay = new Map<string, TimelineItem[]>();

  for (const item of timeline) {
    const itemDate = item.type === 'observation' ? item.data.created_at : item.data.displayTime;
    const day = formatDate(itemDate);
    if (!itemsByDay.has(day)) {
      itemsByDay.set(day, []);
    }
    itemsByDay.get(day)!.push(item);
  }

  // Sort days chronologically
  const sortedEntries = Array.from(itemsByDay.entries()).sort((a, b) => {
    const aDate = new Date(a[0]).getTime();
    const bDate = new Date(b[0]).getTime();
    return aDate - bDate;
  });

  return new Map(sortedEntries);
}

/**
 * Get detail field content for full observation display
 */
function getDetailField(obs: Observation, config: ContextConfig): string | null {
  if (config.fullObservationField === 'narrative') {
    return obs.narrative;
  }
  return obs.facts ? parseJsonArray(obs.facts).join('\n') : null;
}

/**
 * Render a single day's timeline items (markdown path only)
 */
export function renderDayTimeline(
  day: string,
  dayItems: TimelineItem[],
  fullObservationIds: Set<number>,
  config: ContextConfig,
  cwd: string
): string[] {
  const output: string[] = [];

  output.push(...Markdown.renderMarkdownDayHeader(day));

  let lastTime = '';
  let tableOpen = false;

  for (const item of dayItems) {
    if (item.type === 'summary') {
      const summary = item.data as SummaryTimelineItem;
      const formattedTime = formatDateTime(summary.displayTime);
      output.push(...Markdown.renderMarkdownSummaryItem(summary, formattedTime));
    } else {
      const obs = item.data as Observation;
      const time = formatTime(obs.created_at);
      const showTime = time !== lastTime;
      const timeDisplay = showTime ? time : '';
      lastTime = time;
      tableOpen = true;

      const shouldShowFull = fullObservationIds.has(obs.id);
      if (shouldShowFull) {
        const detailField = getDetailField(obs, config);
        output.push(...Markdown.renderMarkdownFullObservation(obs, timeDisplay, detailField, config));
      } else {
        output.push(Markdown.renderMarkdownTableRow(obs, timeDisplay, config));
      }
    }
  }

  if (tableOpen) {
    output.push('');
  }

  return output;
}

/**
 * Render compact color timeline with inline date markers
 */
function renderColorTimeline(
  timeline: TimelineItem[],
  fullObservationIds: Set<number>,
  config: ContextConfig,
  cwd: string
): string[] {
  const output: string[] = [];
  let lastDate = '';
  let lastTime24 = '';
  let isFirstItem = true;

  for (const item of timeline) {
    const itemDate = item.type === 'observation'
      ? (item.data as Observation).created_at
      : (item.data as SummaryTimelineItem).displayTime;

    const currentDate = formatCompactDate(itemDate);
    const dateChanged = currentDate !== lastDate;

    if (item.type === 'summary') {
      const summary = item.data as SummaryTimelineItem;
      const time24 = formatTime24(summary.displayTime);
      // Summary format: #S123  title  (3/12 13:17) or (13:22)
      const timeStr = dateChanged ? `${currentDate} ${time24}` : time24;
      output.push(...Color.renderColorSummaryItem(summary, timeStr));
      lastDate = currentDate;
      lastTime24 = time24;
    } else {
      const obs = item.data as Observation;
      const file = extractFirstFile(obs.files_modified, cwd, obs.files_read);
      const time24 = formatTime24(obs.created_at);
      const showTime = time24 !== lastTime24 || dateChanged;

      // Inline date marker: show date on its own line when day changes (after first day)
      let dateStr: string | undefined;
      if (dateChanged && !isFirstItem) {
        // Emit a standalone date line for day transitions
        output.push(`${colors.bright}${colors.cyan}${currentDate}${colors.reset}`);
      } else if (dateChanged && isFirstItem) {
        // First item: show date inline with time
        dateStr = currentDate;
      }

      const shouldShowFull = fullObservationIds.has(obs.id);
      if (shouldShowFull) {
        const detailField = getDetailField(obs, config);
        output.push(...Color.renderColorFullObservation(obs, time24, showTime, detailField, config, dateStr));
      } else {
        output.push(Color.renderColorTableRow(obs, time24, showTime, config, file, dateStr));
      }

      lastDate = currentDate;
      lastTime24 = time24;
    }
    isFirstItem = false;
  }

  return output;
}

/**
 * Render the complete timeline
 */
export function renderTimeline(
  timeline: TimelineItem[],
  fullObservationIds: Set<number>,
  config: ContextConfig,
  cwd: string,
  useColors: boolean
): string[] {
  if (useColors) {
    return renderColorTimeline(timeline, fullObservationIds, config, cwd);
  }

  // Markdown path: group by day with day headers (unchanged)
  const output: string[] = [];
  const itemsByDay = groupTimelineByDay(timeline);

  for (const [day, dayItems] of itemsByDay) {
    output.push(...renderDayTimeline(day, dayItems, fullObservationIds, config, cwd));
  }

  return output;
}
