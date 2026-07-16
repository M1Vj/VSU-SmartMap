"use client";

import { useEffect, useState } from "react";
import { getRoomsByFacility } from "@/lib/supabase/queries/rooms";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import Image from "next/image";
import { ImageZoomDialog } from "@/components/ui/image-zoom-dialog";
import { SuggestRoomModal } from "@/components/suggestions/suggest-room-modal";
import { AlertCircle, Pencil, Plus } from "lucide-react";

interface RoomRow {
    id: string;
    facility_id: string;
    room_code: string;
    name: string | null;
    description: string | null;
    floor: number | null;
    image_url: string | null;
    image_credit: string | null;
}

interface RoomListProps {
    facilityId: string;
    facilityName: string;
    facilityCode?: string;
}

export function RoomList({ facilityId, facilityName, facilityCode }: RoomListProps) {
    const [rooms, setRooms] = useState<RoomRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [suggestOpen, setSuggestOpen] = useState(false);
    const [selectedRoom, setSelectedRoom] = useState<RoomRow | null>(null);
    const [zoomImage, setZoomImage] = useState<{ src: string; credit?: string } | null>(null);

    useEffect(() => {
        let mounted = true;

        async function fetchRooms() {
            setLoading(true);
            setError(null);
            try {
                const { data, error } = await getRoomsByFacility({ facilityId });
                if (error) {
                    throw new Error(error.message);
                }
                if (mounted) {
                    setRooms((data as RoomRow[]) || []);
                }
            } catch (err) {
                if (mounted) {
                    setError(err instanceof Error ? err.message : "Failed to load rooms");
                }
            } finally {
                if (mounted) {
                    setLoading(false);
                }
            }
        }

        fetchRooms();

        return () => {
            mounted = false;
        };
    }, [facilityId]);

    if (loading) {
        return (
            <div className="space-y-3">
                <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium text-muted-foreground">Rooms</h3>
                </div>
                <div className="space-y-2">
                    <Skeleton className="h-16 w-full" />
                    <Skeleton className="h-16 w-full" />
                    <Skeleton className="h-16 w-full" />
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex items-center gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                <AlertCircle className="h-4 w-4" />
                <p>{error}</p>
            </div>
        );
    }

    const renderHeader = () => (
        <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-muted-foreground">Rooms</h3>
            <Button
                variant="ghost"
                size="sm"
                className="h-7 gap-1 px-2 text-xs"
                onClick={() => setSuggestOpen(true)}
            >
                <Plus className="h-3.5 w-3.5" />
                Suggest room
            </Button>
        </div>
    );

    const handleSuggestEdit = (room: RoomRow) => {
        setSelectedRoom(room);
        setSuggestOpen(true);
    };

    const handleOpenSuggest = (open: boolean) => {
        setSuggestOpen(open);
        if (!open) setSelectedRoom(null);
    };

    if (rooms.length === 0) {
        return (
            <>
                <div className="space-y-3">
                    {renderHeader()}
                    <p className="text-sm text-muted-foreground">
                        No rooms listed yet. Know a room in this building?
                    </p>
                </div>
                <SuggestRoomModal
                    open={suggestOpen}
                    onOpenChange={handleOpenSuggest}
                    facilityId={facilityId}
                    facilityName={facilityName}
                    facilityCode={facilityCode}
                />
            </>
        );
    }

    return (
        <>
            <div className="space-y-3">
                {renderHeader()}
                <div className="grid gap-2">
                    {rooms.map((room) => (
                        <Card key={room.id} className="overflow-hidden">
                            <CardContent className="p-0 flex">
                                {room.image_url && (
                                    <div className="relative w-24 shrink-0 overflow-hidden border-r bg-muted">
                                        <button
                                            type="button"
                                            className="h-full w-full cursor-zoom-in"
                                            onClick={() => setZoomImage({ src: room.image_url!, credit: room.image_credit ?? undefined })}
                                        >
                                            <Image
                                                src={room.image_url}
                                                alt={room.name || room.room_code}
                                                fill
                                                className="object-cover transition-transform hover:scale-105"
                                                sizes="96px"
                                            />
                                        </button>
                                    </div>
                                )}
                                <div className="flex-1 p-3 min-w-0">
                                    <div className="flex items-center justify-between gap-2">
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <span className="font-medium">{room.room_code}</span>
                                                {room.floor !== null && (
                                                    <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                                                        Floor {room.floor}
                                                    </span>
                                                )}
                                            </div>
                                            {room.name && (
                                                <p className="text-sm text-muted-foreground">{room.name}</p>
                                            )}
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-6 w-6 text-muted-foreground hover:text-foreground"
                                            onClick={() => handleSuggestEdit(room)}
                                        >
                                            <Pencil className="h-3 w-3" />
                                            <span className="sr-only">Suggest edit</span>
                                        </Button>
                                    </div>
                                    {room.description && (
                                        <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                                            {room.description}
                                        </p>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </div >
            <SuggestRoomModal
                open={suggestOpen}
                onOpenChange={handleOpenSuggest}
                facilityId={facilityId}
                facilityName={facilityName}
                facilityCode={facilityCode}
                initialData={selectedRoom ? {
                    facilityId,
                    roomCode: selectedRoom.room_code,
                    name: selectedRoom.name ?? "",
                    description: selectedRoom.description ?? "",
                    floor: selectedRoom.floor ?? undefined,
                    imageUrl: selectedRoom.image_url ?? undefined,
                    imageCredit: selectedRoom.image_credit ?? ""
                } : undefined}
                roomId={selectedRoom?.id}
            />
            {zoomImage && (
                <ImageZoomDialog
                    open={!!zoomImage}
                    onOpenChange={(open) => !open && setZoomImage(null)}
                    src={zoomImage.src}
                    alt="Room image"
                    credit={zoomImage.credit}
                />
            )}
        </>
    );
}
