// BullMQ queue for image generation. One queue, one job per panel.
// The worker process imports `panelQueueName` to attach to the same queue.

import { Queue } from "bullmq";
import IORedis from "ioredis";
import { env } from "./env";
import type { PanelId } from "./promptTemplate";

export const PANEL_QUEUE = "panel-generation";

let _connection: IORedis | null = null;
export function redisConnection(): IORedis {
  if (_connection) return _connection;
  _connection = new IORedis(env().REDIS_URL, {
    // BullMQ requires this to be null.
    maxRetriesPerRequest: null,
  });
  return _connection;
}

let _queue: Queue<PanelJobData> | null = null;
export function panelQueue(): Queue<PanelJobData> {
  if (_queue) return _queue;
  _queue = new Queue<PanelJobData>(PANEL_QUEUE, { connection: redisConnection() });
  return _queue;
}

export interface PanelJobData {
  jobId: string;
  panel: PanelId;
  /** Set by the API when enqueueing — saves a DB lookup in the worker. */
  userId: string;
}

// BullMQ rejects custom IDs containing ':' (it's their internal separator).
export function panelJobId(jobId: string, panel: PanelId): string {
  return `${jobId}__${panel}`;
}
