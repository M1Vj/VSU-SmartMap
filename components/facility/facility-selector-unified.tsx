"use client";

import * as React from "react";
import { Search, MapPin, Check, X, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getFacilitiesLite } from "@/lib/supabase/queries/facilities";
import type { FacilityLite } from "@/lib/types/facility";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

interface FacilitySelectorUnifiedProps {
  value?: string | string[];
  onSelect: (facility: FacilityLite) => void;
  onDeselect?: (facilityId: string) => void;
  onCustomEntry?: (value: string) => void;
  multi?: boolean;
  allowCustom?: boolean;
  placeholder?: string;
  className?: string;
}

export function FacilitySelectorUnified({
  value,
  onSelect,
  onDeselect,
  onCustomEntry,
  multi = false,
  allowCustom = false,
  placeholder = "Search facilities...",
  className,
}: FacilitySelectorUnifiedProps) {
  const [query, setQuery] = React.useState("");
  const [facilities, setFacilities] = React.useState<FacilityLite[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [isOpen, setIsOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    async function load() {
      setLoading(true);
      const { data } = await getFacilitiesLite();
      if (data) setFacilities(data);
      setLoading(false);
    }
    load();
  }, []);

  React.useEffect(() => {
    if (multi) return;
    if (Array.isArray(value)) return;
    if (isOpen) return;

    const raw = typeof value === "string" ? value.trim() : "";
    if (!raw) {
      setQuery("");
      return;
    }

    const byId = facilities.find((f) => f.id === raw);
    if (byId) {
      setQuery(byId.name);
      return;
    }

    if (UUID_RE.test(raw)) return;
    setQuery(raw);
  }, [facilities, isOpen, multi, value]);

  const filtered = React.useMemo(() => {
    const fv = facilities.filter((f) => 
      f.name.toLowerCase().includes(query.toLowerCase()) || 
      f.code?.toLowerCase().includes(query.toLowerCase())
    );
    if (!query) return fv.slice(0, 10);
    return fv.slice(0, 20);
  }, [facilities, query]);

  const selectedIds = React.useMemo(() => {
    if (!value) return new Set<string>();
    if (Array.isArray(value)) return new Set(value);
    return new Set([value]);
  }, [value]);

  const exactMatch = React.useMemo(() => {
    return facilities.some(f => f.name.toLowerCase() === query.toLowerCase());
  }, [facilities, query]);

  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && allowCustom && query && !exactMatch) {
      e.preventDefault();
      onCustomEntry?.(query);
      setIsOpen(false);
    }
  };

  return (
    <div className={cn("relative w-full", className)} ref={containerRef}>
      <div className="relative group">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
        <Input
          placeholder={placeholder}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          className="pl-9 pr-4 py-2 text-sm"
        />
        {query && (
          <button
            type="button"
            onClick={() => {
               setQuery("");
               if (allowCustom) onCustomEntry?.("");
            }}
            className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1 z-[5000] bg-card border rounded-md shadow-xl max-h-60 overflow-y-auto overflow-x-hidden">
          {loading && facilities.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground animate-pulse">
              Loading facilities...
            </div>
          ) : (
            <div className="p-1">
              {allowCustom && query && !exactMatch && (
                <>
                  <button
                    key="custom-entry"
                    type="button"
                    onPointerDown={(e) => e.preventDefault()}
                    onClick={() => {
                      onCustomEntry?.(query);
                      setIsOpen(false);
                    }}
                    className="w-full flex items-center gap-3 px-3 py-3 text-sm rounded-sm transition-colors text-left hover:bg-accent hover:text-accent-foreground border-b mb-1"
                  >
                    <div className="shrink-0 p-1.5 rounded-full bg-primary/10 text-primary">
                      <Plus className="h-3.5 w-3.5" />
                    </div>
                    <div className="flex-1 truncate">
                      <div className="font-medium truncate text-primary">Use &quot;{query}&quot;</div>
                      <div className="text-[10px] opacity-70">Custom location</div>
                    </div>
                  </button>
                </>
              )}
              
              {filtered.length === 0 && !allowCustom ? (
                 <div className="p-4 text-center text-sm text-muted-foreground">
                    No facilities found.
                 </div>
              ) : (
                filtered.map((f) => {
                  const isSelected = selectedIds.has(f.id);
                  return (
                    <button
                      key={f.id}
                      type="button"
                      onPointerDown={(e) => {
                        e.preventDefault();
                      }}
                      onClick={() => {
                        if (multi && isSelected) {
                          onDeselect?.(f.id);
                        } else {
                          onSelect(f);
                          if (!multi) {
                             setIsOpen(false);
                             setQuery(f.name);
                          }
                        }
                      }}
                      className={cn(
                        "w-full flex items-center gap-3 px-3 py-3 text-sm rounded-sm transition-colors text-left",
                        isSelected 
                          ? "bg-primary/10 text-primary font-medium" 
                          : "hover:bg-accent hover:text-accent-foreground"
                      )}
                    >
                      <div className={cn(
                        "shrink-0 p-1.5 rounded-full",
                        isSelected ? "bg-primary/20" : "bg-muted"
                      )}>
                        <MapPin className="h-3.5 w-3.5" />
                      </div>
                      <div className="flex-1 truncate">
                        <div className="font-medium truncate">{f.name}</div>
                        {f.code && <div className="text-[10px] opacity-70 uppercase font-mono">{f.code}</div>}
                      </div>
                      {isSelected && <Check className="h-4 w-4 shrink-0" />}
                    </button>
                  );
                })
              )}
            </div>
          )}
        </div>
      )}

      {multi && Array.isArray(value) && value.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {value.map((id) => {
            const f = facilities.find((fac) => fac.id === id);
            if (!f) return null;
            return (
              <Badge key={id} variant="secondary" className="gap-1 pr-1 py-0.5 text-[10px]">
                {f.name}
                <button
                  type="button"
                  onClick={() => onDeselect?.(id)}
                  className="hover:bg-muted rounded-full p-0.5"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            );
          })}
        </div>
      )}
    </div>
  );
}
