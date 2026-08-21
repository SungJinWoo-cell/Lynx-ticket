
import { logger } from "#utils/logger";
import TicketUI from "#bot/Interface";
import * as discordTranscripts from "discord-html-transcripts";
import {
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  FileBuilder,
  AttachmentBuilder,
} from "discord.js";

export default {
  name: "ticketDeleted",

  async execute({ eventArgs, client }) {
    const { ticketId, guildId, userId, channelId } = eventArgs[0];

    try {
      const guild = await client.guilds.fetch(guildId).catch(() => null);
      if (!guild) {
        logger.error("TicketDeleted", `Guild ${guildId} not found`);
        return;
      }

      const panel = await client.db
        .getGuildPanels(guildId)
        .then((panels) => panels[0]);
      const channel = await guild.channels.fetch(channelId).catch(() => null);

      let transcriptBuffer = null;
      const MAX_SIZE = 5 * 1024 * 1024;

      if (channel?.isTextBased()) {
        try {
          transcriptBuffer = await discordTranscripts.createTranscript(
            channel,
            {
              limit: -1,
              returnType: "buffer",
              saveImages: false,
              poweredBy: false,
            }
          );

          if (transcriptBuffer.length > MAX_SIZE) {
            transcriptBuffer = null;
          }
        } catch (error) {
          logger.error(
            "TicketDeleted",
            `Failed to create transcript for ticket ${ticketId}`,
            error
          );
        }

        await channel.delete("Ticket deleted from database").catch(() => {});
      }

      const logChannel = await guild.channels
        .fetch(panel.logs.deleteChannel)
        .catch(() => null);

      if (logChannel?.isTextBased()) {
        const container = new ContainerBuilder();

        container.addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            `## Ticket Deleted\n\n**User:** <@${userId}>\n**Channel:** <#${channelId}>\n**Ticket ID:** ${ticketId}\n**Timestamp:** <t:${Math.floor(Date.now() / 1000)}:F>\n\n**Transcript:** || images are broken|| `
          )
        );

        container.addSeparatorComponents(
          new SeparatorBuilder()
            .setSpacing(SeparatorSpacingSize.Small)
            .setDivider(true)
        );

        const files = [];

        if (transcriptBuffer) {
          const fileName = `ticket-${ticketId}-transcript.html`;
          const attachment = new AttachmentBuilder(transcriptBuffer, {
            name: fileName,
          });
          files.push(attachment);

          container.addFileComponents(
            new FileBuilder().setURL(`attachment://${fileName}`)
          );
        }

        await logChannel.send({
          components: [container],
          files: files,
          flags: TicketUI.getFlags(),
          allowedMentions: { parse: [] },
        });
      }

      logger.info(
        "TicketDeleted",
        `Ticket ${ticketId} and channel ${channelId} deleted`
      );
    } catch (error) {
      logger.error(
        "TicketDeleted",
        `Failed to delete channel for ticket ${ticketId}`,
        error
      );
    }
  },
};
// toast powered code

/**
 * Copyright (c) 2025 Titan X Development
 * Code by Titan X Development
 * MIT License
 */
