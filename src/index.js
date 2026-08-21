
import { Bot } from "#classes/client";
import { logger } from "#utils/logger";

process.removeAllListeners("warning");
process.on("warning", (warning) => {
  if (
    warning.name === "DeprecationWarning" &&
    warning.message.includes("ready event has been renamed to clientReady")
  ) {
    return;
  }
  console.warn(warning);
});

const client = new Bot();

const main = async () => {
  try {
    await client.init();
  } catch (error) {
    logger.error("Main", "Failed to initialize Discord bot", error);
    process.exit(1);
  }
};

const shutdown = async (signal) => {
  logger.info("Shutdown", `Received ${signal}, shutting down gracefully...`);
  try {
    await client.cleanup();
    logger.success("Shutdown", "Bot shut down successfully");
    process.exit(0);
  } catch (error) {
    logger.error("Shutdown", "Error during shutdown", error);
    process.exit(1);
  }
};

process.on("unhandledRejection", (reason, promise) => {
  logger.error("Process", "Unhandled Rejection", reason);
  logger.error(promise);
});

process.on("uncaughtException", (error, origin) => {
  logger.error("Process", `Uncaught Exception: ${origin}`, error);
});

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

main();

export { client };

/**
 * Copyright (c) 2025 Titan X Development
 * Code by Titan X Development
 * MIT License
 */
