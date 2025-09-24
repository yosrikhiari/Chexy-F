import React, { useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { RPGPiece, RPGModifier, RPGBoardModifier, CapacityModifier } from "@/Interfaces/types/rpgChess.ts";
import { Coins, Crown, Sword, Shield, Zap, ShoppingCart, Sparkles, LayoutGrid, Expand } from "lucide-react";
import { RPGShopProps } from "@/Interfaces/RPGShopProps.ts";
import { ShopItem } from "@/Interfaces/shopItems.ts";

import { toast } from "@/components/ui/use-toast.tsx";
// Purchase execution is delegated to parent via onPurchase

const RPGShop: React.FC<RPGShopProps> = ({
                                           shopItems,
                                           coins,
                                           onPurchase,
                                           onClose,
                                           gameId,
                                           playerId,
                                         }) => {
  const getRarityColor = (rarity: string) => {
    switch (rarity) {
      case "legendary":
        return "bg-gradient-to-r from-yellow-400 to-yellow-600 text-yellow-900 border-yellow-500";
      case "epic":
        return "bg-gradient-to-r from-purple-400 to-purple-600 text-white border-purple-500";
      case "rare":
        return "bg-gradient-to-r from-blue-400 to-blue-600 text-white border-blue-500";
      default:
        return "bg-gradient-to-r from-gray-300 to-gray-500 text-gray-800 border-gray-400";
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "piece":
        return <Sword className="h-4 w-4" />;
      case "modifier":
        return <Zap className="h-4 w-4" />;
      case "board_modifier":
        return <LayoutGrid className="h-4 w-4" />;
      case "capacity_modifier":
        return <Expand className="h-4 w-4" />;
      default:
        return <Shield className="h-4 w-4" />;
    }
  };

  const canAfford = (cost: number) => coins >= cost;

  const handlePurchase = useCallback(
    async (item: ShopItem) => {
      if (!gameId || !playerId) {
        toast({
          variant: "destructive",
          title: "Error",
          description: !gameId ? "No game ID provided." : "No player ID provided.",
        });
        return;
      }

      try {
        await onPurchase(item);
        toast({
          title: "Success",
          description: `Successfully purchased ${item.name}!`,
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Failed to purchase item.";
        toast({
          variant: "destructive",
          title: "Error",
          description: errorMessage,
        });
        console.error("Failed to purchase item:", error);
      }
    },
    [gameId, playerId, onPurchase]
  );

  const renderItemStats = (item: ShopItem) => {
    switch (item.type) {
      case "piece":
        const piece = item.item as RPGPiece;
        return (
          <div className="grid grid-cols-2 gap-3 text-sm mb-4">
            <div className="flex items-center gap-2 bg-red-100 p-2 rounded border border-red-300">
              <Shield className="h-4 w-4 text-red-600" />
              <span className="font-bold text-red-800">❤️ HP: {piece.hp}</span>
            </div>
            <div className="flex items-center gap-2 bg-orange-100 p-2 rounded border border-orange-300">
              <Sword className="h-4 w-4 text-orange-600" />
              <span className="font-bold text-orange-800">⚔️ ATK: {piece.attack}</span>
            </div>
            {piece.specialAbility && (
              <div className="col-span-2 p-3 bg-gradient-to-r from-blue-100 to-purple-100 rounded-lg border-2 border-blue-300 shadow-inner">
                <strong className="text-blue-900">🌟 Special Power:</strong>
                <span className="text-blue-800 ml-1">{piece.specialAbility}</span>
              </div>
            )}
          </div>
        );

      case "modifier":
        const modifier = item.item as RPGModifier;
        return (
          <div className="p-3 bg-gradient-to-r from-green-100 to-teal-100 rounded-lg border-2 border-green-300 mb-4 shadow-inner">
            <strong className="text-green-900">✨ Effect:</strong>
            <span className="text-green-800 ml-1">{modifier.effect}</span>
          </div>
        );

      case "board_modifier":
        const boardMod = item.item as RPGBoardModifier;
        return (
          <div className="p-3 bg-gradient-to-r from-purple-100 to-pink-100 rounded-lg border-2 border-purple-300 mb-4 shadow-inner">
            <strong className="text-purple-900">🎯 Board Effect:</strong>
            <span className="text-purple-800 ml-1">{boardMod.effect}</span>
            {boardMod.boardSizeModifier && (
              <div className="mt-2 text-sm">
                <span className="font-bold">Size Modifier: </span>
                {boardMod.boardSizeModifier > 0 ? "+" : ""}
                {boardMod.boardSizeModifier}
              </div>
            )}
          </div>
        );

      case "capacity_modifier":
        const capacityMod = item.item as CapacityModifier;
        return (
          <div className="p-3 bg-gradient-to-r from-amber-100 to-orange-100 rounded-lg border-2 border-amber-300 mb-4 shadow-inner">
            <strong className="text-amber-900">📦 Capacity Bonus:</strong>
            <span className="text-amber-800 ml-1">
              +{capacityMod.capacityBonus} {capacityMod.pieceType || "total"} capacity
            </span>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <Card className="max-w-6xl w-full mx-4 max-h-[90vh] overflow-y-auto bg-gradient-to-br from-amber-50 to-orange-100 border-4 border-amber-400 shadow-2xl">
        <CardHeader className="text-center border-b-4 border-amber-300 bg-gradient-to-r from-amber-200 to-orange-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <ShoppingCart className="h-8 w-8 text-amber-700" />
              <Sparkles className="h-6 w-6 text-amber-600" />
              <CardTitle className="text-3xl font-serif font-bold text-amber-900">
                🏪 Mystical Merchant's Emporium
              </CardTitle>
              <Sparkles className="h-6 w-6 text-amber-600" />
            </div>
            <div className="flex items-center gap-2 bg-gradient-to-r from-yellow-400 to-yellow-600 px-4 py-2 rounded-full border-2 border-yellow-700 shadow-lg">
              <Coins className="h-6 w-6 text-yellow-800" />
              <span className="font-bold text-xl text-yellow-900">{coins}</span>
            </div>
          </div>
          <CardDescription className="text-amber-800 text-lg font-medium">
            ✨ Acquire legendary warriors and mystical artifacts for your quest! ✨
          </CardDescription>
        </CardHeader>

        <CardContent className="p-6 bg-gradient-to-br from-purple-100 to-blue-100">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {shopItems.map((shopItem) => (
              <Card
                key={shopItem.id}
                className={`hover:shadow-2xl transition-all transform hover:scale-105 border-3 ${
                  !canAfford(shopItem.cost)
                    ? "opacity-60 bg-gray-200 border-gray-400"
                    : "bg-gradient-to-br from-white to-blue-50 border-blue-300 hover:border-purple-400"
                }`}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {getTypeIcon(shopItem.type)}
                      <Badge
                        className={`${getRarityColor(shopItem.rarity)} font-bold border-2 shadow-md`}
                      >
                        ✨ {shopItem.rarity.toUpperCase()} ✨
                      </Badge>
                    </div>
                    <div className="flex items-center gap-1 bg-gradient-to-r from-yellow-400 to-yellow-600 px-3 py-1 rounded-full border-2 border-yellow-700 shadow-md">
                      <Coins className="h-4 w-4 text-yellow-800" />
                      <span className="font-bold text-yellow-900">{shopItem.cost}</span>
                    </div>
                  </div>
                  <CardTitle className="text-lg font-serif text-purple-900">
                    {shopItem.name}
                  </CardTitle>
                  <CardDescription className="text-sm text-purple-700 font-medium">
                    {shopItem.description}
                  </CardDescription>
                </CardHeader>

                <CardContent className="pt-0">
                  {renderItemStats(shopItem)}

                  <Button
                    onClick={() => handlePurchase(shopItem)}
                    disabled={!canAfford(shopItem.cost)}
                    className={`w-full font-bold text-lg transition-all transform ${
                      canAfford(shopItem.cost)
                        ? "bg-gradient-to-r from-green-500 to-green-700 hover:from-green-600 hover:to-green-800 text-white border-2 border-green-400 hover:scale-105 shadow-lg"
                        : "bg-gray-400 text-gray-600 cursor-not-allowed border-2 border-gray-300"
                    }`}
                    size="sm"
                  >
                    {canAfford(shopItem.cost) ? "💰 PURCHASE 💰" : "❌ NOT ENOUGH GOLD ❌"}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="flex justify-center mt-8">
            <Button
              onClick={onClose}
              variant="outline"
              size="lg"
              className="bg-gradient-to-r from-red-500 to-red-700 hover:from-red-600 hover:to-red-800 text-white border-3 border-red-400 font-bold text-xl px-8 py-3 transform hover:scale-105 transition-all shadow-lg"
            >
              🚪 Close Shop 🚪
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default RPGShop;
