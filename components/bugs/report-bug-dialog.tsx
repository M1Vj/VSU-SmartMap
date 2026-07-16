"use client";

import { useEffect, useState, useTransition, useRef, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Loader2, Bug, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { uploadBugScreenshotClient } from "@/lib/supabase/storage-client";
import { TurnstileWidget } from "@/components/ui/turnstile-widget";
import type { TurnstileToken } from "@/lib/types/turnstile";
import { verifyTurnstileToken } from "@/lib/turnstile";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DialogScaffoldBody,
  DialogScaffoldContent,
  DialogScaffoldFooter,
  DialogScaffoldHeader,
} from "@/components/ui/dialog-scaffold";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const bugReportSchema = z.object({
  title: z.string().min(5, "Title must be at least 5 characters"),
  description: z.string().min(10, "Description must be at least 10 characters"),
  severity: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
});

type BugReportFormValues = z.infer<typeof bugReportSchema>;

interface ReportBugDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ReportBugDialog({ open, onOpenChange }: ReportBugDialogProps) {
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
  } = useForm<BugReportFormValues>({
    resolver: zodResolver(bugReportSchema),
    defaultValues: {
      title: "",
      description: "",
      severity: "LOW",
    },
  });

  const severityValue = watch("severity");

  // Reset form when dialog opens/closes
  useEffect(() => {
    if (!open) {
      reset();
      setSelectedImage(null);
      setCaptchaError(null);
      resetTurnstile();
      if (imagePreview) {
        URL.revokeObjectURL(imagePreview);
        setImagePreview(null);
      }
    }
  }, [open, reset, imagePreview, resetTurnstile]);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error("Image must be less than 5MB");
        return;
      }

      // Revoke previous URL if it exists
      if (imagePreview) {
        URL.revokeObjectURL(imagePreview);
      }

      setSelectedImage(file);
      const url = URL.createObjectURL(file);
      setImagePreview(url);
    }
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

  const onSubmit = (values: BugReportFormValues) => {
    // Verify turnstile token before submission
    const turnstilePayload = turnstileTokenRef.current;
    if (!turnstilePayload?.token) {
      setCaptchaError("Please complete the captcha verification.");
      return;
    }

    startTransition(async () => {
      try {
        // Verify turnstile token server-side
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
        let screenshotUrl = null;

        // 1. Upload image if selected (FIRST, to avoid RLS issues with public users updating)
        if (selectedImage) {
          const { data: uploadData, error: uploadError } = await uploadBugScreenshotClient(
            reportId,
            selectedImage
          );

          if (uploadError) {
            console.error("Failed to upload screenshot", uploadError);
            toast.warning("Bug report submitting, but screenshot upload failed.");
          } else if (uploadData?.publicUrl) {
            screenshotUrl = uploadData.publicUrl;
          }
        }

        // 2. Create the bug report with the screenshot URL already included
        const { error: reportError } = await supabase
          .from("bug_reports")
          .insert({
            id: reportId,
            title: values.title,
            description: values.description,
            severity: values.severity,
            screenshot_url: screenshotUrl,
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
          if (process.env.NODE_ENV === 'development') {
            console.error("Supabase Report Insert Error:", {
              message: reportError.message,
              details: reportError.details,
              hint: reportError.hint,
              code: reportError.code
            });
          } else {
            console.error("Failed to create bug report:", reportError.message);
          }
          throw reportError;
        }

        toast.success("Bug report submitted successfully! Thank you for your feedback.");
        onOpenChange(false);
      } catch (error) {
        console.error("Failed to submit bug report:", error);
        toast.error("Failed to submit bug report. Please try again.");
        resetTurnstile();
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogScaffoldContent className="sm:max-w-[500px]">
        <DialogScaffoldHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bug className="h-5 w-5" />
            Report a Bug
          </DialogTitle>
          <DialogDescription>
            Found an issue? Let us know so we can fix it.
          </DialogDescription>
        </DialogScaffoldHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col flex-1 min-h-0">
          <DialogScaffoldBody>
            <div className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="title" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                  Title
                </label>
                <Input
                  id="title"
                  placeholder="Brief summary of the issue"
                  {...register("title")}
                />
                {errors.title && (
                  <p className="text-sm font-medium text-destructive">{errors.title.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <label htmlFor="severity" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                  Severity
                </label>
                <Select
                  value={severityValue}
                  onValueChange={(value) => setValue("severity", value as "LOW" | "MEDIUM" | "HIGH" | "CRITICAL")}
                >
                  <SelectTrigger id="severity">
                    <SelectValue placeholder="Select severity" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="LOW">Low - Minor cosmetic issue</SelectItem>
                    <SelectItem value="MEDIUM">Medium - Feature not working as expected</SelectItem>
                    <SelectItem value="HIGH">High - Feature broken / Cannot use app</SelectItem>
                    <SelectItem value="CRITICAL">Critical - Data loss / Security issue</SelectItem>
                  </SelectContent>
                </Select>
                {errors.severity && (
                  <p className="text-sm font-medium text-destructive">{errors.severity.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <label htmlFor="description" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                  Description
                </label>
                <Textarea
                  id="description"
                  placeholder="Please emphasize details on what happened..."
                  className="resize-none min-h-[100px]"
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
                      if (e.key === 'Enter' || e.key === ' ') {
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
                    <img
                      src={imagePreview}
                      alt="Preview"
                      className="w-full h-full object-cover"
                    />
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
