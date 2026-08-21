
import {
  InteractionType,
  ContainerBuilder,
  TextDisplayBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
  SeparatorBuilder,
  SeparatorSpacingSize,
  SectionBuilder,
} from "discord.js";
import { config } from "#config/config";
import { logger } from "#utils/logger";
import { validateCommand } from "#utils/permissionHandler";
import { CommandContext } from "#classes/context";


async function _sendError(interaction, title, description, ephemeral = true) {
  const container = new ContainerBuilder()
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`**${title}**`),
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small),
    )
    .addSectionComponents(
      new SectionBuilder()
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(description),
        )
        .setButtonAccessory(
          new ButtonBuilder()
            .setLabel("Support")
            .setURL(config.links.supportServer)
            .setStyle(ButtonStyle.Link),
        ),
    );

  try {
    const flags = ephemeral
      ? MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
      : MessageFlags.IsComponentsV2;
    const reply = { components: [container], flags };

    if (interaction.deferred || interaction.replied) {
      await interaction.followUp(reply);
    } else {
      await interaction.reply(reply);
    }
  } catch (error) {
    logger.error("InteractionCreate", "Failed to send error reply.", error);
  }
}

function _getCommandFile(interaction, client) {
  const { commandName } = interaction;
  const subCommandGroup = interaction.options.getSubcommandGroup(false);
  const subCommandName = interaction.options.getSubcommand(false);

  if (subCommandGroup && subCommandName) {
    const fullKey = [commandName, subCommandGroup, subCommandName].join(":");
    const groupKey = [commandName, subCommandGroup].join(":");
    return (
      client.commandHandler.slashCommandFiles.get(fullKey) ||
      client.commandHandler.slashCommandFiles.get(groupKey) ||
      client.commandHandler.slashCommandFiles.get(commandName)
    );
  }

  if (subCommandName) {
    const key = [commandName, subCommandName].join(":");
    return (
      client.commandHandler.slashCommandFiles.get(key) ||
      client.commandHandler.slashCommandFiles.get(commandName)
    );
  }

  return client.commandHandler.slashCommandFiles.get(commandName);
}


async function _handleCooldown(interaction, command, client) {
  if (!command.cooldown) return { valid: true };

  const cooldown = client.commandHandler.isOnCooldown(
    command,
    interaction.user.id,
    interaction.guild.id,
  );

  if (cooldown) {
    const timestamp = Math.floor((Date.now() + cooldown) / 1000);
    return {
      valid: false,
      error: {
        title: "Cooldown",
        description: `This command is on cooldown. Please wait <t:${timestamp}:R>.\nPremium users and servers get half cooldowns.`,
      },
    };
  }

  await client.commandHandler.setCooldown(
    command,
    interaction.user.id,
    interaction.guild.id,
  );
  return { valid: true };
}

async function handleChatInputCommand(interaction, client) {
  if (!interaction.inGuild()) {
    return _sendError(
      interaction,
      "Server Only",
      "Commands can only be used in a server.",
    );
  }


  const commandToExecute = _getCommandFile(interaction, client);
  if (!commandToExecute) {
    logger.warn(
      "InteractionCreate",
      `No command file found for interaction: /${interaction.commandName}`,
    );
    return _sendError(
      interaction,
      "Command Error",
      "This command seems to be outdated or improperly configured.",
    );
  }

  

  const cooldownValidation = await _handleCooldown(
    interaction,
    commandToExecute,
    client,
  );
  if (!cooldownValidation.valid) {
    return _sendError(
      interaction,
      cooldownValidation.error.title,
      cooldownValidation.error.description,
    );
  }

  try {
    const ctx = new CommandContext({ client, interaction });
    const permissionValidation = await validateCommand(ctx, commandToExecute);

    if (!permissionValidation.valid) {
      return _sendError(
        interaction,
        permissionValidation.error.title,
        permissionValidation.error.description,
      );
    }

    await commandToExecute.execute({ ctx });
  } catch (error) {
    logger.error(
      "InteractionCreate",
      `Error executing slash command '${commandToExecute.slashData.name}'`,
      error,
    );
    await _sendError(
      interaction,
      "Command Error",
      "An unexpected error occurred while running the command.",
    );
  }
}

async function handleAutocomplete(interaction, client) {
  const commandToExecute = _getCommandFile(interaction, client);
  if (!commandToExecute || !commandToExecute.autocomplete) return;

  try {
    await commandToExecute.autocomplete({ interaction, client });
  } catch (error) {
    logger.error(
      "InteractionCreate",
      `Error handling autocomplete for '${interaction.commandName}'`,
      error,
    );
  }
}

export default {
  name: "interactionCreate",
  async execute({ eventArgs, client }) {
    const [interaction] = eventArgs;

    if (interaction.type === InteractionType.ApplicationCommand) {
      await handleChatInputCommand(interaction, client);
    } else if (
      interaction.type === InteractionType.ApplicationCommandAutocomplete
    ) {
      await handleAutocomplete(interaction, client);
    }
  },
};

/**
 * Copyright (c) 2025 Titan X Development
 * Code by Titan X Development
 * MIT License
 */
