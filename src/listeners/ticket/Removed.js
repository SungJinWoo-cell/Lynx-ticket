
import { ContainerBuilder, TextDisplayBuilder } from "discord.js";
import { logger } from "#utils/logger";
import TicketUI from "#bot/Interface";
import { emoji } from "#config/emoji";

export default {
  name: "ticketUserRemoved",

  async execute({ eventArgs, client }) {
    const { ticketId, guildId, userId, removedBy, channelId } = eventArgs[0];

    try {
      const guild = await client.guilds.fetch(guildId).catch(() => null);
      if (!guild) {
        logger.error("TicketUserRemove", `Guild ${guildId} not found`);
        return;
      }

      const channel = await guild.channels.fetch(channelId).catch(() => null);
      if (!channel) {
        logger.error("TicketUserRemove", `Channel ${channelId} not found`);
        return;
      }

      const ticket = await client.db.getTicket(ticketId);
      if (!ticket) {
        logger.error("TicketUserRemove", `Ticket ${ticketId} not found`);
        return;
      }

      const panel = await client.db.getPanel(ticket.panelId);
      if (!panel) {
        logger.error("TicketUserRemove", `Panel ${ticket.panelId} not found`);
        return;
      }

      const category = panel.categories.find(c => c.categoryId === ticket.categoryId);
      if (!category) {
        logger.error("TicketUserRemove", `Category ${ticket.categoryId} not found`);
        return;
      }

      await channel.permissionOverwrites.delete(userId).catch(() => {});

      const removeContainer = new ContainerBuilder();
      removeContainer.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`## ${emoji.remove} User Removed\n\n<@${userId}> has been removed from this ticket by <@${removedBy}>`)
      );

      await channel.send({
        components: [removeContainer],
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

      if (panel.logs?.userRemoveChannel) {
        const logChannel = await guild.channels.fetch(panel.logs.userRemoveChannel).catch(() => null);
        if (logChannel?.isTextBased()) {
          await logChannel.send({
            components: [TicketUI.buildLogEmbed("User Removed from Ticket", {
              User: `<@${userId}>`,
              "Removed By": `<@${removedBy}>`,
              Channel: `<#${channelId}>`,
              "Ticket ID": ticketId,
            })],
            flags: TicketUI.getFlags(),
            allowedMentions: { parse: [] }
          });
        }
      }

      logger.info("TicketUserRemove", `User ${userId} removed from ticket ${ticketId}`);
    } catch (error) {
      logger.error("TicketUserRemove", `Failed to remove user ${userId} from ticket ${ticketId}`, error);
    }
  },
};

/**
 * Copyright (c) 2025 Titan X Development
 * Code by Titan X Development
 * MIT License
 */
