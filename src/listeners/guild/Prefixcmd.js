
import {
  ContainerBuilder,
  TextDisplayBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
  SeparatorBuilder,
  SeparatorSpacingSize,
  ActionRowBuilder,
  PermissionFlagsBits,
} from "discord.js";
import { logger } from "#utils/logger";
let db;

import { config } from "#config/config";
import { validateCommand } from "#utils/permissionHandler";
import { CommandContext } from "#classes/context";
import { emoji } from "#config/emoji";

const handleTicketMessage = async (message, client) => {
  if (message.author.bot || !message.guild) return;

  const ticket = await db.getTicketByChannel(message.channel.id);
  if (!ticket || ticket.status !== "open") return;

  // Update last activity for auto-close worker
  await db.updateLastActivity(ticket.ticketId).catch(() => {});
};

const mentionRegexCache = new Map();

const getMentionRegex = (clientId) => {
  if (!mentionRegexCache.has(clientId)) {
    mentionRegexCache.set(clientId, new RegExp(`^<@!?${clientId}>\\s*$`));
  }
  return mentionRegexCache.get(clientId);
};

const getMentionPrefixRegex = (clientId) => {
  const key = `prefix_${clientId}`;
  if (!mentionRegexCache.has(key)) {
    mentionRegexCache.set(key, new RegExp(`^<@!?${clientId}>\\s+`));
  }
  return mentionRegexCache.get(key);
};

const sendError = (message, title, description) => {
  const container = new ContainerBuilder();
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(`## ${emoji.cross} ${title}\n\n${description}`)
  );
  message.reply({ components: [container], flags: MessageFlags.IsComponentsV2 }).catch(() => {});
};

const parseMentionPrefix = (content, clientId) => {
  const regex = getMentionPrefixRegex(clientId);
  const match = content.match(regex);
  if (!match) return null;
  const parts = content.slice(match[0].length).trim().split(/\s+/);
  return parts.length > 0 ? { parts, type: "mention" } : null;
};

const parseGuildPrefix = async (content, guildId) => {
  const guildPrefix = await db.getPrefix(guildId);
  const lowerContent = content.toLowerCase();

  if (lowerContent.startsWith(guildPrefix.toLowerCase())) {
    const parts = content.slice(guildPrefix.length).trim().split(/\s+/);
    return parts.length > 0 ? { parts, type: "guild", guildPrefix } : null;
  }
  return null;
};

const parseCommand = async (message, client) => {
  const content = message.content.trim();

  return (
    parseMentionPrefix(content, client.user.id) ||
    (await parseGuildPrefix(content, message.guild.id))
  );
};

const handleMentionOnly = async (message, client) => {
  const mentionRegex = getMentionRegex(client.user.id);
  if (!mentionRegex.test(message.content.trim())) return false;

  const guildPrefix = await db.getPrefix(message.guild.id);
  const container = new ContainerBuilder();

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(`## ${client.user.username}\n\n`)
  );

  container.addSeparatorComponents(
    new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
  );

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
      ` **Server Prefix**\n\n` +
      `${guildPrefix}`+
      `\n\n-# Use \`${guildPrefix}help\` for commands`
    )
  );

  container.addSeparatorComponents(
    new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
  );

  await message.reply({
    components: [container],
    flags: MessageFlags.IsComponentsV2,
  });

  return true;
};

const getCommand = (parts, commandHandler) => {
  if (!parts || parts.length === 0) return { command: null, args: [] };

  const firstPart = parts[0].toLowerCase();

  const arrayCommands = commandHandler.arrayCommands.get(firstPart);
  if (arrayCommands?.length > 0) {
    for (const cmd of arrayCommands) {
      const nameLength = cmd.name.length;
      if (parts.length < nameLength) continue;

      let matches = true;
      for (let i = 0; i < nameLength; i++) {
        if (parts[i].toLowerCase() !== cmd.name[i].toLowerCase()) {
          matches = false;
          break;
        }
      }

      if (matches) return { command: cmd, args: parts.slice(nameLength) };
    }
  }

  const aliasedName = commandHandler.aliases.get(firstPart);
  if (aliasedName) {
    const command = commandHandler.commands.get(aliasedName);
    if (command) return { command, args: parts.slice(1) };
  }

  const directCommand = commandHandler.commands.get(firstPart);
  if (directCommand) return { command: directCommand, args: parts.slice(1) };

  return { command: null, args: [] };
};

export default {
  name: "messageCreate",
  async execute({ eventArgs, client }) {
    db = client.db
    const [message] = eventArgs;
    if (message.author.bot || !message.guild) return;

    const [isBlacklisted, mentionHandled] = await Promise.all([
      Promise.all([
        db.isUserBlacklisted(message.guild.id, message.author.id),
      ]).then(([user, guild]) => user || guild),
      handleMentionOnly(message, client),
    ]);

    if (isBlacklisted || mentionHandled) return;

    const commandInfo = await parseCommand(message, client);
    if (!commandInfo) {
      handleTicketMessage(message, client).catch(err => logger.error("MessageCreate", "Ticket AI error", err));
      return;
    }

    const { command, args } = getCommand(commandInfo.parts, client.commandHandler);
    if (!command) return;

    


    if (command.cooldown) {
      const cooldown = client.commandHandler.isOnCooldown(
        command,
        message.author.id,
        message.guild.id
      );

      if (cooldown) {
        if (
          client.commandHandler.shouldNotifyAboutCooldown(
            command,
            message.author.id,
            message.guild.id
          )
        ) {
          const timestamp = Math.floor((Date.now() + cooldown) / 1000);
          return sendError(
            message,
            "Cooldown",
            `Wait <t:${timestamp}:R>`
          );
        }
        return;
      }

      await client.commandHandler.setCooldown(
        command,
        message.author.id,
        message.guild.id
      );
    }

    try {
      const ctx = new CommandContext({ client, message, args });
      const permissionValidation = await validateCommand(ctx, command);

      if (!permissionValidation.valid) {
        return sendError(
          message,
          permissionValidation.error.title,
          permissionValidation.error.description
        );
      }

      await command.execute({ ctx, args });
    } catch (error) {
      const displayName = Array.isArray(command.name)
        ? command.name.join(" ")
        : command.name;
      logger.error("MessageCreate", `Error: ${displayName}`, error);
      sendError(message, "Command Error", "An error occurred");
    }
  },
};

/**
 * Copyright (c) 2025 Titan X Development
 * Code by Titan X Development
 * MIT License
 */
