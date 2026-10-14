import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { env } from "@/env";

// Private object storage for original statement files and slips, through
// the S3 API: RustFS in Docker during development, Cloudflare R2 in
// production — only the S3_* settings differ. Objects are never public;
// downloads go through short-lived signed URLs after an ownership check.

const DOWNLOAD_URL_TTL_SECONDS = 60;

let client: S3Client | undefined;

function getClient(): { s3: S3Client; bucket: string } {
  if (!isStorageConfigured()) throw new Error("File storage is not configured");
  client ??= new S3Client({
    endpoint: env.S3_ENDPOINT,
    region: env.S3_REGION,
    forcePathStyle: env.S3_FORCE_PATH_STYLE,
    credentials: {
      accessKeyId: env.S3_ACCESS_KEY_ID!,
      secretAccessKey: env.S3_SECRET_ACCESS_KEY!,
    },
  });
  return { s3: client, bucket: env.S3_BUCKET! };
}

export function isStorageConfigured(): boolean {
  return Boolean(env.S3_ENDPOINT && env.S3_BUCKET && env.S3_ACCESS_KEY_ID && env.S3_SECRET_ACCESS_KEY);
}

/**
 * Object key for an import's original file. Ids only: file names can hold
 * personal details, so they stay in the database, not in storage paths.
 */
export function importFileKey(userId: string, importId: string, extension: string): string {
  return `users/${userId}/imports/${importId}.${extension}`;
}

export async function putFile(key: string, body: Uint8Array, contentType: string): Promise<void> {
  const { s3, bucket } = getClient();
  await s3.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: contentType }));
}

export async function deleteFile(key: string): Promise<void> {
  const { s3, bucket } = getClient();
  await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}

/** A download link valid for one minute. Call only after checking ownership. */
export function getDownloadUrl(key: string, fileName: string): Promise<string> {
  const { s3, bucket } = getClient();
  return getSignedUrl(
    s3,
    new GetObjectCommand({
      Bucket: bucket,
      Key: key,
      ResponseContentDisposition: `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
    }),
    { expiresIn: DOWNLOAD_URL_TTL_SECONDS },
  );
}

/** Create the bucket if it doesn't exist yet (used by the seed script). */
export async function ensureBucket(): Promise<"created" | "exists"> {
  const { s3, bucket } = getClient();
  try {
    await s3.send(new HeadBucketCommand({ Bucket: bucket }));
    return "exists";
  } catch {
    await s3.send(new CreateBucketCommand({ Bucket: bucket }));
    return "created";
  }
}
