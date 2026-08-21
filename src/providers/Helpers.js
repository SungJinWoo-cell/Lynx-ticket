
import { ButtonStyle, ComponentType, MessageFlags } from "discord.js";
import { logger } from "#utils/logger";
import { config } from "#config/config";
export class Utils {
  constructor(client) {
    this.client = client;
  }

  sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }


  async disableComponents(msg) {
    try {
      if (!msg?.components?.length) return;

      const disabled = msg.components.map((c) => {
        const j = c.toJSON();

        if (c.type === ComponentType.ActionRow) {
          j.components = c.components.map((s) => {
            const sj = s.toJSON();
            return sj.type === ComponentType.Button &&
              sj.style === ButtonStyle.Link
              ? sj
              : { ...sj, disabled: true };
          });
        } else if (
          [ComponentType.Container, ComponentType.Section].includes(c.type)
        ) {
          j.components = this._disableNested(c.components);

          if (c.accessory?.type === ComponentType.Button) {
            const aj = c.accessory.toJSON();
            j.accessory =
              aj.style === ButtonStyle.Link ? aj : { ...aj, disabled: true };
          }
        }

        return j;
      });

      await msg.edit({
        components: disabled,
        flags: MessageFlags.IsComponentsV2,
      });
    } catch (err) {
      if (![10008, 10003, 50001].includes(err.code)) {
        logger.error("Utils", "disableComponents error", err);
      }
    }
  }

  _disableNested(comps) {
    return comps.map((c) => {
      const j = c.toJSON();

      if (c.type === ComponentType.ActionRow) {
        j.components = c.components.map((s) => {
          const sj = s.toJSON();
          return sj.type === ComponentType.Button &&
            sj.style === ButtonStyle.Link
            ? sj
            : { ...sj, disabled: true };
        });
      } else if (
        [ComponentType.Container, ComponentType.Section].includes(c.type)
      ) {
        j.components = this._disableNested(c.components);

        if (c.accessory?.type === ComponentType.Button) {
          const aj = c.accessory.toJSON();
          j.accessory =
            aj.style === ButtonStyle.Link ? aj : { ...aj, disabled: true };
        }
      }

      return j;
    });
  }
}

let utilsInstance = null;

export function createUtils(client) {
  if (!utilsInstance) {
    utilsInstance = new Utils(client);
  }
  return utilsInstance;
}

export const utils = {
  get instance() {
    if (!utilsInstance) {
      throw new Error("Utils not initialized. Call createUtils(client) first.");
    }
    return utilsInstance;
  },
};

/**
 * Copyright (c) 2025 Titan X Development
 * Code by Titan X Development
 * MIT License
 */
