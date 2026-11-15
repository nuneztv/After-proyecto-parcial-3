"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode } from "react";
import { useAxios } from "./AxiosProvider";
import { useAuth } from "./AuthProvider";
import { useEvents } from "./EventsProvider";
import { EventView, Payment, Product } from "@/types/models";
import { getSavedIds, setSavedIds } from "@/lib/storage";

// Legacy provider: products, payments and saved events. Events moved to EventsProvider
interface DataContextType {
  products: Product[];
  payments: Payment[];
  selectedProduct: Product | null;
  savedIds: string[];
  savedEvents: EventView[];
  loading: boolean;
  error: string;
  loadProducts: () => Promise<void>;
  loadProductById: (id: string) => Promise<Product | null>;
  loadPayments: () => Promise<void>;
  toggleSaved: (eventId: string) => void;
}

const DataContext = createContext<DataContextType | null>(null);

export const DataProvider = ({ children }: { children: ReactNode }) => {
  const axios = useAxios();
  const { user } = useAuth();
  // The id, not the object: GET /api/auth/me replaces the user object without changing who it is
  const userId = user?.id;
  // Saved ids are still kept in localStorage; the events themselves come from the API
  const { allEvents } = useEvents();
  const [products, setProducts] = useState<Product[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [savedIds, setSaved] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (userId) setSaved(getSavedIds(userId));
    else setSaved([]);
  }, [userId]);

  const loadProducts = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { data } = await axios.get<Product[]>("/api/products");
      setProducts(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load products");
    } finally {
      setLoading(false);
    }
  }, [axios]);

  const loadProductById = useCallback(
    async (id: string) => {
      setLoading(true);
      setError("");
      try {
        const { data } = await axios.get<Product>(`/api/products/${id}`);
        setSelectedProduct(data);
        return data;
      } catch (err) {
        setSelectedProduct(null);
        setError(err instanceof Error ? err.message : "Product not found");
        return null;
      } finally {
        setLoading(false);
      }
    },
    [axios]
  );

  const loadPayments = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { data } = await axios.get<Payment[]>("/api/payments");
      setPayments(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load payments");
    } finally {
      setLoading(false);
    }
  }, [axios]);

  useEffect(() => {
    if (!userId) return;
    void loadProducts();
    void loadPayments();
  }, [userId, loadProducts, loadPayments]);

  const toggleSaved = (eventId: string) => {
    if (!user) return;
    setSaved((prev) => {
      const exists = prev.includes(eventId);
      const next = exists ? prev.filter((id) => id !== eventId) : [...prev, eventId];
      setSavedIds(user.id, next);
      return next;
    });
  };

  const savedEvents = useMemo(
    () => allEvents.filter((item) => savedIds.includes(item.id)),
    [allEvents, savedIds]
  );

  return (
    <DataContext.Provider
      value={{
        products,
        payments,
        selectedProduct,
        savedIds,
        savedEvents,
        loading,
        error,
        loadProducts,
        loadProductById,
        loadPayments,
        toggleSaved,
      }}
    >
      {children}
    </DataContext.Provider>
  );
};

export const useData = () => {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useData must be used within DataProvider");
  return ctx;
};
