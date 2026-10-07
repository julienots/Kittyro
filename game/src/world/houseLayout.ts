/** Interior layout of the house (dollhouse cut-away). Coordinates in tiles. */
export interface RoomRect {
  id: string;
  x0: number;
  z0: number;
  x1: number;
  z1: number;
}
export const HOUSE_W = 22;
export const HOUSE_D = 16;
export const HOUSE_ROOMS: RoomRect[] = [
  { id: 'bedroom', x0: 1, z0: 1, x1: 8, z1: 8 },
  { id: 'kitchen', x0: 8, z0: 1, x1: 14, z1: 8 },
  { id: 'living', x0: 14, z0: 1, x1: 21, z1: 8 },
  { id: 'office', x0: 1, z0: 8, x1: 8, z1: 15 },
  { id: 'veranda', x0: 8, z0: 8, x1: 21, z1: 15 },
];
export const HOUSE_DOOR = { x: 17.5, z: 7.6 }; // exit door (front of living room)
