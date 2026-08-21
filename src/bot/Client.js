

import {
  Client,
  GatewayIntentBits,
  Collection,
  Partials,
  Options,
} from "discord.js";

import { config } from "#config/config";
import { DatabaseManager } from "#db/Manager";
import { CommandHandler } from "#handlers/CommandHandler";
import { EventLoader } from "#handlers/EventLoader";
import { logger } from "#utils/logger";
import { createUtils } from "#utils/utils";
import { startAutoCloseWorker } from "../providers/AutoClose.js";



export class Bot extends Client {
  constructor() {
    const clientOptions = {
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.MessageContent,
      ],
      partials: [
        Partials.Channel,
        Partials.GuildMember,
        Partials.Message,
        Partials.User,
      ],
      makeCache: Options.cacheWithLimits({
        MessageManager: 100,
        PresenceManager: 0,
        UserManager: 100,
      }),
      failIfNotExists: false,
      allowedMentions: { parse: ["users", "roles"], repliedUser: false },
      ws: {
        properties: {
          browser: "Discord Android",
        },
      },
    };


    super(clientOptions);

    const mobileProps = {
      $os: "android",
      $browser: "Discord Android",
      $device: "Discord Android",
      os: "android",
      browser: "Discord Android",
      device: "Discord Android",
    };

    const origConnect = this.ws.connect.bind(this.ws);
    this.ws.connect = async () => {
      const promise = origConnect();
      if (this.ws._ws) {
        this.ws._ws.options.identifyProperties = mobileProps;
      }
      return promise;
    };

    this.commands = new Collection();
    this.logger = logger;
    this.config = config;
    this.db = new DatabaseManager(this)
    this.utils = createUtils(this);
    this.commandHandler = new CommandHandler(this);
    this.eventHandler = new EventLoader(this);
  }

  async init() {
    this.logger.banner();

    try {
      this.logger.step("Database connection");
      if (config.database?.url && !config.database.url.startsWith("YOUR_") && config.database.url.trim() !== "") {
        await this.db.connect(config.database.url);
        this.logger.stepSuccess("Database initialized (Connected to MongoDB)");
      } else {
        this.logger.stepInfo("No MONGO_URI configured in .env file");
      }

      this.logger.step("Event handlers");
      const eventSuccess = await this.eventHandler.loadAllEvents();
      if (eventSuccess) {
        const totalEvents = Array.from(this.eventHandler.loadedEvents.values()).reduce(
          (sum, events) => sum + events.length,
          0
        );
        this.logger.stepSuccess(`Event handlers loaded (${totalEvents} events)`);
      }

      this.logger.step("Command modules");
      await this.commandHandler.loadCommands();
      this.logger.stepSuccess(`Command modules loaded (${this.commandHandler.commands.size} prefix & ${this.commandHandler.slashCommandFiles.size} slash commands)`);

      if (!config.token || config.token.startsWith("YOUR_") || config.token.trim() === "") {
        this.logger.stepError("No bot TOKEN configured in .env file");
        return;
      }

      this.logger.step("Discord authentication");
      await this.login(config.token);
      this.logger.stepSuccess(`Authentication successful → ${this.user.tag}`);

      this.logger.step("Auto-Close worker");
      startAutoCloseWorker(this);
      this.logger.stepSuccess("Auto-Close worker started (24h inactivity threshold)");

    } catch (error) {
      this.logger.stepError(`Failed to initialize bot: ${error.message}`);
      throw error;
    }
  }

  async cleanup() {
    this.logger.warn("Bot", `❄️ Starting cleanup for bot...`);
    try {

      this.destroy();

      this.logger.success("Bot", "❄️ Cleanup completed successfully. 🌸");
    } catch (error) {
      this.logger.error("Bot", "❄️ An error occurred during cleanup:", error);
    }
  }
}

/**
 * Copyright (c) 2025 Titan X Development
 * Code by Titan X Development
 * MIT License
 */
