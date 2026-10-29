import { subject } from "@/auth";
export const TOUR_VERSION = "v1";
export const tourKey = () => `m3aya-onboarding:${TOUR_VERSION}:${subject()}`;
