import {
  ApartmentBlock,
  Bank,
  BlueShop,
  BusStop,
  CafeTerrace,
  Clinic,
  House,
  MarketStall,
  Pharmacy,
  RoseShop,
  Taxi,
  WarmShop,
  type Piece,
} from './scenery'
import type { MissionZone } from './zones'

/** The buildings that line the road in each part of town, used in turn along it. */
export const ZONE_BUILDINGS: Record<MissionZone, Piece[]> = {
  neighborhood: [House, ApartmentBlock],
  shopping: [WarmShop, MarketStall, RoseShop],
  dining: [CafeTerrace, RoseShop],
  transport: [BusStop, Taxi],
  health: [Clinic, Pharmacy],
  city: [Bank, ApartmentBlock, BlueShop],
}

