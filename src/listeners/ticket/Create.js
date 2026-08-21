
import { ChannelType, PermissionFlagsBits, ButtonBuilder, ButtonStyle, ActionRowBuilder, ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize } from "discord.js";
import { logger } from "#utils/logger";
import TicketUI from "#bot/Interface";
import { emoji } from "#config/emoji";

export default {
  name: "ticketCreated",

  async execute({ eventArgs, client }) {
    const { ticketId, guildId, panelId, categoryId, userId } = eventArgs[0];

    try {
      const isBlacklisted = await client.db.isUserBlacklisted(guildId, userId);
      if (isBlacklisted) {
        logger.warn("TicketCreate", `Blacklisted user ${userId} attempted to create ticket`);
        return;
      }

      const guild = await client.guilds.fetch(guildId).catch(() => null);
      if (!guild) {
        logger.error("TicketCreate", `Guild ${guildId} not found`);
        return;
      }

      const panel = await client.db.getPanel(panelId);
      if (!panel) {
        logger.error("TicketCreate", `Panel ${panelId} not found`);
        return;
      }

      const category = panel.categories.find(c => c.categoryId === categoryId);
      if (!category) {
        logger.error("TicketCreate", `Category ${categoryId} not found`);
        return;
      }

      const user = await client.users.fetch(userId).catch(() => null);
      if (!user) {
        logger.error("TicketCreate", `User ${userId} not found`);
        return;
      }

      const userTickets = await client.db.getUserCategoryOpenTickets(guildId, userId, categoryId);
      const ticketNumber = userTickets.length;

      const channelName = category.namingFormat
        .replace("{username}", user.username.toLowerCase().replace(/[^a-z0-9]/g, ""))
        .replace("{number}", ticketNumber.toString().padStart(3, '0'));

      const permissionOverwrites = [
        {
          id: guild.id,
          deny: [PermissionFlagsBits.ViewChannel],
        },
        {
          id: userId,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory,
            PermissionFlagsBits.AttachFiles,
            PermissionFlagsBits.EmbedLinks,
          ],
        },
        {
          id: client.user.id,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ManageChannels,
            PermissionFlagsBits.ManageMessages,
          ],
        },
      ];

      for (const roleId of category.supportRoles || []) {
        const role = await guild.roles.fetch(roleId).catch(() => null);
        if (role) {
          permissionOverwrites.push({
            id: roleId,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.ReadMessageHistory,
              PermissionFlagsBits.AttachFiles,
              PermissionFlagsBits.EmbedLinks,
            ],
          });
        }
      }

      const channel = await guild.channels.create({
        name: channelName,
        type: ChannelType.GuildText,
        parent: category.ticketChannelCategory || null,
        permissionOverwrites,
        topic: `Ticket #${ticketId} | User: ${user.tag}`,
      });

      await client.db.setTicketChannel(ticketId, channel.id);

      let pingContent = "";
      if (category.settings.pingUser) pingContent += `<@${userId}> `;
      if (category.settings.pingRole && category.supportRoles?.length > 0) {
        pingContent += category.supportRoles.map(r => `<@&${r}>`).join(" ");
      }

      if (pingContent) {
        await channel.send({ content: pingContent });
      }

      const ticket = await client.db.getTicket(ticketId);
      const controlMsg = await channel.send({ 
        components: [TicketUI.buildTicketPanel(ticket, category, [])],
        flags: TicketUI.getFlags()
      });

      await controlMsg.pin().catch(() => {});
      await client.db.setTicketControlMessage(ticketId, controlMsg.id);

      // Edit the original ephemeral reply (only visible to ticket creator) with the channel link
      const pendingKey = `${guildId}_${userId}`;
      const pendingInteraction = client.pendingTicketInteractions?.get(pendingKey);
      if (pendingInteraction) {
        client.pendingTicketInteractions.delete(pendingKey);
        try {
          const jumpContainer = new ContainerBuilder();
          jumpContainer.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              `## ${emoji.ticket} Ticket Created!\n\n` +
              `Your ticket has been created successfully in <#${channel.id}>\n\n` +
              `-# Click the button below to jump directly to your ticket.`
            )
          );
          jumpContainer.addActionRowComponents(
            new ActionRowBuilder().addComponents(
              new ButtonBuilder()
                .setLabel("🎫 Go to Ticket")
                .setStyle(ButtonStyle.Link)
                .setURL(`https://discord.com/channels/${guildId}/${channel.id}`)
            )
          );
          await pendingInteraction.editReply({
            components: [jumpContainer],
            flags: TicketUI.getFlags(),
          });
        } catch (e) {
          logger.debug("TicketCreate", `Could not edit reply for user ${userId}: ${e.message}`);
        }
      }

      // Always DM the user with Ticket Created info
      try {
        await user.send({
          components: [TicketUI.buildDMOpenEmbed(guild, channel, category)],
          flags: TicketUI.getFlags(),
        });
      } catch (e) {
        logger.debug("TicketCreate", `Could not DM user ${userId}`);
      }

      if (panel.logs?.createChannel) {
        const logChannel = await guild.channels.fetch(panel.logs.createChannel).catch(() => null);
        if (logChannel?.isTextBased()) {
          await logChannel.send({
            components: [TicketUI.buildLogEmbed("Ticket Created", {
              User: `<@${userId}>`,
              Category: category.name,
              Channel: `<#${channel.id}>`,
              "Ticket ID": ticketId,
            })],
            flags: TicketUI.getFlags(),
            allowedMentions: { parse: [] }
          });
        }
      }

      logger.info("TicketCreate", `Ticket ${ticketId} created in ${channel.id}`);
    } catch (error) {
      logger.error("TicketCreate", `Failed to create ticket ${ticketId}`, error);
    }
  },
};

/**
 * Copyright (c) 2025 Titan X Development
 * Code by Titan X Development
 * MIT License
 */
