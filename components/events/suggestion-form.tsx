"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import { Loader2, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { v4 as uuidv4 } from "uuid";

import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { TurnstileWidget } from "@/components/ui/turnstile-widget";
import type { TurnstileToken } from "@/lib/types/turnstile";
import { submitEventSuggestion } from "@/lib/actions/events";
import { EVENT_CATEGORIES } from "@/lib/types/events";
import { uploadEventProofClient } from "@/lib/supabase/storage-client";
import { FacilitySelectorUnified } from "@/components/facility/facility-selector-unified";

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

const formSchema = z.object({
  title: z.string().min(2, "Title must be at least 2 characters"),
  description: z.string().optional(),
  startTime: z.string().min(1, "Start time is required"),
  endTime: z.string().min(1, "End time is required"),
  locationText: z.string().min(1, "Location is required"),
  category: z.enum(EVENT_CATEGORIES),
  proofFile: z
    .custom<FileList>()
    .refine((files) => files?.length === 1, "Proof image is required")
    .refine(
      (files) => files?.[0]?.size <= MAX_FILE_SIZE,
      'Max file size is 5MB.'
    )
    .refine(
      (files) => ACCEPTED_IMAGE_TYPES.includes(files?.[0]?.type),
      "Only .jpg, .png, and .webp formats are supported."
    ),
});

interface SuggestionFormProps {
  onSuccess?: () => void;
  open?: boolean;
}

export const SuggestionForm = React.memo(function SuggestionForm({ onSuccess, open }: SuggestionFormProps) {
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const router = useRouter();

  const [turnstileResetKey, setTurnstileResetKey] = React.useState(0);
  const turnstileTokenRef = React.useRef<TurnstileToken | null>(null);
  const [captchaError, setCaptchaError] = React.useState<string | null>(null);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "",
      description: "",
      startTime: "",
      endTime: "",
      locationText: "",
      category: "academic",
    },
  });

  const handleTurnstileVerify = React.useCallback((payload: TurnstileToken) => {
    if (turnstileTokenRef.current?.token === payload.token) return;
    turnstileTokenRef.current = payload;
    setCaptchaError(null);
  }, []);

  const handleTurnstileError = React.useCallback((errorCode?: string) => {
    setCaptchaError('Captcha error: ' + (errorCode || "Unknown error"));
  }, []);

  const handleTurnstileExpire = React.useCallback(() => {
    turnstileTokenRef.current = null;
    setCaptchaError("Captcha expired. Please verify again.");
  }, []);

  const handleTurnstileReset = React.useCallback(() => {
    turnstileTokenRef.current = null;
  }, []);

  const resetTurnstile = React.useCallback(() => {
    setTurnstileResetKey((prev) => prev + 1);
    turnstileTokenRef.current = null;
  }, []);

  const wasOpen = React.useRef(open);
  React.useEffect(() => {
    if (!open && wasOpen.current) {
      form.reset();
      setCaptchaError(null);
      resetTurnstile();
    }
    wasOpen.current = open;
  }, [open, resetTurnstile, form]);

  async function onSubmit(values: z.infer<typeof formSchema>) {
    const turnstilePayload = turnstileTokenRef.current;
    if (!turnstilePayload?.token) {
      setCaptchaError("Please complete the captcha verification.");
      return;
    }

    setIsSubmitting(true);
    setCaptchaError(null);

    try {
      const file = values.proofFile[0];
      const tempId = uuidv4();

      const uploadResult = await uploadEventProofClient(tempId, file, turnstilePayload);

      if (uploadResult.error) {
        throw new Error(uploadResult.error.message);
      }

      const uploadId = uploadResult.data?.uploadId;
      if (!uploadId) {
        throw new Error("Failed to prepare proof image");
      }

      const result = await submitEventSuggestion({
        title: values.title,
        description: values.description,
        startTime: new Date(values.startTime).toISOString(),
        endTime: new Date(values.endTime).toISOString(),
        locationText: values.locationText,
        category: values.category,
        uploadId,
      });

      if (result.error) {
        throw new Error(result.error.message || "Failed to submit suggestion");
      }

      toast.success("Suggestion submitted successfully!");
      form.reset();
      resetTurnstile();
      
      if (onSuccess) {
        onSuccess();
      } else {
        router.push("/events");
      }
      
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Something went wrong");
      console.error(error);
      resetTurnstile();
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Form {...form}>
      <form id="event-suggestion-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Event Title</FormLabel>
              <FormControl>
                <Input placeholder="e.g. VSU Anniversary" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description</FormLabel>
              <FormControl>
                <Textarea 
                  placeholder="Describe the event..." 
                  className="resize-none h-20 text-sm" 
                  {...field} 
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="startTime"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Start Time</FormLabel>
                <FormControl>
                  <Input type="datetime-local" className="h-10" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="endTime"
            render={({ field }) => (
              <FormItem>
                <FormLabel>End Time</FormLabel>
                <FormControl>
                  <Input type="datetime-local" className="h-10" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="category"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Category</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger className="h-10">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {EVENT_CATEGORIES.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat.charAt(0).toUpperCase() + cat.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="locationText"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Location</FormLabel>
                <FormControl>
                  <FacilitySelectorUnified 
                    value={field.value} 
                    onSelect={(f) => field.onChange(f.name)}
                    onCustomEntry={(val) => field.onChange(val)}
                    allowCustom
                    className="h-10"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="proofFile"
          render={({ field: { value, onChange, ...fieldProps } }) => (
            <FormItem>
              <FormLabel>Proof (Image)</FormLabel>
              <FormControl>
                <div className="flex items-center gap-2">
                  <Input
                    {...fieldProps}
                    type="file"
                    accept={ACCEPTED_IMAGE_TYPES.join(",")}
                    onChange={(e) => {
                      onChange(e.target.files);
                    }}
                    className="cursor-pointer h-10"
                  />
                  <Upload className="h-4 w-4 text-muted-foreground shrink-0" />
                </div>
              </FormControl>
              <FormDescription className="text-[11px]">
                Upload an official memo or poster (max 5MB).
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="space-y-2">
          <TurnstileWidget
            onVerify={handleTurnstileVerify}
            onError={handleTurnstileError}
            onExpire={handleTurnstileExpire}
            onReset={handleTurnstileReset}
            resetSignal={turnstileResetKey}
          />
          {captchaError && (
            <p className="text-sm font-medium text-destructive text-center">{captchaError}</p>
          )}
        </div>

        <div className="flex justify-end pt-4 border-t">
          <Button 
            type="submit" 
            disabled={isSubmitting} 
            className="w-full h-12 text-base font-bold shadow-md transition-all active:scale-[0.98]"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Submitting Suggestion...
              </>
            ) : (
              "Submit Event Suggestion"
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
});
