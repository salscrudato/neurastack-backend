/**
 * NeuraStack Visual Logger
 * Innovative, human-readable console logging with visual blocks and clear status indicators
 */

// Enhanced color palette for better visibility
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  
  // Status colors
  success: '\x1b[32m',    // Green
  error: '\x1b[31m',      // Red
  warning: '\x1b[33m',    // Yellow
  info: '\x1b[36m',       // Cyan
  debug: '\x1b[35m',      // Magenta
  
  // Accent colors
  blue: '\x1b[34m',
  purple: '\x1b[95m',
  orange: '\x1b[38;5;208m',
  pink: '\x1b[38;5;205m',
  
  // Background colors
  bgSuccess: '\x1b[42m',
  bgError: '\x1b[41m',
  bgWarning: '\x1b[43m',
  bgInfo: '\x1b[46m'
};

// Visual icons for different log types
const icons = {
  success: '✅',
  error: '❌',
  warning: '⚠️',
  info: 'ℹ️',
  debug: '🔍',
  firebase: '🔥',
  database: '🗄️',
  api: '🌐',
  memory: '🧠',
  workout: '💪',
  user: '👤',
  system: '⚙️',
  security: '🔒',
  performance: '⚡',
  startup: '🚀',
  shutdown: '🔄',
  health: '❤️',
  cache: '💾',
  ai: '🤖',
  ensemble: '🎭',
  analytics: '📊',
  timer: '⏱️',
  rocket: '🚀',
  party: '🎉',
  thinking: '🤔',
  lightning: '⚡',
  gear: '⚙️',
  shield: '🛡️'
};

class VisualLogger {
  constructor() {
    this.startTime = Date.now();
    this.logCount = 0;
    this.logFilePath = null;
    this.logFileStream = null;
    this.enabled = true;
    // Disable logs in production unless explicitly enabled
    if (typeof process !== "undefined" && process.env && process.env.NODE_ENV === "production" && !process.env.VISUAL_LOGGER_ENABLE) {
      this.enabled = false;
    }
    this.defaultWidth = 60;
  }

  setLogFile(path) {
    const fs = require('fs');
    if (this.logFileStream) {
      this.logFileStream.end();
      this.logFileStream = null;
    }
    this.logFilePath = path;
    this.logFileStream = fs.createWriteStream(path, { flags: 'a' });
  }

  _print(message, color = null) {
    if (!this.enabled) return;
    let str = message;
    if (color && colors[color]) {
      str = colors[color] + message + colors.reset;
    }
    if (this.logFileStream) {
      // Strip ansi color codes for file output
      const stripAnsi = s => s.replace(/\x1b\[[0-9;]*m/g, '');
      this.logFileStream.write(stripAnsi(str) + '\n');
    }
    // Always print to console if enabled
    console.log(str);
  }

  _getColor(level) {
    return colors[level] || colors.info;
  }
  _getIcon(level) {
    return icons[level] || '';
  }

  _wrapLine(line, width) {
    // Simple word wrap
    const lines = [];
    let current = '';
    for (const word of line.split(' ')) {
      if ((current + word).length > width - 2) {
        if (current.length > 0) lines.push(current.trim());
        current = word + ' ';
      } else {
        current += word + ' ';
      }
    }
    if (current.trim().length > 0) lines.push(current.trim());
    return lines;
  }

  separator(char = '═', length = this.defaultWidth, color = 'info') {
    if (!this.enabled) return;
    this._print(colors[color] + char.repeat(length) + colors.reset);
  }

  header(title, subtitle = '', icon = 'system', width = this.defaultWidth) {
    if (!this.enabled) return;
    this.separator('═', width, 'info');
    let headerStr = colors.bright + colors.info +
      `${this._getIcon(icon)} ${title.toUpperCase()}` +
      (subtitle ? ` - ${subtitle}` : '') + colors.reset;
    this._print(headerStr);
    this.separator('═', width, 'info');
  }

  success(message, details = null, category = 'system', width = this.defaultWidth) {
    this._logBlock('success', message, details, category, width);
  }
  error(message, details = null, category = 'system', width = this.defaultWidth) {
    this._logBlock('error', message, details, category, width);
  }
  warning(message, details = null, category = 'system', width = this.defaultWidth) {
    this._logBlock('warning', message, details, category, width);
  }
  info(message, details = null, category = 'system', width = this.defaultWidth) {
    this._logBlock('info', message, details, category, width);
  }

  _logBlock(type, message, details = null, category = 'system', width = this.defaultWidth) {
    if (!this.enabled) return;
    this.logCount++;
    const timestamp = this.getTimestamp();
    const color = this._getColor(type);
    const bright = colors.bright;
    const reset = colors.reset;
    const icon = this._getIcon(type);
    const catIcon = this._getIcon(category);
    // Title line
    const blockTitle = type.toUpperCase();
    const titlePrefix = `\n┌─ ${icon} ${blockTitle} ${catIcon} `;
    // Calculate dashes so total line is width
    const dashes = '─'.repeat(Math.max(0, width - titlePrefix.length - 1));
    this._print(color + bright + titlePrefix + dashes + '┐' + reset);
    // Message lines (wrapped)
    const msgLines = this._wrapLine(message, width - 2);
    for (const line of msgLines) {
      const pad = ' '.repeat(Math.max(0, width - 2 - line.length));
      this._print(color + `│ ${line}${pad}│` + reset);
    }
    // Details
    if (details) {
      if (typeof details === 'object' && !Array.isArray(details)) {
        for (const [key, value] of Object.entries(details)) {
          const detailLine = `${key}: ${value}`;
          for (const l of this._wrapLine(detailLine, width - 2)) {
            const pad = ' '.repeat(Math.max(0, width - 2 - l.length));
            this._print(color + `│ ${l}${pad}│` + reset);
          }
        }
      } else {
        for (const l of this._wrapLine(String(details), width - 2)) {
          const pad = ' '.repeat(Math.max(0, width - 2 - l.length));
          this._print(color + `│ ${l}${pad}│` + reset);
        }
      }
    }
    // Footer
    const footer = `└─ ${timestamp} ` + '─'.repeat(Math.max(0, width - (`└─ ${timestamp} `.length) - 1)) + '┘';
    this._print(color + footer + reset + '\n');
  }

  /**
   * Simple inline log for less important messages
   */
  inline(level, message, icon = 'system') {
    if (!this.enabled) return;
    const timestamp = this.getTimestamp();
    const color = this._getColor(level);
    const statusIcon = this._getIcon(level);
    const catIcon = this._getIcon(icon);
    let msg = `${statusIcon} ${catIcon} ${message}` + colors.dim + ` (${timestamp})` + colors.reset;
    this._print(color + msg + colors.reset);
  }

  /**
   * Progress indicator
   */
  progress(message, step, total, category = 'system', width = this.defaultWidth) {
    if (!this.enabled) return;
    const percentage = Math.round((step / total) * 100);
    const progressBar = '█'.repeat(Math.floor(percentage / 5)) + '░'.repeat(20 - Math.floor(percentage / 5));
    const catIcon = this._getIcon(category);
    this._print(colors.info +
      `${catIcon} ${message} [${progressBar}] ${percentage}% (${step}/${total})` +
      colors.reset
    );
  }

  /**
   * Get formatted timestamp
   */
  getTimestamp() {
    const now = new Date();
    return now.toLocaleTimeString('en-US', { 
      hour12: false, 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit' 
    });
  }

  /**
   * Get uptime since logger creation
   */
  getUptime() {
    const uptime = Date.now() - this.startTime;
    const seconds = Math.floor(uptime / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  }

  /**
   * System status summary
   */
  systemStatus(status = 'healthy', details = {}, width = this.defaultWidth) {
    if (!this.enabled) return;
    const statusIcon = status === 'healthy' ? this._getIcon('success') :
      status === 'warning' ? this._getIcon('warning') : this._getIcon('error');
    const statusColor = status === 'healthy' ? colors.success :
      status === 'warning' ? colors.warning : colors.error;
    this.separator('═', width, status === 'healthy' ? 'success' : status);
    this._print(
      statusColor + colors.bright +
      `${statusIcon} SYSTEM STATUS: ${status.toUpperCase()} ${this._getIcon('system')}` +
      colors.reset
    );
    this._print(
      colors.dim + `Uptime: ${this.getUptime()} | Logs: ${this.logCount}` + colors.reset
    );
    if (Object.keys(details).length > 0) {
      for (const [key, value] of Object.entries(details)) {
        this._print(colors.dim + `${key}: ${value}` + colors.reset);
      }
    }
    this.separator('═', width, status === 'healthy' ? 'success' : status);
  }
}

// Create singleton instance
const logger = new VisualLogger();

module.exports = logger;
