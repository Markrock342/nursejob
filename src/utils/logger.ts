// ============================================
// LOGGER UTILITY - Production-Safe Logging
// ============================================
// ใช้แทน console.log โดยตรง
// จะ log เฉพาะใน development mode เท่านั้น

// ============================================
// Types
// ============================================
type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LoggerOptions {
  prefix?: string;
  showTimestamp?: boolean;
}

// ============================================
// Logger Class
// ============================================
class Logger {
  private prefix: string;
  private showTimestamp: boolean;

  constructor(options: LoggerOptions = {}) {
    this.prefix = options.prefix || '';
    this.showTimestamp = options.showTimestamp || false;
  }

  private formatMessage(level: LogLevel, message: string): string {
    const parts: string[] = [];
    
    if (this.showTimestamp) {
      parts.push(`[${new Date().toISOString()}]`);
    }
    
    parts.push(`[${level.toUpperCase()}]`);
    
    if (this.prefix) {
      parts.push(`[${this.prefix}]`);
    }
    
    parts.push(message);
    
    return parts.join(' ');
  }

  /**
   * Debug log - only in __DEV__
   */
  debug(message: string, ...args: any[]): void {
    if (__DEV__) {
      console.log(this.formatMessage('debug', message), ...args);
    }
  }

  /**
   * Info log - only in __DEV__
   */
  info(message: string, ...args: any[]): void {
    if (__DEV__) {
      console.log(this.formatMessage('info', message), ...args);
    }
  }

  /**
   * Warning log - only in __DEV__
   */
  warn(message: string, ...args: any[]): void {
    if (__DEV__) {
      console.warn(this.formatMessage('warn', message), ...args);
    }
  }

  /**
   * Error log - always logs (for crash reporting)
   * In production, keep minimal console error log
   */
  error(message: string, error?: any): void {
    const formattedMessage = this.formatMessage('error', message);

    if (__DEV__) {
      console.error(formattedMessage, error);
    } else {
      console.error(formattedMessage, error);
    }
  }

  /**
   * Log with emoji prefix (dev only)
   */
  emoji(emoji: string, message: string, ...args: any[]): void {
    if (__DEV__) {
      console.log(`${emoji} ${message}`, ...args);
    }
  }

  /**
   * Group logs together (dev only)
   */
  group(label: string, fn: () => void): void {
    if (__DEV__) {
      console.group(label);
      fn();
      console.groupEnd();
    }
  }
}

// ============================================
// Pre-configured Loggers
// ============================================

// General app logger
export const logger = new Logger({ prefix: 'NurseGo' });

// Service-specific loggers
export const authLogger = new Logger({ prefix: 'Auth' });
export const chatLogger = new Logger({ prefix: 'Chat' });
export const jobLogger = new Logger({ prefix: 'Job' });

// ============================================
// Quick Functions (shorthand)
// ============================================

/**
 * Dev-only log
 */
export function devLog(message: string, ...args: any[]): void {
  if (__DEV__) {
    console.log(message, ...args);
  }
}

/**
 * Dev-only warn
 */
export function devWarn(message: string, ...args: any[]): void {
  if (__DEV__) {
    console.warn(message, ...args);
  }
}

/**
 * Always logs errors (production-safe)
 */
export function logError(message: string, error?: any): void {
  if (__DEV__) {
    console.error(message, error);
  } else {
    // Production: minimal log, consider sending to crash reporting
    console.error(`[ERROR] ${message}`);
  }
}

// ============================================
// Export Default
// ============================================
export default logger;
