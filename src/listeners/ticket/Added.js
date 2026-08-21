
import { PermissionFlagsBits } from "discord.js";
import { logger } from "#utils/logger";
import TicketUI from "#bot/Interface";

export default {
  name: "ticketUserAdded",

  async execute({ eventArgs, client }) {
    const { ticketId, guildId, userId, addedBy, channelId } = eventArgs[0];

    try {
      const guild = await client.guilds.fetch(guildId).catch(() => null);
      if (!guild) {
        logger.error("TicketUserAdd", `Guild ${guildId} not found`);
        return;
      }

      const channel = await guild.channels.fetch(channelId).catch(() => null);
      if (!channel) {
        logger.error("TicketUserAdd", `Channel ${channelId} not found`);
        return;
      }

      const ticket = await client.db.getTicket(ticketId);
      if (!ticket) {
        logger.error("TicketUserAdd", `Ticket ${ticketId} not found`);
        return;
      }

      const panel = await client.db.getPanel(ticket.panelId);
      if (!panel) {
        logger.error("TicketUserAdd", `Panel ${ticket.panelId} not found`);
        return;
      }

      const category = panel.categories.find(c => c.categoryId === ticket.categoryId);
      if (!category) {
        logger.error("TicketUserAdd", `Category ${ticket.categoryId} not found`);
        return;
      }

      await channel.permissionOverwrites.edit(userId, {
        ViewChannel: true,
        SendMessages: true,
        ReadMessageHistory: true,
        AttachFiles: true,
        EmbedLinks: true,
      }).catch(() => {});

      await channel.send({
        components: [TicketUI.buildSuccess("User Added", `<@${userId}> has been added to this ticket by <@${addedBy}>`)],
        flags: TicketUI.getFlags()
      });

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

      if (panel.logs?.userAddChannel) {
        const logChannel = await guild.channels.fetch(panel.logs.userAddChannel).catch(() => null);
        if (logChannel?.isTextBased()) {
          await logChannel.send({
            components: [TicketUI.buildLogEmbed("User Added to Ticket", {
              User: `<@${userId}>`,
              "Added By": `<@${addedBy}>`,
              Channel: `<#${channelId}>`,
              "Ticket ID": ticketId,
            })],
            flags: TicketUI.getFlags(),
            allowedMentions: { parse: [] }
            
          });
        }
      }

      logger.info("TicketUserAdd", `User ${userId} added to ticket ${ticketId}`);
    } catch (error) {
      logger.error("TicketUserAdd", `Failed to add user ${userId} to ticket ${ticketId}`, error);
    }
  },
};

/**
 * Copyright (c) 2025 Titan X Development
 * Code by Titan X Development
 * MIT License
 */
