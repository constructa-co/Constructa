"use client";

import { Upload } from "lucide-react";
import { fieldMessage } from "@/lib/case-library/messages";
import { CASE_STUDY_PHOTO_COUNT, type CaseStudyPhotoSlot } from "@/lib/case-library/photos";

export type PhotoUpload = (slot: number, file: File) => Promise<void>;

/** File upload is offered only when persistence is on the wire contract and a handler exists. */
export function libraryPhotoUploadOffered(persistenceAvailable: boolean, onUpload?: PhotoUpload): boolean {
    return persistenceAvailable && typeof onUpload === "function";
}

export default function CaseStudyPhotoSlots({
    photos,
    onChange,
    onUpload,
    cardIndex,
    persistenceAvailable,
}: {
    photos: CaseStudyPhotoSlot[];
    onChange: (slot: number, patch: Partial<CaseStudyPhotoSlot>) => void;
    /** Replaced in tests; defaults to no upload. */
    onUpload?: PhotoUpload;
    cardIndex: number;
    /** From {@link caseLibraryDraftPhotosOnWire}; when false, upload/replace is not offered. */
    persistenceAvailable: boolean;
}) {
    const canUpload = libraryPhotoUploadOffered(persistenceAvailable, onUpload);
    const unavailableCopy = fieldMessage("photos");
    const slots = photos.length === CASE_STUDY_PHOTO_COUNT ? photos : photos.slice(0, CASE_STUDY_PHOTO_COUNT);
    return (
        <div data-case-study-photos className="space-y-2">
            <p className="text-base font-semibold text-slate-100">Photos {!persistenceAvailable && <span className="font-normal text-slate-400">(not available yet)</span>}{persistenceAvailable && <span className="font-normal text-slate-300">(optional, up to 3)</span>}</p>
            <p className="text-sm text-slate-300">{persistenceAvailable ? "Add your own pictures in order. A caption is optional and stays with each slot." : unavailableCopy}</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {Array.from({ length: CASE_STUDY_PHOTO_COUNT }, (_, slot) => {
                    const photo = slots[slot] ?? { url: "", caption: "" };
                    return (
                        <div key={slot} className="rounded-lg border border-slate-600 bg-slate-950 overflow-hidden">
                            <div className="aspect-[4/3] relative group bg-slate-900">
                                {photo.url ? (
                                    <>
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img src={photo.url} alt={photo.caption || `Photo ${slot + 1}`} className="w-full h-full object-cover" />
                                        {canUpload && (
                                            <label className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center cursor-pointer transition-opacity">
                                                <Upload className="w-5 h-5 text-white" aria-hidden />
                                                <input type="file" accept="image/jpeg,image/png,image/webp" aria-label={`Replace photo ${slot + 1} for past work ${cardIndex + 1}`} className="sr-only" onChange={(event) => { const file = event.target.files?.[0]; if (file) void onUpload!(slot, file); }} />
                                            </label>
                                        )}
                                    </>
                                ) : canUpload ? (
                                    <label className="w-full h-full flex flex-col items-center justify-center cursor-pointer hover:bg-slate-800 transition-colors">
                                        <Upload className="w-5 h-5 text-slate-500 mb-1" aria-hidden />
                                        <span className="text-[10px] text-slate-500">Upload</span>
                                        <input type="file" accept="image/jpeg,image/png,image/webp" aria-label={`Upload photo ${slot + 1} for past work ${cardIndex + 1}`} className="sr-only" onChange={(event) => { const file = event.target.files?.[0]; if (file) void onUpload!(slot, file); }} />
                                    </label>
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-xs text-slate-500 px-2 text-center">No picture</div>
                                )}
                            </div>
                            {persistenceAvailable && (
                                <>
                                    <label htmlFor={`cs-photo-caption-${cardIndex}-${slot}`} className="sr-only">Caption for photo {slot + 1}</label>
                                    <input
                                        id={`cs-photo-caption-${cardIndex}-${slot}`}
                                        className="w-full border-t border-slate-700 bg-slate-950 px-2 py-2 text-sm text-slate-100 placeholder:text-slate-500"
                                        value={photo.caption}
                                        maxLength={300}
                                        placeholder="Caption (optional)"
                                        onChange={(event) => onChange(slot, { caption: event.target.value })}
                                    />
                                </>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
