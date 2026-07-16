"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { MapPinned, Pencil } from "lucide-react";
import { FacilityHeader } from "./facility-header";
import { ContactInfo } from "./contact-info";
import { RoomList } from "./room-list";
import { ActionButtons } from "./action-buttons";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { useApp } from "@/lib/context/app-context";
import { createFacilitySelectionRequest } from "@/lib/navigation/facility-navigation";
import type { Facility } from "@/lib/types/facility";

const SuggestEditModal = dynamic(
  () => import("@/components/suggestions/suggest-edit-modal").then((module) => module.SuggestEditModal),
  { ssr: false }
);

export function FacilitySheet() {
  const pathname = usePathname();
  const {
    selectedFacility,
    selectFacility,
    facilitySheetOpen,
    setActiveTab,
    setFacilitySheetOpen,
  } = useApp();
  const isMapPage = pathname === "/";
  const open = !!selectedFacility && (!isMapPage || facilitySheetOpen);
  const [suggestOpen, setSuggestOpen] = useState(false);

  const [fullFacility, setFullFacility] = useState<Facility | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  useEffect(() => {
    if (!open) {
      setSuggestOpen(false);
      setFullFacility(null);
      setLoadingDetails(false);
      return;
    }

    // Check if we need to fetch full details (e.g. description is missing)
    if (selectedFacility && !('description' in selectedFacility) && !fullFacility) {
      setLoadingDetails(true);
      import("@/lib/supabase/queries/facilities")
        .then(({ getFacilityById }) => getFacilityById({ id: selectedFacility.id }))
        .then(({ data }) => {
          if (data) {
            setFullFacility(data);
          }
        })
        .finally(() => setLoadingDetails(false));
    }
  }, [open, selectedFacility, fullFacility]);

  // Use full details if available, otherwise fall back to passed facility (Lite)
  const displayFacility = fullFacility?.id === selectedFacility?.id ? fullFacility : selectedFacility;

  const handleSeeInMap = () => {
    if (!displayFacility) return;

    if (isMapPage) {
      setFacilitySheetOpen(false);
      return;
    }

    const request = createFacilitySelectionRequest(displayFacility);
    setActiveTab(request.tab, request.options);
  };

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(isOpen) => {
          if (isOpen) return;

          if (isMapPage) {
            setFacilitySheetOpen(false);
            return;
          }

          selectFacility(null);
        }}
      >
        <DialogContent
          className="flex h-[85dvh] max-h-[85dvh] w-[90vw] max-w-lg flex-col gap-0 p-0 sm:h-[90dvh] sm:max-h-[90dvh]"
        >
          <VisuallyHidden>
            <DialogTitle>{displayFacility?.name ?? "Facility Details"}</DialogTitle>
            <DialogDescription>Details for {displayFacility?.name ?? "selected facility"}</DialogDescription>
          </VisuallyHidden>

          {displayFacility && (
            <>
              <div className="flex shrink-0 flex-wrap items-center gap-2 px-6 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={handleSeeInMap}
                >
                  <MapPinned className="h-4 w-4" aria-hidden />
                  See in map
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="gap-2"
                  onClick={() => setSuggestOpen(true)}
                >
                  <Pencil className="h-4 w-4" aria-hidden />
                  Suggest Edit
                </Button>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6">
                <div className="space-y-6 pb-6 pt-4">
                  <FacilityHeader
                    facility={displayFacility}
                    onAddPhoto={() => setSuggestOpen(true)}
                    parentOpen={open}
                  />
                  {loadingDetails && !displayFacility.description && (
                    <div className="space-y-2 px-1">
                      <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
                      <div className="h-4 w-1/2 animate-pulse rounded bg-muted" />
                    </div>
                  )}
                  <ActionButtons facility={displayFacility} />
                  <ContactInfo
                    address="Visayas State University, Baybay City, Leyte"
                    contact={{
                      website: displayFacility.website,
                      facebook: displayFacility.facebook,
                      phone: displayFacility.phone,
                    }}
                  />

                  {displayFacility.hasRooms && (
                    <>
                      <div className="h-px bg-border" />
                      <RoomList facilityId={displayFacility.id} facilityName={displayFacility.name} facilityCode={displayFacility.code} />
                    </>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
      {suggestOpen && displayFacility && (
        <SuggestEditModal
          facility={displayFacility}
          open
          onOpenChange={(isOpen) => setSuggestOpen(isOpen)}
        />
      )}
    </>
  );
}
