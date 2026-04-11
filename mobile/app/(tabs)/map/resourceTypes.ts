// resourceTypes.ts
// Shared types for the resources map feature.
// Import from here in both maplibre.tsx and resourcesSlider.tsx.

export type ResourceType =
  | "hotels"
  | "grocery"
  | "gas"
  | "convenience"
  | "hospital"
  | "pharmacy";

export type NearbyPlace = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  address?: string;
  type: ResourceType;
  distanceMeters?: number;
  rating?: number;
  isOpen?: boolean;
  /** e.g. "Mon–Fri 8 AM–10 PM" or a Google Places weekday_text array */
  openingHours?: string | string[];
};