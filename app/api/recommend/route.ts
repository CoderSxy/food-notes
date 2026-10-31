import { privateJson } from "@/lib/http";
import { requireUser } from "@/lib/auth/requestUser";
import { nearbySchema } from "@/lib/validations/food";
import { nearbyPlaceEntries } from "@/lib/entries";
import {
  chatCompletion,
  buildMessages,
  parseRecommendations,
} from "@/lib/ai/client";
import { apiError } from "@/lib/http";
export const maxDuration = 30;
export async function POST(req: Request) {
  try {
    await requireUser(req);
    const input = nearbySchema.parse(await req.json());
    const foods = await nearbyPlaceEntries(input, input.radiusKm);
    if (!foods.length)
      return privateJson({
        recommendations: [],
        message: "附近暂无足够样本，先去登记几家美食吧",
      });
    const recommendations = parseRecommendations(
      await chatCompletion(buildMessages(input, foods.slice(0, 30))),
      foods.slice(0, 30),
    );
    return privateJson({
      recommendations,
      message: recommendations.length
        ? ""
        : "暂时没有合适的推荐，可以扩大范围或登记更多美食",
    });
  } catch (e) {
    return apiError(e);
  }
}

export const dynamic = "force-dynamic";
