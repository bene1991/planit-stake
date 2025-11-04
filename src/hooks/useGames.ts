import { useState, useEffect } from "react";
import { Game } from "@/types";

const STORAGE_KEY = "j360-games";

export const useGames = () => {
  const [games, setGames] = useState<Game[]>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(games));
  }, [games]);

  const addGame = (game: Omit<Game, "id">) => {
    const newGame: Game = {
      ...game,
      id: crypto.randomUUID(),
    };
    setGames((prev) => [...prev, newGame]);
  };

  const updateGame = (id: string, updates: Partial<Game>) => {
    setGames((prev) => prev.map((g) => (g.id === id ? { ...g, ...updates } : g)));
  };

  const deleteGame = (id: string) => {
    setGames((prev) => prev.filter((g) => g.id !== id));
  };

  return {
    games,
    addGame,
    updateGame,
    deleteGame,
  };
};
