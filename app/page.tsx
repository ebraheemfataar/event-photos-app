import Image from "next/image";
import Link from "next/link";
import CreateEventForm from "@/components/CreateEventForm";
import { unsplash } from "@/lib/demoPhotos";
import ThemeToggle from "@/components/ThemeToggle";
import { CameraIcon, ChevronRightIcon, ImagesIcon, LogoIcon, PlusIcon, QrIcon } from "@/components/icons";

const DECK = [
  { photo: "1541532713592-79a0317b6b77", ml: -170, r: -16, ty: 22, z: 1, tag: "Cheers", hideSm: true },
  { photo: "1504609813442-a8924e83f76e", ml: -120, r: -8, ty: 6, z: 2, tag: "Dance" },
  { photo: "1583939003579-730e3918a45a", ml: -59, r: 0, ty: 0, z: 5, tag: "Candid" },
  { photo: "1559599101-f09722fb4948", ml: 2, r: 8, ty: 6, z: 3, tag: "Laughs" },
  { photo: "1529156069898-49953e39b3ac", ml: 52, r: 16, ty: 22, z: 0, tag: "Group", hideSm: true },
];

const STEPS = [
  { n: "01", title: "Create", body: "Name your event. No sign-up.", bg: "#FFC21A", ink: "#0E0E10", Icon: PlusIcon },
  { n: "02", title: "Share the QR", body: "Print it for tables or drop the link in the group chat.", bg: "#2B2BFF", ink: "#FFFFFF", Icon: QrIcon },
  { n: "03", title: "Watch photos roll in", body: "Uploads land in the live album instantly.", bg: "#1E7A4C", ink: "#FFFFFF", Icon: ImagesIcon },
];

export default function Home() {
  return (
    <div className="flex flex-1 flex-col">
      <header className="glass sticky top-0 z-20 flex h-16 items-center justify-between bg-glass pl-[18px] pr-3.5 md:h-[76px] md:px-10">
        <Link href="/" className="flex items-center gap-2.5 rounded-full">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-btn text-btn-ink">
            <LogoIcon size={18} strokeWidth={2.2} />
          </span>
          <span className="text-[17px] font-semibold tracking-[-0.02em] md:text-lg">Snap &amp; Share</span>
        </Link>
        <div className="flex items-center gap-2">
          <a
            href="#how"
            className="hidden h-11 items-center rounded-full px-4 text-sm font-medium transition-colors hover:bg-surface-3 md:inline-flex"
          >
            How it works
          </a>
          <ThemeToggle className="border border-line bg-surface" />
        </div>
      </header>

      <main className="flex-1">
        <section className="px-5 pt-9 text-center md:px-10 md:pt-[72px]">
          <p className="text-sm text-ink-2 md:text-base">Shared albums for weddings, birthdays &amp; parties</p>
          <h1 className="hd mx-auto mt-3.5 max-w-[980px] text-[40px] leading-[1.04] md:mt-[18px] md:text-[80px] md:leading-none">
            Every angle{" "}
            <span
              aria-hidden="true"
              className="inline-flex h-[34px] w-[62px] translate-y-[2px] items-center justify-center rounded-full bg-[#FF5A1F] align-baseline text-lg md:h-[66px] md:w-32 md:text-4xl"
            >
              💃
            </span>{" "}
            of your party, <span className="text-mute">in one shared album.</span>
          </h1>
          <p className="mx-auto mt-4 max-w-[320px] text-base leading-normal text-ink-2 md:mt-[22px] md:max-w-[520px] md:text-[19px]">
            Guests scan a QR code and upload straight from their phone — no app, no login.
          </p>
          <div className="mt-[22px] flex justify-center gap-2 md:mt-7">
            <a
              href="#create"
              className="inline-flex h-14 items-center gap-3 whitespace-nowrap rounded-full bg-btn pl-5 pr-2 text-[15px] font-semibold text-btn-ink transition-opacity hover:opacity-90 md:gap-3.5 md:pl-[22px] md:text-base"
            >
              Create an album
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent text-[#0E0E10]">
                <PlusIcon size={18} />
              </span>
            </a>
            <a
              href="#how"
              className="inline-flex h-14 items-center whitespace-nowrap rounded-full border border-line-strong bg-surface px-4 text-[15px] font-semibold transition-colors hover:bg-surface-3 md:px-5 md:text-base"
            >
              How it works
            </a>
          </div>

          <div aria-hidden="true" className="relative mx-auto mt-8 h-[210px] max-w-full overflow-hidden md:mt-11 md:h-[290px]">
            {DECK.map((d) => (
              <div
                key={d.tag}
                className={`absolute left-1/2 top-[18px] h-[158px] w-[118px] overflow-hidden rounded-[14px] border-[3px] border-surface shadow-2 md:h-[214px] md:w-[160px] md:rounded-[18px] md:border-4 ${
                  d.hideSm ? "hidden min-[400px]:block" : ""
                }`}
                style={{
                  marginLeft: d.ml,
                  transform: `rotate(${d.r}deg) translateY(${d.ty}px)`,
                  zIndex: d.z,
                }}
              >
                <Image
                  src={unsplash(d.photo)}
                  alt=""
                  fill
                  sizes="160px"
                  loading={d.z === 5 ? "eager" : "lazy"}
                  className="bg-surface-2 object-cover"
                />
                <span className="mono absolute left-2 top-2 rounded-full bg-black/55 px-1.5 py-0.5 text-[9px] text-white md:text-[10px]">
                  {d.tag}
                </span>
              </div>
            ))}
          </div>
          <Link
            href="/demo"
            className="mt-2 inline-flex h-11 items-center gap-2 rounded-full px-4 text-sm font-semibold text-ink-2 transition-colors hover:bg-surface-3 hover:text-ink"
          >
            See a demo album <ChevronRightIcon size={14} />
          </Link>
        </section>

        <section id="create" className="scroll-mt-20 px-4 pt-10 md:pt-16">
          <div className="mx-auto max-w-md rounded-[28px] border border-line bg-surface p-[22px] shadow-1 md:p-7">
            <h2 className="hd text-[26px] leading-[1.1]">
              Start an album. <span className="text-mute">Ten seconds.</span>
            </h2>
            <p className="mt-1.5 mb-4 text-[15px] text-ink-3">You get a QR code to share with your guests.</p>
            <CreateEventForm />
          </div>
        </section>

        <section id="how" className="mx-auto max-w-5xl scroll-mt-20 px-4 pt-12 md:px-10 md:pt-20">
          <div className="mono px-1.5 text-[11px] text-ink-3">How it works</div>
          <h2 className="hd mt-2 mb-[18px] px-1.5 text-[34px] leading-[1.02] md:mb-7 md:text-[56px] md:leading-none">
            Three steps. <span className="text-mute">Zero apps.</span>
          </h2>
          <ol className="grid gap-2.5 md:grid-cols-3 md:gap-4">
            {STEPS.map(({ n, title, body, bg, ink, Icon }) => (
              <li
                key={n}
                className="flex items-center gap-3.5 rounded-[22px] border border-line bg-surface p-2.5 md:flex-col md:items-start md:gap-5 md:rounded-[28px] md:p-5"
              >
                <span
                  className="flex h-[76px] w-[76px] shrink-0 items-center justify-center rounded-2xl md:h-24 md:w-24 md:rounded-[20px]"
                  style={{ background: bg, color: ink }}
                >
                  <Icon size={30} />
                </span>
                <div>
                  <div className="mono text-[10px] text-ink-3">{n}</div>
                  <div className="text-[17px] font-semibold tracking-[-0.02em] md:text-[19px]">{title}</div>
                  <p className="mt-0.5 text-sm leading-snug text-ink-2 md:text-[15px]">{body}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>
      </main>

      <footer className="mt-12 flex items-center justify-between border-t border-line px-[22px] py-6 md:mt-16 md:px-10">
        <span className="mono text-[11px] text-ink-3">© {new Date().getFullYear()} Snap &amp; Share</span>
        <span className="flex items-center gap-1.5 text-[13px] text-ink-3">
          <CameraIcon size={14} /> Made for celebrations
        </span>
      </footer>
    </div>
  );
}
