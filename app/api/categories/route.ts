import { privateJson } from "@/lib/http";
import { z } from "zod";
import { requireUser } from "@/lib/auth/requestUser";
import { listRootCategories, listChildCategories } from "@/lib/categories";
import { apiError } from "@/lib/http";
export async function GET(req: Request) {
  try {
    await requireUser(req);
    const parent = new URL(req.url).searchParams.get("parent_id");
    const categories =
      parent === null
        ? await listRootCategories()
        : await listChildCategories(z.uuid().parse(parent));
    return privateJson({ categories });
  } catch (error) {
    return apiError(error);
  }
}

export const dynamic = "force-dynamic";
