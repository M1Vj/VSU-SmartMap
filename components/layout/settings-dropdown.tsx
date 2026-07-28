"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useTheme } from "next-themes";
import { Settings, Moon, Sun, Laptop, Bug, Info, Globe, Map, Footprints, Car, Navigation, Route, HelpCircle, PanelTop } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuPortal,
  DropdownMenuSubContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu";
import { useApp } from "@/lib/context/app-context";
import type { TransportMode } from "@/lib/types/graph";
import { STUDENT_DESTINATIONS } from "@/lib/navigation/student-navigation";

const ReportBugDialog = dynamic(
  () => import("@/components/bugs/report-bug-dialog").then((module) => module.ReportBugDialog),
  { ssr: false }
);

const ReportRouteDialog = dynamic(
  () => import("@/components/navigation/report-route-dialog").then((module) => module.ReportRouteDialog),
  { ssr: false }
);

const HelpGuideDialog = dynamic(
  () => import("@/components/help/help-guide-dialog").then((module) => module.HelpGuideDialog),
  { ssr: false }
);

export function SettingsDropdown() {
  const [mounted, setMounted] = useState(false);
  const { theme, setTheme } = useTheme();
  const {
    mapStyle,
    setMapStyle,
    defaultTransportMode,
    setDefaultTransportMode,
    visibleStudentDestinations,
    toggleStudentDestination,
    resetStudentDestinations,
  } = useApp();
  const [bugDialogOpen, setBugDialogOpen] = useState(false);
  const [routeDialogOpen, setRouteDialogOpen] = useState(false);
  const [helpDialogOpen, setHelpDialogOpen] = useState(false);
  const searchParams = useSearchParams();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (searchParams.get("guide") === "1") setHelpDialogOpen(true);
  }, [searchParams]);

  const handleTransportModeChange = (val: string) => {
    setDefaultTransportMode(val as TransportMode);
  };

  if (!mounted) {
    return (
      <Button variant="ghost" size="icon" className="w-9 h-9" disabled>
        <Settings className="h-[1.2rem] w-[1.2rem]" />
        <span className="sr-only">Settings</span>
      </Button>
    );
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="w-9 h-9" aria-label="Settings">
            <Settings className="h-[1.2rem] w-[1.2rem] transition-transform duration-500" />
            <span className="sr-only">Settings</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>Settings</DropdownMenuLabel>
          <DropdownMenuSeparator />

          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <Sun className="mr-2 h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
              <Moon className="absolute mr-2 h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
              <span className="ml-2">Theme</span>
            </DropdownMenuSubTrigger>
            <DropdownMenuPortal>
              <DropdownMenuSubContent>
                <DropdownMenuRadioGroup value={theme} onValueChange={setTheme}>
                  <DropdownMenuRadioItem value="light">
                    <Sun className="mr-2 h-4 w-4" />
                    Light
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="dark">
                    <Moon className="mr-2 h-4 w-4" />
                    Dark
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="system">
                    <Laptop className="mr-2 h-4 w-4" />
                    System
                  </DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
              </DropdownMenuSubContent>
            </DropdownMenuPortal>
          </DropdownMenuSub>

          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <Globe className="mr-2 h-4 w-4" />
              <span>Map Style</span>
            </DropdownMenuSubTrigger>
            <DropdownMenuPortal>
              <DropdownMenuSubContent>
                <DropdownMenuRadioGroup value={mapStyle} onValueChange={(val) => setMapStyle(val as "vector" | "satellite")}>
                  <DropdownMenuRadioItem value="vector">
                    <Map className="mr-2 h-4 w-4" />
                    Vector
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="satellite">
                    <Globe className="mr-2 h-4 w-4" />
                    Satellite
                  </DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
              </DropdownMenuSubContent>
            </DropdownMenuPortal>
          </DropdownMenuSub>

          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <Navigation className="mr-2 h-4 w-4" />
              <span>Default Travel Mode</span>
            </DropdownMenuSubTrigger>
            <DropdownMenuPortal>
              <DropdownMenuSubContent>
                <DropdownMenuRadioGroup value={defaultTransportMode} onValueChange={handleTransportModeChange}>
                  <DropdownMenuRadioItem value="walking">
                    <Footprints className="mr-2 h-4 w-4" />
                    Walking
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="driving">
                    <Car className="mr-2 h-4 w-4" />
                    Driving
                  </DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
              </DropdownMenuSubContent>
            </DropdownMenuPortal>
          </DropdownMenuSub>

          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <PanelTop className="mr-2 h-4 w-4" />
              <span>Navigation tabs</span>
            </DropdownMenuSubTrigger>
            <DropdownMenuPortal>
              <DropdownMenuSubContent>
                {STUDENT_DESTINATIONS.map((destination) => (
                  <DropdownMenuCheckboxItem
                    key={destination.id}
                    aria-label={destination.label}
                    checked={visibleStudentDestinations.includes(destination.id)}
                    disabled={destination.required}
                    onCheckedChange={() => toggleStudentDestination(destination.id)}
                    onSelect={(event) => event.preventDefault()}
                  >
                    {destination.label}
                  </DropdownMenuCheckboxItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={resetStudentDestinations}>
                  Reset navigation tabs
                </DropdownMenuItem>
              </DropdownMenuSubContent>
            </DropdownMenuPortal>
          </DropdownMenuSub>

          <DropdownMenuSeparator />

          <DropdownMenuItem onClick={() => setHelpDialogOpen(true)}>
            <HelpCircle className="mr-2 h-4 w-4" />
            Help & guide
          </DropdownMenuItem>

          <DropdownMenuItem asChild>
            <Link href="/info" className="flex items-center w-full cursor-pointer">
              <Info className="mr-2 h-4 w-4" />
              <span>About & Info</span>
            </Link>
          </DropdownMenuItem>

          <DropdownMenuItem onClick={() => setRouteDialogOpen(true)}>
            <Route className="mr-2 h-4 w-4" />
            Report Route Issue
          </DropdownMenuItem>

          <DropdownMenuItem onClick={() => setBugDialogOpen(true)}>
            <Bug className="mr-2 h-4 w-4" />
            Report a Bug
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {routeDialogOpen && (
        <ReportRouteDialog open onOpenChange={setRouteDialogOpen} />
      )}
      {bugDialogOpen && (
        <ReportBugDialog open onOpenChange={setBugDialogOpen} />
      )}
      {helpDialogOpen && (
        <HelpGuideDialog open onOpenChange={setHelpDialogOpen} />
      )}
    </>
  );
}
