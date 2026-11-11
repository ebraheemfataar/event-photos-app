# Snap & Share — Process flows

How the app works end to end, as Mermaid diagrams (rendered on GitHub and in
VS Code's Markdown preview). Sections 1–6 describe the app **as built**;
sections 7–8 are **planned** (see [PRICING.md](PRICING.md) and
[ROADMAP.md](ROADMAP.md)). File and function names match the code.

- [1. Big picture](#1-big-picture)
- [2. Host creates an event](#2-host-creates-an-event)
- [3. Opening an album (guest, host, viewer)](#3-opening-an-album-guest-host-viewer)
- [4. Guest uploads a photo](#4-guest-uploads-a-photo)
- [5. Live updates](#5-live-updates)
- [6. Host removes a photo](#6-host-removes-a-photo)
- [7. Planned: buying or upgrading a plan](#7-planned-buying-or-upgrading-a-plan)
- [8. Planned: contributor cap and album expiry](#8-planned-contributor-cap-and-album-expiry)

---

## 1. Big picture

Who talks to what. Reads and photo writes go through the Next.js server with
a secret key; the browser only sends files to one-time upload URLs the server
issued, and calls the create_event RPC.

```mermaid
flowchart LR
    subgraph Browser["Browser (guest / host phone)"]
        UI["Album UI<br/>EventAlbum, PhotoGallery"]
        UP["PhotoUploadForm<br/>compresses on the phone"]
    end

    subgraph Vercel["Next.js on Vercel"]
        Pages["Pages /e/[id], /host/[id]<br/>(server components)"]
        PhotoRoute["/photos/[photoId]<br/>route handler"]
        Action["fetchEventPhotos<br/>Server Function"]
        UploadFn["uploadActions<br/>start / finish / delete"]
    end

    subgraph Supabase
        DB[("Postgres<br/>events, photos")]
        Bucket[("Storage<br/>event-photos (private)")]
        RT["Realtime<br/>Broadcast"]
    end

    UI -- "page load" --> Pages
    UI -- "img src" --> PhotoRoute
    UI -- "verify live ids" --> Action
    Pages -- "service-role key<br/>scoped to the id" --> DB
    PhotoRoute -- "service-role key" --> Bucket
    Action -- "service-role key" --> DB

    UP -- "start / finish upload" --> UploadFn
    UP -- "file to signed upload URL" --> Bucket
    UI -- "delete own / host remove" --> UploadFn
    UploadFn -- "service-role key<br/>limits, byte check, insert" --> DB
    UploadFn -- "service-role key" --> Bucket
    UI -- "anon key: RPC create_event" --> DB

    DB -- "trigger sends {id}" --> RT
    RT -- "event:{event id} channel" --> UI
```

---

## 2. Host creates an event

```mermaid
sequenceDiagram
    actor Host
    participant Landing as Landing page<br/>CreateEventForm
    participant DB as Supabase<br/>create_event RPC
    participant HostPage as /host/[id]?t=token

    Host->>Landing: Types event name, taps "Create event"
    Landing->>DB: rpc create_event(name) with anon key
    Note over DB: SECURITY DEFINER: inserts the event,<br/>generates host_token. The only time<br/>the token is ever returned (0003).
    DB-->>Landing: id + host_token
    Landing->>HostPage: Redirect to /host/id?t=host_token
    HostPage-->>Host: Album + "Private host link" banner + QR table card
    Note over Host: Host shares the guest link /e/id<br/>(QR card, WhatsApp). Never the host link.
```

---

## 3. Opening an album (guest, host, viewer)

Knowing the link is what grants access, enforced on the server.

```mermaid
flowchart TD
    Start(["Someone opens a link"]) --> Which{"Which link?"}

    Which -- "/e/[id]" --> G1["getEvent(id) on the server<br/>(service-role, scoped to id)"]
    G1 --> G2{"Exists and<br/>still open?"}
    G2 -- "no" --> NF["'We can't find this album'"]
    G2 -- "yes" --> G3["getEventPhotos(id)"] --> Guest["Guest album<br/>can view + upload"]

    Which -- "/host/[id]?t=..." --> H1["getEvent(id)"]
    H1 --> H2{"Exists?"}
    H2 -- "no" --> NF
    H2 -- "yes" --> H3{"t is a uuid and<br/>is_event_host(id, t)?"}
    H3 -- "yes" --> HostAlbum["Host album<br/>banner, QR card, remove photos"]
    H3 -- "no" --> Viewer["View-only album<br/>(no upload, no host tools)"]

    Which -- "/demo" --> Demo["Static mock album<br/>(no database)"]

    Guest --> Img
    HostAlbum --> Img
    Viewer --> Img
    Img["Each photo loads from /photos/[photoId]<br/>(private bucket, 1 h cache, nosniff)"]
```

---

## 4. Guest uploads a photo

Phase 2c: every upload goes through the server (`lib/uploadActions.ts`).

```mermaid
sequenceDiagram
    actor Guest
    participant Form as PhotoUploadForm<br/>(on the phone)
    participant Server as uploadActions<br/>Server Functions
    participant Storage as Supabase Storage<br/>event-photos
    participant DB as Supabase Postgres

    Guest->>Form: Add photos → pick name, prompt, photos
    loop Each selected file
        alt GIF
            Note over Form: Skips compression (keeps animation).<br/>Over 10 MB → skipped with a message.
        else Other images
            Form->>Form: compressImage: redraw on canvas,<br/>max 1920 px / ~1.2 MB.<br/>EXIF + GPS removed.
        end
        Form->>Server: startPhotoUpload(event, guest id, type, host token?)
        Note over Server: Album open? Allowed type?<br/>≤ 50/h per guest, ≤ 400/h per network,<br/>album cap (host exempt). Writes upload_tickets.
        alt refused
            Server-->>Form: message ("shared a lot in the last hour"…)
            Form-->>Guest: Message + Retry
        else ok
            Server-->>Form: one-time signed upload URL
            Form->>Storage: upload the file to it
            Form->>Server: finishPhotoUpload(photo id, guest id, name, prompt)
            Note over Server: Ticket matches this guest, unused, < 1 h.<br/>First bytes really are that image type<br/>(else the file is deleted).
            Server->>DB: insert photos row (guest_hash, by_host)
            Note over DB: Trigger broadcasts {id} (see §5).
            Server-->>Form: ok (photo id remembered on this phone)
        end
    end
    Form-->>Guest: Sheet closes, "Shared to the album"
```

---

## 5. Live updates

Every open album hears about new and removed photos. Messages carry only
the photo id and are always checked with the server, because anyone can send
on a public channel.

```mermaid
sequenceDiagram
    participant DB as Postgres trigger<br/>broadcast_photo_change
    participant RT as Realtime<br/>topic event:{event id}
    participant Album as PhotoGallery<br/>(each open browser)
    participant Server as fetchEventPhotos<br/>Server Function

    DB->>RT: photo_inserted / photo_deleted {id}
    RT->>Album: message
    Note over Album: Queue the id. Ids arriving within ~150 ms<br/>are checked together (Next runs a page's<br/>Server Function calls one at a time).
    Album->>Server: fetchEventPhotos(eventId, [ids])
    Server-->>Album: only real rows that belong to this event
    alt "inserted" and the server returned it
        Album->>Album: Add to the top, "NEW" badge + arrive animation
    else "deleted" and the server no longer has it
        Album->>Album: Remove it
    else anything else (forged or stale message)
        Album->>Album: Ignore
    end
```

---

## 6. Removing a photo (host: any; guest: their own)

```mermaid
sequenceDiagram
    actor Person as Host or guest
    participant Album as Album<br/>(viewer or feed)
    participant Server as uploadActions<br/>Server Functions
    participant Others as Every other open album

    Note over Album: Trash shows on every photo for the host,<br/>and on photos shared from this phone for a guest.
    Person->>Album: Tap trash
    Album-->>Person: "Remove this photo?" / "Delete your photo?"
    alt "Keep it"
        Person->>Album: Cancel, nothing changes
    else Confirm
        alt host
            Album->>Server: removePhotoAsHost(photo, host token)
        else guest
            Album->>Server: deleteMyPhoto(photo, guest id)
        end
        Note over Server: Checks the host token / that the photo's<br/>guest_hash is this guest's. Deletes the row,<br/>then the file through the Storage API.
        alt not allowed or error
            Server-->>Album: message
        else ok
            Server-->>Album: ok
            Album-->>Person: Photo gone, viewer moves on
            Server-->>Others: Trigger → photo_deleted {id} → verified → removed (§5)
            Note over Album,Others: /photos/[id] now returns 404<br/>(cached copies can live up to 1 h).
        end
    end
```

---

## 7. Planned: buying or upgrading a plan

Monetisation Stage B ([PRICING.md](PRICING.md)). Every event starts on Free; picking a paid plan at creation and upgrading later are the same flow. The plan only changes after PayFast's verified server-to-server notification (ITN), never from the browser redirect.

```mermaid
sequenceDiagram
    actor Host
    participant App as Snap & Share<br/>(Next.js server)
    participant DB as Supabase<br/>events, event_purchases
    participant PF as PayFast

    Host->>App: Choose plan / add-on (at creation or "Upgrade")
    App->>DB: Read plan prices + what this event already paid
    App->>App: amount_cents = new plan − already paid (never negative)
    App->>DB: insert event_purchases (status pending, amount_cents, email)
    App-->>Host: Redirect to PayFast with signed form<br/>(m_payment_id = purchase id, notify_url)
    Host->>PF: Pays (card or Instant EFT)
    PF-->>Host: Redirect back to the host page<br/>("Payment processing…", no plan change)

    PF->>App: ITN to notify_url (server to server)
    App->>App: Verify signature (passphrase)
    App->>PF: Validate the ITN with PayFast
    PF-->>App: VALID
    App->>DB: Check purchase exists, still pending,<br/>amount + merchant match
    alt all checks pass
        App->>DB: purchase → paid, then raise events.plan,<br/>expires_at, contributor slots
        App-->>Host: Receipt email (no VAT line)
    else any check fails, or already paid
        App->>DB: Leave the plan unchanged (log it)
    end
```

---

## 8. Planned: contributor cap and album expiry

Monetisation Stages A–B. The cap is checked in the server upload step that
Phase 2c introduces; expiry runs as a daily job.

```mermaid
flowchart TD
    subgraph Cap["Contributor cap (each upload)"]
        U1(["Guest taps Share"]) --> U2["Server upload step (Phase 2c)<br/>reads the browser guest id"]
        U2 --> U3{"Already a contributor<br/>to this event?"}
        U3 -- "yes" --> U6["Issue signed upload URL"]
        U3 -- "no" --> U4{"Contributors still under<br/>plan cap + extra slots?"}
        U4 -- "yes" --> U6
        U4 -- "no" --> U5["'This album is full,<br/>ask the host to upgrade'"]
        U5 -.-> Up["Host sees the upgrade prompt<br/>(§7)"]
    end

    subgraph Expiry["Album expiry (Vercel Cron, daily)"]
        E1(["Daily job"]) --> E2["Find events by expires_at"]
        E2 --> E3{"Days left?"}
        E3 -- "7 or 1, host email known" --> E4["Reminder email:<br/>download or keep longer"]
        E3 -- "past expires_at" --> E5["Delete photo files + rows,<br/>then the event"]
        E3 -- "otherwise" --> E6["Nothing"]
        E4 -.-> Keep["Host buys keep_1yr / upgrades (§7)"]
    end
```
