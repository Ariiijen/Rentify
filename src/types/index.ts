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
  size?: string;
  sizes?: string[];
  color?: string;
  shopId?: string;
  createdAt?: Timestamp;
}

export type BookingStatus = 'pending' | 'confirmed' | 'cancelled';

export interface Booking {
  id: string;
  itemId: string;
  userId: string;
  shopId?: string;
  items?: CartItem[];
  total?: number;
  startDate: string;
  endDate: string;
  status: BookingStatus | 'ongoing' | 'returned';
  createdAt?: Timestamp;
}

export interface CartItem {
  itemId: string;
  name: string;
  price: number;
  deposit: number;
  photoUrl?: string;
  shopId?: string;
  startDate: string;
  endDate: string;
  size: string;
}
