
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { logger } from "#utils/logger";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Command Handler class
 * Loads and manages all bot commands (prefix and slash)
 */
export class CommandHandler {
  /**
   * Creates a new CommandHandler instance
   * Initializes command storage maps and cooldown tracking
   */
  constructor() {
    this.commands = new Map();
    this.aliases = new Map();
    this.arrayCommands = new Map();
    this.slashCommands = new Map();
    this.slashCommandFiles = new Map();
    this.categories = new Map();
    this.commandPaths = new Map();
    this.cooldowns = new Map();
    this.cooldownNotified = new Map();
  }

  /**
   * Loads all commands from the commands directory
   * @async
   * @param {string} [dirPath='../../commands'] - Relative path to commands directory
   */
  async loadCommands(dirPath = "../commands") {
    this.commands.clear();
    this.aliases.clear();
    this.arrayCommands.clear();
    this.slashCommands.clear();
    this.slashCommandFiles.clear();
    this.categories.clear();
    this.commandPaths.clear();

    const commandsAbsolutePath = path.join(__dirname, dirPath);

    try {
      await this._recursivelyLoadCommands(commandsAbsolutePath);
      this._finalizeSlashCommands();
    } catch (error) {
      logger.error("CommandHandler", "Failed to load commands", error);
    }
  }

  /**
   * Recursively loads commands from directories
   * @private
   * @async
   * @param {string} dirPath - Absolute directory path
   * @param {string} [relativePath=''] - Relative path for categorization
   */
  async _recursivelyLoadCommands(dirPath, relativePath = "") {
    try {
      const entries = fs.readdirSync(dirPath, {
        withFileTypes: true,
      });

      const loadPromises = entries.map(async (entry) => {
        const fullPath = path.join(dirPath, entry.name);
        const currentRelativePath = relativePath
          ? path.join(relativePath, entry.name)
          : entry.name;

        if (entry.isDirectory()) {
          await this._recursivelyLoadCommands(fullPath, currentRelativePath);
        } else if (entry.isFile() && entry.name.endsWith(".js")) {
          const category = relativePath || "default";

          if (!this.categories.has(category)) {
            this.categories.set(category, []);
          }
          await this._loadCommandFile(fullPath, category);
        }
      });

      await Promise.all(loadPromises);
    } catch (error) {
      logger.error(
        "CommandHandler",
        `Failed to read directory: ${dirPath}`,
        error,
      );
    }
  }

  /**
   * Loads a single command file
   * @private
   * @async
   * @param {string} filePath - Absolute path to command file
   * @param {string} category - Command category
   */
  async _loadCommandFile(filePath, category) {
    try {
      const commandModule = await import(`file://${filePath}?v=${Date.now()}`);

      if (!commandModule?.default) {
        logger.warn(
          "CommandHandler",
          `Invalid command file: ${path.basename(filePath)} is missing a default export.`,
        );
        return;
      }

      const command = commandModule.default;
      command.category = category;

      if (Array.isArray(command.name)) {
        const firstPart = command.name[0].toLowerCase();

        if (command.name.length > 1) {
          if (!this.arrayCommands.has(firstPart)) {
            this.arrayCommands.set(firstPart, []);
          }
          this.arrayCommands.get(firstPart).push(command);
        }

        const arrayKey = command.name.join(":").toLowerCase();
        this.commands.set(arrayKey, command);
        this.commandPaths.set(arrayKey, filePath);
      } else {
        const cmdName = command.name.toLowerCase();
        this.commandPaths.set(cmdName, filePath);
        this.commands.set(cmdName, command);
      }

      if (command.aliases?.length > 0) {
        if (Array.isArray(command.name)) {
          const arrayKey = command.name.join(":").toLowerCase();
          command.aliases.forEach((alias) =>
            this.aliases.set(alias.toLowerCase(), arrayKey),
          );
        } else {
          const cmdName = command.name.toLowerCase();
          command.aliases.forEach((alias) =>
            this.aliases.set(alias.toLowerCase(), cmdName),
          );
        }
      }

      if (command.enabledSlash && command.slashData) {
        this.slashCommandFiles.set(command.slashData.name.toString(), command);
      }

      this.categories.get(category)?.push(command);
    } catch (error) {
      logger.error(
        "CommandHandler",
        `Failed to load command file: ${path.basename(filePath)}`,
        error,
      );
    }
  }

  /**
   * Finalizes slash commands by building command structures
   * Handles grouped subcommands and command hierarchies
   * @private
   */
  _finalizeSlashCommands() {
    for (const command of this.slashCommandFiles.values()) {
      const { name, description, options, defaultMemberPermissions } =
        command.slashData;

      if (Array.isArray(name)) {
        if (name.length === 2) {
          const [main, sub] = name;
          let mainCmd = this.slashCommands.get(main);

          if (!mainCmd) {
            mainCmd = {
              name: main,
              description: `${main} commands`,
              options: [],
            };
            if (defaultMemberPermissions) {
              mainCmd.default_member_permissions =
                defaultMemberPermissions.toString();
            }
            this.slashCommands.set(main, mainCmd);
          }

          const hasSubcommands = options?.some((opt) => opt.type === 1);

          if (hasSubcommands) {
            let groupObj = mainCmd.options.find(
              (opt) => opt.name === sub && opt.type === 2,
            );

            if (!groupObj) {
              groupObj = {
                name: sub,
                description: description || `${sub} commands`,
                type: 2,
                options: [],
              };
              mainCmd.options.push(groupObj);
            }

            options.forEach((opt) => {
              if (opt.type === 1) {
                groupObj.options.push(opt);
              }
            });
          } else {
            mainCmd.options.push({
              name: sub,
              description,
              options: options || [],
              type: 1,
            });
          }
        } else if (name.length === 3) {
          const [main, group, sub] = name;
          let mainCmd = this.slashCommands.get(main);

          if (!mainCmd) {
            mainCmd = {
              name: main,
              description: `${main} commands`,
              options: [],
            };
            if (defaultMemberPermissions) {
              mainCmd.default_member_permissions =
                defaultMemberPermissions.toString();
            }
            this.slashCommands.set(main, mainCmd);
          }

          let groupObj = mainCmd.options.find(
            (opt) => opt.name === group && opt.type === 2,
          );

          if (!groupObj) {
            groupObj = {
              name: group,
              description: `${group} group under ${main}`,
              type: 2,
              options: [],
            };
            mainCmd.options.push(groupObj);
          }

          groupObj.options.push({
            name: sub,
            description,
            options: options || [],
            type: 1,
          });
        } else {
          logger.warn(
            "CommandHandler",
            `Unsupported slashData.name depth for command: ${command.name}`,
          );
        }
      } else {
        const cmdData = {
          name,
          description,
          options: options || [],
        };
        if (defaultMemberPermissions) {
          cmdData.default_member_permissions =
            defaultMemberPermissions.toString();
        }
        this.slashCommands.set(name, cmdData);
      }
    }
  }

  /**
   * Gets all slash command data for registration
   * @returns {Array<Object>} Array of slash command data objects
   */
  getSlashCommandsData() {
    return Array.from(this.slashCommands.values());
  }

  /**
   * Sets cooldown for a command
   * @param {Command} command - The command
   * @param {string} userId - User ID
   * @param {string} guildId - Guild ID
   */
  async setCooldown(command, userId, guildId) {
    const commandKey = Array.isArray(command.name)
      ? command.name.join(":").toLowerCase()
      : command.name.toLowerCase();

    let cooldown;
    
      cooldown = command.cooldown;
    

    if (cooldown) {
      const cooldownKey = `${commandKey}-${userId}-${guildId}`;
      const cooldownValue = Date.now() + cooldown * 1000;
      this.cooldowns.set(cooldownKey, cooldownValue);
      this.cooldownNotified.delete(cooldownKey);
    }
  }

  /**
   * Checks if command is on cooldown for user
   * @param {Command} command - The command
   * @param {string} userId - User ID
   * @param {string} guildId - Guild ID
   * @returns {number|null} Remaining cooldown in ms or null
   */
  isOnCooldown(command, userId, guildId) {
    const cooldown = command.cooldown;
    if (!cooldown) return null;

    const commandKey = Array.isArray(command.name)
      ? command.name.join(":").toLowerCase()
      : command.name.toLowerCase();

    const cooldownKey = `${commandKey}-${userId}-${guildId}`;
    const cooldownValue = this.cooldowns.get(cooldownKey);

    if (!cooldownValue) return null;

    const remaining = cooldownValue - Date.now();

    if (remaining > 0) {
      return remaining;
    } else {
      this.cooldowns.delete(cooldownKey);
      this.cooldownNotified.delete(cooldownKey);
      return null;
    }
  }

  /**
   * Checks if user should be notified about cooldown
   * Prevents spam by only notifying once per cooldown
   * @param {Command} command - The command
   * @param {string} userId - User ID
   * @param {string} guildId - Guild ID
   * @returns {boolean} True if should notify
   */
  shouldNotifyAboutCooldown(command, userId, guildId) {
    const commandKey = Array.isArray(command.name)
      ? command.name.join(":").toLowerCase()
      : command.name.toLowerCase();

    const cooldownKey = `${commandKey}-${userId}-${guildId}`;
    const hasNotified = this.cooldownNotified.get(cooldownKey);

    if (!hasNotified) {
      this.cooldownNotified.set(cooldownKey, true);
      return true;
    }

    return false;
  }
}

/**
 * Copyright (c) 2025 Titan X Development
 * Code by Titan X Development
 * MIT License
 */
