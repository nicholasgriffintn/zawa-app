import { type RefObject, useEffect } from "react";

type SearchInputRef = RefObject<HTMLInputElement | null>;

export function useGlobalSearchShortcut(inputRef: SearchInputRef): void {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isSearchShortcut(event) || isEditableTarget(event.target)) return;

      event.preventDefault();
      inputRef.current?.focus();
      inputRef.current?.select();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [inputRef]);
}

function isSearchShortcut(event: KeyboardEvent): boolean {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") return true;
  return event.key === "/" && !event.metaKey && !event.ctrlKey && !event.altKey;
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  return Boolean(target.closest("input, textarea, select"));
}
