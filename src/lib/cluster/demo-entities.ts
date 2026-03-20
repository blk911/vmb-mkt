import type { BaseEntity } from "./types";

/** Sample payload so the cluster UI is demonstrable before wiring real APIs. */
export const DEMO_CLUSTER_ENTITIES: BaseEntity[] = [
  {
    id: "google-1",
    type: "google_place",
    name: "Luxe Hair Salon Denver",
    lat: 39.74,
    lng: -104.99,
    category: "hair",
    address: "123 Main St, Denver CO",
  },
  {
    id: "dora-shop-1",
    type: "dora_shop",
    name: "Luxe Hair Salon",
    lat: 39.7401,
    lng: -104.9901,
    category: "hair",
  },
  {
    id: "dora-person-1",
    type: "dora_person",
    name: "Jane Stylist",
    lat: 39.7402,
    lng: -104.9902,
    category: "hair",
  },
];
