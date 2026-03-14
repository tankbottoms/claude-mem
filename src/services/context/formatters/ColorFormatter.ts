/**
 * ColorFormatter - Formats context output with ANSI colors for terminal
 *
 * Handles all colored formatting for context injection (terminal display).
 */

import type {
  ContextConfig,
  Observation,
  TokenEconomics,
  PriorMessages,
} from '../types.js';
import { colors } from '../types.js';
import { ModeManager } from '../../domain/ModeManager.js';
import { formatObservationTokenDisplay } from '../TokenCalculator.js';
import { formatCompactDate, formatTime24 } from '../../../shared/timeline-formatting.js';

/**
 * Format current date/time for header display
 */
function formatHeaderDateTime(): string {
  const now = new Date();
  const date = now.toLocaleDateString('en-CA'); // YYYY-MM-DD format
  const time = now.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  }).toLowerCase().replace(' ', '');
  const tz = now.toLocaleTimeString('en-US', { timeZoneName: 'short' }).split(' ').pop();
  return `${date} ${time} ${tz}`;
}

/**
 * Render colored header
 */
export function renderColorHeader(project: string): string[] {
  return [
    '',
    `${colors.bright}${colors.cyan}[${project}] recent context, ${formatHeaderDateTime()}${colors.reset}`,
    `${colors.gray}${'─'.repeat(60)}${colors.reset}`,
    ''
  ];
}

/**
 * Render colored legend
 */
export function renderColorLegend(): string[] {
  const mode = ModeManager.getInstance().getActiveMode();
  const typeLegendItems = mode.observation_types.map(t => `${t.emoji} ${t.id}`).join(' | ');

  return [
    `${colors.dim}Legend: session-request | ${typeLegendItems}${colors.reset}`,
    ''
  ];
}

/**
 * Render colored column key
 */
export function renderColorColumnKey(): string[] {
  return [
    `${colors.bright}Column Key${colors.reset}`,
    `${colors.dim}  Read: Tokens to read this observation (cost to learn it now)${colors.reset}`,
    `${colors.dim}  Work: Tokens spent on work that produced this record ( research, building, deciding)${colors.reset}`,
    ''
  ];
}

/**
 * Render colored context index instructions
 */
export function renderColorContextIndex(): string[] {
  return [
    `${colors.dim}Context Index: This semantic index (titles, types, files, tokens) is usually sufficient to understand past work.${colors.reset}`,
    '',
    `${colors.dim}When you need implementation details, rationale, or debugging context:${colors.reset}`,
    `${colors.dim}  - Fetch by ID: get_observations([IDs]) for observations visible in this index${colors.reset}`,
    `${colors.dim}  - Search history: Use the mem-search skill for past decisions, bugs, and deeper research${colors.reset}`,
    `${colors.dim}  - Trust this index over re-reading code for past decisions and learnings${colors.reset}`,
    ''
  ];
}

/**
 * Render colored context economics
 */
export function renderColorContextEconomics(
  economics: TokenEconomics,
  config: ContextConfig
): string[] {
  const output: string[] = [];

  output.push(`${colors.bright}${colors.cyan}Context Economics${colors.reset}`);
  output.push(`${colors.dim}  Loading: ${economics.totalObservations} observations (${economics.totalReadTokens.toLocaleString()} tokens to read)${colors.reset}`);
  output.push(`${colors.dim}  Work investment: ${economics.totalDiscoveryTokens.toLocaleString()} tokens spent on research, building, and decisions${colors.reset}`);

  if (economics.totalDiscoveryTokens > 0 && (config.showSavingsAmount || config.showSavingsPercent)) {
    let savingsLine = '  Your savings: ';
    if (config.showSavingsAmount && config.showSavingsPercent) {
      savingsLine += `${economics.savings.toLocaleString()} tokens (${economics.savingsPercent}% reduction from reuse)`;
    } else if (config.showSavingsAmount) {
      savingsLine += `${economics.savings.toLocaleString()} tokens`;
    } else {
      savingsLine += `${economics.savingsPercent}% reduction from reuse`;
    }
    output.push(`${colors.green}${savingsLine}${colors.reset}`);
  }
  output.push('');

  return output;
}

/**
 * Render colored day header
 */
export function renderColorDayHeader(day: string): string[] {
  return [
    `${colors.bright}${colors.cyan}${day}${colors.reset}`
  ];
}

/**
 * Render colored file header
 */
export function renderColorFileHeader(file: string): string[] {
  return [
    `${colors.dim}${file}${colors.reset}`
  ];
}

/**
 * Render colored table row for observation (compact format)
 * Layout: #ID  [glyph type]  title  file  (time)
 * dateStr is shown only when the day changes (passed by TimelineRenderer)
 */
export function renderColorTableRow(
  obs: Observation,
  time: string,
  showTime: boolean,
  config: ContextConfig,
  file?: string,
  dateStr?: string
): string {
  const title = obs.title || 'Untitled';
  const icon = ModeManager.getInstance().getTypeIcon(obs.type);
  const typeId = obs.type || '';

  const idPad = `#${obs.id}`.padEnd(6);
  const typePart = typeId ? `${icon} ${typeId}` : '';
  const filePart = file && file !== 'General' ? `  ${colors.dim}${file.split('/').pop()}${colors.reset}` : '';
  const datePart = dateStr ? `${dateStr} ` : '';
  const timeSuffix = showTime ? `  ${colors.dim}(${datePart}${time})${colors.reset}` : '';

  return `  ${colors.dim}${idPad}${colors.reset}  ${typePart ? `${typePart}  ` : ''}${title}${filePart}${timeSuffix}`;
}

/**
 * Render colored full observation (compact format)
 * Layout: #ID  [glyph type]  title  (time)
 */
export function renderColorFullObservation(
  obs: Observation,
  time: string,
  showTime: boolean,
  detailField: string | null,
  config: ContextConfig,
  dateStr?: string
): string[] {
  const output: string[] = [];
  const title = obs.title || 'Untitled';
  const icon = ModeManager.getInstance().getTypeIcon(obs.type);
  const typeId = obs.type || '';

  const idPad = `#${obs.id}`.padEnd(6);
  const typePart = typeId ? `${icon} ${typeId}` : '';
  const datePart = dateStr ? `${dateStr} ` : '';
  const timeSuffix = showTime ? `  ${colors.dim}(${datePart}${time})${colors.reset}` : '';

  output.push(`  ${colors.dim}${idPad}${colors.reset}  ${typePart ? `${typePart}  ` : ''}${colors.bright}${title}${colors.reset}${timeSuffix}`);
  if (detailField) {
    output.push(`    ${colors.dim}${detailField}${colors.reset}`);
  }
  output.push('');

  return output;
}

/**
 * Render colored summary item in timeline (compact format)
 * formattedTime should be compact like "3/12 13:17" or "13:22"
 */
export function renderColorSummaryItem(
  summary: { id: number; request: string | null },
  formattedTime: string
): string[] {
  return [
    `${colors.yellow}#S${summary.id}${colors.reset}  ${summary.request || 'Session started'}  ${colors.dim}(${formattedTime})${colors.reset}`
  ];
}

/**
 * Render colored summary field
 */
export function renderColorSummaryField(label: string, value: string | null, color: string): string[] {
  if (!value) return [];
  return [`${color}${label}:${colors.reset} ${value}`, ''];
}

/**
 * Render colored previously section
 */
export function renderColorPreviouslySection(priorMessages: PriorMessages): string[] {
  if (!priorMessages.assistantMessage) return [];

  return [
    '',
    '---',
    '',
    `${colors.bright}${colors.magenta}Previously${colors.reset}`,
    '',
    `${colors.dim}A: ${priorMessages.assistantMessage}${colors.reset}`,
    ''
  ];
}

/**
 * Render colored footer
 */
export function renderColorFooter(totalDiscoveryTokens: number, totalReadTokens: number): string[] {
  const workTokensK = Math.round(totalDiscoveryTokens / 1000);
  return [
    '',
    `${colors.dim}Access ${workTokensK}k tokens of past research & decisions for just ${totalReadTokens.toLocaleString()}t.${colors.reset}`
  ];
}

/**
 * Render colored empty state
 */
export function renderColorEmptyState(project: string): string {
  return `\n${colors.bright}${colors.cyan}[${project}] recent context, ${formatHeaderDateTime()}${colors.reset}\n${colors.gray}${'─'.repeat(60)}${colors.reset}\n\n${colors.dim}No previous sessions found for this project yet.${colors.reset}\n`;
}
