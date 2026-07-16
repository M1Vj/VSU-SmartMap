"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EVENT_CATEGORIES } from "@/lib/types/events";

export function EventFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const categoryParam = searchParams.get("category") || "all";
  const [category, setCategory] = React.useState(categoryParam);

  React.useEffect(() => {
    setCategory(categoryParam);
  }, [categoryParam]);

  const applyCategory = (newCategory: string) => {
    const params = new URLSearchParams(searchParams.toString());

    if (newCategory && newCategory !== "all") params.set("category", newCategory);
    else params.delete("category");

    const qs = params.toString();
    router.push(qs ? `/events?${qs}` : "/events");
  };

  return (
    <div className="flex w-full max-w-4xl items-center">
      <Select
        value={category}
        onValueChange={(val) => {
          setCategory(val);
          applyCategory(val);
        }}
        defaultValue="all"
      >
        <SelectTrigger className="w-full sm:w-[180px] h-10">
          <SelectValue placeholder="Category" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Categories</SelectItem>
          {EVENT_CATEGORIES.map((cat) => (
            <SelectItem key={cat} value={cat}>
              {cat.charAt(0).toUpperCase() + cat.slice(1)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
