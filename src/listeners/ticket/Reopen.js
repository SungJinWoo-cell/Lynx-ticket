
import { logger } from "#utils/logger";
import TicketUI from "#bot/Interface";

export default {
  name: "ticketReopened",

  async execute({ eventArgs, client }) {
    const { ticketId, guildId, userId, channelId } = eventArgs[0];

    try {
      const guild = await client.guilds.fetch(guildId).catch(() => null);
      if (!guild) {
        logger.error("TicketReopen", `Guild ${guildId} not found`);
        return;
      }

      const channel = await guild.channels.fetch(channelId).catch(() => null);
      if (!channel) {
        logger.error("TicketReopen", `Channel ${channelId} not found`);
        return;
      }

      const ticket = await client.db.getTicket(ticketId);
      if (!ticket) {
        logger.error("TicketReopen", `Ticket ${ticketId} not found`);
        return;
      }

      const panel = await client.db.getPanel(ticket.panelId);
      if (!panel) {
        logger.error("TicketReopen", `Panel ${ticket.panelId} not found`);
        return;
      }

      const category = panel.categories.find(c => c.categoryId === ticket.categoryId);
      if (!category) {
        logger.error("TicketReopen", `Category ${ticket.categoryId} not found`);
        return;
      }

      const addedUsers = await client.db.getAddedUsers(ticketId);
      const enrichedUsers = [];

      for (const addedUser of addedUsers) {
        const user = await client.users.fetch(addedUser.userId).catch(() => null);
        const addedByUser = await client.users.fetch(addedUser.addedBy).catch(() => null);
        enrichedUsers.push({
          userId: addedUser.userId,
          username: user?.username || `User ${addedUser.userId}`,
          addedByUsername: addedByUser?.username || 'Unknown',
        });
      }

      const controlMsgId = await client.db.getControlMessage(ticketId);
      if (controlMsgId) {
        const controlMsg = await channel.messages.fetch(controlMsgId).catch(() => null);
        if (controlMsg) {
          await controlMsg.edit({ 
            components: [TicketUI.buildTicketPanel(ticket, category, enrichedUsers)],
            flags: TicketUI.getFlags()
          });
        }
      }
  const owner = await client.users.fetch(userId)
      await channel.permissionOverwrites.edit(owner, {
        SendMessages: true,
      }).catch(() => {});
      
      const addedUsersToEdit = await client.db.getAddedUsers(ticketId);
      for (const addedUser of addedUsersToEdit) {
        try {
          const user = await client.users.fetch(addedUser.userId)
          await channel.permissionOverwrites.edit(user, {
            SendMessages: false,
          });
        } catch (error) {
          logger.error("TicketClose", `Failed to remove permissions for user ${addedUser.userId}`, error);
        }
      }
      await channel.send({
        components: [TicketUI.buildSuccess("Ticket Reopened", "This ticket has been reopened and is now active.")],
        flags: TicketUI.getFlags()
      });

      if (panel.logs?.createChannel) {
        const logChannel = await guild.channels.fetch(panel.logs.createChannel).catch(() => null);
        if (logChannel?.isTextBased()) {
          await logChannel.send({
            components: [TicketUI.buildLogEmbed("Ticket Reopened", {
              User: `<@${userId}>`,
              Channel: `<#${channelId}>`,
              "Ticket ID": ticketId,
            })],
            flags: TicketUI.getFlags(),
            allowedMentions: { parse: [] }
          });
        }
      }

      logger.info("TicketReopen", `Ticket ${ticketId} reopened`);
    } catch (error) {
      logger.error("TicketReopen", `Failed to reopen ticket ${ticketId}`, error);
    }
  },
};

/**
 * Copyright (c) 2025 Titan X Development
 * Code by Titan X Development
 * MIT License
 */
