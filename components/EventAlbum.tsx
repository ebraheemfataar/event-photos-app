"use client";

import { useMemo, useRef, useState, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import type { Event, Photo } from "@/lib/types";
import { formatEventDate, type ValidDetails } from "@/lib/eventDetails";
import EventCover from "@/components/EventCover";
import EventInfoSheet from "@/components/EventInfoSheet";
import EditEventSheet from "@/components/EditEventSheet";
import { photoSrc } from "@/lib/photoSrc";
import { PROMPTS } from "@/lib/prompts";
import { createSupabaseClient } from "@/lib/supabase/client";
import { DEFAULT_THEME } from "@/lib/themes";
import { eventHandle, promptShortLabel, promptSwatch } from "@/lib/display";
import PhotoUploadForm from "@/components/PhotoUploadForm";
import QRCodeCard from "@/components/QRCodeCard";
import Sheet from "@/components/Sheet";
import Spinner from "@/components/Spinner";
import StoryViewer from "@/components/StoryViewer";
import ThemeToggle from "@/components/ThemeToggle";
import { FeedView, GridView } from "@/components/PhotoGrid";
import {
  AddSquareIcon,
  AlbumIcon,
  ArrowRightIcon,
  CameraIcon,
  FeedIcon,
  GridIcon,
  ImagesIcon,
  LockIcon,
  LogoIcon,
  PlusIcon,
  PencilIcon,
  QrIcon,
  ShareIcon,
  TrashIcon,
} from "@/components/icons";

export type AlbumMode = "guest" | "host" | "viewer";

export type EventAlbumProps = {
  /** The event, including its details (theme, date, note, cover, poster, links). */
  event: Event;
  photos: Photo[];
  initialPhotoIds: Set<string>;
  /** guest = can upload; host = valid ?t= token; viewer = host URL without a valid token. */
  mode: AlbumMode;
  /** Server-computed guest link (host page). Guests derive it from window.location. */
  guestUrl?: string;
  /** Mock album (/demo): photos are plain URLs and uploading is switched off. */
  demo?: boolean;
  /** Host page only: the validated ?t= token, sent to delete_event_photo. */
  hostToken?: string;
  /** Drop a photo from the album state after the host removed it. */
  onPhotoRemoved?: (photoId: string) => void;
  /** /demo only: apply edited event details to the page. */
  onDemoEdit?: (details: ValidDetails) => void;
};

type View = "grid" | "feed";


export default function EventAlbum({
  event,
  photos,
  initialPhotoIds,
  mode,
  guestUrl: guestUrlProp,
  demo = false,
  hostToken,
  onPhotoRemoved,
  onDemoEdit,
}: EventAlbumProps) {
  const { id: eventId, name: eventName, is_active: isActive, created_at: createdAt } = event;
  const theme = event.theme ?? DEFAULT_THEME;
  const [view, setView] = useState<View>("grid");
  const [filter, setFilter] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tabsRef = useRef<HTMLDivElement>(null);

  const [removeTarget, setRemoveTarget] = useState<Photo | null>(null);
  const [removing, setRemoving] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  const isHost = mode === "host";
  // Hosts add photos too (same upload path and RLS as guests); a visitor with
  // a wrong host token ("viewer") can't.
  const canUpload = mode === "guest" || mode === "host";
  const canRemove = isHost && Boolean(onPhotoRemoved) && (demo || Boolean(hostToken));
  const canEdit = isHost && !demo && Boolean(hostToken);
  // The editor also opens on /demo?as=host, saving to that page only.
  const showEdit = canEdit || (isHost && demo && Boolean(onDemoEdit));
  // Nudge the host to add a cover until they do (guests see the monogram).
  const needsCover = canEdit && !event.cover_path;
  const eventDate = formatEventDate(event.event_date);

  // The profile picture ripples every ~10 s until it's been tapped once.
  const [coverTapped, setCoverTapped] = useState(false);

  function openCover() {
    setCoverTapped(true);
    if (needsCover) setEditOpen(true);
    else setInfoOpen(true);
  }
  const handle = eventHandle(eventName);

  const guestCount = useMemo(
    () => new Set(photos.map((p) => p.guest_name?.trim().toLowerCase()).filter(Boolean)).size,
    [photos]
  );

  const usedPrompts = useMemo(() => {
    const used = new Set(photos.map((p) => p.prompt_id).filter(Boolean));
    return PROMPTS.filter((p) => used.has(p.id));
  }, [photos]);

  const activeFilter = filter && usedPrompts.some((p) => p.id === filter) ? filter : null;
  const visible = useMemo(
    () => (activeFilter ? photos.filter((p) => p.prompt_id === activeFilter) : photos),
    [photos, activeFilter]
  );
  const freshIds = useMemo(
    () => new Set(photos.filter((p) => !initialPhotoIds.has(p.id)).map((p) => p.id)),
    [photos, initialPhotoIds]
  );
  const openIndex = openId ? visible.findIndex((p) => p.id === openId) : -1;

  function notify(message: string) {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2400);
  }

  async function removePhoto() {
    const target = removeTarget;
    if (!target || !onPhotoRemoved) return;
    setRemoving(true);
    if (!demo) {
      // The database checks the host token (delete_event_photo, 0004); the
      // trigger from 0007 then tells every open album to drop the photo.
      const { error } = await createSupabaseClient().rpc("delete_event_photo", {
        p_photo_id: target.id,
        p_host_token: hostToken,
      });
      if (error) {
        setRemoving(false);
        notify("Couldn't remove the photo. Try again.");
        return;
      }
    }
    // If it was open in the viewer, move on to a neighbouring photo.
    if (openId === target.id) {
      const i = visible.findIndex((p) => p.id === target.id);
      setOpenId(visible[i + 1]?.id ?? visible[i - 1]?.id ?? null);
    }
    onPhotoRemoved(target.id);
    setRemoving(false);
    setRemoveTarget(null);
    notify(demo ? "Photo removed (demo only)" : "Photo removed for everyone");
  }

  function resolveGuestUrl() {
    return guestUrlProp || `${window.location.origin}/e/${eventId}`;
  }

  async function shareAlbum() {
    const url = resolveGuestUrl();
    if (navigator.share) {
      try {
        await navigator.share({ title: eventName, text: `Add your photos to ${eventName}`, url });
      } catch {
        // User cancelled the share sheet.
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      notify("Album link copied");
    } catch {
      notify("Couldn't copy the link");
    }
  }

  async function copyHostLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      notify("Host link copied — keep it somewhere safe");
    } catch {
      notify("Couldn't copy — bookmark this page instead");
    }
  }

  function showView(next: View) {
    setView(next);
    tabsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function goToInvite() {
    const el = document.getElementById("invite");
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
    el?.focus({ preventScroll: true });
  }

  const statusNode = isActive ? (
    <span className="flex items-center justify-center gap-1.5 text-live">
      <span aria-hidden="true" className="pulse h-2 w-2 rounded-full bg-[#22C55E]" />
      Live
    </span>
  ) : (
    <span className="text-ink-3">Closed</span>
  );

  const actions =
    mode === "guest" ? (
      <>
        <button
          type="button"
          onClick={() => setUploadOpen(true)}
          className="flex h-11 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-full bg-btn px-3 text-sm font-semibold text-btn-ink transition-opacity hover:opacity-90 active:scale-[0.97] lg:flex-none lg:gap-2 lg:px-5"
        >
          <PlusIcon size={17} />
          Add photos
        </button>
        <button
          type="button"
          onClick={shareAlbum}
          className="flex h-11 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-full border border-line-strong bg-surface px-3 text-sm font-semibold transition-colors hover:bg-surface-3 lg:flex-none lg:gap-2 lg:px-5"
        >
          <ShareIcon size={17} />
          Share album
        </button>
        <button
          type="button"
          onClick={() => setQrOpen(true)}
          aria-label="Show QR code"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-line-strong bg-surface transition-colors hover:bg-surface-3"
        >
          <QrIcon size={18} />
        </button>
      </>
    ) : isHost ? (
      <>
        <button
          type="button"
          onClick={() => setUploadOpen(true)}
          className="flex h-11 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-full bg-btn px-4 text-sm font-semibold text-btn-ink transition-opacity hover:opacity-90 active:scale-[0.97] lg:flex-none lg:gap-2 lg:px-5"
        >
          <PlusIcon size={17} />
          Add photos
        </button>
        {showEdit && (
          <button
            type="button"
            onClick={() => setEditOpen(true)}
            className="flex h-11 flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-full border border-line-strong bg-surface px-4 text-sm font-semibold transition-colors hover:bg-surface-3 lg:flex-none"
          >
            <PencilIcon size={16} />
            Edit event
          </button>
        )}
      </>
    ) : null;

  const subtitle = isHost ? (
    <>
      {/* Fixed locale + zone so server and client render the same string. */}
      Created {new Date(createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })}
      {" · "}
      {isActive ? "uploads open" : "uploads closed"}
    </>
  ) : (
    [eventDate, event.note || "Add your photos — they show up live for everyone at the event."]
      .filter(Boolean)
      .join(" · ")
  );

  return (
    <div data-theme={theme} className="flex min-h-dvh w-full bg-bg text-ink">
      {/* Desktop sidebar */}
      <nav
        aria-label="Primary"
        className="fixed inset-y-0 left-0 z-30 hidden w-[244px] flex-col gap-1 border-r border-line bg-bg px-3.5 py-7 lg:flex"
      >
        <Link href="/" className="mb-5 flex items-center gap-2.5 rounded-full px-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-btn text-btn-ink">
            <LogoIcon size={17} />
          </span>
          <span className="text-lg font-semibold tracking-[-0.02em]">Snap &amp; Share</span>
        </Link>
        {isHost && (
          <span className="mono -mt-3 mb-4 ml-3 inline-flex h-[22px] items-center self-start rounded-full bg-surface-3 px-2 text-[9px] text-ink-2">
            Host
          </span>
        )}
        <SideItem active={view === "grid"} onClick={() => showView("grid")} icon={<AlbumIcon size={22} filled={view === "grid"} />}>
          Album
        </SideItem>
        <SideItem active={view === "feed"} onClick={() => showView("feed")} icon={<FeedIcon size={22} filled={view === "feed"} />}>
          Live feed
        </SideItem>
        {canUpload && (
          <SideItem onClick={() => setUploadOpen(true)} icon={<AddSquareIcon size={22} />}>
            Add photos
          </SideItem>
        )}
        {isHost && (
          <SideItem onClick={goToInvite} icon={<QrIcon size={22} />}>
            QR &amp; sharing
          </SideItem>
        )}
        {showEdit && (
          <SideItem onClick={() => setEditOpen(true)} icon={<PencilIcon size={22} />}>
            Edit event
          </SideItem>
        )}
        <span className="flex-1" />
        <ThemeToggle variant="nav" />
        <Link
          href="/"
          className="flex h-12 items-center gap-3.5 rounded-xl px-3 text-[15px] font-medium text-ink-2 transition-colors hover:bg-surface-3"
        >
          <PlusIcon size={22} strokeWidth={2} />
          Make your own album
        </Link>
      </nav>

      <div className="min-w-0 flex-1 lg:pl-[244px]">
        {/* Mobile header */}
        <header className="flex h-14 items-center justify-between pl-[18px] pr-2 lg:hidden">
          <div className="flex min-w-0 items-center gap-2">
            {isHost ? (
              <LockIcon size={16} className="shrink-0" />
            ) : (
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-btn text-btn-ink">
                <LogoIcon size={15} />
              </span>
            )}
            <span className="truncate text-[17px] font-semibold tracking-[-0.02em]">{handle}</span>
            {isHost && (
              <span className="mono inline-flex h-[22px] shrink-0 items-center rounded-full bg-surface-3 px-2 text-[9px] text-ink-2">
                Host
              </span>
            )}
          </div>
          <ThemeToggle />
        </header>

        {isHost && (
          <div
            role="note"
            className="mx-3.5 mb-1 flex items-center gap-2.5 rounded-2xl border border-warn-line bg-warn-bg py-1.5 pl-3.5 pr-1.5 text-warn-ink lg:mx-7 lg:mt-5 lg:rounded-full lg:pl-[18px]"
          >
            <LockIcon size={16} className="hidden shrink-0 sm:block" />
            <p className="min-w-0 flex-1 text-[13px] leading-snug lg:text-sm">
              <strong className="font-semibold">Private host link</strong> — save it, don&apos;t share it.
            </p>
            <button
              type="button"
              onClick={copyHostLink}
              className="h-11 shrink-0 rounded-full border border-current px-4 text-[13px] font-semibold transition-colors hover:bg-warn-line/40"
            >
              Copy host link
            </button>
          </div>
        )}

        <main className="mx-auto w-full max-w-[935px] pb-[calc(96px+env(safe-area-inset-bottom))] lg:px-6 lg:pb-16">
          {/* Profile — mobile */}
          <section className="px-[18px] pt-1 lg:hidden">
            <div className="flex items-center gap-[22px]">
              <EventCover event={event} live={isActive} size={88} showAddHint={needsCover} beckon={!coverTapped} onClick={openCover} />
              <dl className="grid flex-1 grid-cols-3 text-center">
                <Stat label="Photos">{photos.length}</Stat>
                <Stat label="Guests">{guestCount}</Stat>
                <Stat label="Status">{statusNode}</Stat>
              </dl>
            </div>
            <h1 className="event-title mt-3">{eventName}</h1>
            <p className="mt-0.5 text-sm leading-snug text-ink-2">{subtitle}</p>
            {actions && <div className="mt-3 flex gap-1.5">{actions}</div>}
          </section>

          {/* Profile — desktop */}
          <section className="hidden items-center gap-14 px-8 pt-9 lg:flex xl:gap-[72px] xl:px-10">
            <EventCover event={event} live={isActive} size={150} showAddHint={needsCover} beckon={!coverTapped} onClick={openCover} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="mr-2.5 max-w-full truncate text-[22px] font-medium tracking-[-0.02em]">{handle}</h1>
                {actions}
              </div>
              <dl className="mt-5 flex gap-9 text-base">
                <div className="flex gap-1.5">
                  <dd className="font-semibold">{photos.length}</dd>
                  <dt>photos</dt>
                </div>
                <div className="flex gap-1.5">
                  <dd className="font-semibold">{guestCount}</dd>
                  <dt>guests</dt>
                </div>
                <div className="font-semibold">
                  <dt className="sr-only">Status</dt>
                  <dd>{statusNode}</dd>
                </div>
              </dl>
              <div className="event-title mt-4">{eventName}</div>
              <p className="mt-0.5 text-[15px] leading-normal text-ink-2">{subtitle}</p>
            </div>
          </section>

          {needsCover && (
            <div className="mx-3.5 mt-4 flex items-center gap-3 rounded-[22px] border border-dashed border-line-strong bg-surface p-3.5 lg:mx-8 lg:mt-8 lg:p-4">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-surface-3">
                <ImagesIcon size={20} />
              </span>
              <p className="min-w-0 flex-1 text-sm leading-snug">
                <strong className="font-semibold">Add a cover photo or logo.</strong>{" "}
                <span className="text-ink-2">It&apos;s the first thing guests see, and it shows on WhatsApp link previews.</span>
              </p>
              <button
                type="button"
                onClick={() => setEditOpen(true)}
                className="h-11 shrink-0 rounded-full bg-btn px-4 text-sm font-semibold text-btn-ink transition-opacity hover:opacity-90"
              >
                Add cover
              </button>
            </div>
          )}

          {isHost && (
            <section
              id="invite"
              tabIndex={-1}
              aria-label="Invite guests"
              className="mx-3.5 mt-4 scroll-mt-6 rounded-[28px] border border-line bg-surface p-4 lg:mx-8 lg:mt-8 lg:p-6"
            >
              <QRCodeCard eventName={eventName} guestUrl={guestUrlProp ?? ""} onNotify={notify} split />
            </section>
          )}

          {usedPrompts.length > 0 && (
            <nav
              aria-label="Filter by prompt"
              className="no-scrollbar mt-4 flex gap-3 overflow-x-auto px-3.5 py-1 lg:mt-10 lg:gap-8 lg:px-4"
            >
              <Highlight
                label="All"
                emoji="✦"
                bg="var(--btn)"
                color="var(--btn-ink)"
                pressed={activeFilter === null}
                onClick={() => setFilter(null)}
              />
              {usedPrompts.map((p) => (
                <Highlight
                  key={p.id}
                  label={promptShortLabel(p.id, p.label)}
                  title={p.label}
                  emoji={p.emoji}
                  bg={`var(--prompt-bg, ${promptSwatch(p.id).bg})`}
                  pressed={activeFilter === p.id}
                  onClick={() => setFilter(activeFilter === p.id ? null : p.id)}
                />
              ))}
            </nav>
          )}

          <div
            ref={tabsRef}
            role="tablist"
            aria-label="Album view"
            className="mt-3 grid scroll-mt-2 grid-cols-2 border-b border-line lg:mt-9 lg:flex lg:justify-center lg:gap-14 lg:border-b-0 lg:border-t"
          >
            <TabButton active={view === "grid"} onClick={() => setView("grid")} icon={<GridIcon size={22} className="lg:h-[13px] lg:w-[13px]" />}>
              Grid
            </TabButton>
            <TabButton active={view === "feed"} onClick={() => setView("feed")} icon={<FeedIcon size={22} className="lg:h-[13px] lg:w-[13px]" />}>
              Feed
            </TabButton>
          </div>

          <div role="tabpanel" aria-label={view === "grid" ? "Grid" : "Feed"}>
            {photos.length === 0 ? (
              <EmptyState
                mode={mode}
                onAdd={() => setUploadOpen(true)}
                onInvite={goToInvite}
              />
            ) : view === "grid" ? (
              <GridView photos={visible} freshIds={freshIds} onOpen={(i) => setOpenId(visible[i].id)} />
            ) : (
              <FeedView
                photos={visible}
                freshIds={freshIds}
                onOpen={(i) => setOpenId(visible[i].id)}
                onRemove={canRemove ? setRemoveTarget : undefined}
              />
            )}
          </div>
        </main>
      </div>

      {/* Mobile bottom tab bar */}
      <nav
        aria-label="Album navigation"
        className="glass fixed inset-x-0 bottom-0 z-30 flex items-center justify-between border-t border-line bg-glass px-7 pb-[max(14px,env(safe-area-inset-bottom))] pt-1.5 lg:hidden"
      >
        <BarItem active={view === "grid"} onClick={() => showView("grid")} icon={<AlbumIcon size={24} filled={view === "grid"} />}>
          Album
        </BarItem>
        {mode === "guest" && (
          <button
            type="button"
            onClick={() => setUploadOpen(true)}
            aria-label="Add a photo"
            className="flex h-11 w-[60px] items-center justify-center rounded-[14px] bg-btn text-btn-ink transition-transform active:scale-95"
          >
            <PlusIcon size={24} />
          </button>
        )}
        {isHost && (
          <button
            type="button"
            onClick={goToInvite}
            aria-label="Show guest QR"
            className="flex h-11 w-[60px] items-center justify-center rounded-[14px] bg-btn text-btn-ink transition-transform active:scale-95"
          >
            <QrIcon size={22} />
          </button>
        )}
        <BarItem active={view === "feed"} onClick={() => showView("feed")} icon={<FeedIcon size={24} filled={view === "feed"} />}>
          Feed
        </BarItem>
      </nav>

      {canUpload && (
        <Sheet open={uploadOpen} onClose={() => setUploadOpen(false)} title="New photo">
          {demo ? (
            <div className="pb-2 text-center">
              <p className="mx-auto max-w-xs text-[15px] text-ink-2">
                This is a demo album, so uploads are switched off. Make your own album to try it for real.
              </p>
              <Link
                href="/#create"
                className="mt-5 flex h-14 items-center justify-between rounded-full bg-btn pl-[22px] pr-2 text-base font-semibold text-btn-ink"
              >
                Create an album
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent text-accent-ink">
                  <ArrowRightIcon size={18} />
                </span>
              </Link>
            </div>
          ) : (
            <PhotoUploadForm
              eventId={eventId}
              defaultName={isHost ? "Host" : undefined}
              onUploaded={(n) => {
                setUploadOpen(false);
                notify(n === 1 ? "Shared to the album" : `${n} photos shared to the album`);
              }}
            />
          )}
        </Sheet>
      )}

      <Sheet open={qrOpen} onClose={() => setQrOpen(false)} title="Invite guests">
        {qrOpen && <QRCodeCard eventName={eventName} guestUrl={resolveGuestUrl()} onNotify={notify} />}
      </Sheet>

      <EventInfoSheet
        event={event}
        open={infoOpen}
        onClose={() => setInfoOpen(false)}
        onEdit={
          showEdit
            ? () => {
                setInfoOpen(false);
                setEditOpen(true);
              }
            : undefined
        }
      />

      {editOpen && showEdit && (
        <EditEventSheet
          event={event}
          hostToken={canEdit ? hostToken : undefined}
          onDemoSave={onDemoEdit}
          onClose={() => setEditOpen(false)}
          onSaved={notify}
        />
      )}

      {openIndex >= 0 && (
        <StoryViewer
          photos={visible}
          index={openIndex}
          onIndexChange={(i) => setOpenId(visible[i].id)}
          onClose={() => setOpenId(null)}
          onRemove={canRemove ? setRemoveTarget : undefined}
          paused={removeTarget !== null}
        />
      )}

      {/* Rendered after the story viewer so it sits on top of it. */}
      <Sheet open={removeTarget !== null} onClose={() => !removing && setRemoveTarget(null)} title="Remove this photo?">
        {removeTarget && (
          <div className="pb-1">
            <div className="flex items-center gap-3 rounded-[18px] border border-line bg-surface p-3">
              <span className="relative h-16 w-[52px] shrink-0 overflow-hidden rounded-xl bg-surface-2">
                <Image src={photoSrc(removeTarget)} alt="" fill sizes="52px" className="object-cover" />
              </span>
              <div className="min-w-0 text-sm">
                <div className="truncate font-semibold">{removeTarget.guest_name || "Guest"}&apos;s photo</div>
                <div className="text-ink-3">It disappears for everyone, straight away. This can&apos;t be undone.</div>
              </div>
            </div>
            <div className="mt-4 flex flex-col gap-2">
              <button
                type="button"
                onClick={removePhoto}
                disabled={removing}
                aria-busy={removing}
                className="flex h-14 items-center justify-center gap-2 rounded-full bg-danger text-base font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-progress dark:text-[#0E0E10]"
              >
                {removing ? <Spinner /> : <TrashIcon size={18} />}
                {removing ? "Removing…" : "Remove for everyone"}
              </button>
              <button
                type="button"
                onClick={() => setRemoveTarget(null)}
                disabled={removing}
                className="flex h-[52px] items-center justify-center rounded-full border border-line-strong bg-surface text-[15px] font-semibold transition-colors hover:bg-surface-3 disabled:opacity-60"
              >
                Keep it
              </button>
            </div>
          </div>
        )}
      </Sheet>

      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-[calc(96px+env(safe-area-inset-bottom))] z-[60] flex justify-center px-4 lg:bottom-8"
      >
        {toast && (
          <span className="sheet-in flex min-h-11 items-center rounded-full bg-btn px-5 text-sm font-semibold text-btn-ink shadow-2">
            {toast}
          </span>
        )}
      </div>
    </div>
  );
}

function Stat({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col-reverse items-center">
      <dt className="mono text-[10px] text-ink-3">{label}</dt>
      <dd className="text-xl font-semibold tracking-[-0.03em]">{children}</dd>
    </div>
  );
}

function Highlight({
  label,
  title,
  emoji,
  bg,
  color,
  pressed,
  onClick,
}: {
  label: string;
  title?: string;
  emoji: string;
  bg: string;
  color?: string;
  pressed: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      aria-label={title ? `Show ${title} photos` : "Show all photos"}
      onClick={onClick}
      className="flex w-[66px] shrink-0 flex-col items-center gap-1.5 rounded-2xl text-ink transition-transform active:scale-[0.94] lg:w-20 lg:gap-2"
    >
      <span
        className={`block h-[62px] w-[62px] rounded-full border-[1.5px] p-0.5 lg:h-20 lg:w-20 lg:p-[3px] ${
          pressed ? "border-ink" : "border-line-strong"
        }`}
      >
        <span
          aria-hidden="true"
          className="flex h-full w-full items-center justify-center rounded-full text-2xl lg:text-[30px]"
          style={{ background: bg, color }}
        >
          {emoji}
        </span>
      </span>
      <span className={`max-w-full truncate text-xs lg:text-[13px] ${pressed ? "font-bold" : "font-medium"}`}>{label}</span>
    </button>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`flex h-11 items-center justify-center gap-2 border-b-2 transition-colors lg:-mt-px lg:h-[52px] lg:border-b-0 lg:border-t-[1.5px] ${
        active ? "border-ink text-ink" : "border-transparent text-ink-3 hover:text-ink-2"
      }`}
    >
      {icon}
      <span className="mono sr-only text-xs lg:not-sr-only">{children}</span>
    </button>
  );
}

function BarItem({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={`flex h-12 w-[60px] flex-col items-center justify-center gap-[3px] rounded-xl ${active ? "text-ink" : "text-ink-3"}`}
    >
      {icon}
      <span className="text-[10px] font-semibold">{children}</span>
    </button>
  );
}

function SideItem({
  active = false,
  onClick,
  icon,
  children,
}: {
  active?: boolean;
  onClick: () => void;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={`flex h-12 items-center gap-3.5 rounded-xl px-3 text-left text-[15px] transition-colors hover:bg-surface-3 ${
        active ? "bg-surface-2 font-bold" : "font-medium"
      }`}
    >
      {icon}
      {children}
    </button>
  );
}

function EmptyState({
  mode,
  onAdd,
  onInvite,
}: {
  mode: AlbumMode;
  onAdd: () => void;
  onInvite: () => void;
}) {
  return (
    <div className="px-8 pb-10 pt-12 text-center lg:pt-16">
      <div aria-hidden="true" className="relative mx-auto h-[150px] w-[260px]">
        <span className="absolute left-1/2 top-5 -ml-28 h-[116px] w-[92px] -rotate-12 rounded-2xl bg-[var(--deco-1)]" />
        <span className="absolute left-1/2 top-5 ml-5 h-[116px] w-[92px] rotate-12 rounded-2xl bg-[var(--deco-2)]" />
        <span className="absolute left-1/2 top-1.5 -ml-[50px] flex h-32 w-[100px] items-center justify-center rounded-[18px] border-2 border-dashed border-line-strong bg-surface text-ink-2">
          <PlusIcon size={34} strokeWidth={2} />
        </span>
      </div>
      <h2 className="hd mt-6 text-[30px] leading-[1.05]">
        No photos yet.
        <br />
        <span className="text-mute">Be the first.</span>
      </h2>
      <p className="mx-auto mt-2.5 max-w-xs text-[15px] text-ink-2">
        {mode === "host"
          ? "Share the QR code — every photo guests add shows up here live."
          : "The album is live — everything you add shows up for every guest."}
      </p>
      {mode !== "viewer" && (
        <button
          type="button"
          onClick={mode === "host" ? onInvite : onAdd}
          className="mt-6 inline-flex h-14 items-center gap-3.5 rounded-full bg-btn pl-[22px] pr-2 text-base font-semibold text-btn-ink transition-opacity hover:opacity-90 active:scale-[0.98]"
        >
          {mode === "host" ? "Show the guest QR" : "Take the first photo"}
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent text-accent-ink">
            {mode === "host" ? <ArrowRightIcon size={18} /> : <CameraIcon size={18} strokeWidth={2.2} />}
          </span>
        </button>
      )}
    </div>
  );
}
