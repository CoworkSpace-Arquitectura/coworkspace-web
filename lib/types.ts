export interface Country {
  code: string;
  name: string;
  currency: string;
}

export type Role = 'MEMBER' | 'MANAGER' | 'OWNER';

export interface Member {
  id: string;
  name: string;
  email: string;
  role: Role;
}

export interface Session {
  accessToken: string;
  member: Member;
}

export type RoomKind = 'MEETING_ROOM' | 'PRIVATE_OFFICE' | 'AUDITORIUM' | 'PHONE_BOOTH';

export interface Room {
  id: string;
  locationId: string;
  name: string;
  kind: RoomKind;
  capacity: number;
  equipment: Record<string, string | number | boolean>;
  hourlyRate: number;
}

export interface Desk {
  id: string;
  locationId: string;
  code: string;
  isDedicated: boolean;
  hourlyRate: number;
}

export interface LocationPhoto {
  id: string;
  url: string | null;
  position: number;
  /** Enlace externo o ruta relativa del Gateway (empieza por "/"). */
  src: string;
}

export interface Location {
  id: string;
  name: string;
  city: string;
  address: string;
  country: string;
  currency: string;
  description: string;
  amenities: string[];
  latitude: number | null;
  longitude: number | null;
  managerId: string | null;
  photos: LocationPhoto[];
  rooms?: Room[];
  desks?: Desk[];
}

export type ResourceType = 'ROOM' | 'DESK';

export interface Plan {
  id: string;
  name: string;
  price: number;
  resourceAccess: ResourceType[];
}

export interface Subscription {
  id: string;
  memberId: string;
  planId: string;
  status: 'ACTIVE' | 'EXPIRED' | 'CANCELLED';
  renewsAt: string;
  plan: Plan;
}

export interface Booking {
  id: string;
  memberId: string;
  bookedBy: string | null;
  resourceId: string;
  resourceType: ResourceType;
  locationId: string;
  startTime: string;
  endTime: string;
  status: 'CONFIRMED' | 'PENDING_PAYMENT' | 'CANCELLED';
  extraCharge: number;
  currency: string;
}

export interface Charge {
  id: string;
  bookingId: string;
  amount: number;
  currency: string;
  status: 'PENDING' | 'PAID' | 'FAILED';
  checkoutUrl: string | null;
  failureReason: string | null;
}

export interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  link: string | null;
  readAt: string | null;
  createdAt: string;
}

export interface Profile {
  memberId: string;
  displayName: string;
  profession: string | null;
  bio: string;
  visible?: boolean;
}

export interface CommunityEvent {
  id: string;
  locationId: string;
  title: string;
  description: string;
  scheduledAt: string;
  capacity: number;
  _count: { registrations: number };
}
