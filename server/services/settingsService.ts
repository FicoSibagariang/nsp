import type { Db } from '../db';

export async function getPublicBranding(database: Db): Promise<{ koperasiName: string }> {
  const row = await database
    .query("SELECT value FROM settings WHERE key = 'koperasiName'")
    .get<{ value: string }>();
  return {
    koperasiName: row?.value?.trim() || 'Koperasi',
  };
}

export async function getAllSettings(database: Db): Promise<Record<string, string>> {
  const settingsArray = (await database.query("SELECT * FROM settings").all()) as {
    key: string;
    value: string;
  }[];

  const settingsObj: Record<string, string> = {};
  for (const s of settingsArray) {
    settingsObj[s.key] = s.value;
  }

  // Fallback to environment variables if not yet saved in database
  if (settingsObj.waNotificationEnabled === undefined && process.env.WA_NOTIFICATION_ENABLED !== undefined) {
    settingsObj.waNotificationEnabled = process.env.WA_NOTIFICATION_ENABLED;
  }
  if (!settingsObj.waWebhookUrl && process.env.WA_WEBHOOK_URL) {
    settingsObj.waWebhookUrl = process.env.WA_WEBHOOK_URL;
  }
  if (!settingsObj.waWebhookToken && process.env.WA_WEBHOOK_TOKEN) {
    settingsObj.waWebhookToken = process.env.WA_WEBHOOK_TOKEN;
  }
  if (!settingsObj.waNotificationTarget && process.env.WA_NOTIFICATION_TARGET) {
    settingsObj.waNotificationTarget = process.env.WA_NOTIFICATION_TARGET;
  }

  return settingsObj;
}

export async function updateAllSettings(
  database: Db,
  data: Record<string, unknown>
): Promise<{ beforeMap: Record<string, string>; afterMap: Record<string, string> }> {
  const currentSettings = (await database.query("SELECT * FROM settings").all()) as {
    key: string;
    value: string;
  }[];

  const beforeMap: Record<string, string> = {};
  for (const s of currentSettings) {
    beforeMap[s.key] = s.value;
  }

  const upsert = database.prepare(
    "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value"
  );

  const afterMap: Record<string, string> = {};
  await database.transaction(async () => {
    for (const [key, value] of Object.entries(data)) {
      const valStr = String(value);
      afterMap[key] = valStr;
      await upsert.run(key, valStr);
    }
  })();

  return { beforeMap, afterMap };
}
