import type { ArgentineProvince } from "@/lib/provinces";

/** Dirección ya serializada para componentes cliente (sin fechas ni relays). */
export type AddressView = {
  id: string;
  recipientName: string;
  phone: string;
  street: string;
  number: string;
  floorApt: string | null;
  city: string;
  province: ArgentineProvince;
  postalCode: string;
  notes: string | null;
  isDefault: boolean;
};

export type CheckoutSettingsView = {
  deliveryEnabled: boolean;
  pickupEnabled: boolean;
  shippingFlatCents: number;
  freeShippingThresholdCents: number | null;
  pickupInstructions: string | null;
};

export type CheckoutOrderView = {
  id: string;
  number: string;
  statusLabel: string;
  createdAt: string;
  totalCents: number;
};
