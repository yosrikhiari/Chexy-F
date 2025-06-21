import { ShopItem } from "@/Interfaces/shopItems";

export interface RPGShopProps {
  shopItems: ShopItem[];
  coins: number;
  onPurchase: (item: ShopItem) => void;
  onClose: () => void;
  gameId?: string;
  playerId?: string;
}
