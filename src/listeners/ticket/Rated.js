
import { logger } from "#utils/logger";
import TicketUI from "#bot/Interface";
import { emoji } from "#config/emoji";

export default {
  name: "ticketRated",

  async execute({ eventArgs, client }) {
    const { ticketId, guildId, userId, stars, feedback, channelId } = eventArgs[0];

    try {
      const guild = await client.guilds.fetch(guildId).catch(() => null);
      if (!guild) {
        logger.error("TicketRated", `Guild ${guildId} not found`);
        return;
      }

      const ticket = await client.db.getTicket(ticketId);
      if (!ticket) {
        logger.error("TicketRated", `Ticket ${ticketId} not found`);
        return;
      }

      const panel = await client.db.getPanel(ticket.panelId);
      if (!panel) {
        logger.error("TicketRated", `Panel ${ticket.panelId} not found`);
        return;
      }

      const category = panel.categories.find(c => c.categoryId === ticket.categoryId);
      if (!category) {
        logger.error("TicketRated", `Category ${ticket.categoryId} not found`);
        return;
      }

      if (panel.logs?.ratingChannel) {
        const logChannel = await guild.channels.fetch(panel.logs.ratingChannel).catch(() => null);
        if (logChannel?.isTextBased()) {
          const starsDisplay = emoji.starFill.repeat(stars) + emoji.starEmpty.repeat(5 - stars);

          const logData = {
            User: `<@${userId}>`,
            Category: category.name,
            Channel: `<#${channelId}>`,
            Rating: `${starsDisplay} (${stars}/5)`,
            "Ticket ID": ticketId,
          };

          if (feedback) {
            logData.Feedback = feedback;
          }

          await logChannel.send({
            components: [TicketUI.buildLogEmbed("Ticket Rated", logData)],
            flags: TicketUI.getFlags(),
            allowedMentions: { parse: [] }
          });
        }
      }

      logger.info("TicketRated", `Ticket ${ticketId} rated ${stars} stars`);
    } catch (error) {
      logger.error("TicketRated", `Failed to log rating for ticket ${ticketId}`, error);
    }
  },
};

/**
 * Copyright (c) 2025 Titan X Development
 * Code by Titan X Development
 * MIT License
 */
