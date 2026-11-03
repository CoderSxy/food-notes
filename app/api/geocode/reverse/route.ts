import { requireUser } from "@/lib/auth/requestUser";
import { reverseGeocodeNominatim } from "@/lib/geocode/nominatim";
import { apiError, HttpError, privateJson } from "@/lib/http";

export async function GET(req: Request) {
  try {
    await requireUser(req);
    const params = new URL(req.url).searchParams;
    const latRaw = params.get("lat");
    const lngRaw = params.get("lng");
    const lat = Number(latRaw);
    const lng = Number(lngRaw);
    if (
      latRaw === null ||
      lngRaw === null ||
      latRaw.trim() === "" ||
      lngRaw.trim() === "" ||
      !Number.isFinite(lat) ||
      !Number.isFinite(lng) ||
      lat < -90 ||
      lat > 90 ||
      lng < -180 ||
      lng > 180
    ) {
      throw new HttpError("请提供有效的经纬度", 400);
    }
    return privateJson(await reverseGeocodeNominatim(lat, lng));
  } catch (error) {
    return apiError(error);
  }
}

export const dynamic = "force-dynamic";
