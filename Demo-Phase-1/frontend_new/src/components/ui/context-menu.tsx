"use client";
import * as ContextMenuPrimitive from "@radix-ui/react-context-menu";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

interface MenuItem {
  label: string;
  icon?: ReactNode;
  shortcut?: string;
  onClick: () => void;
  variant?: "default" | "destructive";
  disabled?: boolean;
}

interface MenuSeparator {
  type: "separator";
}

type MenuEntry = MenuItem | MenuSeparator;

interface ContextMenuProps {
  children: ReactNode;
  items: MenuEntry[];
}

function isSeparator(entry: MenuEntry): entry is MenuSeparator {
  return "type" in entry && entry.type === "separator";
}

export function ContextMenu({ children, items }: ContextMenuProps) {
  return (
    <ContextMenuPrimitive.Root>
      <ContextMenuPrimitive.Trigger asChild>
        {children}
      </ContextMenuPrimitive.Trigger>
      <ContextMenuPrimitive.Portal>
        <ContextMenuPrimitive.Content
          className={cn(
            "min-w-[180px] overflow-hidden rounded-lg p-1",
            "bg-slate-800/95 backdrop-blur-xl border border-white/10",
            "shadow-xl shadow-black/30",
            "animate-fade-up",
            "z-50"
          )}
        >
          {items.map((entry, i) => {
            if (isSeparator(entry)) {
              return (
                <ContextMenuPrimitive.Separator
                  key={i}
                  className="h-px my-1 mx-2 bg-white/10"
                />
              );
            }
            return (
              <ContextMenuPrimitive.Item
                key={i}
                disabled={entry.disabled}
                onClick={entry.onClick}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 text-sm rounded-md cursor-pointer select-none",
                  "outline-none transition-colors duration-100",
                  entry.variant === "destructive"
                    ? "text-red-400 data-[highlighted]:bg-red-500/15 data-[highlighted]:text-red-300"
                    : "text-slate-200 data-[highlighted]:bg-teal-500/15 data-[highlighted]:text-teal-300",
                  entry.disabled && "opacity-40 pointer-events-none"
                )}
              >
                {entry.icon && (
                  <span className="w-4 h-4 flex-shrink-0 flex items-center justify-center opacity-70">
                    {entry.icon}
                  </span>
                )}
                <span className="flex-1">{entry.label}</span>
                {entry.shortcut && (
                  <span className="text-xs text-slate-500 ml-4">
                    {entry.shortcut}
                  </span>
                )}
              </ContextMenuPrimitive.Item>
            );
          })}
        </ContextMenuPrimitive.Content>
      </ContextMenuPrimitive.Portal>
    </ContextMenuPrimitive.Root>
  );
}

export type { MenuEntry, MenuItem };
