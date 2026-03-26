import { createContext, useContext, useEffect, useState } from "react";

export interface CartItem {
  itemId: number;
  itemName: string;
  category: string;
  price: number;
  qty: number;
}

interface CartContextValue {
  cartItems: CartItem[];
  cartCount: number;
  cartTotal: number;
  addToCart: (item: Omit<CartItem, "qty">) => void;
  removeFromCart: (itemId: number) => void;
  updateQty: (itemId: number, qty: number) => void;
  clearCart: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

const STORAGE_KEY = "clikmate_cart";

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [cartItems, setCartItems] = useState<CartItem[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cartItems));
  }, [cartItems]);

  const cartCount = cartItems.reduce((sum, i) => sum + i.qty, 0);
  const cartTotal = cartItems.reduce((sum, i) => sum + i.price * i.qty, 0);

  function addToCart(item: Omit<CartItem, "qty">) {
    setCartItems((prev) => {
      const existing = prev.find((i) => i.itemId === item.itemId);
      if (existing) {
        return prev.map((i) =>
          i.itemId === item.itemId ? { ...i, qty: i.qty + 1 } : i,
        );
      }
      return [...prev, { ...item, qty: 1 }];
    });
  }

  function removeFromCart(itemId: number) {
    setCartItems((prev) => prev.filter((i) => i.itemId !== itemId));
  }

  function updateQty(itemId: number, qty: number) {
    if (qty <= 0) {
      removeFromCart(itemId);
      return;
    }
    setCartItems((prev) =>
      prev.map((i) => (i.itemId === itemId ? { ...i, qty } : i)),
    );
  }

  function clearCart() {
    setCartItems([]);
  }

  return (
    <CartContext.Provider
      value={{
        cartItems,
        cartCount,
        cartTotal,
        addToCart,
        removeFromCart,
        updateQty,
        clearCart,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside CartProvider");
  return ctx;
}
