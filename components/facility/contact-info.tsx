import { Mail, Phone, Globe, Facebook, MapPin } from "lucide-react";
import type { ContactInfo as ContactInfoType } from "@/lib/types/common";
import { cn } from "@/lib/utils";

interface ContactInfoProps {
    contact?: ContactInfoType;
    address?: string; // Address might be separate or part of contact
    className?: string;
}

export function ContactInfo({ contact, address, className }: ContactInfoProps) {
    if (!contact && !address) return null;

    return (
        <div className={cn("space-y-3", className)}>
            <h3 className="text-sm font-medium text-muted-foreground">Contact Information</h3>
            <div className="space-y-2 text-sm">
                {address && (
                    <div className="flex items-start gap-2">
                        <MapPin className="mt-0.5 h-4 w-4 text-muted-foreground" />
                        <span>{address}</span>
                    </div>
                )}

                {contact?.email && (
                    <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        <a
                            href={`mailto:${contact.email}`}
                            className="text-primary hover:underline"
                        >
                            {contact.email}
                        </a>
                    </div>
                )}

                {contact?.phone && (
                    <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        <a
                            href={`tel:${contact.phone}`}
                            className="text-primary hover:underline"
                        >
                            {contact.phone}
                        </a>
                    </div>
                )}

                {contact?.website && (
                    <div className="flex items-center gap-2">
                        <Globe className="h-4 w-4 text-muted-foreground" />
                        <a
                            href={contact.website}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline"
                        >
                            Website
                        </a>
                    </div>
                )}

                {contact?.facebook && (
                    <div className="flex items-center gap-2">
                        <Facebook className="h-4 w-4 text-muted-foreground" />
                        <a
                            href={contact.facebook}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline"
                        >
                            Facebook
                        </a>
                    </div>
                )}
            </div>
        </div>
    );
}
