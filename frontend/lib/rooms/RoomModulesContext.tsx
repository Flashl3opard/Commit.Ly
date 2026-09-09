"use client";

import { createContext, useCallback, useContext, useEffect, useReducer, type ReactNode } from "react";
import { getRoomModules, type RoomModule } from "@/lib/api/rooms";

type RoomModulesContextValue = {
  roomId: string;
  modules: RoomModule[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  /** Merges a module the caller already knows about (e.g. its own create/update/remove REST response) without a full refetch. */
  upsertModule: (module_: RoomModule) => void;
  removeModuleLocal: (moduleId: string) => void;
};

const RoomModulesContext = createContext<RoomModulesContextValue | null>(null);

type State = { modules: RoomModule[]; loading: boolean; error: string | null };

type Action =
  | { kind: "reset" }
  | { kind: "loaded"; modules: RoomModule[] }
  | { kind: "loadError"; message: string }
  | { kind: "upserted"; module_: RoomModule }
  | { kind: "removed"; moduleId: string };

const initialState: State = { modules: [], loading: true, error: null };

function sortByPosition(modules: RoomModule[]): RoomModule[] {
  return [...modules].sort((a, b) => a.position - b.position);
}

function reducer(state: State, action: Action): State {
  switch (action.kind) {
    case "reset":
      return initialState;
    case "loaded":
      return { modules: sortByPosition(action.modules), loading: false, error: null };
    case "loadError":
      return { ...state, loading: false, error: action.message };
    case "upserted": {
      const index = state.modules.findIndex((m) => m.id === action.module_.id);
      const next = index === -1 ? [...state.modules, action.module_] : state.modules.map((m) => (m.id === action.module_.id ? action.module_ : m));
      return { ...state, modules: sortByPosition(next) };
    }
    case "removed":
      return { ...state, modules: state.modules.filter((m) => m.id !== action.moduleId) };
  }
}

/**
 * Holds the current room's module list — what the icon rail renders and
 * what the contextual sub-sidebar reacts to. Scoped to one room per
 * provider instance (mounted per room page), refetched whenever roomId
 * changes. Kept separate from RoomsContext (the cross-room room list)
 * since modules are meaningless outside the room currently being viewed.
 *
 * Local state is a single reducer (not several useState calls) so the
 * roomId-change reset and the fetch-settle can both dispatch from inside
 * effects without tripping react-hooks/set-state-in-effect — the same
 * pattern useChatRoom and CommandPalette already use for the identical
 * reason.
 */
export function RoomModulesProvider({ roomId, children }: { roomId: string; children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  const refresh = useCallback(async () => {
    dispatch({ kind: "reset" });
    try {
      const { modules: fetched } = await getRoomModules(roomId);
      dispatch({ kind: "loaded", modules: fetched });
    } catch {
      dispatch({ kind: "loadError", message: "Couldn't load room modules." });
    }
  }, [roomId]);

  useEffect(() => {
    dispatch({ kind: "reset" });
    let cancelled = false;

    getRoomModules(roomId)
      .then(({ modules: fetched }) => {
        if (!cancelled) dispatch({ kind: "loaded", modules: fetched });
      })
      .catch(() => {
        if (!cancelled) dispatch({ kind: "loadError", message: "Couldn't load room modules." });
      });

    return () => {
      cancelled = true;
    };
  }, [roomId]);

  const upsertModule = useCallback((module_: RoomModule) => {
    dispatch({ kind: "upserted", module_ });
  }, []);

  const removeModuleLocal = useCallback((moduleId: string) => {
    dispatch({ kind: "removed", moduleId });
  }, []);

  return (
    <RoomModulesContext.Provider
      value={{ roomId, modules: state.modules, loading: state.loading, error: state.error, refresh, upsertModule, removeModuleLocal }}
    >
      {children}
    </RoomModulesContext.Provider>
  );
}

export function useRoomModules(): RoomModulesContextValue {
  const context = useContext(RoomModulesContext);
  if (!context) {
    throw new Error("useRoomModules must be used within a RoomModulesProvider");
  }
  return context;
}
