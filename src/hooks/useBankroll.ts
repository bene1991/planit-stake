import { useState, useEffect } from "react";
import { Bankroll, Method } from "@/types";

const STORAGE_KEY = "j360-bankroll";

const defaultBankroll: Bankroll = {
  total: 10000,
  methods: [],
};

export const useBankroll = () => {
  const [bankroll, setBankroll] = useState<Bankroll>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : defaultBankroll;
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(bankroll));
  }, [bankroll]);

  const updateTotal = (total: number) => {
    setBankroll((prev) => ({ ...prev, total }));
  };

  const addMethod = (method: Omit<Method, "id">) => {
    const newMethod: Method = {
      ...method,
      id: crypto.randomUUID(),
    };
    setBankroll((prev) => ({
      ...prev,
      methods: [...prev.methods, newMethod],
    }));
  };

  const updateMethod = (id: string, updates: Partial<Method>) => {
    setBankroll((prev) => ({
      ...prev,
      methods: prev.methods.map((m) => (m.id === id ? { ...m, ...updates } : m)),
    }));
  };

  const deleteMethod = (id: string) => {
    setBankroll((prev) => ({
      ...prev,
      methods: prev.methods.filter((m) => m.id !== id),
    }));
  };

  return {
    bankroll,
    updateTotal,
    addMethod,
    updateMethod,
    deleteMethod,
  };
};
