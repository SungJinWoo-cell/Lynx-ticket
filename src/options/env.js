
import dotenv from "dotenv";
dotenv.config();


export const config = {
  token: process.env.TOKEN || process.env.token || "",
  clientId: process.env.CLIENT_ID || process.env.clientId || "",
  prefix: process.env.PREFIX || ".",

  environment: process.env.NODE_ENV || "development",
  database: {
    url: process.env.MONGO_URI || process.env.mongoURI || "",
  },
  debug: true,
  
  links: {
    supportServer: "https://discord.gg/TEpxUwQwaC",
    invite:
      "https://discord.com/api/oauth2/authorize?client_id=1505154157928251393&permissions=8&scope=bot",
  },

  watermark: "© Titan X Development",
  version: "2.0.0",
};

/**
 * Copyright (c) 2025 Titan X Development
 * Code by Titan X Development
 * MIT License
 */
