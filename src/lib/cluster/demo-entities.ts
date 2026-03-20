import type { BaseEntity } from "./types";

/**
 * Sample payload for `/admin/vmb` — includes a Google + DORA pair that should merge (same brand, ~0.03 mi).
 * Replace with API-mapped `BaseEntity[]` in production.
 */
export const DEMO_CLUSTER_ENTITIES: BaseEntity[] = [
  {
    id: "google-moda",
    type: "google_place",
    name: "Salon Moda Capelli Denver",
    lat: 39.74,
    lng: -104.99,
    category: "hair",
    address: "456 Broadway, Denver CO 80203",
  },
  {
    id: "dora-moda",
    type: "dora_shop",
    name: "Salon Moda Capelli",
    lat: 39.74043,
    lng: -104.99,
    category: "hair",
    address: "456 Broadway Denver CO 80203",
    licenseId: "COS-12345",
  },
  {
    id: "dora-person-moda",
    type: "dora_person",
    name: "Alex Tech",
    lat: 39.7405,
    lng: -104.9901,
    category: "hair",
  },
  {
    id: "google-luxe",
    type: "google_place",
    name: "Luxe Hair Salon Denver",
    lat: 39.75,
    lng: -105.0,
    category: "hair",
    address: "123 Main St, Denver CO",
  },
  {
    id: "dora-luxe",
    type: "dora_shop",
    name: "Luxe Hair Salon",
    lat: 39.7501,
    lng: -105.0001,
    category: "hair",
  },
  {
    id: "dora-person-luxe",
    type: "dora_person",
    name: "Jane Stylist",
    lat: 39.7502,
    lng: -105.0002,
    category: "hair",
  },
];
