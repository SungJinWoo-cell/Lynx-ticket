
import { Command } from "#structures/classes/Command";
import { PermissionFlagsBits, ContainerBuilder, TextDisplayBuilder, MessageFlags } from "discord.js";
import { logger } from "#utils/logger";

class PrefixCommand extends Command {
  constructor() {
    super({
      name: "prefix",
      description: "Change the server prefix",
      usage: "prefix <new_prefix>",
      examples: ["prefix ,", "prefix !"],
      userPermissions: [PermissionFlagsBits.ManageGuild],
      botPermissions: [],
      enabledSlash: true,
      slashData: {
        name: "prefix",
        description: "Change the server prefix",
        defaultMemberPermissions: PermissionFlagsBits.ManageGuild,
        options: [
          {
            name: "prefix",
            description: "New prefix (1 character)",
            type: 3,
            required: true,
            max_length: 1,
          },
        ],
      },
    });
  }

  async execute({ ctx, args }) {
    try {
      const db = ctx.client.db;
      
      let prefix;
      if (ctx.isSlash) {
        prefix = ctx.interaction.options.getString("prefix");
      } else {
        prefix = args?.[0];
      }

      logger.debug("PrefixCommand", `Received args: ${JSON.stringify(args)}, prefix: ${prefix}`);

      if (!prefix) {
        logger.warn("PrefixCommand", "No prefix provided");
        const container = new ContainerBuilder()
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent("## Invalid Input\n\nPlease provide a prefix (1 character).")
          );
        return await ctx.reply({ components: [container], flags: MessageFlags.IsComponentsV2 });
      }

      if (prefix.length > 1) {
        logger.warn("PrefixCommand", `Prefix too long: ${prefix}`);
        const container = new ContainerBuilder()
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent("## Invalid Length\n\nPrefix must be a single character.")
          );
        return await ctx.reply({ components: [container], flags: MessageFlags.IsComponentsV2 });
      }

      await db.setPrefix(ctx.guild.id, prefix);
      logger.success("PrefixCommand", `Prefix changed to "${prefix}" in ${ctx.guild.id}`);

      const container = new ContainerBuilder()
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(`## Prefix Updated\n\nServer prefix has been changed to: **\`${prefix}\`**\n\n-# Changes take effect immediately`)
        );

      return await ctx.reply({ components: [container], flags: MessageFlags.IsComponentsV2 });
    } catch (error) {
      logger.error("PrefixCommand", "Command execution failed", error);
      const container = new ContainerBuilder()
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent("## Error\n\nFailed to update prefix. Please try again.")
        );
      await ctx.reply({ components: [container], flags: MessageFlags.IsComponentsV2 });
    }
  }
}

export default new PrefixCommand();

/**
 * Copyright (c) 2025 Titan X Development
 * Code by Titan X Development
 * MIT License
 */
