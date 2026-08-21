
import { Command } from "#structures/classes/Command";
import { PermissionFlagsBits, ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize, MessageFlags } from "discord.js";
import { logger } from "#utils/logger";

class BlacklistCommand extends Command {
  constructor() {
    super({
      name: "blacklist",
      description: "Manage blacklisted users",
      usage: "blacklist <add|remove|list> [user]",
      examples: ["blacklist add @user", "blacklist remove @user", "blacklist list"],
      userPermissions: [PermissionFlagsBits.ManageGuild],
      botPermissions: [],
      enabledSlash: true,
      slashData: {
        name: "blacklist",
        description: "Manage blacklisted users",
        defaultMemberPermissions: PermissionFlagsBits.ManageGuild,
        options: [
          {
            name: "add",
            description: "Add a user to the blacklist",
            type: 1,
            options: [
              {
                name: "user",
                description: "User to blacklist",
                type: 9,
                required: true,
              },
            ],
          },
          {
            name: "remove",
            description: "Remove a user from the blacklist",
            type: 1,
            options: [
              {
                name: "user",
                description: "User to remove from blacklist",
                type: 9,
                required: true,
              },
            ],
          },
          {
            name: "list",
            description: "List all blacklisted users",
            type: 1,
          },
        ],
      },
    });
  }

  async execute({ ctx, args }) {
    const db = ctx.client.db;
    
    const subcommand = ctx.isSlash
      ? ctx.interaction.options.getSubcommand()
      : args[0]?.toLowerCase();

    if (!subcommand || !["add", "remove", "list"].includes(subcommand)) {
      const container = new ContainerBuilder()
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent("## Invalid Subcommand\n\nUse: `blacklist add`, `blacklist remove`, or `blacklist list`")
        );
      return ctx.reply({ components: [container], flags: MessageFlags.IsComponentsV2 });
    }

    if (subcommand === "add") {
      return this._add(ctx, db);
    } else if (subcommand === "remove") {
      return this._remove(ctx, db);
    } else if (subcommand === "list") {
      return this._list(ctx, db);
    }
  }

  async _add(ctx, db) {
    const user = ctx.isSlash
      ? ctx.interaction.options.getUser("user")
      : ctx.message.mentions.users.first();

    if (!user) {
      const container = new ContainerBuilder()
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent("## Missing User\n\nPlease specify a user to blacklist.")
        );
      return ctx.reply({ components: [container], flags: MessageFlags.IsComponentsV2 });
    }

    try {
      const isBlacklisted = await db.isUserBlacklisted(ctx.guild.id, user.id);
      if (isBlacklisted) {
        const container = new ContainerBuilder()
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent("## Already Blacklisted\n\nThis user is already blacklisted.")
          );
        return ctx.reply({ components: [container], flags: MessageFlags.IsComponentsV2 });
      }

      await db.addBlacklistedUser(
        ctx.guild.id,
        user.id,
        "Blacklisted from creating tickets",
        ctx.author.id
      );

      logger.success(
        "BlacklistCommand",
        `User ${user.id} blacklisted in ${ctx.guild.id}`
      );

      const container = new ContainerBuilder()
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(`## User Blacklisted\n\n${user.tag} has been blacklisted from creating tickets.`),
          new TextDisplayBuilder().setContent(`-# Blacklisted by ${ctx.author.tag}`)
        );

      return ctx.reply({ components: [container], flags: MessageFlags.IsComponentsV2 });
    } catch (error) {
      logger.error("BlacklistCommand", "Failed to blacklist user", error);
      const container = new ContainerBuilder()
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent("## Error\n\nFailed to blacklist user. Please try again.")
        );
      return ctx.reply({ components: [container], flags: MessageFlags.IsComponentsV2 });
    }
  }

  async _remove(ctx, db) {
    const user = ctx.isSlash
      ? ctx.interaction.options.getUser("user")
      : ctx.message.mentions.users.first();

    if (!user) {
      const container = new ContainerBuilder()
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent("## Missing User\n\nPlease specify a user to remove from blacklist.")
        );
      return ctx.reply({ components: [container], flags: MessageFlags.IsComponentsV2 });
    }

    try {
      const isBlacklisted = await db.isUserBlacklisted(ctx.guild.id, user.id);
      if (!isBlacklisted) {
        const container = new ContainerBuilder()
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent("## Not Blacklisted\n\nThis user is not blacklisted.")
          );
        return ctx.reply({ components: [container], flags: MessageFlags.IsComponentsV2 });
      }

      await db.removeBlacklistedUser(ctx.guild.id, user.id);

      logger.success(
        "BlacklistCommand",
        `User ${user.id} removed from blacklist in ${ctx.guild.id}`
      );

      const container = new ContainerBuilder()
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(`## User Removed\n\n${user.tag} has been removed from the blacklist.`),
          new TextDisplayBuilder().setContent(`-# Removed by ${ctx.author.tag}`)
        );

      return ctx.reply({ components: [container], flags: MessageFlags.IsComponentsV2 });
    } catch (error) {
      logger.error("BlacklistCommand", "Failed to remove blacklist", error);
      const container = new ContainerBuilder()
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent("## Error\n\nFailed to remove user. Please try again.")
        );
      return ctx.reply({ components: [container], flags: MessageFlags.IsComponentsV2 });
    }
  }

  async _list(ctx, db) {
    try {
      const blacklisted = await db.getBlacklistedUsers(ctx.guild.id);

      if (blacklisted.length === 0) {
        const container = new ContainerBuilder()
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent("## No Blacklisted Users\n\nThere are no blacklisted users in this server.")
          );
        return ctx.reply({ components: [container], flags: MessageFlags.IsComponentsV2 });
      }

      let description = "";
      for (const entry of blacklisted) {
        try {
          const user = await ctx.client.users.fetch(entry.userId);
          description += `**${user.tag}** (\`${user.id}\`)\n`;
        } catch {
          description += `Unknown User (\`${entry.userId}\`)\n`;
        }
      }

      const container = new ContainerBuilder()
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(`## Blacklisted Users\n\n${description || "No users found"}`),
          new TextDisplayBuilder().setContent(`-# Total: ${blacklisted.length}`)
        );

      return ctx.reply({ components: [container], flags: MessageFlags.IsComponentsV2 });
    } catch (error) {
      logger.error("BlacklistCommand", "Failed to list blacklist", error);
      const container = new ContainerBuilder()
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent("## Error\n\nFailed to retrieve blacklist. Please try again.")
        );
      return ctx.reply({ components: [container], flags: MessageFlags.IsComponentsV2 });
    }
  }
}

export default new BlacklistCommand();

/**
 * Copyright (c) 2025 Titan X Development
 * Code by Titan X Development
 * MIT License
 */
