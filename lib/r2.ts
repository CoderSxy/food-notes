import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { z } from "zod";
import { HttpError } from "@/lib/http";

const r2Schema = z.object({
  R2_ACCOUNT_ID: z.string().min(1),
  R2_ACCESS_KEY_ID: z.string().min(1),
  R2_SECRET_ACCESS_KEY: z.string().min(1),
  R2_BUCKET: z.string().min(1),
  R2_PUBLIC_BASE_URL: z.string().min(1),
  R2_ENDPOINT: z.string().min(1).optional(),
});

export type R2Config = {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  publicBaseUrl: string;
  endpoint: string;
};

function readR2Env() {
  return r2Schema.safeParse(process.env);
}

export function isR2Configured(): boolean {
  return readR2Env().success;
}

export function getR2Config(): R2Config {
  const parsed = readR2Env();
  if (!parsed.success) throw new HttpError("图片存储未配置", 503);
  const env = parsed.data;
  return {
    accountId: env.R2_ACCOUNT_ID,
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    bucket: env.R2_BUCKET,
    publicBaseUrl: env.R2_PUBLIC_BASE_URL,
    endpoint:
      env.R2_ENDPOINT ||
      `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  };
}

let cached: { key: string; client: S3Client } | null = null;

function getClient() {
  const cfg = getR2Config();
  const key = `${cfg.endpoint}|${cfg.accessKeyId}|${cfg.bucket}`;
  if (cached?.key === key) return { client: cached.client, cfg };
  const client = new S3Client({
    region: "auto",
    endpoint: cfg.endpoint,
    credentials: {
      accessKeyId: cfg.accessKeyId,
      secretAccessKey: cfg.secretAccessKey,
    },
    forcePathStyle: false,
  });
  cached = { key, client };
  return { client, cfg };
}

export function publicUrlForKey(key: string): string {
  const base = getR2Config().publicBaseUrl.replace(/\/$/, "");
  return `${base}/${key}`;
}

export async function presignPutObject(
  key: string,
  contentType: string,
  expiresIn = 300,
): Promise<string> {
  const { client, cfg } = getClient();
  return getSignedUrl(
    client,
    new PutObjectCommand({
      Bucket: cfg.bucket,
      Key: key,
      ContentType: contentType,
    }),
    { expiresIn },
  );
}

export async function deleteR2Object(key: string): Promise<void> {
  if (!isR2Configured()) return;
  try {
    const { client, cfg } = getClient();
    await client.send(
      new DeleteObjectCommand({ Bucket: cfg.bucket, Key: key }),
    );
  } catch (error) {
    console.error("[deleteR2Object]", error);
  }
}
