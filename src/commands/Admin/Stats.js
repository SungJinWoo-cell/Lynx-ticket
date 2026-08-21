
import { Command } from "#structures/classes/Command";
import {
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  MessageFlags,
} from "discord.js";
import { emoji } from "#config/emoji";
import TicketUI from "#bot/Interface";

class StatsCommand extends Command {
  constructor() {
    super({
      name: "stats",
      description: "View ticket statistics for this server",
      usage: "stats",
      examples: ["stats"],
      userPermissions: [],
      botPermissions: [],
      cooldown: 5,
      enabledSlash: true,
      slashData: {
        name: "stats",
        description: "View ticket statistics for this server",
      },
    });
  }

  async execute({ ctx }) {
    const guildId = ctx.guild.id;

    const [serverStats, globalStats] = await Promise.all([
      ctx.client.db.getGuildTicketStats(guildId),
      ctx.client.db.getGlobalTicketStats(),
    ]);

    const guild = ctx.guild;

    const starBar = (avg) => {
      if (!avg || avg === "N/A") return "No ratings yet";
      const full = Math.min(5, Math.max(1, Math.round(parseFloat(avg))));
      return emoji.starFill.repeat(full) + emoji.starEmpty.repeat(5 - full) + ` (${avg}/5)`;
    };

    const serverOpenPct = serverStats.total > 0 ? Math.round((serverStats.open / serverStats.total) * 100) : 0;
    const globalOpenPct = globalStats.total > 0 ? Math.round((globalStats.open / globalStats.total) * 100) : 0;

    const container = new ContainerBuilder();

    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `## ${emoji.dashboard} Ticket Analytics & System Statistics`
      )
    );

    container.addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
    );

    container.addSectionComponents((section) =>
      section
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            `### 📊 Server Statistics — **${guild.name}**\n\n` +
            `${emoji.ticket} **Total Tickets:** ${serverStats.total}\n` +
            `${emoji.check} **Open Tickets:** ${serverStats.open} (${serverOpenPct}%)\n` +
            `${emoji.lock} **Closed Tickets:** ${serverStats.closed}\n` +
            `${emoji.starFill} **Rated Tickets:** ${serverStats.rated}\n` +
            `${emoji.logs} **Average Rating:** ${starBar(serverStats.avgRating)}`
          )
        )
        .setThumbnailAccessory((t) => t.setURL(guild.iconURL({ size: 256 }) || ctx.client.user.displayAvatarURL()))
    );

    container.addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
    );

    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `### 🌐 Global Network Statistics\n\n` +
        `${emoji.ticket} **Total Global Tickets:** ${globalStats.total}\n` +
        `${emoji.check} **Active Tickets:** ${globalStats.open} (${globalOpenPct}%)\n` +
        `${emoji.lock} **Resolved Tickets:** ${globalStats.closed}\n` +
        `${emoji.starFill} **Total Ratings Submitted:** ${globalStats.rated}\n` +
        `${emoji.dashboard} **System Network:** ${globalStats.totalGuilds} Guild(s) | ${globalStats.totalPanels} Panel(s)\n` +
        `${emoji.logs} **Global Avg Rating:** ${starBar(globalStats.avgRating)}\n\n` +
        `-# ${emoji.logs} All statistics are live from MongoDB database storage.`
      )
    );

    container.addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
    );

    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`-# © Titan X Development`)
    );

    return ctx.reply({
      components: [container],
      flags: TicketUI.getFlags(),
      allowedMentions: { parse: [] },
    });
  }
}

export default new StatsCommand();

/**
 * Copyright (c) 2025 Titan X Development
 * Code by Titan X Development
 * MIT License
 */
