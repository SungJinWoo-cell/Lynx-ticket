
// Titan X Development

import { REST } from "@discordjs/rest";
import { Routes } from "discord-api-types/v10";
import { ActivityType } from "discord.js";
import { logger } from "#utils/logger";
import { initEmojiManager } from "#config/emoji";

export default {
  name: "clientReady",
  once: true,
  async execute({ client }) {
    initEmojiManager(client);
    client.user.setPresence({
      activities: [{ name: "Titan X Development", type: ActivityType.Watching }],
      status: "online",
    });

    try {
      const slashCommandsData = client.commandHandler.getSlashCommandsData();

      if (!slashCommandsData || slashCommandsData.length === 0) {
        logger.stepInfo("No slash commands to register");
      } else {
        logger.step("Synchronizing slash commands");
        const rest = new REST({ version: "10" }).setToken(config.token);

        const currentCommands = await rest.get(
          Routes.applicationCommands(client.user.id),
        );

        const currentMap = new Map(
          currentCommands.map((c) => [c.name, c]),
        );

        const normalize = (cmd) => {
          const { id, application_id, version, guild_id, ...rest } = cmd;
          return rest;
        };

        const toUpdate = slashCommandsData.filter((cmd) => {
          const existing = currentMap.get(cmd.name);
          if (!existing) return true;
          return (
            JSON.stringify(normalize(existing)) !==
            JSON.stringify(normalize(cmd))
          );
        });

        if (toUpdate.length === 0) {
          logger.stepSuccess("Slash commands already in sync");
        } else {
          const merged = [];
          const updateMap = new Map(toUpdate.map((c) => [c.name, c]));

          for (const cmd of currentCommands) {
            if (updateMap.has(cmd.name)) {
              merged.push(updateMap.get(cmd.name));
              updateMap.delete(cmd.name);
            } else {
              merged.push(cmd);
            }
          }

          merged.push(...updateMap.values());

          await rest.put(
            Routes.applicationCommands(client.user.id),
            { body: merged },
          );

          logger.stepSuccess(`Command synchronization complete (${toUpdate.length} commands updated)`);
        }
      }
    } catch (err) {
      logger.stepError(`Auto register failed: ${err.message}`);
    }

    logger.stepInfo(`Connected to ${client.guilds.cache.size} guild(s)`);
    logger.footer();
  },
};

/**
 * Copyright (c) 2025 Titan X Development
 * Code by Titan X Development
 * MIT License
 */
