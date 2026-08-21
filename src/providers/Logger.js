
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import util from "util";

const config = {
  logLevel: "debug",
  logRotationSizeMB: 5,
  defaultContext: "APP",
  timezone: "Asia/Kolkata",

  colors: {
    info: "#2A4A6A", // Deep muted blue
    success: "#2A4A3A", // Deep muted green
    warning: "#4A3A1A", // Deep muted amber
    error: "#4A2525", // Deep muted red
    debug: "#2A2A2A", // Subtle gray
  },
  textColors: {
    message: "#9E9E9E", // Soft gray
    timestamp: "#5A5A5A", // Dimmer gray
    dimmed: "#4A4A4A", // Very dim gray
    badge: "#B8B8B8", // Muted white
  },
};

const createRgbColor = (hex) => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (text) => `\x1b[38;2;${r};${g};${b}m${text}\x1b[0m`;
};

const createBgColor = (bgHex, fgHex) => {
  const bgR = parseInt(bgHex.slice(1, 3), 16);
  const bgG = parseInt(bgHex.slice(3, 5), 16);
  const bgB = parseInt(bgHex.slice(5, 7), 16);
  const fgR = parseInt(fgHex.slice(1, 3), 16);
  const fgG = parseInt(fgHex.slice(3, 5), 16);
  const fgB = parseInt(fgHex.slice(5, 7), 16);
  return (text) =>
    `\x1b[48;2;${bgR};${bgG};${bgB}m\x1b[38;2;${fgR};${fgG};${fgB}m ${text} \x1b[0m`;
};

const textStyle = {
  message: createRgbColor(config.textColors.message),
  timestamp: createRgbColor(config.textColors.timestamp),
  dimmed: createRgbColor(config.textColors.dimmed),
};

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOG_DIR = path.resolve(__dirname, "../../logs");

class Logger {
  constructor() {
    this.levels = { debug: 0, info: 1, success: 2, warn: 3, error: 4 };
    this.consoleLogLevel = this.levels[config.logLevel] ?? 1;

    this.contextBadges = {
      info: createBgColor(config.colors.info, config.textColors.badge),
      success: createBgColor(config.colors.success, config.textColors.badge),
      warn: createBgColor(config.colors.warning, config.textColors.badge),
      error: createBgColor(config.colors.error, config.textColors.badge),
      debug: createBgColor(config.colors.debug, config.textColors.badge),
    };

    this.logFilePath = "";
    this.errorLogFilePath = "";
    this._initLogFiles();
  }

  _getTimestamp() {
    return new Date().toLocaleString("en-IN", {
      timeZone: config.timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
  }

  _getTimeOnly() {
    return new Date().toLocaleTimeString("en-IN", {
      timeZone: config.timezone,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
  }

  _initLogFiles() {
    try {
      if (!fs.existsSync(LOG_DIR)) {
        fs.mkdirSync(LOG_DIR, { recursive: true });
      }
      this.logFilePath = path.join(LOG_DIR, "app.log");
      this.errorLogFilePath = path.join(LOG_DIR, "error.log");
      this._rotateLogFile(this.logFilePath);
      this._rotateLogFile(this.errorLogFilePath);
      const separator = "=".repeat(80);
      const startMessage = `\n${separator}\nLog session started at ${this._getTimestamp()} IST\n${separator}`;
      this._writeToFile(this.logFilePath, startMessage);
    } catch (error) {
      console.error("[Logger] Failed to initialize log files:", error);
    }
  }

  _rotateLogFile(filePath) {
    try {
      if (!fs.existsSync(filePath)) return;
      const stats = fs.statSync(filePath);
      const sizeMB = stats.size / (1024 * 1024);
      if (sizeMB > config.logRotationSizeMB) {
        const timestamp = this._getTimestamp().replace(/[/:,\s]/g, "-");
        const backupPath = `${filePath}.${timestamp}`;
        fs.renameSync(filePath, backupPath);
      }
    } catch (error) {
      console.error("[Logger] Failed to rotate log file:", error);
    }
  }

  _writeToFile(filePath, content) {
    try {
      fs.appendFileSync(filePath, `${content}\n`);
    } catch (error) {
      console.error("[Logger] Failed to write to log file:", error);
    }
  }

  _formatForFile(level, context, message) {
    const timestamp = this._getTimestamp();
    const levelUpper = level.toUpperCase();
    return `[${timestamp}] [${levelUpper}] [${context}] ${message}`;
  }

  _parseArgs(args) {
    let context = config.defaultContext;
    let errorObject = null;
    const argsCopy = [...args];

    if (argsCopy.length > 0 && argsCopy[argsCopy.length - 1] instanceof Error) {
      errorObject = argsCopy.pop();
    }

    if (argsCopy.length > 1 && typeof argsCopy[0] === "string") {
      const potentialContext = argsCopy[0];
      const isValidContext =
        potentialContext.length <= 20 &&
        /^[A-Z0-9_\-:]+$/i.test(potentialContext);
      if (isValidContext) {
        context = argsCopy.shift();
      }
    }

    const message = argsCopy.length > 0 ? util.format(...argsCopy) : "";

    return { context, message, errorObject };
  }

  _log(level, ...args) {
    const levelNum = this.levels[level];
    if (levelNum < this.consoleLogLevel) return;

    const { context, message, errorObject } = this._parseArgs(args);

    const timestamp = this._getTimeOnly();
    const contextBadge = this.contextBadges[level](context);
    const formattedMessage = `${textStyle.timestamp(timestamp)} ${contextBadge} ${textStyle.message(message)}`;

    const logMethod =
      level === "error" || level === "warn" ? console.warn : console.log;
    logMethod(formattedMessage);

    const fileMessage = this._formatForFile(level, context, message);
    this._writeToFile(this.logFilePath, fileMessage);

    const finalErrorObject =
      level === "error" && !errorObject ? new Error(message) : errorObject;

    if (finalErrorObject) {
      const errorStack =
        finalErrorObject.stack ||
        util.inspect(finalErrorObject, { depth: null });
      let errorText;

      if (Array.isArray(finalErrorObject.errors)) {
        errorText = finalErrorObject.errors
          .map((e) => e.text || util.inspect(e))
          .join("\n");
      } else {
        errorText =
          finalErrorObject.stack ||
          finalErrorObject.message ||
          util.inspect(finalErrorObject, { depth: null });
      }

      console.log(textStyle.dimmed(errorText));
      const errorFileMessage = `${fileMessage}\n${errorStack}`;
      this._writeToFile(this.errorLogFilePath, errorFileMessage);
    }
  }

  info(...args) {
    this._log("info", ...args);
  }

  success(...args) {
    this._log("success", ...args);
  }
  warn(...args) {
    this._log("warn", ...args);
  }

  error(...args) {
    this._log("error", ...args);
  }

  debug(...args) {
    this._log("debug", ...args);
  }

  banner() {
    const cyan = "\x1b[36m";
    const boldCyan = "\x1b[1;36m";
    const white = "\x1b[37m";
    const reset = "\x1b[0m";

    console.log(`
${cyan}╭─────────────────────────────────────────────────────────────╮${reset}
${cyan}│${reset}                 ${boldCyan}🎫 TITAN X TICKET BOT 🎫${reset}                  ${cyan}│${reset}
${cyan}│${reset}              ${white}High-Quality • Fast • Reliable${reset}               ${cyan}│${reset}
${cyan}╰─────────────────────────────────────────────────────────────╯${reset}
`);
  }

  footer() {
    const cyan = "\x1b[36m";
    const green = "\x1b[32m";
    const white = "\x1b[37m";
    const dim = "\x1b[2m";
    const reset = "\x1b[0m";

    console.log(`
${cyan}   ────────────────────────────────────────────────────────────${reset}

   ${green}🎫 System Operational 🎫${reset}
   ${white}Developed with ♡ by Titan X Development${reset}
   ${dim}Ready to manage tickets on your servers${reset}

${cyan}   ────────────────────────────────────────────────────────────${reset}
`);
  }

  step(title) {
    const blue = "\x1b[34m\x1b[1m";
    const reset = "\x1b[0m";
    console.log(`${blue}◆ Loading ${title}...${reset}`);
  }

  stepSuccess(message) {
    const green = "\x1b[32m\x1b[1m";
    const reset = "\x1b[0m";
    console.log(`${green}✓ ${message}${reset}`);
  }

  stepInfo(message) {
    const cyan = "\x1b[36m";
    const reset = "\x1b[0m";
    console.log(`${cyan}ⓘ ${message}${reset}`);
  }

  stepError(message) {
    const red = "\x1b[31m\x1b[1m";
    const reset = "\x1b[0m";
    console.log(`${red}✗ Error: ${message}${reset}`);
  }
}
export const logger = new Logger();

/**
 * Copyright (c) 2025 Titan X Development
 * Code by Titan X Development
 * MIT License
 */
