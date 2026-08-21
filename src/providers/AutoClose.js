
import { logger } from "#utils/logger";
import { emoji } from "#config/emoji";
import {
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
} from "discord.js";
import TicketUI from "#bot/Interface";

const AUTO_CLOSE_HOURS = 24; // default: close after 24h of inactivity
const CHECK_INTERVAL_MS = 5 * 60 * 1000; // check every 5 minutes

export function startAutoCloseWorker(client) {
  const run = async () => {
    try {
      const tickets = await client.db.getTicketsForAutoClose();
      if (tickets.length === 0) return;

      logger.info("AutoClose", `Found ${tickets.length} ticket(s) to auto-close`);

      for (const ticket of tickets) {
        try {
          const guild = await client.guilds.fetch(ticket.guildId).catch(() => null);
          if (!guild) continue;

          const channel = await guild.channels.fetch(ticket.channelId).catch(() => null);

          if (channel?.isTextBased()) {
            const container = new ContainerBuilder();
            container.addTextDisplayComponents(
              new TextDisplayBuilder().setContent(
                `## ${emoji.timer} Ticket Auto-Closed\n\n` +
                `This ticket has been automatically closed due to **${AUTO_CLOSE_HOURS} hours of inactivity**.\n\n` +
                `-# Use \`.reopen\` if you still need assistance.`
              )
            );
            await channel.send({
              components: [container],
              flags: TicketUI.getFlags(),
            }).catch(() => {});
          }

          // Emit the close event via the database
          await client.db.closeTicket(ticket.ticketId, client.user.id, "Auto-closed due to inactivity");

          logger.info("AutoClose", `Auto-closed ticket ${ticket.ticketId}`);
        } catch (err) {
          logger.error("AutoClose", `Failed to auto-close ticket ${ticket.ticketId}`, err);
        }
      }
    } catch (err) {
      logger.error("AutoClose", "Worker run failed", err);
    }
  };

  // Initial run, then schedule
  setTimeout(run, 30_000); // 30s after startup
  setInterval(run, CHECK_INTERVAL_MS);
}

/**
 * Schedule a ticket for auto-close based on last activity
 * @param {object} client
 * @param {string} ticketId
 * @param {number} hours - hours of inactivity before closing
 */
export async function scheduleAutoClose(client, ticketId, hours = AUTO_CLOSE_HOURS) {
  const closeAt = new Date(Date.now() + hours * 60 * 60 * 1000);
  await client.db.setAutoClose(ticketId, closeAt);
  logger.debug("AutoClose", `Ticket ${ticketId} scheduled to auto-close at ${closeAt.toISOString()}`);
}

/**
 * Copyright (c) 2025 Titan X Development
 * Code by Titan X Development
 * MIT License
 */
