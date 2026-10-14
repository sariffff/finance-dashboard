import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import { deleteFile, ensureBucket, getDownloadUrl, importFileKey, isStorageConfigured, putFile } from "./storage";

// Integration test against the S3-compatible storage in docker compose
// (RustFS). Skipped when S3_* isn't configured.

describe.runIf(isStorageConfigured())("file storage", () => {
  it("stores a private file that is only reachable through a signed URL", async () => {
    await ensureBucket();
    const key = importFileKey(randomUUID(), randomUUID(), "pdf");
    const content = new TextEncoder().encode("%PDF-1.7 test file");

    await putFile(key, content, "application/pdf");

    const url = await getDownloadUrl(key, "statement กันยายน.pdf");
    const signed = await fetch(url);
    expect(signed.status).toBe(200);
    expect(signed.headers.get("content-disposition")).toContain("attachment");
    expect(new Uint8Array(await signed.arrayBuffer())).toEqual(content);

    // The same object without a signature is refused.
    const unsigned = await fetch(url.split("?")[0]);
    expect(unsigned.ok).toBe(false);

    await deleteFile(key);
    expect((await fetch(await getDownloadUrl(key, "x.pdf"))).status).toBe(404);
  });

  it("keeps personal file names out of storage paths", () => {
    expect(importFileKey("user-1", "import-1", "pdf")).toBe("users/user-1/imports/import-1.pdf");
  });
});
