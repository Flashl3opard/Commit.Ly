"use client";

import { useState } from "react";
import { Loader2, Plus, Power, X } from "lucide-react";
import { Dialog } from "@/components/ui/Dialog";
import { MODULE_ICONS, MODULE_LABELS } from "./IconRail";
import { createRoomModule, updateRoomModule, removeRoomModule, type RoomDetails, type RoomModule, type RoomModuleType } from "@/lib/api/rooms";
import { ApiError } from "@/lib/api/types";

type CustomizeRoomDialogProps = {
  open: boolean;
  onClose: () => void;
  room: RoomDetails;
  modules: RoomModule[];
  onModuleUpserted: (module_: RoomModule) => void;
  onModuleRemoved: (moduleId: string) => void;
};

// CHAT is always active and can't be removed/disabled (see room-service's
// roomModule.service.ts) — never offered as an "available" module to add,
// since every room already has it from creation.
const OPTIONAL_MODULE_TYPES: RoomModuleType[] = ["TASKS", "NOTES", "RELEASES"];

/**
 * The owner's "what exists in this room" control surface — add/remove/
 * enable/disable modules. Members never see this dialog at all (the
 * caller only renders it for owners); the backend independently enforces
 * the same rule regardless of what the UI shows.
 */
export function CustomizeRoomDialog({ open, onClose, room, modules, onModuleUpserted, onModuleRemoved }: CustomizeRoomDialogProps) {
  const [busyType, setBusyType] = useState<RoomModuleType | null>(null);
  const [error, setError] = useState<string | null>(null);

  const activeTypes = new Set(modules.map((m) => m.type));
  const availableTypes = OPTIONAL_MODULE_TYPES.filter((type) => !activeTypes.has(type));

  async function handleAdd(type: RoomModuleType) {
    setBusyType(type);
    setError(null);
    try {
      const { module: created } = await createRoomModule(room.id, { type });
      onModuleUpserted(created);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't add module.");
    } finally {
      setBusyType(null);
    }
  }

  async function handleToggle(module_: RoomModule) {
    setBusyType(module_.type);
    setError(null);
    try {
      const { module: updated } = await updateRoomModule(room.id, module_.id, { enabled: !module_.enabled });
      onModuleUpserted(updated);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't update module.");
    } finally {
      setBusyType(null);
    }
  }

  async function handleRemove(module_: RoomModule) {
    setBusyType(module_.type);
    setError(null);
    try {
      await removeRoomModule(room.id, module_.id);
      onModuleRemoved(module_.id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't remove module.");
    } finally {
      setBusyType(null);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title="Customize room">
      <div className="-mt-2 mb-4">
        <p className="text-base font-semibold text-foreground">{room.name}</p>
        <p className="font-mono text-xs text-muted">{room.repository.fullName}</p>
      </div>

      {error && <p className="mb-3 text-sm text-danger">{error}</p>}

      <p className="text-xs font-medium tracking-wide text-muted-2 uppercase">Active modules</p>
      <ul className="mt-2 space-y-1">
        {modules.map((module_) => {
          const Icon = MODULE_ICONS[module_.type];
          const isChat = module_.type === "CHAT";
          const busy = busyType === module_.type;
          return (
            <li
              key={module_.id}
              className="flex items-center gap-2.5 rounded-lg border border-border px-3 py-2"
            >
              <Icon className="h-4 w-4 shrink-0 text-muted-2" aria-hidden="true" />
              <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                {module_.name || MODULE_LABELS[module_.type]}
              </span>
              {!module_.enabled && (
                <span className="shrink-0 rounded border border-border px-1.5 py-0.5 text-[10px] font-medium text-muted-2 uppercase">
                  Disabled
                </span>
              )}
              {!isChat && (
                <>
                  <button
                    type="button"
                    onClick={() => handleToggle(module_)}
                    disabled={busy}
                    title={module_.enabled ? "Disable module" : "Enable module"}
                    aria-label={module_.enabled ? "Disable module" : "Enable module"}
                    className="focus-ring shrink-0 rounded-md p-1.5 text-muted-2 transition-colors hover:bg-white/5 hover:text-foreground disabled:opacity-50"
                  >
                    {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <Power className="h-3.5 w-3.5" aria-hidden="true" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRemove(module_)}
                    disabled={busy}
                    title="Remove module"
                    aria-label="Remove module"
                    className="focus-ring shrink-0 rounded-md p-1.5 text-muted-2 transition-colors hover:bg-danger-bg hover:text-danger disabled:opacity-50"
                  >
                    <X className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </>
              )}
            </li>
          );
        })}
      </ul>

      {availableTypes.length > 0 && (
        <>
          <p className="mt-5 text-xs font-medium tracking-wide text-muted-2 uppercase">Available modules</p>
          <ul className="mt-2 space-y-1">
            {availableTypes.map((type) => {
              const Icon = MODULE_ICONS[type];
              const busy = busyType === type;
              return (
                <li key={type}>
                  <button
                    type="button"
                    onClick={() => handleAdd(type)}
                    disabled={busy}
                    className="focus-ring flex w-full items-center gap-2.5 rounded-lg border border-dashed border-border-strong px-3 py-2 text-left text-sm text-muted transition-colors hover:bg-white/5 hover:text-foreground disabled:opacity-50"
                  >
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Plus className="h-4 w-4 shrink-0" aria-hidden="true" />}
                    <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                    {MODULE_LABELS[type]}
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </Dialog>
  );
}
