import { NextResponse } from "next/server";
import { z } from "zod";

import { getImport } from "@/db/queries/imports";
import { getCurrentUser } from "@/lib/dal";
import { getDownloadUrl } from "@/lib/storage";

// Download an import's original file: check the session and ownership, then
// redirect to a signed storage URL that expires after a minute.
export async function GET(_request: Request, { params }: RouteContext<"/api/imports/[id]/file">) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return new NextResponse("Not found", { status: 404 });

  const found = await getImport(user.id, id);
  if (!found?.storageKey) return new NextResponse("Not found", { status: 404 });

  const url = await getDownloadUrl(found.storageKey, found.fileName);
  return NextResponse.redirect(url, { headers: { "Cache-Control": "private, no-store" } });
}
