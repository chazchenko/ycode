import { NextRequest, NextResponse } from 'next/server';
import { getMapboxAccessToken } from '@/lib/map-server';

const MAPBOX_GEOCODING_URL = 'https://api.mapbox.com/geocoding/v5/mapbox.places';

/**
 * GET /ycode/api/maps/geocode?q=<search>
 *
 * Proxies geocoding requests to the Mapbox Geocoding API.
 * Returns an array of results with place_name and center coordinates.
 */
export async function GET(request: NextRequest) {
  try {
    const query = request.nextUrl.searchParams.get('q');

    if (!query || query.length < 2) {
      return NextResponse.json(
        { error: 'Query must be at least 2 characters' },
        { status: 400 }
      );
    }

    const accessToken = await getMapboxAccessToken();

    if (!accessToken) {
      return NextResponse.json(
        { error: 'Mapbox access token not configured' },
        { status: 400 }
      );
    }

    const url = `${MAPBOX_GEOCODING_URL}/${encodeURIComponent(query)}.json?access_token=${accessToken}&limit=5&types=place,address,poi`;
    const response = await fetch(url);

    if (!response.ok) {
      return NextResponse.json(
        { error: 'Geocoding request failed' },
        { status: 502 }
      );
    }

    const data = await response.json();
    const results = (data.features || []).map((feature: { place_name: string; center: [number, number] }) => ({
      place_name: feature.place_name,
      center: feature.center,
    }));

    return NextResponse.json({ data: results });
  } catch (error) {
    console.error('Geocoding error:', error);
    return NextResponse.json(
      { error: 'Failed to geocode address' },
      { status: 500 }
    );
  }
}
