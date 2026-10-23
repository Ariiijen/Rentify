import type { Timestamp } from 'firebase/firestore';

export type UserRole = 'shop' | 'customer';

export type ItemStatus =
  | 'available'
  | 'reserved'
  | 'booked'
  | 'pickedUp'
  | 'cleaning';

export interface Item {
  id: string;
  name: string;
  type: string;
  price: number;
  deposit: number;
  photoUrl: string;
  status: ItemStatus;
  createdAt?: Timestamp;
}

export type BookingStatus = 'pending' | 'confirmed' | 'cancelled';

export interface Booking {
  id: string;
  itemId: string;
  userId: string;
  startDate: string;
  endDate: string;
  status: BookingStatus;
  createdAt?: Timestamp;
}
