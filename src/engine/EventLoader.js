
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { logger } from "#utils/logger";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Event Loader class
 * Loads and registers all event handlers for the bot
 */
export class EventLoader {
  /**
   * Creates a new EventLoader instance
   * @param {Bot} client - The bot client
   */
  constructor(client) {
    this.client = client;
    this.loadedEvents = new Map();
    this.handlers = new Map();
    this.eventsPath = path.join(__dirname, "../listeners");
    this.handlersPath = path.join(__dirname);
  }

  /**
   * Loads all events from the events directory
   * @async
   * @returns {Promise<boolean>} True if successful
   */
  async loadAllEvents() {
    try {
      await this.loadHandlers();
      await this.loadEventsByType();

      const totalEvents = Array.from(this.loadedEvents.values()).reduce(
        (sum, events) => sum + events.length,
        0,
      );

      return true;
    } catch (error) {
      logger.error("EventLoader", "Failed to load events");
      logger.error("EventLoader", error.message);
      return false;
    }
  }

  /**
   * Loads all event handlers
   * @async
   */
  async loadHandlers() {
    try {
      if (!fs.existsSync(this.handlersPath)) {
        logger.warn(
          "EventLoader",
          `Handlers directory not found: ${this.handlersPath}`,
        );
        return;
      }

      const handlerFiles = await fs.promises.readdir(this.handlersPath);

      for (const file of handlerFiles) {
        if (file === "DiscordDispatcher.js" || (file.endsWith("Handler.js") && file !== "CommandHandler.js" && file !== "EventLoader.js")) {
          const handlerPath = path.join(this.handlersPath, file);
          const handlerModule = await import(`file://${handlerPath}`);

          if (handlerModule?.default) {
            const handler = new handlerModule.default(this.client);
            const handlerName = file === "DiscordDispatcher.js" ? "discord" : file.replace(".js", "").replace("Handler", "");
            this.handlers.set(handlerName, handler);
          }
        }
      }
    } catch (error) {
      logger.error("EventLoader", "Failed to load handlers", error);
    }
  }

  /**
   * Loads events organized by type (discord, player, node, etc.)
   * @async
   */
  async loadEventsByType() {
    try {
      if (!fs.existsSync(this.eventsPath)) {
        logger.warn(
          "EventLoader",
          `Events directory not found: ${this.eventsPath}`,
        );
        return;
      }

      const handler = this.handlers.get("discord") || this.handlers.values().next().value;
      if (handler) {
        await this.recursiveLoadEvents(this.eventsPath, "discord");
      }
    } catch (error) {
      logger.error("EventLoader", "Failed to load events", error);
    }
  }

  /**
   * Recursively loads events from directories
   * @async
   * @param {string} dirPath - Directory path
   * @param {string} eventType - Type of events (discord, player, node)
   */
  async recursiveLoadEvents(dirPath, eventType) {
    try {
      const entries = await fs.promises.readdir(dirPath, {
        withFileTypes: true,
      });

      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);

        if (entry.isDirectory()) {
          await this.recursiveLoadEvents(fullPath, eventType);
        } else if (entry.isFile() && entry.name.endsWith(".js")) {
          await this.loadEventFile(fullPath, eventType);
        }
      }
    } catch (error) {
      logger.error(
        "EventLoader",
        `Failed to read directory: ${dirPath}`,
        error,
      );
    }
  }

  /**
   * Loads a single event file
   * @async
   * @param {string} filePath - Path to event file
   * @param {string} eventType - Type of event
   */
  async loadEventFile(filePath, eventType) {
    try {
      const module = await import(`file://${filePath}?t=${Date.now()}`);
      if (!module?.default) return;

      const event = module.default;
      const handler = this.handlers.get(eventType);

      if (!handler) {
        logger.warn(
          "EventLoader",
          `No handler found for event type: ${eventType}`,
        );
        return;
      }

      await handler.register(event);

      if (!this.loadedEvents.has(eventType)) {
        this.loadedEvents.set(eventType, []);
      }
      this.loadedEvents.get(eventType).push(event);
    } catch (error) {
      logger.error("EventLoader", `Failed to load event: ${filePath}`);
      logger.error("EventLoader", error.message);
    }
  }

  /**
   * Gets all loaded events
   * @returns {Object} Map of event types to event arrays
   */
  getLoadedEvents() {
    return Object.fromEntries(this.loadedEvents);
  }

  /**
   * Gets all registered handler names
   * @returns {Array<string>} Handler names
   */
  getHandlers() {
    return Array.from(this.handlers.keys());
  }

  /**
   * Gets available event type names
   * @returns {Array<string>} Event type names
   */
  getAvailableEventTypes() {
    try {
      if (!fs.existsSync(this.eventsPath)) return [];

      return fs
        .readdirSync(this.eventsPath, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name);
    } catch (error) {
      logger.error("EventLoader", "Failed to get available event types", error);
      return [];
    }
  }
}

/**
 * Copyright (c) 2025 Titan X Development
 * Code by Titan X Development
 * MIT License
 */
