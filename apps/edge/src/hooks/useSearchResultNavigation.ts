import { type KeyboardEvent, useCallback, useEffect, useId, useState } from "react";

export type SearchResultOptionProps = {
  id: string;
  className?: string;
  role: "option";
  "aria-selected": "true" | "false";
};

export function useSearchResultNavigation<T>({
  isOpen,
  items,
  onClear,
  onSelect,
}: {
  isOpen: boolean;
  items: T[];
  onClear: () => void;
  onSelect: (item: T) => void;
}) {
  const listboxId = useId();
  const [activeResultIndex, setActiveResultIndex] = useState(0);
  const activeResult = isOpen ? (items[activeResultIndex] ?? null) : null;
  const activeResultId = activeResult ? resultOptionId(listboxId, activeResultIndex) : undefined;

  useEffect(() => {
    setActiveResultIndex(0);
  }, [isOpen, items]);

  const handleInputKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      if (!isOpen) return;

      if (event.key === "ArrowDown") {
        event.preventDefault();
        setActiveResultIndex((currentIndex) =>
          items.length ? (currentIndex + 1) % items.length : 0,
        );
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        setActiveResultIndex((currentIndex) =>
          items.length ? (currentIndex - 1 + items.length) % items.length : 0,
        );
      } else if (event.key === "Enter" && activeResult) {
        event.preventDefault();
        onSelect(activeResult);
      } else if (event.key === "Escape") {
        event.preventDefault();
        onClear();
      }
    },
    [activeResult, isOpen, items.length, onClear, onSelect],
  );

  const getResultOptionProps = useCallback(
    (index: number): SearchResultOptionProps => ({
      id: resultOptionId(listboxId, index),
      className: isOpen && index === activeResultIndex ? "active" : undefined,
      role: "option",
      "aria-selected": isOpen && index === activeResultIndex ? "true" : "false",
    }),
    [activeResultIndex, isOpen, listboxId],
  );

  return {
    activeResultId,
    getResultOptionProps,
    handleInputKeyDown,
    listboxId,
  };
}

function resultOptionId(listboxId: string, index: number): string {
  return `${listboxId}-result-${index}`;
}
