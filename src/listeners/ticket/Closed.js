
import { logger } from "#utils/logger";
import TicketUI from "#bot/Interface";
import * as discordTranscripts from "discord-html-transcripts";
import { AttachmentBuilder, FileBuilder } from "discord.js";

export default {
  name: "ticketClosed",

  async execute({ eventArgs, client }) {
    const { ticketId, guildId, userId, closedBy, reason, channelId } = eventArgs[0];

    try {
      const guild = await client.guilds.fetch(guildId).catch(() => null);
      if (!guild) {
        logger.error("TicketClose", `Guild ${guildId} not found`);
        return;
      }

      const channel = await guild.channels.fetch(channelId).catch(() => null);
      if (!channel) {
        logger.error("TicketClose", `Channel ${channelId} not found`);
        return;
      }

      const ticket = await client.db.getTicket(ticketId);
      if (!ticket) {
        logger.error("TicketClose", `Ticket ${ticketId} not found`);
        return;
      }

      const panel = await client.db.getPanel(ticket.panelId);
      if (!panel) {
        logger.error("TicketClose", `Panel ${ticket.panelId} not found`);
        return;
      }

      const category = panel.categories.find(c => c.categoryId === ticket.categoryId);
      if (!category) {
        logger.error("TicketClose", `Category ${ticket.categoryId} not found`);
        return;
      }

      const controlMsgId = await client.db.getControlMessage(ticketId);
      if (controlMsgId) {
        const controlMsg = await channel.messages.fetch(controlMsgId).catch(() => null);
        if (controlMsg) {
          const closedContent = `## ${category.name}\n\n**Status:** Closed\n**Closed By:** <@${closedBy}>${reason ? `\n**Reason:** ${reason}` : ""}`;

          const container = TicketUI.buildTicketPanel(ticket, category, []);
          await controlMsg.edit({ 
            components: [container],
            flags: TicketUI.getFlags()
          });
        }
      }

      await channel.send({ 
        components: [TicketUI.buildRatingRequest(ticketId, userId)],
        flags: TicketUI.getFlags()
      });
      const discordUser = await client.users.fetch(userId).catch(() => null);
      await channel.permissionOverwrites.edit(discordUser, {
        SendMessages: false,
      }).catch(() => {});
      const addedUsers = await client.db.getAddedUsers(ticketId);
      for (const addedUser of addedUsers) {
        try {
          const user = await client.users.fetch(addedUser.userId)
          await channel.permissionOverwrites.edit(user, {
            SendMessages: false,
          });
        } catch (error) {
          logger.error("TicketClose", `Failed to remove permissions for user ${addedUser.userId}`, error);
        }
      }

      // Always DM the user with Ticket Closed info
      try {
        const user = await client.users.fetch(userId);
        await user.send({
          components: [TicketUI.buildDMCloseEmbed(guild, guildId, channelId, closedBy, reason)],
          flags: TicketUI.getFlags(),
        });
      } catch (e) {
        logger.debug("TicketClose", `Could not DM user ${userId}`);
      }

      // Generate transcript before locking down channel
      let transcriptBuffer = null;
      try {
        transcriptBuffer = await discordTranscripts.createTranscript(channel, {
          limit: -1,
          returnType: "buffer",
          saveImages: false,
          poweredBy: false,
        });
        if (transcriptBuffer.length > 5 * 1024 * 1024) transcriptBuffer = null;
      } catch (e) {
        logger.debug("TicketClose", "Could not generate transcript");
      }

      if (panel.logs?.closeChannel) {
        const logChannel = await guild.channels.fetch(panel.logs.closeChannel).catch(() => null);
        if (logChannel?.isTextBased()) {
          const files = [];
          const fileName = `transcript-${ticketId}.html`;
          if (transcriptBuffer) {
            files.push(new AttachmentBuilder(transcriptBuffer, { name: fileName }));
          }
          await logChannel.send({
            components: [TicketUI.buildLogEmbed("Ticket Closed", {
              User: `<@${userId}>`,
              "Closed By": `<@${closedBy}>`,
              Channel: `<#${channelId}>`,
              "Ticket ID": ticketId,
              ...(reason && { Reason: reason }),
              Transcript: transcriptBuffer ? `[View] attachment://${fileName}` : "Not available",
            })],
            files,
            flags: TicketUI.getFlags(),
            allowedMentions: { parse: [] }
          });
        }
      }

      logger.info("TicketClose", `Ticket ${ticketId} closed by ${closedBy}`);
    } catch (error) {
      logger.error("TicketClose", `Failed to close ticket ${ticketId}`, error);
    }
  },
};

/**
 * Copyright (c) 2025 Titan X Development
 * Code by Titan X Development
 * MIT License
 */
