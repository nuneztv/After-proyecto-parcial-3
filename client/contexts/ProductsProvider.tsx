'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useAxios } from './AxiosProvider';
import { useAuth } from './AuthProvider';
import { getErrorMessage } from '@/lib/errors';
import type { Product } from '@/types/models';

interface ProductsContextType {
  // Every ticket, used to show the price on the event detail
  products: Product[];
  loading: boolean;
  error: string;
  selectedProduct: Product | null;
  loadingProduct: boolean;
  productError: string;
  loadProductById: (id: string) => Promise<Product | null>;
  // The ticket sold for an event, if any
  getTicketForEvent: (eventId: string) => Product | null;
}

const ProductsContext = createContext<ProductsContextType | null>(null);

export const ProductsProvider = ({ children }: { children: ReactNode }) => {
  const axios = useAxios();
  const { user } = useAuth();
  // The id, not the object: GET /api/auth/me replaces the user object without changing who it is
  const userId = user?.id;
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [loadingProduct, setLoadingProduct] = useState(false);
  const [productError, setProductError] = useState('');
  // Only the latest detail request may update the state (responses can arrive out of order)
  const detailRequest = useRef('');

  const loadProducts = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await axios.get<Product[]>('/api/products');
      setProducts(data);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [axios]);

  useEffect(() => {
    if (!userId) return;
    // The fetch is the external system this effect syncs with: the list only changes once the
    // API answers (the loading flag is the only synchronous update)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadProducts();
  }, [userId, loadProducts]);

  const loadProductById = useCallback(
    async (id: string) => {
      detailRequest.current = id;
      setLoadingProduct(true);
      setProductError('');
      try {
        const { data } = await axios.get<Product>(`/api/products/${encodeURIComponent(id)}`);
        if (detailRequest.current === id) setSelectedProduct(data);
        return data;
      } catch (err) {
        if (detailRequest.current === id) {
          setSelectedProduct(null);
          setProductError(getErrorMessage(err));
        }
        return null;
      } finally {
        if (detailRequest.current === id) setLoadingProduct(false);
      }
    },
    [axios],
  );

  // Each ticket belongs to one event (products.event_id)
  const getTicketForEvent = useCallback(
    (eventId: string) => products.find((product) => product.eventId === eventId) ?? null,
    [products],
  );

  const value = useMemo(
    () => ({
      products,
      loading,
      error,
      selectedProduct,
      loadingProduct,
      productError,
      loadProductById,
      getTicketForEvent,
    }),
    [products, loading, error, selectedProduct, loadingProduct, productError, loadProductById, getTicketForEvent],
  );

  return <ProductsContext.Provider value={value}>{children}</ProductsContext.Provider>;
};

export const useProducts = () => {
  const ctx = useContext(ProductsContext);
  if (!ctx) throw new Error('useProducts must be used within ProductsProvider');
  return ctx;
};
