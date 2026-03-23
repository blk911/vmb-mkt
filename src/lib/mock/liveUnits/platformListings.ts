/**
 * Mock platform listings for development / tests — not production data.
 * Some rows are designed to match high-confidence; others should fail matching.
 */
import type { PlatformListing } from "@/lib/live-units/platform-signal-types";

/** ~Tolga Taskin Salon area (Denver) — should match that live unit when lat/lon present on row. */
export const MOCK_PLATFORM_LISTINGS: PlatformListing[] = [
  {
    platform: "fresha",
    name: "Tolga Taskin Salon",
    address: "2708 E 3rd Ave, Denver, CO 80206",
    lat: 39.72083,
    lng: -104.95547,
    services: ["Haircut", "Hair color", "Balayage", "Styling"],
    bookingUrl: "https://fresha.com/providers/tolga-taskin-salon-mock",
  },
  {
    platform: "vagaro",
    name: "Tolga Taskin Salon",
    address: "2708 E 3rd Ave, Denver, CO",
    lat: 39.72082,
    lng: -104.95548,
    services: ["Hair", "Salon services"],
    bookingUrl: "https://vagaro.com/us/example-tolga-mock",
  },
  /** Far from any entity — should not attach (outside 0.5 mi or low score). */
  {
    platform: "booksy",
    name: "Random Nail Studio",
    address: "123 Main St, Boulder, CO",
    lat: 40.015,
    lng: -105.2705,
    services: ["Manicure", "Pedicure"],
    bookingUrl: "https://booksy.com/mock-far-away",
  },
  /** Wrong name at Denver coords — name score should tank total below threshold. */
  {
    platform: "glossgenius",
    name: "Completely Different Business Name XYZ",
    address: "2708 E 3rd Ave, Denver, CO",
    lat: 39.72083,
    lng: -104.95547,
    services: ["Nails"],
    bookingUrl: "https://glossgenius.com/mock-no-match",
  },
  /** No coordinates — strict matcher rejects. */
  {
    platform: "fresha",
    name: "Ghost Listing",
    address: null,
    lat: null,
    lng: null,
    services: ["Spa"],
    bookingUrl: "https://fresha.com/mock-no-geo",
  },
];
