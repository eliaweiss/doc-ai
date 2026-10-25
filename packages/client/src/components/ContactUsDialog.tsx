"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@zdocs/client-component";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@zdocs/client-component";
import { Input } from "@zdocs/client-component";
import { Textarea } from "@zdocs/client-component";
import { Button } from "@zdocs/client-component";
import { useAppStore } from "../context-providers/appStore";
import { zFetch } from "../lib/utils";

interface ContactUsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ContactUsDialog({ open, onOpenChange }: ContactUsDialogProps) {
  const t = useTranslations("appPage");
  const { loginUser } = useAppStore();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const contactFormSchema = useMemo(
    () =>
      z.object({
        name: z.string().min(1, { message: t("contactUsNameRequired") }),
        email: z.string().email({ message: t("contactUsEmailInvalid") }),
        subject: z.string().min(1, { message: t("contactUsSubjectRequired") }),
        message: z.string().min(1, { message: t("contactUsMessageRequired") }),
      }),
    [t]
  );

  type ContactFormData = z.infer<typeof contactFormSchema>;

  const form = useForm<ContactFormData>({
    resolver: zodResolver(contactFormSchema as any),
    defaultValues: {
      name: "",
      email: "",
      subject: "",
      message: "",
    },
  });

  // Pre-populate name and email when dialog opens
  useEffect(() => {
    if (open && loginUser) {
      form.reset({
        name: loginUser.name || "",
        email: loginUser.email || "",
        subject: "",
        message: "",
      });
    }
  }, [open, loginUser, form]);

  const onSubmit = async (data: ContactFormData) => {
    setIsSubmitting(true);
    try {
      await zFetch("/api/contact-us", {
        method: "POST",
        body: {
          name: data.name,
          email: data.email,
          subject: data.subject,
          message: data.message,
        },
      });

      toast.success(t("contactUsSuccess"));
      form.reset();
      onOpenChange(false);
    } catch (error: any) {
      console.error("Failed to submit contact form:", error);
      toast.error(
        error.message || t("contactUsError") || "Failed to submit contact form"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    form.reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg" data-testid="contact-us-dialog">
        <DialogHeader>
          <DialogTitle>{t("contactUs")}</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("contactUsName")}</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder={t("contactUsNamePlaceholder")}
                      data-testid="contact-us-name-input"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("contactUsEmail")}</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      type="email"
                      placeholder={t("contactUsEmailPlaceholder")}
                      data-testid="contact-us-email-input"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="subject"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("contactUsSubject")}</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder={t("contactUsSubjectPlaceholder")}
                      data-testid="contact-us-subject-input"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="message"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("contactUsMessage")}</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      placeholder={t("contactUsMessagePlaceholder")}
                      className="min-h-[120px]"
                      data-testid="contact-us-message-input"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={handleCancel}
                data-testid="contact-us-cancel-btn"
              >
                {t("cancel")}
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                data-testid="contact-us-submit-btn"
              >
                {isSubmitting ? t("submitting") || "Submitting..." : t("submit")}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
