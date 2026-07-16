"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Loader2, Route as RouteIcon, Upload, X } from "lucide-react";
import { toast } from "sonner";

import { createClient } from "@/lib/supabase/client";
import { uploadBugScreenshotClient } from "@/lib/supabase/storage-client";
import { TurnstileWidget } from "@/components/ui/turnstile-widget";
import type { TurnstileToken } from "@/lib/types/turnstile";
import { verifyTurnstileToken } from "@/lib/turnstile";
import type { TransportMode } from "@/lib/types/graph";

import { Button } from "@/components/ui/button";
import { Dialog, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import {
  DialogScaffoldBody,
  DialogScaffoldContent,
  DialogScaffoldFooter,
  DialogScaffoldHeader,
} from "@/components/ui/dialog-scaffold";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const routeReportSchema = z.object({
  fromText: z.string().optional(),
  toText: z.string().optional(),
  mode: z.enum(["walking", "driving"]),
  issueType: z.enum(["incorrect_path", "missing_path", "closed_path", "accessibility", "other"]),
  description: z.string().min(10, "Description must be at least 10 characters"),
});

type RouteReportFormValues = z.infer<typeof routeReportSchema>;

export type RouteReportContext = {
  fromText?: string | null;
  toText?: string | null;
  destinationId?: string | null;
  start?: { lat: number; lng: number } | null;
  end?: { lat: number; lng: number } | null;
  mode?: TransportMode | null;
  routeIndex?: number | null;
  routeCount?: number | null;
  totalDistanceMeters?: number | null;
};

interface ReportRouteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  context?: RouteReportContext;
}

const ISSUE_LABELS: Record<RouteReportFormValues["issueType"], string> = {
  incorrect_path: "Incorrect route/pathway",
  missing_path: "Missing pathway",
  closed_path: "Closed/blocked pathway",
  accessibility: "Accessibility issue",
  other: "Other navigation issue",
};

export function ReportRouteDialog({ open, onOpenChange, context }: ReportRouteDialogProps) {
  const [isPending, startTransition] = useTransition();
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [captchaError, setCaptchaError] = useState<string | null>(null);
  const [turnstileResetKey, setTurnstileResetKey] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const turnstileTokenRef = useRef<TurnstileToken | null>(null);
  const supabase = createClient();

  const resetTurnstile = useCallback(() => {
    turnstileTokenRef.current = null;
    setTurnstileResetKey((value) => value + 1);
  }, []);

  const handleTurnstileVerify = useCallback((payload: TurnstileToken) => {
    turnstileTokenRef.current = payload;
    setCaptchaError(null);
  }, []);

  const handleTurnstileError = useCallback((code?: string) => {
    if (code) {
      setCaptchaError(`Captcha error (code ${code}). Please try again.`);
    }
  }, []);

  const handleTurnstileExpire = useCallback(() => {
    turnstileTokenRef.current = null;
    setCaptchaError("Captcha expired. Please complete it again.");
  }, []);

  const handleTurnstileReset = useCallback(() => {
    turnstileTokenRef.current = null;
  }, []);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<RouteReportFormValues>({
    resolver: zodResolver(routeReportSchema),
    defaultValues: {
      fromText: context?.fromText ?? "",
      toText: context?.toText ?? "",
      mode: (context?.mode ?? "walking") as RouteReportFormValues["mode"],
      issueType: "incorrect_path",
      description: "",
    },
  });

  const modeValue = watch("mode");
  const issueTypeValue = watch("issueType");

  useEffect(() => {
    if (open) {
      reset({
        fromText: context?.fromText ?? "",
        toText: context?.toText ?? "",
        mode: (context?.mode ?? "walking") as RouteReportFormValues["mode"],
        issueType: "incorrect_path",
        description: "",
      });
      setSelectedImage(null);
      setCaptchaError(null);
      resetTurnstile();
      if (imagePreview) {
        URL.revokeObjectURL(imagePreview);
        setImagePreview(null);
      }
      return;
    }

    // Cleanup when closing
    setSelectedImage(null);
    setCaptchaError(null);
    resetTurnstile();
    if (imagePreview) {
      URL.revokeObjectURL(imagePreview);
      setImagePreview(null);
    }
  }, [
    open,
    context?.fromText,
    context?.toText,
    context?.mode,
    reset,
    resetTurnstile,
    imagePreview,
  ]);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be less than 5MB");
      return;
    }

    if (imagePreview) {
      URL.revokeObjectURL(imagePreview);
    }

    setSelectedImage(file);
    const url = URL.createObjectURL(file);
    setImagePreview(url);
  };

  const removeImage = () => {
    setSelectedImage(null);
    if (imagePreview) {
      URL.revokeObjectURL(imagePreview);
      setImagePreview(null);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen && isPending) {
      toast.info("Please wait for the submission to complete");
      return;
    }
    onOpenChange(newOpen);
  };

  const onSubmit = (values: RouteReportFormValues) => {
    const turnstilePayload = turnstileTokenRef.current;
    if (!turnstilePayload?.token) {
      setCaptchaError("Please complete the captcha verification.");
      return;
    }

    startTransition(async () => {
      try {
        const verifyResult = await verifyTurnstileToken(
          turnstilePayload.token,
          turnstilePayload.idempotencyKey
        );

        if (!verifyResult.success) {
          setCaptchaError(verifyResult.error || "Captcha verification failed.");
          resetTurnstile();
          return;
        }

        const reportId = crypto.randomUUID();
        let screenshotUrl: string | null = null;

        if (selectedImage) {
          const { data: uploadData, error: uploadError } = await uploadBugScreenshotClient(
            reportId,
            selectedImage
          );

          if (uploadError) {
            console.error("Failed to upload screenshot", uploadError);
            toast.warning("Report submitting, but screenshot upload failed.");
          } else if (uploadData?.publicUrl) {
            screenshotUrl = uploadData.publicUrl;
          }
        }

        const fromText = values.fromText?.trim() || context?.fromText?.trim() || "";
        const toText = values.toText?.trim() || context?.toText?.trim() || "";
        const issueLabel = ISSUE_LABELS[values.issueType];

        let title = `Navigation: ${issueLabel}`;
        if (fromText || toText) {
          title += ` (${fromText || "?"} -> ${toText || "?"})`;
        }

        const { error: reportError } = await supabase
          .from("bug_reports")
          .insert({
            id: reportId,
            title,
            description: values.description,
            severity: "MEDIUM",
            screenshot_url: screenshotUrl,
            user_details: {
              report_type: "navigation",
              issue_type: values.issueType,
              from_text: fromText || null,
              to_text: toText || null,
              mode: values.mode,
              destination_id: context?.destinationId ?? null,
              start: context?.start ?? null,
              end: context?.end ?? null,
              route_index: context?.routeIndex ?? null,
              route_count: context?.routeCount ?? null,
              total_distance_meters: context?.totalDistanceMeters ?? null,
            },
            device_info: {
              userAgent: navigator.userAgent,
              pathname: window.location.pathname,
              viewport: `${window.innerWidth}x${window.innerHeight}`,
              screen: `${window.screen.width}x${window.screen.height}`,
              language: navigator.language,
              timestamp: new Date().toISOString(),
            },
            status: "OPEN",
          });

        if (reportError) {
          throw reportError;
        }

        toast.success("Route report submitted! Thank you for improving SmartMap.");
        onOpenChange(false);
      } catch (error) {
        console.error("Failed to submit route report:", error);
        toast.error("Failed to submit route report. Please try again.");
        resetTurnstile();
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogScaffoldContent className="sm:max-w-[520px]">
        <DialogScaffoldHeader>
          <DialogTitle className="flex items-center gap-2">
            <RouteIcon className="h-5 w-5" />
            Report Incorrect Route/Pathway
          </DialogTitle>
          <DialogDescription>
            Report inaccurate routes, missing pathways, or incorrect travel directions.
          </DialogDescription>
        </DialogScaffoldHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col flex-1 min-h-0">
          <DialogScaffoldBody>
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <label
                    htmlFor="fromText"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    From (Optional)
                  </label>
                  <Input
                    id="fromText"
                    placeholder="e.g., Admin Building"
                    {...register("fromText")}
                  />
                </div>

                <div className="space-y-2">
                  <label
                    htmlFor="toText"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    To (Optional)
                  </label>
                  <Input
                    id="toText"
                    placeholder="e.g., Library"
                    {...register("toText")}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <label
                    htmlFor="mode"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    Travel Mode
                  </label>
                  <Select
                    value={modeValue}
                    onValueChange={(value) => setValue("mode", value as RouteReportFormValues["mode"])}
                  >
                    <SelectTrigger id="mode">
                      <SelectValue placeholder="Select mode" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="walking">Walking</SelectItem>
                      <SelectItem value="driving">Driving</SelectItem>
                    </SelectContent>
                  </Select>
                  {errors.mode && (
                    <p className="text-sm font-medium text-destructive">{errors.mode.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <label
                    htmlFor="issueType"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    Issue Type
                  </label>
                  <Select
                    value={issueTypeValue}
                    onValueChange={(value) => setValue("issueType", value as RouteReportFormValues["issueType"])}
                  >
                    <SelectTrigger id="issueType">
                      <SelectValue placeholder="Select issue type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="incorrect_path">{ISSUE_LABELS.incorrect_path}</SelectItem>
                      <SelectItem value="missing_path">{ISSUE_LABELS.missing_path}</SelectItem>
                      <SelectItem value="closed_path">{ISSUE_LABELS.closed_path}</SelectItem>
                      <SelectItem value="accessibility">{ISSUE_LABELS.accessibility}</SelectItem>
                      <SelectItem value="other">{ISSUE_LABELS.other}</SelectItem>
                    </SelectContent>
                  </Select>
                  {errors.issueType && (
                    <p className="text-sm font-medium text-destructive">{errors.issueType.message}</p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="description"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Description
                </label>
                <Textarea
                  id="description"
                  placeholder="Describe what was wrong with the route and what the correct path should be..."
                  className="resize-none min-h-[110px]"
                  {...register("description")}
                />
                {errors.description && (
                  <p className="text-sm font-medium text-destructive">{errors.description.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                  Screenshot (Optional)
                </label>

                {!imagePreview ? (
                  <div
                    className="border-2 border-dashed rounded-md p-4 flex flex-col items-center justify-center cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => fileInputRef.current?.click()}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        fileInputRef.current?.click();
                      }
                    }}
                    role="button"
                    tabIndex={0}
                    aria-label="Upload screenshot"
                  >
                    <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground text-center">
                      Click to upload a screenshot
                      <br />
                      <span className="text-xs text-muted-foreground/70">(Max 5MB)</span>
                    </p>
                  </div>
                ) : (
                  <div className="relative rounded-md overflow-hidden border aspect-video group">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                    <Button
                      type="button"
                      variant="destructive"
                      size="icon"
                      className="absolute top-2 right-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeImage();
                      }}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                )}

                <input
                  type="file"
                  ref={fileInputRef}
                  className="hidden"
                  accept="image/*"
                  onChange={handleImageSelect}
                />
              </div>

              <div className="space-y-2">
                <TurnstileWidget
                  onVerify={handleTurnstileVerify}
                  onError={handleTurnstileError}
                  onExpire={handleTurnstileExpire}
                  onReset={handleTurnstileReset}
                  resetSignal={turnstileResetKey}
                />
                {captchaError && (
                  <p className="text-sm font-medium text-destructive">{captchaError}</p>
                )}
              </div>
            </div>
          </DialogScaffoldBody>

          <DialogScaffoldFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Submit Report
            </Button>
          </DialogScaffoldFooter>
        </form>
      </DialogScaffoldContent>
    </Dialog>
  );
}

