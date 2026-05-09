import logo from "./assets/logo.png";
import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";

declare global {
  interface Window {
    google: any;
  }
}

const GOOGLE_CLIENT_ID =
  "447699234633-ivo2e1c2q843scj32k5323o2rkq6h7dp.apps.googleusercontent.com";

const SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbytLuNWR4QH9hKKFrGbwuFP3XsLU9r4daZn4XT0A4qOlJ5tjOZ2R0vE4gSuyhpWiUg5xA/exec";

const TOTAL_STEPS = 9;
const ADMIN_EMAIL = "atxprestigedetailing@gmail.com";
const VENMO_URL = "https://venmo.com/u/emilio512";
const CASHAPP_URL = "https://cash.app/$Emiliofive12";

type AvailabilitySlot = {
  date: string;
  time: string;
  available?: boolean;
  notes?: string;
};

type VehicleType = "truckSuv" | "sedan" | "coupe" | "boat" | "";
type PackageType = "basic" | "premium" | "exterior" | "interior" | "exteriorPremium" | "interiorPremium" | "";
type ServiceType = "mobile" | "dropoff" | "";
type ClientType = "oneTime" | "maintenance" | "";
type FrequencyType = "biweekly" | "monthly" | "";

type AddOn =
  | "Headlight Restoration"
  | "Stain Removal"
  | "Paint Correction"
  | "Pet Hair Removal"
  | "Steam Cleaning"
  | "Ceramic Coating"
  | "Oxidation Removal"
  | "Gelcoat Polishing"
  | "Wet Sanding"
  | "Interior Deep Extraction"
  | "Sealant & Protection Upgrade"
  | "Engine Compartment Detail";

type GoogleUser = {
  name: string;
  email: string;
  picture: string;
};

type Booking = {
  date: string;
  time: string;
  year: string;
  make: string;
  model: string;
  boatSize: string;
  vehicle: string;
  packageType: string;
  hourlyRate: string;
  addOns: string;
  serviceType: string;
  address: string;
  avgTime: string;
  notes: string;
  clientType: string;
  recurringFrequency: string;
  status: string;
  invoiceAmount: string;
  invoiceStatus: string;
  invoiceNote: string;
  photosLink: string;
  beforePhotoUrl: string;
  afterPhotoUrl: string;
  invoiceLink: string;
  name: string;
  phone: string;
  email: string;
  rowIndex: number;
};

const vehicleOptions = [
  { id: "truckSuv" as VehicleType, label: "Truck / SUV", basicRate: 80, premiumRate: 100 },
  { id: "sedan"    as VehicleType, label: "Sedan",        basicRate: 70, premiumRate: 90  },
  { id: "coupe"    as VehicleType, label: "Coupe",        basicRate: 65, premiumRate: 85  },
  { id: "boat"     as VehicleType, label: "Boat",         basicRate: 90, premiumRate: 100 },
];

const addOnOptions: { label: AddOn; priceText: string; fixedPrice?: number }[] = [
  { label: "Headlight Restoration",    priceText: "$150", fixedPrice: 150 },
  { label: "Stain Removal",            priceText: "Need consultation" },
  { label: "Paint Correction",         priceText: "Need consultation" },
  { label: "Pet Hair Removal",         priceText: "$60",  fixedPrice: 60  },
  { label: "Steam Cleaning",           priceText: "$60",  fixedPrice: 60  },
  { label: "Ceramic Coating",          priceText: "Need consultation" },
  { label: "Engine Compartment Detail",priceText: "$75",  fixedPrice: 75  },
];

const marineAddOnOptions: { label: AddOn; priceText: string; fixedPrice?: number }[] = [
  { label: "Oxidation Removal",            priceText: "Need consultation" },
  { label: "Gelcoat Polishing",            priceText: "Need consultation" },
  { label: "Wet Sanding",                  priceText: "Need consultation" },
  { label: "Interior Deep Extraction",     priceText: "$120", fixedPrice: 120 },
  { label: "Sealant & Protection Upgrade", priceText: "$80",  fixedPrice: 80  },
];

function formatDateLabel(dateStr: string) {
  if (!dateStr) return "N/A";
  const parts = dateStr.includes("-") ? dateStr.split("-").map(Number) : null;
  if (!parts) return dateStr;
  const [y, m, d] = parts;
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    weekday: "short", month: "short", day: "numeric", year: "numeric",
  });
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency", currency: "USD", maximumFractionDigits: 0,
  }).format(value);
}

function isUpcoming(dateStr: string) {
  if (!dateStr) return false;
  const parts = dateStr.includes("-") ? dateStr.split("-").map(Number) : null;
  if (!parts) return false;
  const [y, m, d] = parts;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return new Date(y, m - 1, d) >= today;
}

// Calculate recurring schedule dates from a start date
function calcRecurringDates(startDateStr: string, freq: string, count: number = 6): string[] {
  if (!startDateStr || !freq) return [];
  const [y, m, d] = startDateStr.split("-").map(Number);
  const start = new Date(y, m - 1, d);
  const dates: string[] = [];

  if (freq === "biweekly") {
    let next = new Date(start);
    next.setDate(next.getDate() + 14);
    while (dates.length < count) {
      dates.push(formatDateLabel(fmtDate(next)));
      next.setDate(next.getDate() + 14);
    }
  } else if (freq === "monthly") {
    // Same weekday + same week position each month
    const dow = start.getDay();
    const weekPos = Math.ceil(start.getDate() / 7);
    const isLast = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 7).getMonth() !== start.getMonth();

    let checkMonth = start.getMonth() + 1;
    let checkYear = start.getFullYear();
    if (checkMonth > 11) { checkMonth = 0; checkYear++; }

    while (dates.length < count) {
      const candidate = getNthWeekday(checkYear, checkMonth, dow, weekPos, isLast);
      if (candidate) dates.push(formatDateLabel(fmtDate(candidate)));
      checkMonth++;
      if (checkMonth > 11) { checkMonth = 0; checkYear++; }
      if (checkYear > start.getFullYear() + 3) break;
    }
  }
  return dates;
}

function fmtDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function getNthWeekday(year: number, month: number, dow: number, n: number, isLast: boolean): Date | null {
  if (isLast) {
    const last = new Date(year, month + 1, 0);
    while (last.getDay() !== dow) last.setDate(last.getDate() - 1);
    return last;
  }
  const first = new Date(year, month, 1);
  const diff = (dow - first.getDay() + 7) % 7;
  const result = new Date(year, month, 1 + diff + (n - 1) * 7);
  return result.getMonth() === month ? result : null;
}

function getCadenceLabel(startDateStr: string, freq: string): string {
  if (!startDateStr || !freq) return "";
  const [y, m, d] = startDateStr.split("-").map(Number);
  const start = new Date(y, m - 1, d);
  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const dayName = dayNames[start.getDay()];
  if (freq === "biweekly") return `Every other ${dayName}`;
  const weekPos = Math.ceil(start.getDate() / 7);
  const isLast = new Date(y, m - 1, d + 7).getMonth() !== start.getMonth();
  const ordinals = ["", "1st", "2nd", "3rd", "4th", "5th"];
  const pos = isLast ? "last" : ordinals[weekPos];
  return `Every ${pos} ${dayName} of the month`;
}

async function fetchAllAvailability(): Promise<AvailabilitySlot[]> {
  const res = await fetch(`${SCRIPT_URL}?action=getAllAvailability`);
  const data: { slots: AvailabilitySlot[] } = await res.json();
  return data.slots || [];
}

async function fetchBookingsForEmail(email: string): Promise<Booking[]> {
  const res = await fetch(`${SCRIPT_URL}?action=getBookingsByEmail&email=${encodeURIComponent(email)}`);
  const data: { bookings: Booking[] } = await res.json();
  return data.bookings || [];
}

async function fetchAllBookings(): Promise<Booking[]> {
  const res = await fetch(`${SCRIPT_URL}?action=getAllBookings`);
  const data: { bookings: Booking[] } = await res.json();
  return data.bookings || [];
}

async function updateBooking(rowIndex: number, updates: Record<string, string>): Promise<boolean> {
  const res = await fetch(SCRIPT_URL, {
    method: "POST",
    body: JSON.stringify({ action: "updateBooking", rowIndex, ...updates }),
  });
  const data = await res.json();
  return data.success;
}

function BookingCard({ booking, upcoming, onRequestChange }: {
  booking: Booking; upcoming: boolean; onRequestChange: (b: Booking) => void;
}) {
  const vehicleLabel =
    booking.vehicle === "boat"
      ? [booking.boatSize, booking.make, booking.model].filter(Boolean).join(" ")
      : [booking.year, booking.make, booking.model].filter(Boolean).join(" ");

  const hasPhotos = booking.beforePhotoUrl || booking.afterPhotoUrl;
  const isCompleted = booking.status === "Completed" || booking.invoiceStatus === "paid";
  const [showPhotos, setShowPhotos] = React.useState(false);
  const [loadedImgs, setLoadedImgs] = React.useState<Record<string, boolean>>({});

  const beforeUrls = booking.beforePhotoUrl ? booking.beforePhotoUrl.split(",").map(u => u.trim()).filter(Boolean) : [];
  const afterUrls  = booking.afterPhotoUrl  ? booking.afterPhotoUrl.split(",").map(u => u.trim()).filter(Boolean) : [];

  // Convert thumbnail URLs to full-size for download (sz=w400 → sz=w1600)
  const fullSizeUrl = (url: string) => url.replace("sz=w400", "sz=w1600");

  async function downloadPhoto(url: string, label: string) {
    try {
      const full = fullSizeUrl(url);
      const res = await fetch(full);
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = label + ".jpg";
      a.click();
      URL.revokeObjectURL(a.href);
    } catch {
      window.open(fullSizeUrl(url), "_blank");
    }
  }

  return (
    <div style={{ background: "rgba(255,255,255,0.05)", border: upcoming ? "1px solid rgba(59,130,246,0.45)" : "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 18, position: "relative" as const }}>
      {upcoming && (
        <span style={{ position: "absolute" as const, top: 14, right: 14, background: "rgba(59,130,246,0.15)", color: "#93c5fd", fontSize: "0.75rem", fontWeight: 700, borderRadius: 999, padding: "3px 10px", border: "1px solid rgba(59,130,246,0.3)" }}>
          UPCOMING
        </span>
      )}
      <div style={{ fontSize: "1rem", fontWeight: 700, color: "#f1f5f9", marginBottom: 4 }}>
        {formatDateLabel(booking.date)}{booking.time ? ` at ${booking.time}` : ""}
      </div>
      <div style={{ fontSize: "0.92rem", color: "rgba(255,255,255,0.45)", lineHeight: 1.6 }}>
        {vehicleLabel && <div>{vehicleLabel}</div>}
        <div>{booking.packageType === "basic" ? "Basic Detail" : booking.packageType === "premium" ? "Premium Detail" : booking.packageType === "exterior" ? "Exterior Only — Basic" : booking.packageType === "interior" ? "Interior Only — Basic" : booking.packageType === "exteriorPremium" ? "Exterior Only — Premium" : booking.packageType === "interiorPremium" ? "Interior Only — Premium" : booking.packageType}</div>
        {booking.serviceType && (
          <div>{booking.serviceType === "mobile" ? `Mobile Service${booking.address ? ` - ${booking.address}` : ""}` : "Drop-Off Service"}</div>
        )}
        {booking.addOns && <div>Add-Ons: {booking.addOns}</div>}
        {booking.notes && <div>Notes: {booking.notes}</div>}
      </div>

      {booking.invoiceStatus === "released" && booking.invoiceAmount && (
        <div style={{ marginTop: 10, background: "rgba(251,191,36,0.1)", border: "1px solid rgba(251,191,36,0.3)", borderRadius: 10, padding: "10px 14px", fontSize: "0.88rem", color: "#fbbf24" }}>
          <span style={{ fontWeight: 700 }}>Balance due: ${booking.invoiceAmount}</span>
          {booking.invoiceNote ? ` — ${booking.invoiceNote}` : ""}
        </div>
      )}

      {booking.invoiceStatus === "paid" && (
        <div style={{ marginTop: 10, background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.25)", borderRadius: 10, padding: "8px 14px", fontSize: "0.82rem", color: "#34d399", fontWeight: 600 }}>
          ✓ Paid ${booking.invoiceAmount}
        </div>
      )}

      {/* Action buttons */}
      <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" as const }}>
        {upcoming && (
          <button onClick={() => onRequestChange(booking)} style={{ background: "rgba(255,255,255,0.08)", color: "#f1f5f9", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 10, padding: "9px 16px", fontSize: "0.9rem", fontWeight: 600, cursor: "pointer" }}>
            Request a Change
          </button>
        )}
        {isCompleted && hasPhotos && (
          <button onClick={() => setShowPhotos(p => !p)}
            style={{ display: "inline-flex", alignItems: "center", gap: 6, background: showPhotos ? "rgba(59,130,246,0.25)" : "rgba(59,130,246,0.12)", color: "#93c5fd", border: "1px solid rgba(59,130,246,0.3)", borderRadius: 10, padding: "9px 16px", fontSize: "0.9rem", fontWeight: 600, cursor: "pointer" }}>
            📸 {showPhotos ? "Hide Photos" : `View Photos (${beforeUrls.length + afterUrls.length})`}
          </button>
        )}
        {isCompleted && booking.invoiceLink && (
          <a href={booking.invoiceLink} target="_blank" rel="noopener noreferrer"
            style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(16,185,129,0.1)", color: "#34d399", border: "1px solid rgba(16,185,129,0.3)", borderRadius: 10, padding: "9px 16px", fontSize: "0.9rem", fontWeight: 600, cursor: "pointer", textDecoration: "none" }}>
            🧾 Download Invoice
          </a>
        )}
      </div>

      {/* Inline photo gallery */}
      {showPhotos && hasPhotos && (
        <div style={{ marginTop: 16, background: "rgba(0,0,0,0.3)", borderRadius: 14, padding: 16 }}>
          {beforeUrls.length > 0 && (
            <div style={{ marginBottom: afterUrls.length > 0 ? 16 : 0 }}>
              <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "rgba(255,255,255,0.35)", textTransform: "uppercase" as const, letterSpacing: "0.08em", marginBottom: 10 }}>
                Before ({beforeUrls.length})
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(100px, 1fr))", gap: 8 }}>
                {beforeUrls.map((url, i) => (
                  <div key={i} style={{ position: "relative" as const, borderRadius: 10, overflow: "hidden", aspectRatio: "1", background: "rgba(255,255,255,0.06)" }}>
                    {!loadedImgs[url] && (
                      <div style={{ position: "absolute" as const, inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <div style={{ width: 20, height: 20, border: "2px solid rgba(255,255,255,0.15)", borderTopColor: "#93c5fd", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
                      </div>
                    )}
                    <img
                      src={url}
                      loading="lazy"
                      onLoad={() => setLoadedImgs(p => ({ ...p, [url]: true }))}
                      style={{ width: "100%", height: "100%", objectFit: "cover" as const, display: "block", opacity: loadedImgs[url] ? 1 : 0, transition: "opacity 0.3s ease", cursor: "pointer" }}
                      onClick={() => window.open(fullSizeUrl(url), "_blank")}
                    />
                    <button
                      onClick={() => downloadPhoto(url, `before_${i + 1}`)}
                      style={{ position: "absolute" as const, bottom: 4, right: 4, background: "rgba(0,0,0,0.65)", border: "none", borderRadius: 6, width: 26, height: 26, cursor: "pointer", color: "#fff", fontSize: "0.7rem", display: "flex", alignItems: "center", justifyContent: "center" }}
                      title="Download">⬇</button>
                  </div>
                ))}
              </div>
            </div>
          )}
          {afterUrls.length > 0 && (
            <div>
              <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "rgba(255,255,255,0.35)", textTransform: "uppercase" as const, letterSpacing: "0.08em", marginBottom: 10 }}>
                After ({afterUrls.length})
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(100px, 1fr))", gap: 8 }}>
                {afterUrls.map((url, i) => (
                  <div key={i} style={{ position: "relative" as const, borderRadius: 10, overflow: "hidden", aspectRatio: "1", background: "rgba(255,255,255,0.06)" }}>
                    {!loadedImgs[url] && (
                      <div style={{ position: "absolute" as const, inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <div style={{ width: 20, height: 20, border: "2px solid rgba(255,255,255,0.15)", borderTopColor: "#34d399", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
                      </div>
                    )}
                    <img
                      src={url}
                      loading="lazy"
                      onLoad={() => setLoadedImgs(p => ({ ...p, [url]: true }))}
                      style={{ width: "100%", height: "100%", objectFit: "cover" as const, display: "block", opacity: loadedImgs[url] ? 1 : 0, transition: "opacity 0.3s ease", cursor: "pointer" }}
                      onClick={() => window.open(fullSizeUrl(url), "_blank")}
                    />
                    <button
                      onClick={() => downloadPhoto(url, `after_${i + 1}`)}
                      style={{ position: "absolute" as const, bottom: 4, right: 4, background: "rgba(0,0,0,0.65)", border: "none", borderRadius: 6, width: 26, height: 26, cursor: "pointer", color: "#fff", fontSize: "0.7rem", display: "flex", alignItems: "center", justifyContent: "center" }}
                      title="Download">⬇</button>
                  </div>
                ))}
              </div>
            </div>
          )}
          {/* Download all */}
          {(beforeUrls.length + afterUrls.length) > 1 && (
            <button
              onClick={() => {
                [...beforeUrls.map((u,i) => ({u, label:`before_${i+1}`})), ...afterUrls.map((u,i) => ({u, label:`after_${i+1}`}))].forEach(({u, label}) => downloadPhoto(u, label));
              }}
              style={{ marginTop: 12, width: "100%", background: "rgba(59,130,246,0.15)", color: "#93c5fd", border: "1px solid rgba(59,130,246,0.3)", borderRadius: 10, padding: "10px", fontWeight: 700, fontSize: "0.85rem", cursor: "pointer" }}>
              ⬇ Download All {beforeUrls.length + afterUrls.length} Photos
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default function App() {
  const addressInputRef = useRef(null);

  const [googleUser, setGoogleUser]                     = useState<GoogleUser | null>(() => {
    try {
      const saved = localStorage.getItem("atx_google_user");
      return saved ? JSON.parse(saved) : null;
    } catch { return null; }
  });
  const [googleScriptLoaded, setGoogleScriptLoaded]     = useState(false);
  const [splashDone, setSplashDone]                     = useState(false);
  const [splashPhase, setSplashPhase]                   = useState(0); // 0=logo, 1=tagline, 2=fadeout
  const [view, setView]                                 = useState<"booking" | "myBookings" | "requestChange" | "admin" | "balance" | "inventory">("booking");
  const [adminTab, setAdminTab]                         = useState<"bookings" | "invoices" | "revenue" | "availability">("bookings");
  const [adminBookings, setAdminBookings]               = useState<Booking[]>([]);
  const [adminLoading, setAdminLoading]                 = useState(false);
  const [adminFilter, setAdminFilter]                   = useState<"all" | "upcoming" | "past" | "maintenance">("all");
  const [selectedAdminBooking, setSelectedAdminBooking] = useState<Booking | null>(null);
  const [completeAmount, setCompleteAmount]             = useState("");
  const [completeHours, setCompleteHours]               = useState("");
  const [completeNote, setCompleteNote]                 = useState("");
  const [completeLoading, setCompleteLoading]           = useState(false);
  const [billingMode, setBillingMode]                   = useState<"hourly" | "flat">("hourly");
  const [editingInvoiceRow, setEditingInvoiceRow]       = useState<number | null>(null);
  const [editInvoiceAmount, setEditInvoiceAmount]       = useState("");
  const [editInvoiceNote, setEditInvoiceNote]           = useState("");
  const [quickBookClient, setQuickBookClient]           = useState<Booking | null>(null);
  const [quickBookSearch, setQuickBookSearch]           = useState("");
  const [quickBookOpen, setQuickBookOpen]               = useState(false);
  const [qCalMonth, setQCalMonth]                       = useState(() => new Date().getMonth());
  const [qCalYear, setQCalYear]                         = useState(() => new Date().getFullYear());
  const [qAddOnList, setQAddOnList]                     = useState<AddOn[]>([]);
  const qAddressRef                                     = useRef<HTMLInputElement>(null);
  const [qDate, setQDate]                               = useState("");
  const [qTime, setQTime]                               = useState("");
  const [qPkg, setQPkg]                                 = useState("basic");
  const [qClientType, setQClientType]                   = useState("oneTime");
  const [qFreq, setQFreq]                               = useState("");
  const [qNotes, setQNotes]                             = useState("");
  const [qAddress, setQAddress]                         = useState("");
  const [qServiceType, setQServiceType]                 = useState("mobile");
  const [qSubmitting, setQSubmitting]                   = useState(false);
  const [qCustomService, setQCustomService]             = useState("");
  const [qCustomPrice, setQCustomPrice]                 = useState("");
  const [squarePopup, setSquarePopup]                   = useState(false);
  const [squareBooking, setSquareBooking]               = useState<Booking | null>(null);
  const [copiedAmount, setCopiedAmount]                 = useState<number | null>(null);
  const [editingBooking, setEditingBooking]             = useState<Booking | null>(null);
  const [editFields, setEditFields]                     = useState<Partial<Booking>>({});
  const [editSaving, setEditSaving]                     = useState(false);
  const [bookingsTab, setBookingsTab]                   = useState<"appointments" | "maintenance">("appointments");
  const [availSlots, setAvailSlots]                     = useState<{date: string; time: string; available: string}[]>([]);
  const [availLoading, setAvailLoading]                 = useState(false);
  const [newSlotDate, setNewSlotDate]                   = useState("");
  const [newSlotTime, setNewSlotTime]                   = useState("");
  const [addingSlot, setAddingSlot]                     = useState(false);
  const [photoUploading, setPhotoUploading]             = useState<{[key: number]: string}>({});
  const [localPhotoPreviews, setLocalPhotoPreviews]     = useState<{[key: string]: string[]}>({});
  const [processingRows, setProcessingRows]             = useState<Set<number>>(new Set());
  const [userBookings, setUserBookings]                 = useState<Booking[]>([]);
  const [bookingsLoading, setBookingsLoading]           = useState(false);
  const [changeTarget, setChangeTarget]                 = useState<Booking | null>(null);
  const [changeNote, setChangeNote]                     = useState("");
  const [changeSubmitted, setChangeSubmitted]           = useState(false);
  const [changeSubmitting, setChangeSubmitting]         = useState(false);
  const [step, setStep]                                 = useState(0);
  const [vehicle, setVehicle]                           = useState<VehicleType>("");
  const [clientType, setClientType]                     = useState<ClientType>("");
  const [frequency, setFrequency]                       = useState<FrequencyType>("");
  const [pkg, setPkg]                                   = useState<PackageType>("");
  const [addOns, setAddOns]                             = useState<AddOn[]>([]);
  const [serviceType, setServiceType]                   = useState<ServiceType>("");
  const [name, setName]                                 = useState("");
  const [phone, setPhone]                               = useState("");
  const [smsConsent, setSmsConsent]                     = useState(false);
  const [smsMarketingConsent, setSmsMarketingConsent]   = useState(false);
  const [email, setEmail]                               = useState("");
  const [year, setYear]                                 = useState("");
  const [make, setMake]                                 = useState("");
  const [model, setModel]                               = useState("");
  const [boatMake, setBoatMake]                         = useState("");
  const [boatModel, setBoatModel]                       = useState("");
  const [boatSize, setBoatSize]                         = useState("");
  const [bookingNotes, setBookingNotes]                 = useState("");
  const [selectedDate, setSelectedDate]                 = useState("");
  const [availableSlots, setAvailableSlots]             = useState<AvailabilitySlot[]>([]);
  const [allAvailableSlots, setAllAvailableSlots]       = useState<AvailabilitySlot[]>([]);
  const [availableDates, setAvailableDates]             = useState<string[]>([]);
  const [calMonth, setCalMonth]                         = useState(() => new Date().getMonth());
  const [calYear, setCalYear]                           = useState(() => new Date().getFullYear());
  const [selectedTime, setSelectedTime]                 = useState("");
  const [address, setAddress]                           = useState("");
  const [street, setStreet]                             = useState("");
  const [city, setCity]                                 = useState("");
  const [stateRegion, setStateRegion]                   = useState("");
  const [zip, setZip]                                   = useState("");
  const [placeId, setPlaceId]                           = useState("");
  const [lat, setLat]                                   = useState("");
  const [lng, setLng]                                   = useState("");
  const [addressSelected, setAddressSelected]           = useState(false);
  const [makeOptions, setMakeOptions]                   = useState<string[]>([]);
  const [modelOptions, setModelOptions]                 = useState<string[]>([]);

  // ── Splash screen sequencing ──
  useEffect(() => {
    const t1 = setTimeout(() => setSplashPhase(1), 1200);   // tagline + button appears
    return () => { clearTimeout(t1); };
  }, []);

  // ── Global styles injected once into <head> so they apply on ALL views ──
  useEffect(() => {
    const styleId = "atx-global-styles";
    if (document.getElementById(styleId)) return;
    const style = document.createElement("style");
    style.id = styleId;
    style.textContent = `
      @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&display=swap');

      *, *::before, *::after { box-sizing: border-box; }

      @keyframes fadeSlideUp {
        from { opacity: 0; transform: translateY(24px); }
        to   { opacity: 1; transform: translateY(0); }
      }
      @keyframes fadeSlideIn {
        from { opacity: 0; transform: translateX(-16px); }
        to   { opacity: 1; transform: translateX(0); }
      }
      @keyframes checkDraw {
        from { stroke-dashoffset: 50; opacity: 0; }
        to   { stroke-dashoffset: 0;  opacity: 1; }
      }
      @keyframes toastIn {
        from { opacity: 0; transform: translateX(60px) scale(0.95); }
        to   { opacity: 1; transform: translateX(0) scale(1); }
      }
      @keyframes spin {
        from { transform: rotate(0deg); }
        to   { transform: rotate(360deg); }
      }
      @keyframes orb1 {
        0%,100% { transform: translate(0,0) scale(1); }
        33%     { transform: translate(60px,-40px) scale(1.1); }
        66%     { transform: translate(-30px,60px) scale(0.95); }
      }
      @keyframes orb2 {
        0%,100% { transform: translate(0,0) scale(1); }
        33%     { transform: translate(-80px,50px) scale(1.05); }
        66%     { transform: translate(40px,-70px) scale(1.1); }
      }
      @keyframes orb3 {
        0%,100% { transform: translate(0,0) scale(1); }
        50%     { transform: translate(50px,80px) scale(1.08); }
      }
      @keyframes shimmer {
        0%   { background-position: -200% 0; }
        100% { background-position: 200% 0; }
      }
      @keyframes pulse-glow {
        0%,100% { box-shadow: 0 0 20px rgba(59,130,246,0.3); }
        50%     { box-shadow: 0 0 40px rgba(59,130,246,0.6); }
      }
      @keyframes stagger-in {
        from { opacity: 0; transform: translateY(16px); }
        to   { opacity: 1; transform: translateY(0); }
      }

      /* Animated orb background */
      .atx-bg {
        position: fixed; inset: 0; overflow: hidden; z-index: 0; pointer-events: none;
      }
      .atx-orb {
        position: absolute; border-radius: 50%;
        filter: blur(80px); opacity: 0.35;
      }
      .atx-orb-1 {
        width: 600px; height: 600px; top: -200px; right: -100px;
        background: radial-gradient(circle, #1e40af 0%, transparent 70%);
        animation: orb1 18s ease-in-out infinite;
      }
      .atx-orb-2 {
        width: 500px; height: 500px; bottom: -100px; left: -150px;
        background: radial-gradient(circle, #0e7490 0%, transparent 70%);
        animation: orb2 22s ease-in-out infinite;
      }
      .atx-orb-3 {
        width: 400px; height: 400px; top: 40%; left: 40%;
        background: radial-gradient(circle, #5b21b6 0%, transparent 70%);
        animation: orb3 26s ease-in-out infinite;
      }
      .atx-grid {
        position: absolute; inset: 0;
        background-image: linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),
                          linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px);
        background-size: 60px 60px;
      }

      /* Button effects */
      button {
        font-family: 'Outfit', sans-serif;
        transition: transform 0.15s cubic-bezier(0.16,1,0.3,1), box-shadow 0.15s ease, filter 0.15s ease, opacity 0.15s ease;
      }
      button:hover:not(:disabled) {
        transform: translateY(-2px);
        filter: brightness(1.12);
        box-shadow: 0 8px 30px rgba(0,0,0,0.35);
      }
      button:active:not(:disabled) {
        transform: translateY(0px) scale(0.97) !important;
        filter: brightness(0.92);
      }

      /* Card hover */
      .booking-card {
        transition: box-shadow 0.25s ease, transform 0.25s cubic-bezier(0.16,1,0.3,1), border-color 0.2s ease;
      }
      .booking-card:hover {
        box-shadow: 0 20px 60px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.12);
        transform: translateY(-3px);
        border-color: rgba(255,255,255,0.2) !important;
      }
      .inv-item {
        transition: box-shadow 0.2s ease, transform 0.2s cubic-bezier(0.16,1,0.3,1);
      }
      .inv-item:hover {
        box-shadow: 0 12px 40px rgba(0,0,0,0.4);
        transform: translateY(-2px);
      }
      .option-card {
        transition: all 0.2s cubic-bezier(0.16,1,0.3,1);
      }
      .option-card:hover {
        background: rgba(255,255,255,0.08) !important;
        border-color: rgba(255,255,255,0.2) !important;
        transform: translateY(-3px);
        box-shadow: 0 12px 40px rgba(0,0,0,0.4);
      }

      /* Input focus */
      input, select, textarea {
        font-family: 'Outfit', sans-serif;
        transition: border-color 0.2s ease, box-shadow 0.2s ease;
      }
      input:focus, select:focus, textarea:focus {
        outline: none;
        border-color: rgba(59,130,246,0.7) !important;
        box-shadow: 0 0 0 3px rgba(59,130,246,0.15) !important;
      }

      /* Staggered card animations */
      .stagger-1 { animation: stagger-in 0.4s cubic-bezier(0.16,1,0.3,1) 0.05s both; }
      .stagger-2 { animation: stagger-in 0.4s cubic-bezier(0.16,1,0.3,1) 0.10s both; }
      .stagger-3 { animation: stagger-in 0.4s cubic-bezier(0.16,1,0.3,1) 0.15s both; }
      .stagger-4 { animation: stagger-in 0.4s cubic-bezier(0.16,1,0.3,1) 0.20s both; }

      /* Scrollbar */
      ::-webkit-scrollbar { width: 6px; height: 6px; }
      ::-webkit-scrollbar-track { background: rgba(255,255,255,0.03); }
      ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.12); border-radius: 3px; }
      ::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.22); }

      /* Select options dark */
      option { background: #0f1623; color: #f1f5f9; }

      /* Selection */
      ::selection { background: rgba(59,130,246,0.35); color: #fff; }

      /* Status badges — override inline styles for dark theme */
      .badge-upcoming  { background: rgba(59,130,246,0.18) !important; color: #93c5fd !important; border: 1px solid rgba(59,130,246,0.3) !important; }
      .badge-completed { background: rgba(16,185,129,0.18) !important; color: #6ee7b7 !important; border: 1px solid rgba(16,185,129,0.3) !important; }
      .badge-cancelled { background: rgba(239,68,68,0.18) !important; color: #fca5a5 !important; border: 1px solid rgba(239,68,68,0.3) !important; }
      .badge-skipped   { background: rgba(99,179,237,0.18) !important; color: #93c5fd !important; border: 1px solid rgba(99,179,237,0.3) !important; }
      .badge-paid      { background: rgba(16,185,129,0.18) !important; color: #6ee7b7 !important; border: 1px solid rgba(16,185,129,0.3) !important; }

      /* Progress bar */
      .progress-bar-track { background: rgba(255,255,255,0.06) !important; }
      .progress-bar-fill  { background: linear-gradient(90deg, #3b82f6, #8b5cf6) !important; box-shadow: 0 0 12px rgba(59,130,246,0.5); }
    `;
    document.head.appendChild(style);
  }, []);
  type InventoryItem = {
    rowIndex: number;
    item: string;
    category: string;
    quantity: string;
    unit: string;
    lowStockThreshold: string;
    notes: string;
  };
  const [inventoryItems, setInventoryItems]             = useState<InventoryItem[]>([]);
  const [inventoryLoading, setInventoryLoading]         = useState(false);
  const [inventoryFilter, setInventoryFilter]           = useState<"all" | "low">("all");
  const [inventorySearch, setInventorySearch]           = useState("");
  const [editingInventoryRow, setEditingInventoryRow]   = useState<number | null>(null);
  const [editingInventoryVal, setEditingInventoryVal]   = useState("");
  const [editingThresholdRow, setEditingThresholdRow]   = useState<number | null>(null);
  const [editingThresholdVal, setEditingThresholdVal]   = useState("");
  const [inventorySaving, setInventorySaving]           = useState(false);
  const [addingInventoryItem, setAddingInventoryItem]   = useState(false);
  const [newInventoryItem, setNewInventoryItem]         = useState({ item: "", category: "", quantity: "", unit: "", lowStockThreshold: "", notes: "" });
  const [invCatFilter, setInvCatFilter]                 = useState("All");
  const [maintTimeConflicts, setMaintTimeConflicts]     = useState<{date:string;dateLabel:string;time:string;clientName:string;vehicle:string}[]>([]);
  const [maintTimeChecking, setMaintTimeChecking]       = useState(false);
  const [maintTimeCheckedFor, setMaintTimeCheckedFor]   = useState<{rowIndex:number;time:string}|null>(null);

  // ── Toast / loading system ──
  type Toast = { id: number; message: string; type: "loading" | "success" | "error" };
  const [toasts, setToasts]                             = useState<Toast[]>([]);
  const toastId                                         = useRef(0);

  function showToast(message: string, type: Toast["type"] = "loading", duration?: number): number {
    const id = ++toastId.current;
    setToasts(prev => [...prev, { id, message, type }]);
    if (duration) setTimeout(() => dismissToast(id), duration);
    return id;
  }
  function dismissToast(id: number) {
    setToasts(prev => prev.filter(t => t.id !== id));
  }
  function updateToast(id: number, message: string, type: Toast["type"], duration = 3000) {
    setToasts(prev => prev.map(t => t.id === id ? { ...t, message, type } : t));
    setTimeout(() => dismissToast(id), duration);
  }

  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: currentYear - 1995 + 1 }, (_, i) => String(currentYear - i));

  // ── Job Timer state ──
  const [timerBookingRow, setTimerBookingRow]   = useState<number | null>(null);
  const [timerElapsed, setTimerElapsed]         = useState<number>(0); // seconds
  const [timerRunning, setTimerRunning]         = useState(false);
  const timerIntervalRef                        = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (timerRunning) {
      timerIntervalRef.current = setInterval(() => {
        setTimerElapsed(prev => prev + 1);
      }, 1000);
    } else {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    }
    return () => { if (timerIntervalRef.current) clearInterval(timerIntervalRef.current); };
  }, [timerRunning]);

  function timerDisplay(secs: number) {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;
  }

  function startTimer(rowIndex: number) {
    setTimerBookingRow(rowIndex);
    setTimerElapsed(0);
    setTimerRunning(true);
  }

  async function stopTimer(booking: Booking) {
    setTimerRunning(false);
    const hours = (timerElapsed / 3600).toFixed(2);
    // Auto-fill hours in complete form
    setCompleteHours(hours);
    const rate = parseFloat(booking.hourlyRate || "0");
    if (rate > 0) setCompleteAmount((parseFloat(hours) * rate).toFixed(2));
    // Save elapsed time to sheet
    try {
      await fetch(SCRIPT_URL, {
        method: "POST",
        body: JSON.stringify({
          action: "updateBookingFields",
          rowIndex: booking.rowIndex,
          fields: { timerHours: hours },
        }),
      });
    } catch (e) { console.error("Timer save failed", e); }
    setTimerBookingRow(null);
  }

  useEffect(() => {
    if (document.getElementById("google-gsi-script")) { setGoogleScriptLoaded(true); return; }
    const script = document.createElement("script");
    script.id = "google-gsi-script";
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true; script.defer = true;
    script.onload = () => setGoogleScriptLoaded(true);
    document.body.appendChild(script);
  }, []);

  useEffect(() => {
    if (!googleScriptLoaded || googleUser) return;
    if (!window.google?.accounts?.id) return;
    window.google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: handleGoogleCredential,
    });
  }, [googleScriptLoaded, googleUser]);

  function handleGoogleCredential(response: any) {
    try {
      const payload = JSON.parse(atob(response.credential.split(".")[1]));
      const user = { name: payload.name || "", email: payload.email || "", picture: payload.picture || "" };
      setGoogleUser(user);
      setEmail(payload.email || "");
      localStorage.setItem("atx_google_user", JSON.stringify(user));
    } catch (e) { console.error("Google sign-in error", e); }
  }

  function handleSignOut() {
    if (window.google?.accounts?.id) window.google.accounts.id.disableAutoSelect();
    localStorage.removeItem("atx_google_user");
    setGoogleUser(null); setEmail(""); setView("booking"); setUserBookings([]);
  }

  const loadMyBookings = useCallback(async () => {
    if (!googleUser) return;
    setBookingsLoading(true);
    try {
      const bookings = await fetchBookingsForEmail(googleUser.email);
      setUserBookings(bookings);
    } catch (e) { console.error("Failed to load bookings", e); }
    finally { setBookingsLoading(false); }
  }, [googleUser]);

  function openMyBookings() {
    setView("myBookings"); setBookingsTab("appointments"); loadMyBookings();
  }

  const loadAdminBookings = useCallback(async () => {
    setAdminLoading(true);
    try {
      const bookings = await fetchAllBookings();
      setAdminBookings(bookings);
    } catch (e) { console.error("Failed to load admin bookings", e); }
    finally { setAdminLoading(false); }
  }, []);

  const loadInventory = useCallback(async () => {
    setInventoryLoading(true);
    try {
      const res = await fetch(`${SCRIPT_URL}?action=getInventory`);
      const data = await res.json();
      setInventoryItems(data.items || []);
    } catch (e) { console.error("Failed to load inventory", e); }
    finally { setInventoryLoading(false); }
  }, []);

  async function handleMarkComplete() {
    if (!selectedAdminBooking) return;
    if (processingRows.has(selectedAdminBooking.rowIndex)) return; // double-click guard
    const savedBooking = selectedAdminBooking;
    const rate = parseFloat(savedBooking.hourlyRate || "0");
    const finalAmount = savedBooking.clientType !== "maintenance" && completeHours
      ? String((parseFloat(completeHours) * rate).toFixed(2))
      : completeAmount;
    if (!finalAmount || parseFloat(finalAmount) <= 0) { alert("Please enter the hours or amount."); return; }
    setProcessingRows(prev => new Set([...prev, savedBooking.rowIndex]));
    setCompleteLoading(true);
    // Optimistic UI update
    setAdminBookings(prev => prev.map(b => b.rowIndex === savedBooking.rowIndex
      ? { ...b, status: "Completed", invoiceAmount: finalAmount, invoiceStatus: "pending", invoiceNote: completeNote }
      : b));
    setSelectedAdminBooking(null); setCompleteAmount(""); setCompleteHours(""); setCompleteNote("");
    try {
      const ok = await updateBooking(savedBooking.rowIndex, {
        status: "Completed",
        invoiceAmount: finalAmount,
        invoiceStatus: "pending",
        invoiceNote: completeNote,
      });
      if (ok) {
        if (savedBooking.clientType === "maintenance" && savedBooking.recurringFrequency && savedBooking.date) {
          const nextDates = calcRecurringDates(savedBooking.date, savedBooking.recurringFrequency, 1);
          if (nextDates.length > 0) {
            // nextDates returns formatted labels — we need YYYY-MM-DD
            // Use fmtDate on the calculated date
            const [y, m, d] = savedBooking.date.split("-").map(Number);
            const start = new Date(y, m - 1, d);
            const nextDate = savedBooking.recurringFrequency === "biweekly"
              ? new Date(start.getFullYear(), start.getMonth(), start.getDate() + 14)
              : getNthWeekday(
                  start.getMonth() + 1 > 11 ? start.getFullYear() + 1 : start.getFullYear(),
                  start.getMonth() + 1 > 11 ? 0 : start.getMonth() + 1,
                  start.getDay(),
                  Math.ceil(start.getDate() / 7),
                  new Date(start.getFullYear(), start.getMonth(), start.getDate() + 7).getMonth() !== start.getMonth()
                );
            if (nextDate) {
              const nextDateStr = fmtDate(nextDate);
              try {
                await fetch(SCRIPT_URL, {
                  method: "POST",
                  body: JSON.stringify({
                    action: "createNextMaintenanceBooking",
                    ...savedBooking,
                    date: nextDateStr,
                    displayDate: nextDateStr,
                    status: "Booked",
                    invoiceAmount: "",
                    invoiceStatus: "",
                    invoiceNote: "",
                  }),
                });
              } catch (e) { console.error("Failed to create next booking", e); }
            }
          }
        }
        await loadAdminBookings();
        setSelectedAdminBooking(null);
        setCompleteAmount("");
        setCompleteHours("");
        setCompleteNote("");
      } else { alert("Something went wrong. Please try again."); }
    } catch (e) { alert("Something went wrong."); }
    finally { setCompleteLoading(false); setProcessingRows(prev => { const n = new Set(prev); n.delete(savedBooking.rowIndex); return n; }); }
  }

  async function applyMaintenanceTimeUpdate(booking: Booking, newTime: string) {
    const tid = showToast("Updating schedule — this may take a moment...", "loading");
    try {
      const res = await fetch(SCRIPT_URL, {
        method: "POST",
        body: JSON.stringify({
          action: "updateMaintenanceTime",
          customerEmail: booking.email,
          customerName: booking.name,
          customerPhone: booking.phone,
          make: booking.make,
          model: booking.model,
          newTime,
        }),
      });
      const d = await res.json();
      if (d.success) {
        updateToast(tid, `✓ Updated ${d.updatedRows} booking${d.updatedRows !== 1 ? "s" : ""} and ${d.updatedCal} calendar event${d.updatedCal !== 1 ? "s" : ""} to ${newTime}`, "success", 4000);
        setMaintTimeCheckedFor(null);
        setMaintTimeConflicts([]);
        await loadAdminBookings();
        setEditingBooking(null);
        setEditFields({});
      } else {
        updateToast(tid, "Something went wrong: " + (d.error || "unknown error"), "error", 4000);
      }
    } catch (e) {
      updateToast(tid, "Network error — please try again", "error", 4000);
    }
  }

  async function handleSaveEdit() {
    if (!editingBooking) return;
    setEditSaving(true);
    const dateChanged = editFields.date && editFields.date !== editingBooking.date;
    const timeChanged = editFields.time && editFields.time !== editingBooking.time;
    const scheduleChanged = dateChanged || timeChanged;

    // Build change summary for email
    const pkgLabel = (p: string) => p === "basic" ? "Basic Detail" : p === "premium" ? "Premium Detail" : p === "exterior" ? "Exterior Basic" : p === "exteriorPremium" ? "Exterior Premium" : p === "interior" ? "Interior Basic" : p === "interiorPremium" ? "Interior Premium" : p;
    const svcLabel = (s: string) => s === "mobile" ? "Mobile" : s === "dropoff" ? "Drop-Off" : s;
    const ctLabel  = (c: string) => c === "oneTime" ? "One-Time" : c === "maintenance" ? "Maintenance" : c;
    const changeDetails: { field: string; from: string; to: string }[] = [];
    if (editFields.packageType && editFields.packageType !== editingBooking.packageType) changeDetails.push({ field: "Package", from: pkgLabel(editingBooking.packageType), to: pkgLabel(editFields.packageType) });
    if (editFields.addOns !== undefined && editFields.addOns !== editingBooking.addOns) changeDetails.push({ field: "Add-Ons", from: editingBooking.addOns || "None", to: editFields.addOns || "None" });
    if (editFields.clientType && editFields.clientType !== editingBooking.clientType) changeDetails.push({ field: "Client Type", from: ctLabel(editingBooking.clientType), to: ctLabel(editFields.clientType) });
    if (editFields.recurringFrequency !== undefined && editFields.recurringFrequency !== editingBooking.recurringFrequency) changeDetails.push({ field: "Frequency", from: editingBooking.recurringFrequency || "None", to: editFields.recurringFrequency || "None" });
    if (editFields.year && editFields.year !== editingBooking.year) changeDetails.push({ field: "Year", from: editingBooking.year, to: editFields.year });
    if (editFields.make && editFields.make !== editingBooking.make) changeDetails.push({ field: "Make", from: editingBooking.make, to: editFields.make });
    if (editFields.model && editFields.model !== editingBooking.model) changeDetails.push({ field: "Model", from: editingBooking.model, to: editFields.model });
    if (editFields.serviceType && editFields.serviceType !== editingBooking.serviceType) changeDetails.push({ field: "Service Type", from: svcLabel(editingBooking.serviceType), to: svcLabel(editFields.serviceType) });
    if (editFields.address && editFields.address !== editingBooking.address) changeDetails.push({ field: "Address", from: editingBooking.address, to: editFields.address });

    try {
      const res = await fetch(SCRIPT_URL, {
        method: "POST",
        body: JSON.stringify({
          action: "updateBookingFields",
          rowIndex: editingBooking.rowIndex,
          fields: editFields,
          oldDate: editingBooking.date,
          oldTime: editingBooking.time,
          scheduleChanged,
          customerName: editingBooking.name,
          customerEmail: editingBooking.email,
          customerPhone: editingBooking.phone,
          vehicle: editingBooking.vehicle === "boat"
            ? [editingBooking.boatSize, editingBooking.make, editingBooking.model].filter(Boolean).join(" ")
            : [editFields.year || editingBooking.year, editFields.make || editingBooking.make, editFields.model || editingBooking.model].filter(Boolean).join(" "),
          packageType: editFields.packageType || editingBooking.packageType,
          serviceType: editFields.serviceType || editingBooking.serviceType,
          address: editFields.address || editingBooking.address,
          hourlyRate: editingBooking.hourlyRate,
          serviceDate: editFields.date || editingBooking.date,
          // Change notification payload
          hasDetailChanges: changeDetails.length > 0,
          changeDetails: JSON.stringify(changeDetails),
        }),
      });
      const data = await res.json();
      if (data.success) { await loadAdminBookings(); setEditingBooking(null); setEditFields({}); }
      else { alert("Something went wrong."); }
    } catch (e) { alert("Something went wrong."); }
    finally { setEditSaving(false); }
  }

  async function handleReleaseInvoice(booking: Booking) {
    if (processingRows.has(booking.rowIndex)) return;
    setProcessingRows(prev => new Set([...prev, booking.rowIndex]));
    // Optimistic update
    setAdminBookings(prev => prev.map(b => b.rowIndex === booking.rowIndex ? { ...b, invoiceStatus: "released" } : b));
    try {
      const ok = await updateBooking(booking.rowIndex, { invoiceStatus: "released" });
      if (ok) {
        fetch(SCRIPT_URL, {
          method: "POST",
          body: JSON.stringify({
            action: "sendInvoiceEmail",
            customerName: booking.name,
            customerEmail: booking.email,
            customerPhone: booking.phone,
            invoiceAmount: booking.invoiceAmount,
            invoiceNote: booking.invoiceNote,
            serviceDate: booking.date,
          }),
        }).catch(e => console.error("Invoice email failed", e));
        await loadAdminBookings();
      } else {
        setAdminBookings(prev => prev.map(b => b.rowIndex === booking.rowIndex ? { ...b, invoiceStatus: "pending" } : b));
        alert("Something went wrong.");
      }
    } catch (e) { alert("Something went wrong."); }
    finally { setProcessingRows(prev => { const n = new Set(prev); n.delete(booking.rowIndex); return n; }); }
  }

  async function handleMarkPaid(booking: Booking) {
    if (processingRows.has(booking.rowIndex)) return;
    setProcessingRows(prev => new Set([...prev, booking.rowIndex]));
    setAdminBookings(prev => prev.map(b => b.rowIndex === booking.rowIndex ? { ...b, invoiceStatus: "paid" } : b));
    const tid = showToast("Processing payment and sending receipt...", "loading");
    try {
      const ok = await updateBooking(booking.rowIndex, { invoiceStatus: "paid" });
      if (ok) {
        const vehicleLabel = booking.vehicle === "boat"
          ? [booking.boatSize, booking.make, booking.model].filter(Boolean).join(" ")
          : [booking.year, booking.make, booking.model].filter(Boolean).join(" ");
        const pkgLabel = booking.packageType === "basic" ? "Basic Detail" : booking.packageType === "premium" ? "Premium Detail" : booking.packageType === "exterior" ? "Exterior Only — Basic" : booking.packageType === "exteriorPremium" ? "Exterior Only — Premium" : booking.packageType === "interior" ? "Interior Only — Basic" : booking.packageType === "interiorPremium" ? "Interior Only — Premium" : booking.packageType;
        try {
          const emailRes = await fetch(SCRIPT_URL, {
            method: "POST",
            body: JSON.stringify({
              action: "sendPaymentConfirmedEmail",
              customerName: booking.name,
              customerEmail: booking.email,
              customerPhone: booking.phone,
              invoiceAmount: booking.invoiceAmount,
              serviceDate: booking.date,
              packageType: pkgLabel,
              vehicle: vehicleLabel,
              hourlyRate: booking.hourlyRate,
              addOns: booking.addOns,
              invoiceNote: booking.invoiceNote,
              rowIndex: booking.rowIndex,
              photosLink: (booking as any).photosLink || "",
              beforePhotoUrl: (booking as any).beforePhotoUrl || "",
              afterPhotoUrl: (booking as any).afterPhotoUrl || "",
              invoiceLink: (booking as any).invoiceLink || "",
            }),
          });
          const emailData = await emailRes.json();
          if (emailData.success) {
            updateToast(tid, `✓ Payment confirmed — receipt sent to ${booking.name}`, "success", 4000);
          } else {
            updateToast(tid, "Marked paid but receipt email failed — check logs", "error", 5000);
          }
        } catch (emailErr) {
          updateToast(tid, "Marked paid but receipt email failed", "error", 5000);
        }
        await loadAdminBookings();
      } else {
        setAdminBookings(prev => prev.map(b => b.rowIndex === booking.rowIndex ? { ...b, invoiceStatus: "released" } : b));
        updateToast(tid, "Something went wrong — please try again", "error", 4000);
      }
    } catch (e) {
      updateToast(tid, "Network error — please try again", "error", 4000);
    }
    finally { setProcessingRows(prev => { const n = new Set(prev); n.delete(booking.rowIndex); return n; }); }
  }

  async function handleSquareRequest(booking: Booking) {
    setSquareBooking(booking);
    setSquarePopup(true);
    // Send email to admin
    try {
      await fetch(SCRIPT_URL, {
        method: "POST",
        body: JSON.stringify({
          action: "squareInvoiceRequest",
          customerName: booking.name,
          customerEmail: booking.email,
          amount: booking.invoiceAmount,
          date: booking.date,
        }),
      });
    } catch (e) { console.error("Square request email failed", e); }
  }

  // Static vehicle data — reliable curated list
  useEffect(() => {
    if (!vehicle || vehicle === "boat") { setMakeOptions([]); return; }
    const carMakes = [
      "Acura","Alfa Romeo","Audi","BMW","Buick","Cadillac","Chevrolet","Chrysler",
      "Dodge","Ferrari","Fiat","Ford","Genesis","GMC","Honda","Hyundai","Infiniti",
      "Jaguar","Jeep","Kia","Lamborghini","Land Rover","Lexus","Lincoln","Maserati",
      "Mazda","Mercedes-Benz","Mini","Mitsubishi","Nissan","Porsche","Ram","Rivian",
      "Rolls-Royce","Subaru","Tesla","Toyota","Volkswagen","Volvo",
    ];
    const truckMakes = [
      "Chevrolet","Ford","GMC","Ram","Toyota","Nissan","Honda","Jeep",
      "Land Rover","Lexus","Lincoln","Cadillac","Rivian","Mercedes-Benz",
    ];
    setMakeOptions(vehicle === "truckSuv" ? truckMakes : carMakes);
  }, [vehicle]);

  useEffect(() => {
    if (!make || !vehicle || vehicle === "boat") { setModelOptions([]); return; }
    const modelMap: Record<string, string[]> = {
      "Toyota": ["Camry","Corolla","RAV4","Tacoma","Tundra","Highlander","4Runner","Sienna","Prius","Avalon","Sequoia","Land Cruiser","Venza","C-HR"],
      "Ford": ["F-150","F-250","F-350","Mustang","Explorer","Escape","Edge","Bronco","Bronco Sport","Expedition","Ranger","Maverick","EcoSport"],
      "Chevrolet": ["Silverado 1500","Silverado 2500","Tahoe","Suburban","Equinox","Traverse","Blazer","Malibu","Camaro","Corvette","Colorado","Trax","Trailblazer"],
      "Honda": ["Civic","Accord","CR-V","Pilot","Odyssey","HR-V","Ridgeline","Passport","Insight"],
      "Nissan": ["Altima","Sentra","Maxima","Rogue","Murano","Pathfinder","Frontier","Titan","Armada","Kicks","Versa"],
      "Hyundai": ["Elantra","Sonata","Tucson","Santa Fe","Palisade","Kona","Ioniq 5","Ioniq 6","Santa Cruz","Venue"],
      "Kia": ["Forte","K5","Telluride","Sorento","Sportage","Soul","Stinger","EV6","Carnival","Seltos"],
      "Jeep": ["Wrangler","Grand Cherokee","Cherokee","Compass","Gladiator","Renegade","Wagoneer","Grand Wagoneer"],
      "GMC": ["Sierra 1500","Sierra 2500","Yukon","Yukon XL","Terrain","Acadia","Canyon","Envoy"],
      "Ram": ["1500","2500","3500","ProMaster","ProMaster City"],
      "Dodge": ["Charger","Challenger","Durango","Journey"],
      "Subaru": ["Outback","Forester","Crosstrek","Impreza","Legacy","Ascent","WRX","BRZ","Solterra"],
      "BMW": ["3 Series","5 Series","7 Series","X3","X5","X7","M3","M5","i4","iX","4 Series","2 Series"],
      "Mercedes-Benz": ["C-Class","E-Class","S-Class","GLC","GLE","GLS","A-Class","CLA","AMG GT","EQS","EQE"],
      "Audi": ["A3","A4","A6","A8","Q3","Q5","Q7","Q8","e-tron","RS3","RS6"],
      "Lexus": ["ES","IS","GS","LS","RX","NX","GX","LX","UX","LC"],
      "Cadillac": ["CT4","CT5","Escalade","Escalade ESV","XT4","XT5","XT6","Lyriq"],
      "Lincoln": ["Navigator","Aviator","Corsair","Nautilus","Continental"],
      "Acura": ["ILX","TLX","RLX","MDX","RDX","NSX"],
      "Infiniti": ["Q50","Q60","QX50","QX60","QX80"],
      "Volkswagen": ["Jetta","Passat","Golf","Tiguan","Atlas","Taos","ID.4","Arteon"],
      "Mazda": ["Mazda3","Mazda6","CX-3","CX-5","CX-9","CX-30","CX-50","MX-5 Miata"],
      "Volvo": ["S60","S90","V60","V90","XC40","XC60","XC90","C40"],
      "Porsche": ["911","Cayenne","Macan","Panamera","Taycan","718"],
      "Tesla": ["Model 3","Model S","Model X","Model Y","Cybertruck"],
      "Land Rover": ["Defender","Discovery","Range Rover","Range Rover Sport","Range Rover Evoque","Range Rover Velar"],
      "Jaguar": ["F-Pace","E-Pace","I-Pace","XE","XF","F-Type"],
      "Genesis": ["G70","G80","G90","GV70","GV80","GV60"],
      "Mitsubishi": ["Outlander","Eclipse Cross","Galant","Mirage","Outlander Sport"],
      "Buick": ["Enclave","Encore","Encore GX","Envision","LaCrosse"],
      "Chrysler": ["300","Pacifica","Voyager"],
      "Rivian": ["R1T","R1S"],
      "Mini": ["Cooper","Countryman","Clubman","Paceman"],
      "Fiat": ["500","500X","500L"],
      "Alfa Romeo": ["Giulia","Stelvio","Tonale"],
      "Maserati": ["Ghibli","Quattroporte","Levante","Grecale"],
      "Ferrari": ["Roma","Portofino","SF90","F8"],
      "Lamborghini": ["Urus","Huracan","Aventador"],
      "Rolls-Royce": ["Ghost","Phantom","Cullinan","Wraith","Dawn"],
    };
    const models = modelMap[make] || [];
    setModelOptions(models.sort((a, b) => a.localeCompare(b)));
  }, [make, vehicle]);

  useEffect(() => {
    if (step !== 5 || serviceType !== "mobile") return;
    if (!window.google?.maps?.places || !addressInputRef.current) return;
    const ac = new window.google.maps.places.Autocomplete(addressInputRef.current, {
      types: ["address"], componentRestrictions: { country: "us" },
      fields: ["address_components", "formatted_address", "geometry", "place_id"],
    });
    const listener = ac.addListener("place_changed", () => {
      const place = ac.getPlace();
      if (!place?.address_components) return;
      let sn = "", rt = "", loc = "", aa = "", pc = "";
      place.address_components.forEach((c: any) => {
        if (c.types.includes("street_number")) sn = c.long_name;
        if (c.types.includes("route")) rt = c.long_name;
        if (c.types.includes("locality")) loc = c.long_name;
        if (c.types.includes("administrative_area_level_1")) aa = c.short_name;
        if (c.types.includes("postal_code")) pc = c.long_name;
      });
      setAddress(place.formatted_address || "");
      setStreet([sn, rt].filter(Boolean).join(" "));
      setCity(loc); setStateRegion(aa); setZip(pc);
      setPlaceId(place.place_id || "");
      setLat(place.geometry?.location?.lat?.() ?? "");
      setLng(place.geometry?.location?.lng?.() ?? "");
      setAddressSelected(true);
    });
    return () => { if (listener) window.google.maps.event.removeListener(listener); };
  }, [step, serviceType]);

  useEffect(() => {
    if (!quickBookClient || !qAddressRef.current) return;
    if (!window.google?.maps?.places) return;
    const ac = new window.google.maps.places.Autocomplete(qAddressRef.current, {
      types: ["address"], componentRestrictions: { country: "us" },
      fields: ["formatted_address"],
    });
    const listener = ac.addListener("place_changed", () => {
      const place = ac.getPlace();
      if (place?.formatted_address) setQAddress(place.formatted_address);
    });
    return () => { if (listener) window.google.maps.event.removeListener(listener); };
  }, [quickBookClient]);

  useEffect(() => {
    fetchAllAvailability().then((slots) => {
      setAllAvailableSlots(slots);
      const dates = [...new Set(slots.map((s) => s.date))];
      setAvailableDates(dates);
      // Auto-advance calendar to first available month
      if (dates.length > 0) {
        const sorted = [...dates].sort();
        const [y, m] = sorted[0].split("-").map(Number);
        const today = new Date();
        const firstAvailMonth = new Date(y, m - 1);
        const thisMonth = new Date(today.getFullYear(), today.getMonth());
        if (firstAvailMonth > thisMonth) {
          setCalMonth(m - 1);
          setCalYear(y);
        }
      }
    }).catch(console.error);
  }, []);

  useEffect(() => {
    if (!selectedDate) { setAvailableSlots([]); return; }
    setAvailableSlots(allAvailableSlots.filter((s) => s.date === selectedDate));
  }, [selectedDate, allAvailableSlots]);

  const selectedVehicle = vehicleOptions.find((v) => v.id === vehicle);

  const hourlyRate = useMemo(() => {
    if (!selectedVehicle || !pkg) return 0;
    if (pkg === "premium" || pkg === "exteriorPremium" || pkg === "interiorPremium") return selectedVehicle.premiumRate;
    return selectedVehicle.basicRate;
  }, [selectedVehicle, pkg]);

  const packageHours = useMemo(() => {
    if (!vehicle || !pkg) return "Select vehicle first";
    if (pkg === "exterior" || pkg === "interior" || pkg === "exteriorPremium" || pkg === "interiorPremium") return "2 hours avg";
    if (vehicle === "boat") return pkg === "premium" ? "5-8 hours avg" : "3-6 hours avg";
    if (clientType === "maintenance") return "2 hours";
    if (vehicle === "truckSuv") return "3-5 hours avg";
    return pkg === "premium" ? "3-5 hours avg" : "3-4 hours avg";
  }, [vehicle, pkg, clientType]);

  const addOnEstimate = useMemo(() => {
    const all = [...addOnOptions, ...marineAddOnOptions];
    return addOns.reduce((sum, a) => sum + (all.find((o) => o.label === a)?.fixedPrice ?? 0), 0);
  }, [addOns]);

  const estimateText     = useMemo(() => hourlyRate ? `${formatCurrency(hourlyRate)}/hr` : "", [hourlyRate]);
  const addOnSummaryText = useMemo(() => addOns.join(", "), [addOns]);

  function toggleAddOn(addOn: AddOn) {
    setAddOns((prev) => prev.includes(addOn) ? prev.filter((i) => i !== addOn) : [...prev, addOn]);
  }
  function next() { setStep((s) => s + 1); }
  function back() { setStep((s) => s - 1); }

  const vehicleSummary =
    vehicle === "boat"
      ? [boatSize, boatMake, boatModel].filter(Boolean).join(" ") || "N/A"
      : [year, make, model].filter(Boolean).join(" ") || "N/A";

  const step6Disabled =
    !name || !email || !selectedDate || !selectedTime ||
    (vehicle === "boat" ? !boatSize || !boatMake || !boatModel : !year || !make || !model);

  const standardBookings    = userBookings.filter((b) => b.clientType !== "maintenance");
  const maintenanceBookings = userBookings.filter((b) => b.clientType === "maintenance");
  const isMaintenance       = maintenanceBookings.length > 0;

  // A booking is "done" if admin explicitly marked it Completed
  // (regardless of invoice — a past date with no status is also done)
  const isDone = (b: Booking) => b.status === "Completed";

  // Standard bookings: upcoming = future date and not done
  const upcomingStandard = standardBookings
    .filter((b) => isUpcoming(b.date) && !isDone(b))
    .sort((a, b) => a.date.localeCompare(b.date));
  const pastStandard = standardBookings
    .filter((b) => !isUpcoming(b.date) || isDone(b))
    .sort((a, b) => b.date.localeCompare(a.date));

  // Maintenance bookings: upcoming = future date and not done
  const upcomingMaintenance = maintenanceBookings
    .filter((b) => isUpcoming(b.date) && !isDone(b))
    .sort((a, b) => a.date.localeCompare(b.date));
  const pastMaintenance = maintenanceBookings
    .filter((b) => !isUpcoming(b.date) || isDone(b))
    .sort((a, b) => b.date.localeCompare(a.date));

  async function submitChangeRequest() {
    if (!changeTarget || !changeNote.trim()) return;
    setChangeSubmitting(true);
    try {
      const vl = changeTarget.vehicle === "boat"
        ? [changeTarget.boatSize, changeTarget.make, changeTarget.model].filter(Boolean).join(" ")
        : [changeTarget.year, changeTarget.make, changeTarget.model].filter(Boolean).join(" ");
      await fetch(SCRIPT_URL, {
        method: "POST",
        body: JSON.stringify({
          action: "requestChange",
          customerEmail: googleUser?.email || "",
          customerName: googleUser?.name || "",
          bookingDate: changeTarget.date,
          bookingTime: changeTarget.time,
          vehicle: vl,
          packageType: changeTarget.packageType,
          changeNote,
        }),
      });
      setChangeSubmitted(true);
    } catch (e) { console.error("Change request failed", e); }
    finally { setChangeSubmitting(false); }
  }

  const S = {
    page:           { minHeight: "100vh", background: "#080c12", color: "#e8eaf0", padding: "32px 16px", fontFamily: '"Outfit", ui-sans-serif, system-ui, sans-serif', position: "relative" as const, overflow: "hidden" } as const,
    container:      { maxWidth: 960, margin: "0 auto", position: "relative" as const, zIndex: 1 } as const,
    card:           { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 28, boxShadow: "0 24px 80px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.08)", padding: 32, animation: "fadeSlideUp 0.45s cubic-bezier(0.16,1,0.3,1) both", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)" } as const,
    title:          { fontSize: "2.6rem", fontWeight: 900, letterSpacing: "-2px", color: "#ffffff", margin: "0 0 14px", textAlign: "center" as const, textShadow: "0 2px 20px rgba(99,179,237,0.3)" },
    subtitle:       { fontSize: "1rem", color: "rgba(255,255,255,0.5)", margin: "0 0 28px", textAlign: "center" as const },
    primary:        { background: "linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)", color: "#fff", border: "none", borderRadius: 14, padding: "14px 24px", fontSize: "1rem", fontWeight: 700, cursor: "pointer", boxShadow: "0 8px 32px rgba(59,130,246,0.4), inset 0 1px 0 rgba(255,255,255,0.2)" } as const,
    secondary:      { background: "rgba(255,255,255,0.07)", color: "#e8eaf0", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 14, padding: "13px 20px", fontSize: "1rem", fontWeight: 600, cursor: "pointer", backdropFilter: "blur(10px)" } as const,
    disabled:       { opacity: 0.35, cursor: "not-allowed" } as const,
    optionGrid:     { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14, marginBottom: 20 } as const,
    optionCard:     { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 20, padding: 20, cursor: "pointer", textAlign: "left" as const, transition: "all 0.2s cubic-bezier(0.16,1,0.3,1)", backdropFilter: "blur(10px)" },
    selectedCard:   { border: "1.5px solid rgba(99,179,237,0.8)", background: "rgba(59,130,246,0.15)", boxShadow: "0 0 0 3px rgba(59,130,246,0.2), 0 8px 32px rgba(59,130,246,0.2)", transform: "translateY(-2px)" },
    selectedGreen:  { border: "1.5px solid rgba(52,211,153,0.8)", background: "rgba(16,185,129,0.15)", boxShadow: "0 0 0 3px rgba(16,185,129,0.2)" },
    optionTitle:    { fontWeight: 700, fontSize: "1.05rem", marginBottom: 8, color: "#f1f5f9" },
    optionMeta:     { color: "rgba(255,255,255,0.5)", fontSize: "0.95rem", lineHeight: 1.45 },
    estimateBox:    { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 16, textAlign: "center" as const, marginTop: 6 } as const,
    estimateLabel:  { color: "rgba(255,255,255,0.5)", fontSize: "0.95rem", marginBottom: 6 },
    estimateValue:  { fontSize: "1.05rem", fontWeight: 800, color: "#f1f5f9", lineHeight: 1.5 },
    noteBox:        { marginTop: 14, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 14, color: "rgba(255,255,255,0.6)", textAlign: "center" as const, lineHeight: 1.45 } as const,
    addOnGrid:      { display: "grid", gap: 12, marginBottom: 18 } as const,
    addOnRow:       { display: "flex", alignItems: "center", gap: 14, padding: 16, borderRadius: 16, border: "1px solid rgba(255,255,255,0.10)", background: "rgba(255,255,255,0.04)", cursor: "pointer", justifyContent: "space-between", flexWrap: "wrap" as const, backdropFilter: "blur(10px)" },
    checkWrap:      { display: "flex", alignItems: "center", gap: 12, flex: 1, minWidth: 220 },
    checkbox:       { width: 18, height: 18, accentColor: "#3b82f6" },
    addOnPrice:     { color: "#93c5fd", fontWeight: 700 },
    inputGrid:      { display: "grid", gap: 14, maxWidth: 560, margin: "0 auto" } as const,
    input:          { width: "100%", boxSizing: "border-box" as const, background: "rgba(255,255,255,0.06)", color: "#f1f5f9", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 14, padding: "14px 16px", fontSize: "1rem", outline: "none", backdropFilter: "blur(10px)" },
    buttonRow:      { display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" as const, marginTop: 24 },
    rightButtons:   { display: "flex", gap: 12, marginLeft: "auto" } as const,
    summaryGrid:    { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14, marginTop: 22 } as const,
    summaryCard:    { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 16 },
    sectionLabel:   { fontSize: "0.95rem", fontWeight: 700, color: "#cbd5e1", marginTop: 6, marginBottom: -4, textAlign: "left" as const },
    summaryHeading: { fontSize: "0.82rem", color: "rgba(255,255,255,0.4)", marginBottom: 8, textTransform: "uppercase" as const, letterSpacing: "0.08em" },
    summaryValue:   { fontSize: "1rem", fontWeight: 700, lineHeight: 1.5, color: "#f1f5f9", wordBreak: "break-word" as const },
    successWrap:    { textAlign: "center" as const, padding: "10px 0" },
    successText:    { fontSize: "1.05rem", color: "rgba(255,255,255,0.6)", lineHeight: 1.6, maxWidth: 620, margin: "0 auto 24px" },
  };

  const Header = () => (
    <div style={{ display: "flex", justifyContent: "center", marginBottom: 36 }}>
      <div style={{ maxWidth: 760, width: "100%" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
          <a href="https://atxprestigedetailing.com" target="_blank" rel="noopener noreferrer" style={{ display: "flex", alignItems: "center", gap: 14, textDecoration: "none", flex: 1, minWidth: 0 }}>
            <div style={{ width: 72, height: 72, borderRadius: "50%", background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, backdropFilter: "blur(10px)", boxShadow: "0 8px 32px rgba(0,0,0,0.3)" }}>
              <img src={logo} alt="ATX Prestige Detailing logo" style={{ width: 56, height: 56, objectFit: "contain" as const }} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <h1 style={{ fontSize: "clamp(1.5rem, 5vw, 2.6rem)", fontWeight: 900, letterSpacing: "-1.5px", color: "#ffffff", margin: 0, lineHeight: 1.05, textShadow: "0 2px 20px rgba(99,179,237,0.3)" }}>ATX Prestige Detailing</h1>
              <p style={{ color: "rgba(255,255,255,0.45)", fontSize: "clamp(0.78rem, 2.2vw, 0.95rem)", marginTop: 6, marginBottom: 0, lineHeight: 1.4, fontStyle: "italic" }}>Defined by Detail, Driven by Standards, Trusted for Prestige</p>
            </div>
          </a>
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center" }}>
          {googleUser ? (
            <div style={{ display: "flex", alignItems: "center", gap: 10, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 14, padding: "8px 14px", backdropFilter: "blur(10px)" }}>
              <img src={googleUser.picture} alt={googleUser.name} style={{ width: 32, height: 32, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.2)", flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "#f1f5f9" }}>{googleUser.name}</div>
                <div style={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.45)" }}>{googleUser.email}</div>
              </div>
              <button onClick={handleSignOut} style={{ fontSize: "0.78rem", color: "rgba(255,255,255,0.5)", background: "none", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, padding: "4px 10px", cursor: "pointer", marginLeft: 4 }}>Sign out</button>
            </div>
          ) : (
            <button
              onClick={() => window.google?.accounts?.id?.prompt()}
              style={{
                display: "flex", alignItems: "center", gap: 10,
                background: "rgba(255,255,255,0.07)",
                border: "1px solid rgba(255,255,255,0.12)",
                borderRadius: 12, padding: "10px 18px",
                fontSize: "0.9rem", fontWeight: 600, cursor: "pointer",
                color: "#e8eaf0", backdropFilter: "blur(10px)",
                boxShadow: "0 4px 16px rgba(0,0,0,0.2)",
              }}
            >
              <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" style={{ width: 18, height: 18 }} />
              Sign in with Google
            </button>
          )}
        </div>
      </div>
    </div>
  );

  const ProgressBar = () => (
    <div style={{ marginBottom: 28 }}>
      <div style={{ display: "flex", justifyContent: "space-between", color: "rgba(255,255,255,0.45)", fontSize: "0.82rem", marginBottom: 8 }}>
        <span style={{ letterSpacing: "0.05em", textTransform: "uppercase" as const, fontSize: "0.72rem" }}>Booking</span>
        <span>Step {step} of {TOTAL_STEPS - 1}</span>
      </div>
      <div className="progress-bar-track" style={{ height: 3, borderRadius: 999, overflow: "hidden" }}>
        <div className="progress-bar-fill" style={{ height: "100%", width: `${(step / (TOTAL_STEPS - 1)) * 100}%`, borderRadius: 999, transition: "width 0.5s cubic-bezier(0.16,1,0.3,1)" }} />
      </div>
    </div>
  );

  // SQUARE POPUP MODAL — defined here so it's available in all views
  const SquarePopup = () => squarePopup ? (
    <div style={{ position: "fixed" as const, inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 16, backdropFilter: "blur(8px)" }}>
      <div style={{ background: "rgba(15,20,30,0.95)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 24, padding: 32, maxWidth: 400, width: "100%", boxShadow: "0 40px 100px rgba(0,0,0,0.6)" }}>
        <h3 style={{ margin: "0 0 12px", fontWeight: 800, color: "#f1f5f9" }}>Square Invoice Request</h3>
        <p style={{ color: "rgba(255,255,255,0.55)", fontSize: "0.95rem", lineHeight: 1.6, margin: "0 0 20px" }}>
          We received your request. We will send you a Square invoice to <strong style={{ color: "#93c5fd" }}>{squareBooking?.email}</strong> shortly so you can pay by credit or debit card.
        </p>
        <p style={{ color: "rgba(255,255,255,0.45)", fontSize: "0.82rem", margin: "0 0 20px" }}>Note: A 4% processing fee applies to card payments.</p>
        <button onClick={() => { setSquarePopup(false); setSquareBooking(null); }} style={{ background: "#111827", color: "#fff", border: "none", borderRadius: 12, padding: "12px 20px", fontWeight: 700, cursor: "pointer", width: "100%" }}>Got it</button>
      </div>
    </div>
  ) : null;

  // MY BOOKINGS VIEW
  // ── SPLASH SCREEN ──────────────────────────────────────────────────────────

  if (!splashDone) {
    return (
      <div style={{
        position: "fixed" as const, inset: 0,
        background: "#080c12",
        display: "flex", alignItems: "center", justifyContent: "center",
        zIndex: 9999, fontFamily: '"Outfit", sans-serif',
        opacity: splashPhase === 2 ? 0 : 1,
        transition: "opacity 0.8s cubic-bezier(0.4,0,0.2,1)",
        overflow: "hidden",
      }}>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;700;900&display=swap');
          @keyframes logoIn{0%{opacity:0;transform:scale(0.5);filter:blur(16px)}70%{opacity:1;transform:scale(1.06);filter:blur(0)}100%{opacity:1;transform:scale(1);filter:blur(0)}}
          @keyframes fadeUp{0%{opacity:0;transform:translateY(14px)}100%{opacity:1;transform:translateY(0)}}
          @keyframes glowPulse{0%,100%{box-shadow:0 0 20px rgba(59,130,246,0.5),0 4px 24px rgba(0,0,0,0.5)}50%{box-shadow:0 0 44px rgba(59,130,246,0.85),0 4px 24px rgba(0,0,0,0.5)}}
        `}</style>

        {/* Spline 3D — scaled down on mobile */}
        <div style={{ position:"absolute", inset:0, overflow:"hidden" }}>
          <style>{`
            @media (max-width: 640px) {
              .spline-frame {
                transform: scale(0.65);
                transform-origin: center center;
                width: 154% !important;
                height: 154% !important;
                top: -27% !important;
                left: -27% !important;
              }
            }
          `}</style>
          <iframe
            className="spline-frame"
            src="https://my.spline.design/zooxautonomousvehicle-swC2lsvHWZjCeAEOrYirbLPh/"
            frameBorder={0}
            style={{ position:"absolute", inset:0, width:"100%", height:"100%", border:"none" }}
          />
        </div>

        {/* TOP — Logo + name, free text no pill */}
        <div style={{
          position:"absolute",
          top:"clamp(16px,3vh,32px)",
          left:0, right:0,
          zIndex:2,
          display:"flex", justifyContent:"center",
          pointerEvents:"none",
          animation:"logoIn 1s cubic-bezier(0.16,1,0.3,1) 0.3s both",
        }}>
          <div style={{ display:"flex", alignItems:"center", gap:14 }}>
            <div style={{ width:"clamp(52px,7vw,72px)", height:"clamp(52px,7vw,72px)", borderRadius:"50%", background:"rgba(6,10,20,0.7)", border:"1.5px solid rgba(255,255,255,0.18)", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, backdropFilter:"blur(12px)" }}>
              <img src={logo} alt="ATX" style={{ width:"82%", height:"82%", objectFit:"contain" as const }} />
            </div>
            <div>
              <div style={{ fontSize:"clamp(20px,3.5vw,30px)", fontWeight:900, letterSpacing:"-0.5px", lineHeight:1, color:"#fff", textShadow:"0 2px 20px rgba(0,0,0,1), 0 0 30px rgba(59,130,246,0.4)", whiteSpace:"nowrap" as const }}>ATX Prestige Detailing</div>
              <div style={{ fontSize:"clamp(0.52rem,1.1vw,0.62rem)", letterSpacing:"0.22em", textTransform:"uppercase" as const, color:"rgba(255,255,255,0.55)", marginTop:4, textShadow:"0 1px 8px rgba(0,0,0,0.9)" }}>Defined by Detail · Driven by Standards</div>
            </div>
          </div>
        </div>

        {/* BOTTOM — Enter button only */}
        <div style={{
          position:"absolute",
          bottom:"clamp(16px,4vh,40px)",
          left:0, right:0,
          zIndex:2,
          display:"flex", justifyContent:"center",
          opacity: splashPhase >= 1 ? 1 : 0,
          transform: splashPhase >= 1 ? "translateY(0)" : "translateY(14px)",
          transition: "opacity 0.6s ease 0.2s, transform 0.6s ease 0.2s",
          pointerEvents: splashPhase >= 1 ? "auto" : "none" as const,
        }}>
          <button
            onClick={() => { setSplashPhase(2); setTimeout(() => setSplashDone(true), 800); }}
            style={{
              background: "linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)",
              color: "#fff", border: "none",
              borderRadius: 999,
              padding: "clamp(10px,2vh,14px) clamp(28px,6vw,48px)",
              fontSize: "clamp(0.88rem,2vw,1rem)",
              fontWeight: 700, cursor: "pointer",
              letterSpacing: "0.05em",
              animation: "glowPulse 2.5s ease-in-out infinite",
              fontFamily: '"Outfit", sans-serif',
              display:"flex", alignItems:"center", gap:8,
            }}
          >
            Get Started <span style={{ fontSize:"1.1em" }}>→</span>
          </button>
        </div>
      </div>
    );
  }


  if (view === "myBookings") {
    return (
      <div style={S.page}>

      {/* Animated background */}
      <div className="atx-bg">
        <div className="atx-grid" />
        <div className="atx-orb atx-orb-1" />
        <div className="atx-orb atx-orb-2" />
        <div className="atx-orb atx-orb-3" />
      </div>
        <div style={S.container}>
          <Header />
          <SquarePopup />
          <div style={S.card} key={step}>
            <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24, flexWrap: "wrap" as const }}>
              <button onClick={() => setView("booking")} style={{ ...S.secondary, padding: "9px 14px", fontSize: "0.9rem" }}>Back</button>
              <h2 style={{ ...S.title, margin: 0, fontSize: "1.8rem" }}>My Bookings</h2>
              <div style={{ display: "flex", gap: 8, marginLeft: "auto" }}>
                {googleUser?.email === ADMIN_EMAIL && (
                  <button onClick={() => { setView("admin"); loadAdminBookings(); }} style={{ ...S.secondary, padding: "10px 16px", fontSize: "0.9rem" }}>Admin</button>
                )}
                <button onClick={() => { setView("booking"); setStep(1); }} style={{ ...S.primary, padding: "10px 16px", fontSize: "0.9rem" }}>Book New Service</button>
              </div>
            </div>

            <div style={{ overflowX: "auto" as const, marginBottom: 24, borderBottom: "1.5px solid rgba(255,255,255,0.08)" }}>
              <div style={{ display: "flex", gap: 0, minWidth: "max-content" }}>
                <button onClick={() => setBookingsTab("appointments")} style={{ background: "none", border: "none", cursor: "pointer", padding: "10px 16px", fontSize: "0.9rem", fontWeight: 700, color: bookingsTab === "appointments" ? "#f1f5f9" : "rgba(255,255,255,0.35)", borderBottom: bookingsTab === "appointments" ? "3px solid #f1f5f9" : "3px solid transparent", marginBottom: -2, whiteSpace: "nowrap" as const }}>
                  My Appointments
                </button>
                {isMaintenance && (
                  <button onClick={() => setBookingsTab("maintenance")} style={{ background: "none", border: "none", cursor: "pointer", padding: "10px 16px", fontSize: "0.9rem", fontWeight: 700, color: bookingsTab === "maintenance" ? "#059669" : "#9ca3af", borderBottom: bookingsTab === "maintenance" ? "3px solid #059669" : "3px solid transparent", marginBottom: -2, whiteSpace: "nowrap" as const }}>
                    Maintenance Plan
                  </button>
                )}
                <button onClick={() => setBookingsTab("balance" as any)} style={{ background: "none", border: "none", cursor: "pointer", padding: "10px 16px", fontSize: "0.9rem", fontWeight: 700, color: (bookingsTab as string) === "balance" ? "#d97706" : "#9ca3af", borderBottom: (bookingsTab as string) === "balance" ? "3px solid #d97706" : "3px solid transparent", marginBottom: -2, whiteSpace: "nowrap" as const }}>
                  Balance
                </button>
              </div>
            </div>

            {bookingsLoading ? (
              <div style={{ textAlign: "center", padding: 40, color: "rgba(255,255,255,0.45)" }}>Loading your bookings...</div>
            ) : (
              <>
                {bookingsTab === "appointments" && (() => {
                  // All bookings — standard AND maintenance combined
                  const allUpcoming = [...upcomingStandard, ...upcomingMaintenance].sort((a, b) => a.date.localeCompare(b.date));
                  const allPast = [...pastStandard, ...pastMaintenance].sort((a, b) => b.date.localeCompare(a.date));
                  return (
                    <>
                      {allUpcoming.length === 0 && allPast.length === 0 && (
                        <div style={{ textAlign: "center", padding: 40, color: "rgba(255,255,255,0.45)" }}>
                          No bookings found for {googleUser?.email}.<br />
                          <button onClick={() => { setView("booking"); setStep(1); }} style={{ ...S.primary, marginTop: 16, display: "inline-block" }}>Book Your First Service</button>
                        </div>
                      )}
                      {allUpcoming.length > 0 && (
                        <>
                          <div style={{ fontWeight: 700, color: "rgba(255,255,255,0.7)", fontSize: "0.95rem", marginBottom: 12, textTransform: "uppercase" as const, letterSpacing: "0.04em" }}>Upcoming</div>
                          <div style={{ display: "grid", gap: 14, marginBottom: 28 }}>
                            {allUpcoming.map((b, i) => (
                              <BookingCard key={i} booking={b} upcoming onRequestChange={(b) => { setChangeTarget(b); setChangeNote(""); setChangeSubmitted(false); setView("requestChange"); }} />
                            ))}
                          </div>
                        </>
                      )}
                      {allPast.length > 0 && (
                        <>
                          <div style={{ fontWeight: 700, color: "rgba(255,255,255,0.35)", fontSize: "0.95rem", marginBottom: 12, textTransform: "uppercase" as const, letterSpacing: "0.04em" }}>Past Services</div>
                          <div style={{ display: "grid", gap: 14 }}>
                            {allPast.map((b, i) => <BookingCard key={i} booking={b} upcoming={false} onRequestChange={() => {}} />)}
                          </div>
                        </>
                      )}
                    </>
                  );
                })()}

                {bookingsTab === "maintenance" && isMaintenance && (() => {
                  const sixMonthsOut = new Date();
                  sixMonthsOut.setMonth(sixMonthsOut.getMonth() + 6);

                  // Use earliest upcoming booked row as reference, fall back to most recent
                  const allSorted = [...maintenanceBookings].sort((a, b) => a.date.localeCompare(b.date));
                  const ref = allSorted.find(b => isUpcoming(b.date)) || allSorted[allSorted.length - 1];
                  const freq = ref?.recurringFrequency || "";

                  // Map of booked upcoming dates for quick lookup
                  const bookedMap: Record<string, typeof upcomingMaintenance[0]> = {};
                  upcomingMaintenance.forEach(b => { bookedMap[b.date] = b; });

                  // Generate all dates from ref forward, filter to upcoming + within 6 months
                  const scheduleDates: { dateStr: string; label: string; booked: boolean; booking?: typeof upcomingMaintenance[0] }[] = [];

                  if (ref && freq && ref.date) {
                    const [ry, rm, rd] = ref.date.split("-").map(Number);
                    const refStart = new Date(ry, rm - 1, rd);
                    const today = new Date(); today.setHours(0,0,0,0);

                    const rawDates: string[] = [];
                    if (freq === "biweekly") {
                      let cur = new Date(refStart);
                      for (let i = 0; i < 30; i++) {
                        rawDates.push(fmtDate(cur));
                        cur.setDate(cur.getDate() + 14);
                      }
                    } else if (freq === "monthly") {
                      const dow = refStart.getDay();
                      const weekPos = Math.ceil(refStart.getDate() / 7);
                      const isLastW = new Date(ry, rm - 1, rd + 7).getMonth() !== refStart.getMonth();
                      let cm = rm - 1; let cy = ry;
                      for (let i = 0; i < 12; i++) {
                        const d = getNthWeekday(cy, cm, dow, weekPos, isLastW);
                        if (d) rawDates.push(fmtDate(d));
                        cm++; if (cm > 11) { cm = 0; cy++; }
                      }
                    }

                    rawDates.forEach(ds => {
                      const [y2, m2, d2] = ds.split("-").map(Number);
                      const dt = new Date(y2, m2 - 1, d2);
                      if (dt >= today && dt <= sixMonthsOut) {
                        scheduleDates.push({
                          dateStr: ds,
                          label: formatDateLabel(ds),
                          booked: !!bookedMap[ds],
                          booking: bookedMap[ds],
                        });
                      }
                    });
                  }

                  const scheduleLabel = freq === "biweekly" ? "Bi-Weekly" : freq === "monthly" ? "Monthly" : "Recurring";
                  const cadence = ref ? getCadenceLabel(ref.date, freq) : "";

                  return (
                    <>
                      <div style={{ background: "rgba(16,185,129,0.1)", border: "1px solid #6ee7b7", borderRadius: 14, padding: "14px 18px", marginBottom: 20 }}>
                        <div style={{ fontWeight: 700, color: "#34d399", marginBottom: 2 }}>Maintenance Plan — {scheduleLabel}</div>
                        {cadence && <div style={{ fontSize: "0.88rem", color: "#10b981" }}>{cadence}</div>}
                        <div style={{ color: "#10b981", fontSize: "0.88rem", marginTop: 4, lineHeight: 1.5 }}>
                          Your schedule below shows the next 6 months of services. Contact us through My Appointments to request any changes.
                        </div>
                      </div>

                      {scheduleDates.length === 0 && (
                        <div style={{ textAlign: "center", padding: 30, color: "rgba(255,255,255,0.45)", fontSize: "0.9rem" }}>No upcoming services scheduled.</div>
                      )}

                      <div style={{ display: "grid", gap: 10 }}>
                        {scheduleDates.map((sd, i) => {
                          const b = sd.booking;
                          const vl = b ? (b.vehicle === "boat"
                            ? [b.boatSize, b.make, b.model].filter(Boolean).join(" ")
                            : [b.year, b.make, b.model].filter(Boolean).join(" ")) : "";
                          return (
                            <div key={i} style={{ background: sd.booked ? "rgba(16,185,129,0.1)" : "rgba(255,255,255,0.03)", border: sd.booked ? "1.5px solid rgba(16,185,129,0.5)" : "1px solid rgba(255,255,255,0.07)", borderRadius: 14, padding: "14px 16px", display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap" as const, gap: 8 }}>
                              <div>
                                <div style={{ fontWeight: 700, color: "#f1f5f9", fontSize: "0.95rem" }}>
                                  {sd.label}{b?.time ? ` at ${b.time}` : ""}
                                </div>
                                {b && (
                                  <>
                                    <div style={{ fontSize: "0.85rem", color: "rgba(255,255,255,0.45)" }}>{vl && `${vl} · `}{b.packageType === "basic" ? "Basic Detail" : b.packageType === "premium" ? "Premium Detail" : b.packageType === "exterior" ? "Exterior Only — Basic" : b.packageType === "exteriorPremium" ? "Exterior Only — Premium" : b.packageType === "interior" ? "Interior Only — Basic" : b.packageType === "interiorPremium" ? "Interior Only — Premium" : b.packageType}</div>
                                    {b.serviceType === "mobile" && b.address && <div style={{ fontSize: "0.82rem", color: "rgba(255,255,255,0.35)" }}>{b.address}</div>}
                                  </>
                                )}
                              </div>
                              <span style={{ background: sd.booked ? "#ecfdf5" : "rgba(255,255,255,0.08)", color: sd.booked ? "#059669" : "#9ca3af", fontSize: "0.72rem", fontWeight: 700, borderRadius: 999, padding: "3px 9px", whiteSpace: "nowrap" as const }}>
                                {sd.booked ? "CONFIRMED" : "SCHEDULED"}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  );
                })()}
              </>
            )}

            {/* Balance tab */}
            {(bookingsTab as string) === "balance" && (
              <>
                {(() => {
                  const releasedInvoices = userBookings.filter(b => b.invoiceStatus === "released" || b.invoiceStatus === "paid");
                  const outstanding = releasedInvoices.filter(b => b.invoiceStatus === "released");
                  const paid = releasedInvoices.filter(b => b.invoiceStatus === "paid");
                  const totalOwed = outstanding.reduce((sum, b) => sum + parseFloat(b.invoiceAmount || "0"), 0);

                  return (
                    <>
                      {outstanding.length === 0 && paid.length === 0 && (
                        <div style={{ textAlign: "center", padding: 40, color: "rgba(255,255,255,0.45)" }}>No invoices on file yet.</div>
                      )}

                      {outstanding.length > 0 && (
                        <>
                          <div style={{ background: "rgba(251,191,36,0.12)", border: "1px solid #fde047", borderRadius: 14, padding: "16px 18px", marginBottom: 20, textAlign: "center" as const }}>
                            <div style={{ fontWeight: 700, color: "#713f12", fontSize: "1rem", marginBottom: 12 }}>Total Balance Due</div>
                            <div style={{ display: "flex", gap: 0, justifyContent: "center" }}>
                              <div style={{ flex: 1, textAlign: "center" as const, padding: "0 12px" }}>
                                <div style={{ fontSize: "0.75rem", color: "#fbbf24", marginBottom: 4 }}>Venmo / Cash App</div>
                                <div style={{ fontSize: "1.8rem", fontWeight: 900, color: "#fbbf24", letterSpacing: "-0.5px" }}>${totalOwed.toFixed(2)}</div>
                                <div style={{ fontSize: "0.7rem", color: "#f59e0b", marginTop: 2 }}>No fee</div>
                              </div>
                              <div style={{ width: 1, background: "#fde047", alignSelf: "stretch" }} />
                              <div style={{ flex: 1, textAlign: "center" as const, padding: "0 12px" }}>
                                <div style={{ fontSize: "0.75rem", color: "#fbbf24", marginBottom: 4 }}>Square / Card (+4%)</div>
                                <div style={{ fontSize: "1.8rem", fontWeight: 900, color: "#fbbf24", letterSpacing: "-0.5px" }}>${(totalOwed * 1.04).toFixed(2)}</div>
                                <div style={{ fontSize: "0.7rem", color: "#f59e0b", marginTop: 2 }}>Includes fee</div>
                              </div>
                            </div>
                          </div>

                          {outstanding.map((b, i) => {
                            const baseAmt = parseFloat(b.invoiceAmount || "0");
                            const squareAmt = (baseAmt * 1.04).toFixed(2);
                            return (
                            <div key={i} style={{ background: "rgba(255,255,255,0.05)", border: "1px solid #fde047", borderRadius: 16, padding: 18, marginBottom: 14 }}>
                              <div style={{ fontWeight: 700, color: "#f1f5f9", marginBottom: 4 }}>{formatDateLabel(b.date)} — {b.packageType === "basic" ? "Basic Detail" : b.packageType === "premium" ? "Premium Detail" : b.packageType === "exterior" ? "Exterior Only — Basic" : b.packageType === "exteriorPremium" ? "Exterior Only — Premium" : b.packageType === "interior" ? "Interior Only — Basic" : b.packageType === "interiorPremium" ? "Interior Only — Premium" : b.packageType}</div>
                              <div style={{ fontSize: "0.9rem", color: "rgba(255,255,255,0.45)", marginBottom: 10 }}>
                                {[b.year, b.make, b.model, b.boatSize].filter(Boolean).join(" ")}
                                {b.invoiceNote ? ` — ${b.invoiceNote}` : ""}
                              </div>
                              {/* Amount due box showing both prices + copy button */}
                              <div style={{ background: "rgba(251,191,36,0.12)", border: "1px solid #fde047", borderRadius: 12, padding: "14px 16px", marginBottom: 14 }}>
                                <div style={{ display: "flex", gap: 0, marginBottom: 12 }}>
                                  <div style={{ flex: 1, textAlign: "center" as const, padding: "0 8px" }}>
                                    <div style={{ fontSize: "0.72rem", color: "#fbbf24", marginBottom: 3 }}>Venmo / Cash App</div>
                                    <div style={{ fontSize: "1.5rem", fontWeight: 900, color: "#fbbf24", letterSpacing: "-0.5px" }}>${baseAmt.toFixed(2)}</div>
                                    <div style={{ fontSize: "0.68rem", color: "#f59e0b", marginTop: 2 }}>No fee</div>
                                  </div>
                                  <div style={{ width: 1, background: "#fde047", alignSelf: "stretch" }} />
                                  <div style={{ flex: 1, textAlign: "center" as const, padding: "0 8px" }}>
                                    <div style={{ fontSize: "0.72rem", color: "#fbbf24", marginBottom: 3 }}>Square (Card)</div>
                                    <div style={{ fontSize: "1.5rem", fontWeight: 900, color: "#fbbf24", letterSpacing: "-0.5px" }}>${squareAmt}</div>
                                    <div style={{ fontSize: "0.68rem", color: "#f59e0b", marginTop: 2 }}>+4% fee</div>
                                  </div>
                                </div>
                                {/* Copy amount button */}
                                <button
                                  onClick={() => {
                                    navigator.clipboard.writeText(baseAmt.toFixed(2));
                                    setCopiedAmount(baseAmt);
                                    setTimeout(() => setCopiedAmount(null), 2500);
                                  }}
                                  style={{
                                    width: "100%",
                                    background: copiedAmount === baseAmt ? "#059669" : "#111827",
                                    color: "#fff",
                                    border: "none",
                                    borderRadius: 10,
                                    padding: "11px 16px",
                                    fontSize: "0.9rem",
                                    fontWeight: 700,
                                    cursor: "pointer",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    gap: 8,
                                    transition: "background 0.2s ease",
                                  }}
                                >
                                  {copiedAmount === baseAmt ? (
                                    <><span style={{ fontSize: "1rem" }}>✓</span> Copied ${baseAmt.toFixed(2)} to clipboard</>
                                  ) : (
                                    <><span style={{ fontSize: "1rem" }}>⎘</span> Copy Amount — ${baseAmt.toFixed(2)}</>
                                  )}
                                </button>
                                {copiedAmount === baseAmt && (
                                  <div style={{ fontSize: "0.78rem", color: "#059669", textAlign: "center" as const, marginTop: 6 }}>
                                    Now open Venmo or Cash App and paste into the amount field
                                  </div>
                                )}
                              </div>

                              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                                <div>
                                  <a href={VENMO_URL} target="_blank" rel="noopener noreferrer" style={{ display: "block", background: "#008CFF", color: "#fff", borderRadius: 10, padding: "8px 6px", textAlign: "center", textDecoration: "none", fontWeight: 700, fontSize: "0.82rem" }}>Venmo</a>
                                  <div style={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.45)", textAlign: "center" as const, marginTop: 3 }}>${baseAmt.toFixed(2)}</div>
                                </div>
                                <div>
                                  <a href={CASHAPP_URL} target="_blank" rel="noopener noreferrer" style={{ display: "block", background: "#00C244", color: "#fff", borderRadius: 10, padding: "8px 6px", textAlign: "center", textDecoration: "none", fontWeight: 700, fontSize: "0.82rem" }}>Cash App</a>
                                  <div style={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.45)", textAlign: "center" as const, marginTop: 3 }}>${baseAmt.toFixed(2)}</div>
                                </div>
                                <div>
                                  <button onClick={() => handleSquareRequest(b)} style={{ display: "block", width: "100%", background: "#111827", color: "#fff", border: "none", borderRadius: 10, padding: "8px 6px", fontWeight: 700, fontSize: "0.82rem", cursor: "pointer" }}>Card (Square)</button>
                                  <div style={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.45)", textAlign: "center" as const, marginTop: 3 }}>${squareAmt}</div>
                                </div>
                              </div>
                            </div>
                            );
                          })}
                        </>
                      )}

                      {paid.length > 0 && (
                        <>
                          <div style={{ fontWeight: 700, color: "rgba(255,255,255,0.35)", fontSize: "0.85rem", textTransform: "uppercase" as const, letterSpacing: "0.04em", marginTop: 16, marginBottom: 10 }}>Paid</div>
                          {paid.map((b, i) => (
                            <div key={i} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: 14, marginBottom: 10 }}>
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <div>
                                  <div style={{ fontWeight: 600, color: "rgba(255,255,255,0.7)", fontSize: "0.9rem" }}>{formatDateLabel(b.date)}</div>
                                  <div style={{ fontSize: "0.85rem", color: "rgba(255,255,255,0.35)" }}>{b.packageType === "basic" ? "Basic Detail" : b.packageType === "premium" ? "Premium Detail" : b.packageType === "exterior" ? "Exterior Only — Basic" : b.packageType === "exteriorPremium" ? "Exterior Only — Premium" : b.packageType === "interior" ? "Interior Only — Basic" : b.packageType === "interiorPremium" ? "Interior Only — Premium" : b.packageType}</div>
                                </div>
                                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                  <span style={{ fontWeight: 700, color: "rgba(255,255,255,0.7)" }}>${b.invoiceAmount}</span>
                                  <span style={{ background: "rgba(16,185,129,0.15)", color: "#34d399", fontSize: "0.72rem", fontWeight: 700, borderRadius: 999, padding: "2px 8px" }}>PAID</span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </>
                      )}
                    </>
                  );
                })()}
              </>
            )}

          </div>
        </div>
      </div>
    );
  }

  // ADMIN VIEW
  if (view === "admin" && googleUser?.email === ADMIN_EMAIL) {
    const filtered = adminBookings.filter(b => {
      if (adminFilter === "upcoming") return isUpcoming(b.date) && b.status !== "Completed" && b.status !== "Cancelled" && b.status !== "Skipped";
      if (adminFilter === "past") return !isUpcoming(b.date) || b.status === "Completed" || b.status === "Cancelled" || b.status === "Skipped";
      if (adminFilter === "maintenance") return b.clientType === "maintenance";
      return true;
    }).sort((a, b) => {
      // "All" tab: completed/cancelled first (newest → oldest), then upcoming (soonest first)
      if (adminFilter === "all") {
        const aDone = a.status === "Completed" || a.status === "Cancelled" || a.status === "Skipped";
        const bDone = b.status === "Completed" || b.status === "Cancelled" || b.status === "Skipped";
        if (aDone && !bDone) return -1;
        if (!aDone && bDone) return 1;
        if (aDone && bDone) return b.date.localeCompare(a.date);
        return a.date.localeCompare(b.date);
      }
      // "Upcoming" tab: soonest first
      if (adminFilter === "upcoming") return a.date.localeCompare(b.date);
      // "Past" tab: most recent first
      if (adminFilter === "past") return b.date.localeCompare(a.date);
      // "Maintenance" tab: upcoming first, then by date
      const aUp = isUpcoming(a.date) && a.status !== "Completed" && a.status !== "Cancelled" && a.status !== "Skipped";
      const bUp = isUpcoming(b.date) && b.status !== "Completed" && b.status !== "Cancelled" && b.status !== "Skipped";
      if (aUp && !bUp) return -1;
      if (!aUp && bUp) return 1;
      return aUp ? a.date.localeCompare(b.date) : b.date.localeCompare(a.date);
    });

    const pendingInvoices = adminBookings.filter(b => b.invoiceStatus === "pending");
    const releasedInvoices = adminBookings.filter(b => b.invoiceStatus === "released");
    const paidInvoices = adminBookings.filter(b => b.invoiceStatus === "paid");

    return (
      <div style={S.page}>

      {/* Animated background */}
      <div className="atx-bg">
        <div className="atx-grid" />
        <div className="atx-orb atx-orb-1" />
        <div className="atx-orb atx-orb-2" />
        <div className="atx-orb atx-orb-3" />
      </div>
        {/* Toast container */}
        <div style={{ position: "fixed" as const, bottom: 24, right: 24, zIndex: 9999, display: "flex", flexDirection: "column" as const, gap: 10, alignItems: "flex-end" }}>
          {toasts.map(t => (
            <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 10, background: t.type === "error" ? "rgba(239,68,68,0.12)" : t.type === "success" ? "#f0fdf4" : "#1e293b", color: t.type === "error" ? "#dc2626" : t.type === "success" ? "#065f46" : "#fff", border: t.type === "error" ? "1.5px solid #fca5a5" : t.type === "success" ? "1.5px solid #6ee7b7" : "none", borderRadius: 14, padding: "12px 18px", fontSize: "0.88rem", fontWeight: 600, boxShadow: "0 4px 20px rgba(0,0,0,0.18)", animation: "toastIn 0.25s ease", maxWidth: 320, cursor: "pointer" }} onClick={() => dismissToast(t.id)}>
              {t.type === "loading" && <div style={{ width: 16, height: 16, border: "2.5px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.7s linear infinite", flexShrink: 0 }} />}
              {t.type === "success" && <span style={{ fontSize: "1rem" }}>✓</span>}
              {t.type === "error" && <span style={{ fontSize: "1rem" }}>✕</span>}
              <span>{t.message}</span>
            </div>
          ))}
        </div>
        <div style={S.container}>
          <Header />
          <SquarePopup />
          <div style={S.card} key={step}>
            <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24, flexWrap: "wrap" as const }}>
              <button onClick={() => setView("myBookings")} style={{ ...S.secondary, padding: "9px 14px", fontSize: "0.9rem" }}>Back</button>
              <h2 style={{ ...S.title, margin: 0, fontSize: "1.8rem" }}>Admin</h2>
              <button onClick={loadAdminBookings} style={{ ...S.secondary, marginLeft: "auto", padding: "9px 14px", fontSize: "0.9rem" }}>Refresh</button>
            </div>

            {/* Admin tabs */}
            <div style={{ display: "flex", gap: 0, marginBottom: 24, borderBottom: "1.5px solid rgba(255,255,255,0.08)", overflowX: "auto" as const, WebkitOverflowScrolling: "touch" as any, scrollbarWidth: "none" as any }}>
              <button onClick={() => setAdminTab("bookings")} style={{ background: "none", border: "none", cursor: "pointer", padding: "10px 18px", fontSize: "0.95rem", fontWeight: 700, color: adminTab === "bookings" ? "#f1f5f9" : "rgba(255,255,255,0.35)", borderBottom: adminTab === "bookings" ? "3px solid #f1f5f9" : "3px solid transparent", marginBottom: -2 }}>All Bookings</button>
              <button onClick={() => setAdminTab("invoices")} style={{ background: "none", border: "none", cursor: "pointer", padding: "10px 18px", fontSize: "0.95rem", fontWeight: 700, color: adminTab === "invoices" ? "#d97706" : "#9ca3af", borderBottom: adminTab === "invoices" ? "3px solid #d97706" : "3px solid transparent", marginBottom: -2 }}>
                Invoices {pendingInvoices.length > 0 && <span style={{ background: "#ef4444", color: "#fff", borderRadius: 999, padding: "1px 6px", fontSize: "0.72rem", marginLeft: 4 }}>{pendingInvoices.length}</span>}
              </button>
              <button onClick={() => { setAdminTab("revenue"); }} style={{ background: "none", border: "none", cursor: "pointer", padding: "10px 18px", fontSize: "0.95rem", fontWeight: 700, color: adminTab === "revenue" ? "#059669" : "#9ca3af", borderBottom: adminTab === "revenue" ? "3px solid #059669" : "3px solid transparent", marginBottom: -2 }}>Revenue</button>
              <button onClick={() => { setAdminTab("availability"); if (availSlots.length === 0) { setAvailLoading(true); fetch(`${SCRIPT_URL}?action=getAllAvailability`).then(r => r.json()).then(d => { setAvailSlots(d.slots || []); setAvailLoading(false); }).catch(() => setAvailLoading(false)); } }} style={{ background: "none", border: "none", cursor: "pointer", padding: "10px 18px", fontSize: "0.95rem", fontWeight: 700, color: adminTab === "availability" ? "#2563eb" : "#9ca3af", borderBottom: adminTab === "availability" ? "3px solid #2563eb" : "3px solid transparent", marginBottom: -2 }}>Availability</button>
            </div>

            {adminLoading ? (
              <div style={{ textAlign: "center", padding: 40, color: "rgba(255,255,255,0.45)" }}>Loading...</div>
            ) : (
              <>
                {/* All Bookings tab */}
                {adminTab === "bookings" && (
                  <>
                    {/* Filter bar + Quick Book button */}
                    <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" as const, alignItems: "center" }}>
                      {(["all", "upcoming", "past", "maintenance"] as const).map(f => (
                        <button key={f} onClick={() => setAdminFilter(f)} style={{ background: adminFilter === f ? "#111827" : "rgba(255,255,255,0.08)", color: adminFilter === f ? "#fff" : "#374151", border: "none", borderRadius: 999, padding: "6px 14px", fontSize: "0.85rem", fontWeight: 600, cursor: "pointer", textTransform: "capitalize" as const }}>
                          {f === "all" ? "All" : f === "upcoming" ? "Upcoming" : f === "past" ? "Past" : "Maintenance"}
                        </button>
                      ))}
                      <button
                        onClick={() => { setQuickBookOpen(true); setQuickBookClient(null); setQuickBookSearch(""); }}
                        style={{ ...S.primary, marginLeft: "auto", padding: "7px 16px", fontSize: "0.85rem", background: "linear-gradient(135deg, #7c3aed, #5b21b6)" }}
                      >
                        + Book Existing Client
                      </button>
                    </div>

                    {/* Quick Book Modal */}
                    {quickBookOpen ? (() => {
                      // Get unique client+vehicle combinations so multi-vehicle clients show all their vehicles
                      const clientMap: Record<string, Booking> = {};
                      adminBookings.forEach(b => {
                        if (!b.name) return;
                        const vehicleKey = b.vehicle === "boat"
                          ? [b.boatSize, b.make, b.model].filter(Boolean).join(" ")
                          : [b.year, b.make, b.model].filter(Boolean).join(" ");
                        const key = `${b.email || b.name}__${vehicleKey}`;
                        if (!clientMap[key]) clientMap[key] = b;
                      });
                      const clients = Object.values(clientMap).sort((a, b) => a.name.localeCompare(b.name));
                      const filtered = quickBookSearch
                        ? clients.filter(c => c.name.toLowerCase().includes(quickBookSearch.toLowerCase()) || c.email.toLowerCase().includes(quickBookSearch.toLowerCase()))
                        : clients;

                      return (
                        <div style={{ background: "rgba(124,58,237,0.08)", border: "1.5px solid rgba(124,58,237,0.4)", borderRadius: 16, padding: 20, marginBottom: 20 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                            <div style={{ fontWeight: 700, color: "#a78bfa", fontSize: "0.95rem" }}>Book Existing Client</div>
                            <button onClick={() => { setQuickBookOpen(false); setQuickBookSearch(""); setQuickBookClient(null); setQCustomService(""); setQCustomPrice(""); }} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.4)", cursor: "pointer", fontSize: "1.1rem" }}>✕</button>
                          </div>

                          {!quickBookClient ? (
                            <>
                              <input
                                style={{ ...S.input, marginBottom: 12 }}
                                placeholder="Search by name or email..."
                                value={quickBookSearch}
                                onChange={e => setQuickBookSearch(e.target.value)}
                                autoFocus
                              />
                              <div style={{ display: "grid", gap: 8, maxHeight: 280, overflowY: "auto" as const }}>
                                {filtered.map((c, i) => {
                                  const vl = c.vehicle === "boat"
                                    ? [c.boatSize, c.make, c.model].filter(Boolean).join(" ")
                                    : [c.year, c.make, c.model].filter(Boolean).join(" ");
                                  return (
                                    <button key={i} onClick={() => {
                                      setQuickBookClient(c);
                                      setQPkg(c.packageType || "basic");
                                      setQClientType(c.clientType || "oneTime");
                                      setQFreq(c.recurringFrequency || "");
                                      setQAddOnList([]);
                                      setQAddress(c.address || "");
                                      setQServiceType(c.serviceType || "mobile");
                                      setQDate(""); setQTime(""); setQNotes("");
                                    }}
                                      style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 12, padding: "12px 14px", cursor: "pointer", textAlign: "left" as const, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                                      <div>
                                        <div style={{ fontWeight: 700, color: "#f1f5f9", fontSize: "0.9rem" }}>{c.name}</div>
                                        <div style={{ fontSize: "0.78rem", color: "rgba(255,255,255,0.45)" }}>{c.email} · {c.phone}</div>
                                        {vl && <div style={{ fontSize: "0.78rem", color: "rgba(255,255,255,0.35)" }}>{vl}</div>}
                                      </div>
                                      <span style={{ color: "#a78bfa", fontSize: "0.8rem", fontWeight: 600, whiteSpace: "nowrap" as const }}>Select →</span>
                                    </button>
                                  );
                                })}
                                {filtered.length === 0 && <div style={{ color: "rgba(255,255,255,0.35)", fontSize: "0.88rem", padding: 8 }}>No clients found.</div>}
                              </div>
                            </>
                          ) : (
                            /* Client selected — show pre-filled booking form */
                            (() => {
                              const c = quickBookClient;
                              const vl = c.vehicle === "boat"
                                ? [c.boatSize, c.make, c.model].filter(Boolean).join(" ")
                                : [c.year, c.make, c.model].filter(Boolean).join(" ");
                              return (
                                <div>
                                  {/* Client summary */}
                                  <div style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 12, padding: "12px 14px", marginBottom: 14, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                    <div>
                                      <div style={{ fontWeight: 700, color: "#f1f5f9" }}>{c.name}</div>
                                      <div style={{ fontSize: "0.82rem", color: "rgba(255,255,255,0.45)" }}>{c.email} · {c.phone}</div>
                                      {vl && <div style={{ fontSize: "0.78rem", color: "rgba(255,255,255,0.35)" }}>{vl}</div>}
                                    </div>
                                    <button onClick={() => setQuickBookClient(null)} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.4)", cursor: "pointer", fontSize: "0.82rem" }}>Change</button>
                                  </div>

                                  <div style={{ fontSize: "0.78rem", color: "rgba(255,255,255,0.45)", marginBottom: 14 }}>
                                    Client info pre-filled. Pick a date, time, and service details.
                                  </div>

                                  {/* Calendar */}
                                  <div style={{ background: "rgba(0,0,0,0.3)", borderRadius: 16, padding: "18px 14px", marginBottom: 14 }}>
                                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                                      <button onClick={() => { const d = new Date(qCalYear, qCalMonth - 1, 1); setQCalMonth(d.getMonth()); setQCalYear(d.getFullYear()); }} style={{ background: "rgba(255,255,255,0.08)", border: "none", borderRadius: 8, width: 32, height: 32, cursor: "pointer", color: "#fff", fontSize: "1rem" }}>‹</button>
                                      <span style={{ fontWeight: 700, color: "#fff", fontSize: "0.9rem" }}>{new Date(qCalYear, qCalMonth).toLocaleDateString("en-US", { month: "long", year: "numeric" })}</span>
                                      <button onClick={() => { const d = new Date(qCalYear, qCalMonth + 1, 1); setQCalMonth(d.getMonth()); setQCalYear(d.getFullYear()); }} style={{ background: "rgba(255,255,255,0.08)", border: "none", borderRadius: 8, width: 32, height: 32, cursor: "pointer", color: "#fff", fontSize: "1rem" }}>›</button>
                                    </div>
                                    <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2, marginBottom: 6 }}>
                                      {["S","M","T","W","T","F","S"].map((d, i) => <div key={i} style={{ textAlign: "center" as const, fontSize: "0.68rem", color: "rgba(255,255,255,0.35)", fontWeight: 700, padding: "2px 0" }}>{d}</div>)}
                                    </div>
                                    <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 3 }}>
                                      {(() => {
                                        const firstDay = new Date(qCalYear, qCalMonth, 1).getDay();
                                        const daysInMonth = new Date(qCalYear, qCalMonth + 1, 0).getDate();
                                        const today2 = new Date(); today2.setHours(0,0,0,0);
                                        const cells = [];
                                        for (let i = 0; i < firstDay; i++) cells.push(<div key={`e${i}`} />);
                                        for (let d = 1; d <= daysInMonth; d++) {
                                          const ds = `${qCalYear}-${String(qCalMonth + 1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
                                          const isAvail = availableDates.includes(ds);
                                          const isPast = new Date(qCalYear, qCalMonth, d) < today2;
                                          const isSel = qDate === ds;
                                          cells.push(
                                            <button key={d} disabled={!isAvail || isPast}
                                              onClick={() => { setQDate(ds); setQTime(""); }}
                                              style={{ height: 34, borderRadius: 8, border: "none", background: isSel ? "#fff" : isAvail && !isPast ? "rgba(255,255,255,0.1)" : "transparent", color: isSel ? "#111" : isAvail && !isPast ? "#fff" : "rgba(255,255,255,0.18)", fontSize: "0.82rem", fontWeight: isSel ? 800 : 500, cursor: isAvail && !isPast ? "pointer" : "default" }}>{d}</button>
                                          );
                                        }
                                        return cells;
                                      })()}
                                    </div>
                                  </div>

                                  {/* Time slots */}
                                  {qDate && (() => {
                                    const slots = allAvailableSlots.filter(s => s.date === qDate);
                                    return (
                                      <div style={{ marginBottom: 14 }}>
                                        <div style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.45)", marginBottom: 8, textTransform: "uppercase" as const, letterSpacing: "0.06em" }}>Available Times — {formatDateLabel(qDate)}</div>
                                        {slots.length === 0
                                          ? <div style={{ color: "#f87171", fontSize: "0.85rem" }}>No available times for this date.</div>
                                          : <div style={{ display: "flex", gap: 8, flexWrap: "wrap" as const }}>
                                              {slots.map((s, i) => (
                                                <button key={i} onClick={() => setQTime(s.time)}
                                                  style={{ padding: "9px 14px", borderRadius: 10, border: qTime === s.time ? "2px solid #fff" : "1px solid rgba(255,255,255,0.15)", background: qTime === s.time ? "#fff" : "rgba(255,255,255,0.07)", color: qTime === s.time ? "#111" : "#fff", fontSize: "0.88rem", fontWeight: 700, cursor: "pointer" }}>
                                                  {s.time}
                                                </button>
                                              ))}
                                            </div>
                                        }
                                      </div>
                                    );
                                  })()}

                                  {/* Service fields */}
                                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                                    <div style={{ gridColumn: "1 / -1" }}>
                                      <div style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.45)", marginBottom: 4 }}>Service Type</div>
                                      <select style={{ ...S.input, padding: "9px 12px", backgroundColor: "transparent" }} value={qPkg} onChange={e => { setQPkg(e.target.value); setQCustomService(""); setQCustomPrice(""); }}>
                                        <option value="basic">Basic Detail</option>
                                        <option value="premium">Premium Detail</option>
                                        <option value="exterior">Exterior Only — Basic</option>
                                        <option value="exteriorPremium">Exterior Only — Premium</option>
                                        <option value="interior">Interior Only — Basic</option>
                                        <option value="interiorPremium">Interior Only — Premium</option>
                                        <option value="custom">⚡ Custom Job</option>
                                      </select>
                                    </div>

                                    {/* Custom job fields */}
                                    {qPkg === "custom" && (
                                      <>
                                        <div style={{ gridColumn: "1 / -1" }}>
                                          <div style={{ fontSize: "0.75rem", color: "#a78bfa", marginBottom: 4, fontWeight: 700 }}>Service Name *</div>
                                          <input
                                            style={{ ...S.input, padding: "9px 12px", border: "1.5px solid rgba(124,58,237,0.5)" }}
                                            placeholder="e.g. PPF Removal, Engine Bay Clean, Odor Treatment"
                                            value={qCustomService}
                                            onChange={e => setQCustomService(e.target.value)}
                                          />
                                        </div>
                                        <div style={{ gridColumn: "1 / -1" }}>
                                          <div style={{ fontSize: "0.75rem", color: "#a78bfa", marginBottom: 4, fontWeight: 700 }}>Flat Price ($) *</div>
                                          <input
                                            style={{ ...S.input, padding: "9px 12px", border: "1.5px solid rgba(124,58,237,0.5)", fontWeight: 700, fontSize: "1rem" }}
                                            type="number"
                                            inputMode="decimal"
                                            step="0.01"
                                            placeholder="e.g. 350"
                                            value={qCustomPrice}
                                            onChange={e => setQCustomPrice(e.target.value)}
                                          />
                                          {qCustomPrice && (
                                            <div style={{ marginTop: 6, fontSize: "0.82rem", color: "#a78bfa", fontWeight: 600 }}>
                                              Flat rate: ${parseFloat(qCustomPrice).toFixed(2)} — invoice will be set automatically
                                            </div>
                                          )}
                                        </div>
                                      </>
                                    )}

                                    <div>
                                      <div style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.45)", marginBottom: 4 }}>Location</div>
                                      <select style={{ ...S.input, padding: "9px 12px", backgroundColor: "transparent" }} value={qServiceType} onChange={e => setQServiceType(e.target.value)}>
                                        <option value="mobile">Mobile</option>
                                        <option value="dropoff">Drop-Off</option>
                                      </select>
                                    </div>
                                    <div>
                                      <div style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.45)", marginBottom: 4 }}>Client Type</div>
                                      <select style={{ ...S.input, padding: "9px 12px", backgroundColor: "transparent" }} value={qClientType} onChange={e => setQClientType(e.target.value)}>
                                        <option value="oneTime">One-Time</option>
                                        <option value="maintenance">Maintenance</option>
                                      </select>
                                    </div>
                                    {qClientType === "maintenance" && (
                                      <div>
                                        <div style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.45)", marginBottom: 4 }}>Frequency</div>
                                        <select style={{ ...S.input, padding: "9px 12px", backgroundColor: "transparent" }} value={qFreq} onChange={e => setQFreq(e.target.value)}>
                                          <option value="">Select</option>
                                          <option value="biweekly">Bi-Weekly</option>
                                          <option value="monthly">Monthly</option>
                                        </select>
                                      </div>
                                    )}
                                  </div>

                                  {/* Address with autocomplete */}
                                  {qServiceType === "mobile" && (
                                    <div style={{ marginBottom: 10 }}>
                                      <div style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.45)", marginBottom: 4 }}>Service Address</div>
                                      <input
                                        ref={qAddressRef}
                                        style={{ ...S.input, padding: "9px 12px" }}
                                        placeholder="Start typing address..."
                                        value={qAddress}
                                        onChange={e => setQAddress(e.target.value)}
                                      />
                                    </div>
                                  )}

                                  {/* Add-ons — hidden for custom jobs */}
                                  {qPkg !== "custom" && (
                                  <div style={{ marginBottom: 10 }}>
                                    <div style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.45)", marginBottom: 8, textTransform: "uppercase" as const, letterSpacing: "0.06em" }}>Add-On Services</div>
                                    <div style={{ display: "grid", gap: 6 }}>
                                      {(c.vehicle === "boat" ? marineAddOnOptions : addOnOptions).map(opt => {
                                        const checked = qAddOnList.includes(opt.label as AddOn);
                                        return (
                                          <label key={opt.label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: checked ? "rgba(59,130,246,0.1)" : "rgba(255,255,255,0.04)", border: `1px solid ${checked ? "rgba(59,130,246,0.4)" : "rgba(255,255,255,0.08)"}`, borderRadius: 10, padding: "9px 12px", cursor: "pointer" }}>
                                            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                              <input type="checkbox" checked={checked} style={{ accentColor: "#3b82f6", width: 15, height: 15 }}
                                                onChange={() => setQAddOnList(prev => checked ? prev.filter(a => a !== opt.label) : [...prev, opt.label as AddOn])} />
                                              <span style={{ fontSize: "0.85rem", color: "#f1f5f9" }}>{opt.label}</span>
                                            </div>
                                            <span style={{ fontSize: "0.82rem", color: "#93c5fd", fontWeight: 700 }}>{opt.priceText}</span>
                                          </label>
                                        );
                                      })}
                                    </div>
                                    {qAddOnList.length > 0 && (() => {
                                      const all = [...addOnOptions, ...marineAddOnOptions];
                                      const total = qAddOnList.reduce((s, a) => s + (all.find(o => o.label === a)?.fixedPrice ?? 0), 0);
                                      return total > 0 ? (
                                        <div style={{ marginTop: 8, fontSize: "0.82rem", color: "#34d399", fontWeight: 600 }}>
                                          Add-on estimate: ${total} (consultation items priced separately)
                                        </div>
                                      ) : null;
                                    })()}
                                  </div>
                                  )}

                                  {/* Notes */}
                                  <div style={{ marginBottom: 14 }}>
                                    <div style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.45)", marginBottom: 4 }}>Notes (optional)</div>
                                    <input style={{ ...S.input, padding: "9px 12px" }} placeholder="Any special instructions" value={qNotes} onChange={e => setQNotes(e.target.value)} />
                                  </div>

                                  {/* Submit */}
                                  <button
                                    disabled={!qDate || !qTime || qSubmitting || (qPkg === "custom" && (!qCustomService.trim() || !qCustomPrice))}
                                    onClick={async () => {
                                      setQSubmitting(true);
                                      const tid = showToast("Creating booking...", "loading");
                                      try {
                                        const isCustom = qPkg === "custom";
                                        const vOpts = vehicleOptions.find(v => v.id === c.vehicle);
                                        const isPremium = qPkg === "premium" || qPkg === "exteriorPremium" || qPkg === "interiorPremium";
                                        const rate = isCustom ? 0 : (vOpts ? (isPremium ? vOpts.premiumRate : vOpts.basicRate) : parseFloat(c.hourlyRate || "80"));
                                        const all2 = [...addOnOptions, ...marineAddOnOptions];
                                        const addOnEst = qAddOnList.reduce((s, a) => s + (all2.find(o => o.label === a)?.fixedPrice ?? 0), 0);
                                        const res = await fetch(SCRIPT_URL, {
                                          method: "POST",
                                          body: JSON.stringify({
                                            action: "bookAppointment",
                                            name: c.name, phone: c.phone, email: c.email,
                                            date: qDate, displayDate: qDate, time: qTime,
                                            year: c.year, make: c.make, model: c.model,
                                            boatSize: c.boatSize, vehicle: c.vehicle,
                                            packageType: isCustom ? "custom" : qPkg,
                                            hourlyRate: rate,
                                            addOns: isCustom ? qCustomService : qAddOnList.join(", "),
                                            addOnEstimate: isCustom ? parseFloat(qCustomPrice) : addOnEst,
                                            serviceType: qServiceType, address: qAddress,
                                            street: "", city: "", state: "", zip: "",
                                            placeId: "", lat: "", lng: "",
                                            avgTime: "", notes: isCustom ? `Custom job: ${qCustomService} — $${qCustomPrice}${qNotes ? ". " + qNotes : ""}` : qNotes,
                                            clientType: qClientType,
                                            recurringFrequency: qFreq,
                                          }),
                                        });
                                        const d = await res.json();
                                        if (d.success) {
                                          updateToast(tid, `✓ ${isCustom ? "Custom job" : "Booking"} created for ${c.name}`, "success", 4000);
                                          setQuickBookOpen(false); setQuickBookClient(null); setQuickBookSearch("");
                                          setQDate(""); setQTime(""); setQNotes(""); setQAddOnList([]);
                                          setQCustomService(""); setQCustomPrice("");
                                          await loadAdminBookings();
                                        } else {
                                          updateToast(tid, "Failed: " + (d.error || "unknown error"), "error", 4000);
                                        }
                                      } catch (e) {
                                        updateToast(tid, "Network error — please try again", "error", 4000);
                                      }
                                      setQSubmitting(false);
                                    }}
                                    style={{ width: "100%", background: qPkg === "custom" ? "linear-gradient(135deg, #7c3aed, #5b21b6)" : "linear-gradient(135deg, #7c3aed, #5b21b6)", color: "#fff", border: "none", borderRadius: 10, padding: "13px", fontWeight: 700, fontSize: "0.95rem", cursor: "pointer", opacity: !qDate || !qTime || (qPkg === "custom" && (!qCustomService.trim() || !qCustomPrice)) ? 0.5 : 1 }}>
                                    {qSubmitting ? "Creating..." : qPkg === "custom" ? `Book Custom Job for ${c.name}` : `Submit Booking for ${c.name}`}
                                  </button>
                                </div>
                              );
                            })()
                          )}
                        </div>
                      );
                    })() : null}
                    {/* Maintenance schedule summary — all upcoming grouped by client */}
                    {adminFilter === "maintenance" && (() => {
                      const futureMain = adminBookings.filter(b => b.clientType === "maintenance" && isUpcoming(b.date) && b.status !== "Completed" && b.status !== "Cancelled" && b.status !== "Skipped");
                      const grouped: Record<string, Booking[]> = {};
                      futureMain.forEach(b => {
                        if (!grouped[b.email]) grouped[b.email] = [];
                        grouped[b.email].push(b);
                      });
                      return Object.keys(grouped).length > 0 ? (
                        <div style={{ marginBottom: 20 }}>
                          <div style={{ fontWeight: 700, color: "rgba(255,255,255,0.7)", fontSize: "0.85rem", textTransform: "uppercase" as const, letterSpacing: "0.04em", marginBottom: 10 }}>Maintenance Schedule Overview</div>
                          {Object.entries(grouped).map(([email, bookings]) => {
                            const sorted = [...bookings].sort((a, b) => a.date.localeCompare(b.date));
                            return (
                              <div key={email} style={{ background: "rgba(16,185,129,0.1)", border: "1px solid #6ee7b7", borderRadius: 12, padding: "14px 16px", marginBottom: 10 }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap" as const, gap: 4, marginBottom: 8 }}>
                                  <div>
                                    <div style={{ fontWeight: 700, color: "#34d399", fontSize: "0.95rem" }}>{sorted[0].name}</div>
                                    <div style={{ fontSize: "0.82rem", color: "#10b981" }}>{email}</div>
                                  </div>
                                  <span style={{ background: "rgba(255,255,255,0.05)", border: "1px solid #6ee7b7", borderRadius: 999, padding: "2px 10px", fontSize: "0.78rem", fontWeight: 700, color: "#059669" }}>
                                    {sorted[0].recurringFrequency === "biweekly" ? "Bi-Weekly" : "Monthly"}
                                  </span>
                                </div>
                                <div style={{ display: "grid", gap: 6 }}>
                                  {sorted.map((b, i) => (
                                    <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "rgba(255,255,255,0.05)", borderRadius: 8, padding: "7px 12px", fontSize: "0.85rem" }}>
                                      <span style={{ color: "#34d399", fontWeight: 600 }}>{i === 0 ? "Next: " : (i + 1) + ". "}{formatDateLabel(b.date)}{b.time ? ` at ${b.time}` : ""}</span>
                                      <span style={{ color: "rgba(255,255,255,0.45)", fontSize: "0.78rem" }}>{b.packageType === "basic" ? "Basic" : "Premium"}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : null;
                    })()}

                    {filtered.length === 0 && <div style={{ textAlign: "center", padding: 40, color: "rgba(255,255,255,0.45)" }}>No bookings found.</div>}

                    <div style={{ display: "grid", gap: 12 }}>
                      {filtered.map((b, i) => {
                        const vl = b.vehicle === "boat" ? [b.boatSize, b.make, b.model].filter(Boolean).join(" ") : [b.year, b.make, b.model].filter(Boolean).join(" ");
                        const isComplete = b.status === "Completed";
                        const isSelected = selectedAdminBooking?.rowIndex === b.rowIndex;

                        return (
                          <div key={i} className="booking-card" style={{ background: b.status === "Cancelled" ? "rgba(239,68,68,0.08)" : b.status === "Skipped" ? "rgba(59,130,246,0.08)" : "rgba(255,255,255,0.04)", border: `1px solid ${b.status === "Cancelled" ? "rgba(239,68,68,0.35)" : b.status === "Skipped" ? "rgba(59,130,246,0.35)" : isComplete ? "rgba(255,255,255,0.07)" : isUpcoming(b.date) ? "rgba(59,130,246,0.45)" : "rgba(255,255,255,0.07)"}`, borderRadius: 16, padding: 16, opacity: b.status === "Cancelled" || b.status === "Skipped" ? 0.85 : 1 }}>
                            {b.status === "Cancelled" && (
                              <div style={{ background: "rgba(239,68,68,0.25)", border: "1px solid rgba(239,68,68,0.4)", borderRadius: 8, padding: "6px 12px", marginBottom: 10, display: "flex", alignItems: "center", gap: 8 }}>
                                <span style={{ color: "#fff", fontWeight: 800, fontSize: "0.85rem", letterSpacing: "0.04em" }}>✕ APPOINTMENT CANCELLED</span>
                              </div>
                            )}
                            {b.status === "Skipped" && (
                              <div style={{ background: "rgba(59,130,246,0.25)", border: "1px solid rgba(59,130,246,0.4)", borderRadius: 8, padding: "6px 12px", marginBottom: 10, display: "flex", alignItems: "center", gap: 8 }}>
                                <span style={{ color: "#fff", fontWeight: 800, fontSize: "0.85rem", letterSpacing: "0.04em" }}>⏭ MAINTENANCE SKIPPED</span>
                              </div>
                            )}
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, marginBottom: 6, flexWrap: "wrap" as const }}>
                              <div>
                                <div style={{ fontWeight: 700, color: b.status === "Cancelled" ? "#fca5a5" : b.status === "Skipped" ? "rgba(255,255,255,0.45)" : "#f1f5f9", fontSize: "0.95rem" }}>{b.name} — {formatDateLabel(b.date)}{b.time ? ` at ${b.time}` : ""}</div>
                                <div style={{ fontSize: "0.85rem", color: "rgba(255,255,255,0.45)" }}>{b.email} · {b.phone}</div>
                                <div style={{ fontSize: "0.85rem", color: "rgba(255,255,255,0.45)" }}>{vl} · {b.packageType === "basic" ? "Basic Detail" : b.packageType === "premium" ? "Premium Detail" : b.packageType === "exterior" ? "Exterior Only — Basic" : b.packageType === "exteriorPremium" ? "Exterior Only — Premium" : b.packageType === "interior" ? "Interior Only — Basic" : b.packageType === "interiorPremium" ? "Interior Only — Premium" : b.packageType === "custom" ? `⚡ Custom: ${b.addOns || "Custom Job"}` : b.packageType} · {b.packageType === "custom" ? "Flat rate" : `$${b.hourlyRate}/hr`}</div>
                                {b.clientType === "maintenance" && <div style={{ fontSize: "0.8rem", color: "#059669", fontWeight: 600 }}>{b.recurringFrequency === "biweekly" ? "Bi-Weekly" : "Monthly"} Maintenance</div>}
                                {b.serviceType === "mobile" && b.address && <div style={{ fontSize: "0.8rem", color: "rgba(255,255,255,0.45)" }}>{b.address}</div>}
                                {b.addOns && <div style={{ fontSize: "0.8rem", color: "#93c5fd" }}>Add-Ons: {b.addOns}</div>}
                                {b.notes && <div style={{ fontSize: "0.8rem", color: "rgba(255,255,255,0.35)" }}>Notes: {b.notes}</div>}
                              </div>
                              <div style={{ display: "flex", flexDirection: "column" as const, alignItems: "flex-end", gap: 4 }}>
                                <span style={{ background: b.status === "Cancelled" ? "rgba(239,68,68,0.15)" : b.status === "Skipped" ? "rgba(59,130,246,0.15)" : isComplete ? "rgba(16,185,129,0.15)" : isUpcoming(b.date) ? "rgba(59,130,246,0.15)" : "rgba(255,255,255,0.06)", color: b.status === "Cancelled" ? "#f87171" : b.status === "Skipped" ? "#93c5fd" : isComplete ? "#34d399" : isUpcoming(b.date) ? "#93c5fd" : "rgba(255,255,255,0.35)", fontSize: "0.72rem", fontWeight: 700, borderRadius: 999, padding: "2px 8px" }}>
                                  {b.status === "Cancelled" ? "CANCELLED" : b.status === "Skipped" ? "SKIPPED" : isComplete ? "COMPLETED" : isUpcoming(b.date) ? "UPCOMING" : "PAST"}
                                </span>
                                {b.invoiceStatus && b.invoiceStatus !== "" && (
                                  <span style={{ background: b.invoiceStatus === "paid" ? "rgba(16,185,129,0.2)" : b.invoiceStatus === "released" ? "rgba(251,191,36,0.15)" : "rgba(251,191,36,0.1)", color: b.invoiceStatus === "paid" ? "#34d399" : "#fbbf24", fontSize: "0.72rem", fontWeight: 700, borderRadius: 999, padding: "2px 8px" }}>
                                    {b.invoiceStatus === "pending" ? "INVOICE PENDING" : b.invoiceStatus === "released" ? `INVOICE SENT $${b.invoiceAmount}` : `PAID $${b.invoiceAmount}`}
                                  </span>
                                )}
                              </div>
                            </div>

                            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" as const, marginTop: 8, alignItems: "center" }}>
                              {!isComplete && b.status !== "Cancelled" && b.status !== "Skipped" && (
                                <button onClick={() => { setSelectedAdminBooking(isSelected ? null : b); setEditingBooking(null); if (b.packageType === "custom") { setBillingMode("flat"); setCompleteAmount(""); setCompleteNote(b.addOns || ""); setCompleteHours(""); } else { setBillingMode("hourly"); setCompleteAmount(b.hourlyRate ? String(parseFloat(b.hourlyRate) * 2) : ""); setCompleteHours(b.clientType === "maintenance" ? "2" : ""); setCompleteNote(""); } }}
                                  style={{ background: isSelected ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.1)", color: "#f1f5f9", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 8, padding: "7px 14px", fontSize: "0.82rem", fontWeight: 600, cursor: "pointer" }}>
                                  {isSelected ? "Cancel" : "Mark Complete"}
                                </button>
                              )}
                              {/* Job Timer button */}
                              {!isComplete && b.status !== "Cancelled" && b.status !== "Skipped" && (
                                timerBookingRow === b.rowIndex ? (
                                  <div style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(251,191,36,0.08)", border: "1px solid #f59e0b", borderRadius: 8, padding: "5px 12px" }}>
                                    <span style={{ fontSize: "0.9rem", fontWeight: 800, color: "#fbbf24", fontVariantNumeric: "tabular-nums" }}>{timerDisplay(timerElapsed)}</span>
                                    <button onClick={() => stopTimer(b)}
                                      style={{ background: "#dc2626", color: "#fff", border: "none", borderRadius: 6, padding: "4px 10px", fontSize: "0.78rem", fontWeight: 700, cursor: "pointer" }}>
                                      Stop & Fill
                                    </button>
                                  </div>
                                ) : (
                                  <button onClick={() => { startTimer(b.rowIndex); setSelectedAdminBooking(b); setEditingBooking(null); if (b.packageType === "custom") { setBillingMode("flat"); setCompleteAmount(""); setCompleteNote(b.addOns || ""); setCompleteHours(""); } else { setBillingMode("hourly"); setCompleteHours(""); setCompleteAmount(""); setCompleteNote(""); } }}
                                    style={{ background: "#059669", color: "#fff", border: "none", borderRadius: 8, padding: "7px 14px", fontSize: "0.82rem", fontWeight: 600, cursor: "pointer" }}>
                                    ▶ Start Timer
                                  </button>
                                )
                              )}
                              {b.status !== "Cancelled" && b.status !== "Skipped" && (
                                <button onClick={() => { setEditingBooking(editingBooking?.rowIndex === b.rowIndex ? null : b); setEditFields({ name: b.name, phone: b.phone, email: b.email, date: b.date, time: b.time, year: b.year, make: b.make, model: b.model, boatSize: b.boatSize, packageType: b.packageType, serviceType: b.serviceType, address: b.address, notes: b.notes, clientType: b.clientType, recurringFrequency: b.recurringFrequency, addOns: b.addOns }); setSelectedAdminBooking(null); }}
                                  style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.7)", border: "none", borderRadius: 8, padding: "7px 14px", fontSize: "0.82rem", fontWeight: 600, cursor: "pointer" }}>
                                  {editingBooking?.rowIndex === b.rowIndex ? "Cancel Edit" : "Edit"}
                                </button>
                              )}
                              {!isComplete && isUpcoming(b.date) && b.status !== "Cancelled" && b.status !== "Skipped" && (
                                <button onClick={async () => {
                                  if (!window.confirm(
                                    b.clientType === "maintenance"
                                      ? `Cancel ${b.name}'s entire maintenance plan? This will cancel ALL upcoming maintenance appointments, reopen the slots, and remove all calendar events.`
                                      : `Cancel ${b.name}'s appointment on ${formatDateLabel(b.date)} at ${b.time}? This will notify the customer.`
                                  )) return;
                                  try {
                                    const vl = b.vehicle === "boat"
                                      ? [b.boatSize, b.make, b.model].filter(Boolean).join(" ")
                                      : [b.year, b.make, b.model].filter(Boolean).join(" ");
                                    const res = await fetch(SCRIPT_URL, {
                                      method: "POST",
                                      body: JSON.stringify({
                                        action: "cancelBooking",
                                        rowIndex: b.rowIndex,
                                        customerName: b.name,
                                        customerEmail: b.email,
                                        customerPhone: b.phone,
                                        date: b.date,
                                        time: b.time,
                                        vehicle: vl,
                                        packageType: b.packageType,
                                        address: b.address,
                                        clientType: b.clientType,
                                      }),
                                    });
                                    const d = await res.json();
                                    if (d.success) {
                                      setAdminBookings(prev => prev.map(bk => bk.rowIndex === b.rowIndex ? { ...bk, status: "Cancelled" } : bk));
                                      const msg = b.clientType === "maintenance"
                                        ? `Maintenance plan cancelled. All upcoming appointments removed and ${b.name} has been notified.`
                                        : `Appointment cancelled. ${b.name} has been notified.`;
                                      alert(msg);
                                    } else { alert("Something went wrong."); }
                                  } catch (e) { alert("Something went wrong."); }
                                }}
                                style={{ background: "rgba(239,68,68,0.1)", color: "#dc2626", border: "1.5px solid #fca5a5", borderRadius: 8, padding: "7px 14px", fontSize: "0.82rem", fontWeight: 600, cursor: "pointer" }}>
                                  Cancel Appt
                                </button>
                              )}
                              {/* Skip button — maintenance only */}
                              {!isComplete && isUpcoming(b.date) && b.status !== "Cancelled" && b.status !== "Skipped" && b.clientType === "maintenance" && (
                                <button onClick={async () => {
                                  if (!window.confirm(`Skip ${b.name}'s maintenance on ${formatDateLabel(b.date)}? They will be notified and moved to their next scheduled date.`)) return;
                                  const skipTid = showToast("Skipping appointment and updating calendar...", "loading");
                                  try {
                                    const vl = b.vehicle === "boat"
                                      ? [b.boatSize, b.make, b.model].filter(Boolean).join(" ")
                                      : [b.year, b.make, b.model].filter(Boolean).join(" ");
                                    const res = await fetch(SCRIPT_URL, {
                                      method: "POST",
                                      body: JSON.stringify({
                                        action: "skipMaintenanceBooking",
                                        rowIndex: b.rowIndex,
                                        customerName: b.name,
                                        customerEmail: b.email,
                                        customerPhone: b.phone,
                                        date: b.date,
                                        time: b.time,
                                        vehicleLabel: vl,
                                        packageType: b.packageType,
                                        address: b.address,
                                        recurringFrequency: b.recurringFrequency,
                                        // pass all booking fields for next booking creation
                                        name: b.name,
                                        phone: b.phone,
                                        email: b.email,
                                        year: b.year,
                                        make: b.make,
                                        model: b.model,
                                        boatSize: b.boatSize,
                                        vehicle: b.vehicle,
                                        hourlyRate: b.hourlyRate,
                                        addOns: b.addOns,
                                        serviceType: b.serviceType,
                                        clientType: b.clientType,
                                        avgTime: b.avgTime,
                                        notes: b.notes,
                                      }),
                                    });
                                    const d = await res.json();
                                    if (d.success) {
                                      setAdminBookings(prev => prev.map(bk => bk.rowIndex === b.rowIndex ? { ...bk, status: "Skipped" } : bk));
                                      updateToast(skipTid, `Skipped ✓ — ${b.name} notified. Next: ${d.nextDate || "see schedule"}`, "success", 4000);
                                      await loadAdminBookings();
                                    } else {
                                      updateToast(skipTid, "Something went wrong: " + (d.error || ""), "error", 4000);
                                    }
                                  } catch (e) { updateToast(skipTid, "Network error — please try again", "error", 4000); }
                                }}
                                style={{ background: "rgba(59,130,246,0.08)", color: "#0369a1", border: "1.5px solid #7dd3fc", borderRadius: 8, padding: "7px 14px", fontSize: "0.82rem", fontWeight: 600, cursor: "pointer" }}>
                                  ⏭ Skip Appt
                                </button>
                              )}
                            </div>

                            {/* Edit form */}
                            {editingBooking?.rowIndex === b.rowIndex && (
                              <div style={{ marginTop: 14, padding: 16, background: "rgba(255,255,255,0.04)", borderRadius: 12, border: "1px solid rgba(255,255,255,0.08)" }}>
                                <div style={{ fontWeight: 700, color: "rgba(255,255,255,0.7)", marginBottom: 12 }}>Edit Booking</div>

                                {/* Reschedule indicator */}
                                {((editFields.date && editFields.date !== b.date) || (editFields.time && editFields.time !== b.time)) && (
                                  <div style={{ background: "rgba(251,191,36,0.08)", border: "1.5px solid #f59e0b", borderRadius: 10, padding: "12px 14px", marginBottom: 14 }}>
                                    <div style={{ fontWeight: 700, color: "#fbbf24", fontSize: "0.88rem", marginBottom: 4 }}>⚠ Reschedule Detected</div>
                                    <div style={{ fontSize: "0.82rem", color: "#fbbf24" }}>
                                      <span style={{ textDecoration: "line-through", opacity: 0.7 }}>{formatDateLabel(b.date)}{b.time ? ` at ${b.time}` : ""}</span>
                                      <span style={{ margin: "0 8px" }}>→</span>
                                      <strong>{formatDateLabel(editFields.date || b.date)}{(editFields.time || b.time) ? ` at ${editFields.time || b.time}` : ""}</strong>
                                    </div>
                                    <div style={{ fontSize: "0.75rem", color: "#f59e0b", marginTop: 4 }}>Customer will be notified by email and SMS. Calendar will be updated.</div>
                                  </div>
                                )}

                                {/* Date & Time — full width with calendar picker */}
                                <div style={{ marginBottom: 12, gridColumn: "1 / -1" }}>
                                  <div style={{ fontSize: "0.78rem", color: "rgba(255,255,255,0.45)", marginBottom: 6, fontWeight: 600 }}>Reschedule Date & Time</div>
                                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                                    <div>
                                      <div style={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.35)", marginBottom: 3 }}>New Date</div>
                                      <input
                                        type="date"
                                        style={{ width: "100%", padding: "9px 12px", fontSize: "0.85rem", border: "1.5px solid #d1d5db", borderRadius: 14, outline: "none", boxSizing: "border-box" as const, cursor: "pointer", background: "rgba(255,255,255,0.05)", color: "#f1f5f9", fontFamily: "inherit" }}
                                        value={editFields.date || b.date}
                                        min={new Date().toISOString().split("T")[0]}
                                        onChange={e => setEditFields(prev => ({ ...prev, date: e.target.value }))}
                                      />
                                    </div>
                                    <div>
                                      <div style={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.35)", marginBottom: 3 }}>New Time</div>
                                      {(() => {
                                        const slotsForDate = allAvailableSlots.filter(s => s.date === (editFields.date || b.date));
                                        return slotsForDate.length > 0 ? (
                                          <select
                                            style={{ ...S.input, padding: "8px 10px", fontSize: "0.85rem", backgroundColor: "transparent" }}
                                            value={editFields.time || b.time}
                                            onChange={e => setEditFields(prev => ({ ...prev, time: e.target.value }))}
                                          >
                                            <option value={b.time}>{b.time} (current)</option>
                                            {slotsForDate.filter(s => s.time !== b.time).map(s => (
                                              <option key={s.time} value={s.time}>{s.time}</option>
                                            ))}
                                          </select>
                                        ) : (
                                          <div style={{ padding: "8px 10px", background: "rgba(239,68,68,0.1)", border: "1px solid #fca5a5", borderRadius: 14, fontSize: "0.82rem", color: "#dc2626" }}>
                                            No available slots on this date
                                          </div>
                                        );
                                      })()}
                                    </div>
                                  </div>
                                </div>

                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                                  {[
                                    { label: "Name", key: "name" },
                                    { label: "Phone", key: "phone" },
                                    { label: "Email", key: "email" },
                                    { label: "Year", key: "year" },
                                    { label: "Make", key: "make" },
                                    { label: "Model", key: "model" },
                                    { label: "Boat Size", key: "boatSize" },
                                    { label: "Address", key: "address" },
                                    { label: "Notes", key: "notes" },
                                  ].map(field => (
                                    <div key={field.key}>
                                      <div style={{ fontSize: "0.78rem", color: "rgba(255,255,255,0.45)", marginBottom: 3 }}>{field.label}</div>
                                      <input
                                        style={{ ...S.input, padding: "8px 10px", fontSize: "0.85rem" }}
                                        value={(editFields as any)[field.key] || ""}
                                        onChange={e => setEditFields(prev => ({ ...prev, [field.key]: e.target.value }))}
                                      />
                                    </div>
                                  ))}
                                  <div>
                                    <div style={{ fontSize: "0.78rem", color: "rgba(255,255,255,0.45)", marginBottom: 3 }}>Package</div>
                                    <select style={{ ...S.input, padding: "8px 10px", fontSize: "0.85rem", backgroundColor: "transparent" }} value={(editFields as any).packageType || ""} onChange={e => setEditFields(prev => ({ ...prev, packageType: e.target.value }))}>
                                      <option value="basic">Basic</option>
                                      <option value="premium">Premium</option>
                                      <option value="exterior">Exterior Basic</option>
                                      <option value="exteriorPremium">Exterior Premium</option>
                                      <option value="interior">Interior Basic</option>
                                      <option value="interiorPremium">Interior Premium</option>
                                    </select>
                                  </div>
                                  <div>
                                    <div style={{ fontSize: "0.78rem", color: "rgba(255,255,255,0.45)", marginBottom: 3 }}>Service Type</div>
                                    <select style={{ ...S.input, padding: "8px 10px", fontSize: "0.85rem", backgroundColor: "transparent" }} value={(editFields as any).serviceType || ""} onChange={e => setEditFields(prev => ({ ...prev, serviceType: e.target.value }))}>
                                      <option value="mobile">Mobile</option>
                                      <option value="dropoff">Drop-Off</option>
                                    </select>
                                  </div>
                                  <div>
                                    <div style={{ fontSize: "0.78rem", color: "rgba(255,255,255,0.45)", marginBottom: 3 }}>Client Type</div>
                                    <select style={{ ...S.input, padding: "8px 10px", fontSize: "0.85rem", backgroundColor: "transparent" }} value={(editFields as any).clientType || ""} onChange={e => setEditFields(prev => ({ ...prev, clientType: e.target.value }))}>
                                      <option value="oneTime">One-Time</option>
                                      <option value="maintenance">Maintenance</option>
                                    </select>
                                  </div>
                                  <div>
                                    <div style={{ fontSize: "0.78rem", color: "rgba(255,255,255,0.45)", marginBottom: 3 }}>Frequency</div>
                                    <select style={{ ...S.input, padding: "8px 10px", fontSize: "0.85rem", backgroundColor: "transparent" }} value={(editFields as any).recurringFrequency || ""} onChange={e => setEditFields(prev => ({ ...prev, recurringFrequency: e.target.value }))}>
                                      <option value="">None</option>
                                      <option value="biweekly">Bi-Weekly</option>
                                      <option value="monthly">Monthly</option>
                                    </select>
                                  </div>
                                </div>

                                {/* Add-Ons editor — full width */}
                                <div style={{ marginBottom: 14, padding: "12px 14px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12 }}>
                                  <div style={{ fontSize: "0.78rem", color: "rgba(255,255,255,0.45)", marginBottom: 10, fontWeight: 600 }}>Add-On Services</div>
                                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 6 }}>
                                    {(b.vehicle === "boat" ? marineAddOnOptions : addOnOptions).map(option => {
                                      const currentAddOns = (editFields.addOns || "").split(",").map((s: string) => s.trim()).filter(Boolean);
                                      const isChecked = currentAddOns.includes(option.label);
                                      return (
                                        <label key={option.label} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: "0.82rem", color: "rgba(255,255,255,0.7)" }}>
                                          <input
                                            type="checkbox"
                                            checked={isChecked}
                                            style={{ accentColor: "#0f0f0f", width: 15, height: 15 }}
                                            onChange={() => {
                                              const updated = isChecked
                                                ? currentAddOns.filter((a: string) => a !== option.label)
                                                : [...currentAddOns, option.label];
                                              setEditFields(prev => ({ ...prev, addOns: updated.join(", ") }));
                                            }}
                                          />
                                          <span>{option.label}</span>
                                          <span style={{ color: "rgba(255,255,255,0.35)", marginLeft: "auto" }}>{option.priceText}</span>
                                        </label>
                                      );
                                    })}
                                  </div>
                                  {editFields.addOns !== b.addOns && (
                                    <div style={{ marginTop: 10, fontSize: "0.78rem", color: "#7c3aed", background: "#f5f3ff", border: "1px solid #ddd6fe", borderRadius: 8, padding: "6px 10px" }}>
                                      <span style={{ fontWeight: 700 }}>Changed: </span>
                                      <span style={{ textDecoration: "line-through", opacity: 0.6 }}>{b.addOns || "None"}</span>
                                      <span style={{ margin: "0 6px" }}>→</span>
                                      <strong>{editFields.addOns || "None"}</strong>
                                    </div>
                                  )}
                                </div>

                                {/* Change summary — shows all detected changes before saving */}
                                {(() => {
                                  const pkgLabel = (p: string) => p === "basic" ? "Basic Detail" : p === "premium" ? "Premium Detail" : p === "exterior" ? "Exterior Basic" : p === "exteriorPremium" ? "Exterior Premium" : p === "interior" ? "Interior Basic" : p === "interiorPremium" ? "Interior Premium" : p;
                                  const svcLabel = (s: string) => s === "mobile" ? "Mobile" : s === "dropoff" ? "Drop-Off" : s;
                                  const ctLabel  = (c: string) => c === "oneTime" ? "One-Time" : c === "maintenance" ? "Maintenance" : c;
                                  const changes: { field: string; from: string; to: string }[] = [];
                                  if (editFields.packageType && editFields.packageType !== b.packageType) changes.push({ field: "Package", from: pkgLabel(b.packageType), to: pkgLabel(editFields.packageType) });
                                  if (editFields.addOns !== undefined && editFields.addOns !== b.addOns) changes.push({ field: "Add-Ons", from: b.addOns || "None", to: editFields.addOns || "None" });
                                  if (editFields.clientType && editFields.clientType !== b.clientType) changes.push({ field: "Client Type", from: ctLabel(b.clientType), to: ctLabel(editFields.clientType) });
                                  if (editFields.recurringFrequency !== undefined && editFields.recurringFrequency !== b.recurringFrequency) changes.push({ field: "Frequency", from: b.recurringFrequency || "None", to: editFields.recurringFrequency || "None" });
                                  if (editFields.year && editFields.year !== b.year) changes.push({ field: "Year", from: b.year, to: editFields.year });
                                  if (editFields.make && editFields.make !== b.make) changes.push({ field: "Make", from: b.make, to: editFields.make });
                                  if (editFields.model && editFields.model !== b.model) changes.push({ field: "Model", from: b.model, to: editFields.model });
                                  if (editFields.serviceType && editFields.serviceType !== b.serviceType) changes.push({ field: "Service Type", from: svcLabel(b.serviceType), to: svcLabel(editFields.serviceType) });
                                  if (editFields.address && editFields.address !== b.address) changes.push({ field: "Address", from: b.address, to: editFields.address });
                                  if (changes.length === 0) return null;
                                  return (
                                    <div style={{ marginBottom: 14, padding: "12px 14px", background: "rgba(251,191,36,0.08)", border: "1.5px solid #fcd34d", borderRadius: 12 }}>
                                      <div style={{ fontSize: "0.78rem", fontWeight: 700, color: "#fbbf24", marginBottom: 8 }}>📧 Booking change email will be sent to {b.email}</div>
                                      {changes.map((c, i) => (
                                        <div key={i} style={{ fontSize: "0.78rem", color: "#fcd34d", marginBottom: 3 }}>
                                          <strong>{c.field}:</strong> <span style={{ textDecoration: "line-through", opacity: 0.6 }}>{c.from}</span> → <strong>{c.to}</strong>
                                        </div>
                                      ))}
                                    </div>
                                  );
                                })()}

                                <div style={{ display: "flex", gap: 8 }}>
                                  <button onClick={handleSaveEdit} disabled={editSaving}
                                    style={{ background: "#2563eb", color: "#fff", border: "none", borderRadius: 8, padding: "9px 18px", fontWeight: 700, fontSize: "0.88rem", cursor: "pointer", opacity: editSaving ? 0.5 : 1 }}>
                                    {editSaving ? "Saving..." : "Save Changes"}
                                  </button>
                                  <button onClick={() => { setEditingBooking(null); setEditFields({}); }}
                                    style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.7)", border: "none", borderRadius: 8, padding: "9px 14px", fontWeight: 600, fontSize: "0.88rem", cursor: "pointer" }}>
                                    Cancel
                                  </button>
                                </div>

                                {/* Update all future times — maintenance only */}
                                {b.clientType === "maintenance" && (() => {
                                  const ALL_TIMES = ["7:00 AM","7:30 AM","8:00 AM","8:30 AM","9:00 AM","9:30 AM","10:00 AM","10:30 AM","11:00 AM","11:30 AM","12:00 PM","12:30 PM","1:00 PM","1:30 PM","2:00 PM","2:30 PM","3:00 PM","3:30 PM","4:00 PM","4:30 PM","5:00 PM","5:30 PM","6:00 PM","6:30 PM","7:00 PM"];
                                  const checkedForThis = maintTimeCheckedFor?.rowIndex === b.rowIndex;
                                  const selectedNewTime = maintTimeCheckedFor?.time || "";
                                  const hasConflicts = checkedForThis && maintTimeConflicts.length > 0;
                                  const isClean = checkedForThis && maintTimeConflicts.length === 0;

                                  return (
                                    <div style={{ marginTop: 16, padding: "14px 16px", background: "rgba(59,130,246,0.08)", border: "1.5px solid #7dd3fc", borderRadius: 12 }}>
                                      <div style={{ fontWeight: 700, color: "#0369a1", fontSize: "0.88rem", marginBottom: 4 }}>Update Time for Entire Schedule</div>
                                      <div style={{ fontSize: "0.78rem", color: "#0284c7", marginBottom: 12 }}>Changes the time on ALL future appointments and calendar events for this vehicle. Checks for conflicts with other bookings first.</div>

                                      <div style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" as const, marginBottom: 12 }}>
                                        <div>
                                          <div style={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.45)", marginBottom: 4 }}>Select New Time</div>
                                          <select
                                            id={`newTimeAll-${b.rowIndex}`}
                                            style={{ ...S.input, padding: "8px 12px", fontSize: "0.85rem", backgroundColor: "transparent", width: "auto" }}
                                            defaultValue={b.time}
                                            onChange={() => {
                                              // Reset conflict check when time changes
                                              setMaintTimeCheckedFor(null);
                                              setMaintTimeConflicts([]);
                                            }}
                                          >
                                            {ALL_TIMES.map(t => (
                                              <option key={t} value={t}>{t}{t === b.time ? " (current)" : ""}</option>
                                            ))}
                                          </select>
                                        </div>
                                        <button
                                          disabled={maintTimeChecking}
                                          onClick={async () => {
                                            const sel = document.getElementById(`newTimeAll-${b.rowIndex}`) as HTMLSelectElement;
                                            const newTime = sel?.value;
                                            if (!newTime || newTime === b.time) { alert("Please select a different time."); return; }
                                            setMaintTimeChecking(true);
                                            setMaintTimeConflicts([]);
                                            setMaintTimeCheckedFor(null);
                                            try {
                                              const res = await fetch(SCRIPT_URL, {
                                                method: "POST",
                                                body: JSON.stringify({
                                                  action: "checkMaintenanceTimeConflicts",
                                                  customerEmail: b.email,
                                                  make: b.make,
                                                  model: b.model,
                                                  newTime,
                                                  frequency: b.recurringFrequency,
                                                  refDate: b.date,
                                                }),
                                              });
                                              const d = await res.json();
                                              if (d.success) {
                                                setMaintTimeConflicts(d.conflicts || []);
                                                setMaintTimeCheckedFor({ rowIndex: b.rowIndex, time: newTime });
                                              } else { alert("Check failed: " + (d.error || "")); }
                                            } catch (e) { alert("Something went wrong."); }
                                            setMaintTimeChecking(false);
                                          }}
                                          style={{ background: "#0369a1", color: "#fff", border: "none", borderRadius: 8, padding: "9px 16px", fontWeight: 700, fontSize: "0.85rem", cursor: "pointer", opacity: maintTimeChecking ? 0.6 : 1 }}>
                                          {maintTimeChecking ? "Checking..." : "Check for Conflicts"}
                                        </button>
                                      </div>

                                      {/* Conflict results */}
                                      {hasConflicts && (
                                        <div style={{ background: "rgba(239,68,68,0.1)", border: "1.5px solid #fca5a5", borderRadius: 10, padding: "12px 16px", marginBottom: 12 }}>
                                          <div style={{ fontWeight: 700, color: "#dc2626", fontSize: "0.85rem", marginBottom: 8 }}>
                                            ⚠ {maintTimeConflicts.length} conflict{maintTimeConflicts.length !== 1 ? "s" : ""} found at {selectedNewTime}
                                          </div>
                                          <div style={{ fontSize: "0.78rem", color: "#fca5a5", marginBottom: 8 }}>
                                            The following existing bookings overlap with this time:
                                          </div>
                                          {maintTimeConflicts.map((c, ci) => (
                                            <div key={ci} style={{ background: "rgba(255,255,255,0.05)", border: "1px solid #fca5a5", borderRadius: 8, padding: "8px 12px", marginBottom: 6, fontSize: "0.82rem" }}>
                                              <span style={{ fontWeight: 700, color: "#f1f5f9" }}>{c.dateLabel}</span>
                                              <span style={{ color: "rgba(255,255,255,0.45)" }}> — {c.clientName}</span>
                                              <span style={{ color: "rgba(255,255,255,0.35)" }}> · {c.vehicle}</span>
                                            </div>
                                          ))}
                                          <div style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.35)", marginTop: 8 }}>You can still apply the change — these are informational so you can decide how to handle each conflict manually.</div>
                                          <button
                                            onClick={async () => {
                                              if (!window.confirm(`Apply ${selectedNewTime} to all future ${b.make} ${b.model} appointments anyway? ${maintTimeConflicts.length} conflict${maintTimeConflicts.length !== 1 ? "s" : ""} will need to be resolved manually.`)) return;
                                              await applyMaintenanceTimeUpdate(b, selectedNewTime);
                                            }}
                                            style={{ marginTop: 10, background: "#dc2626", color: "#fff", border: "none", borderRadius: 8, padding: "8px 14px", fontWeight: 700, fontSize: "0.82rem", cursor: "pointer" }}>
                                            Apply Anyway
                                          </button>
                                        </div>
                                      )}

                                      {isClean && (
                                        <div style={{ background: "rgba(16,185,129,0.08)", border: "1.5px solid #6ee7b7", borderRadius: 10, padding: "12px 16px", marginBottom: 12 }}>
                                          <div style={{ fontWeight: 700, color: "#059669", fontSize: "0.85rem", marginBottom: 4 }}>✓ No conflicts — {selectedNewTime} is clear for all future dates</div>
                                          <div style={{ fontSize: "0.78rem", color: "#10b981" }}>Safe to apply. This will update all future bookings and calendar events.</div>
                                          <button
                                            onClick={async () => {
                                              await applyMaintenanceTimeUpdate(b, selectedNewTime);
                                            }}
                                            style={{ marginTop: 10, background: "#059669", color: "#fff", border: "none", borderRadius: 8, padding: "8px 14px", fontWeight: 700, fontSize: "0.82rem", cursor: "pointer" }}>
                                            Apply to All Future Appointments
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                  );
                                })()}
                              </div>
                            )}

                            {/* Mark complete form */}
                            {isSelected && (
                              <div style={{ marginTop: 14, padding: 16, background: "rgba(255,255,255,0.04)", borderRadius: 12, border: "1px solid rgba(255,255,255,0.08)" }}>
                                <div style={{ fontWeight: 700, color: "rgba(255,255,255,0.7)", marginBottom: 10 }}>Confirm Service & Set Invoice</div>
                                {b.packageType === "custom" && (
                                  <div style={{ background: "rgba(124,58,237,0.12)", border: "1.5px solid rgba(124,58,237,0.4)", borderRadius: 10, padding: "10px 14px", marginBottom: 12, fontSize: "0.85rem", color: "#a78bfa" }}>
                                    ⚡ <strong>Custom Job:</strong> {b.addOns || "Custom Service"} — enter the final amount below.
                                  </div>
                                )}

                                {b.clientType !== "maintenance" ? (
                                  /* Non-maintenance: hourly or flat rate toggle */
                                  <div style={{ marginBottom: 10 }}>
                                    {/* Mode toggle */}
                                    <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
                                      <button
                                        onClick={() => { setBillingMode("hourly"); setCompleteAmount(""); setCompleteHours(""); }}
                                        style={{ flex: 1, padding: "8px 12px", borderRadius: 8, border: billingMode === "hourly" ? "2px solid #f1f5f9" : "1px solid rgba(255,255,255,0.12)", background: billingMode === "hourly" ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.04)", color: billingMode === "hourly" ? "#fff" : "rgba(255,255,255,0.5)", fontWeight: 700, fontSize: "0.82rem", cursor: "pointer" }}
                                      >
                                        ⏱ Hourly
                                      </button>
                                      <button
                                        onClick={() => { setBillingMode("flat"); setCompleteHours(""); setCompleteAmount(""); }}
                                        style={{ flex: 1, padding: "8px 12px", borderRadius: 8, border: billingMode === "flat" ? "2px solid #a78bfa" : "1px solid rgba(255,255,255,0.12)", background: billingMode === "flat" ? "rgba(139,92,246,0.3)" : "rgba(255,255,255,0.04)", color: billingMode === "flat" ? "#fff" : "rgba(255,255,255,0.5)", fontWeight: 700, fontSize: "0.82rem", cursor: "pointer" }}
                                      >
                                        💲 Flat Rate
                                      </button>
                                    </div>

                                    {billingMode === "hourly" ? (
                                      <>
                                        <div style={{ fontSize: "0.82rem", color: "rgba(255,255,255,0.45)", marginBottom: 10 }}>
                                          Rate: <strong style={{ color: "#f1f5f9" }}>${b.hourlyRate}/hr</strong> — Enter hours to calculate
                                        </div>
                                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                                          <div>
                                            <div style={{ fontSize: "0.78rem", color: "rgba(255,255,255,0.45)", marginBottom: 4 }}>Hours Worked</div>
                                            <input
                                              style={{ ...S.input, padding: "12px 14px", fontSize: "1rem" }}
                                              type="number"
                                              inputMode="decimal"
                                              step="0.5"
                                              placeholder="e.g. 2.5"
                                              value={completeHours}
                                              onChange={e => {
                                                setCompleteHours(e.target.value);
                                                const hrs = parseFloat(e.target.value);
                                                const rate2 = parseFloat(b.hourlyRate || "0");
                                                if (hrs > 0 && rate2 > 0) setCompleteAmount((hrs * rate2).toFixed(2));
                                                else setCompleteAmount("");
                                              }}
                                            />
                                          </div>
                                          <div>
                                            <div style={{ fontSize: "0.78rem", color: "rgba(255,255,255,0.45)", marginBottom: 4 }}>Invoice Amount</div>
                                            <input
                                              style={{ ...S.input, padding: "12px 14px", fontSize: "1rem", fontWeight: 700 }}
                                              type="number"
                                              inputMode="decimal"
                                              placeholder="Auto-calc"
                                              value={completeAmount}
                                              onChange={e => setCompleteAmount(e.target.value)}
                                            />
                                          </div>
                                        </div>
                                        <div>
                                          <div style={{ fontSize: "0.78rem", color: "rgba(255,255,255,0.45)", marginBottom: 4 }}>Note (optional)</div>
                                          <input style={{ ...S.input, padding: "12px 14px" }} placeholder="e.g. Boat detail, full interior" value={completeNote} onChange={e => setCompleteNote(e.target.value)} />
                                        </div>
                                        {completeHours && completeAmount && (
                                          <div style={{ marginTop: 10, padding: "8px 12px", background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.3)", borderRadius: 10, fontSize: "0.88rem", color: "#34d399", fontWeight: 700 }}>
                                            {completeHours} hrs × ${b.hourlyRate}/hr = ${completeAmount}
                                          </div>
                                        )}
                                      </>
                                    ) : (
                                      <>
                                        <div style={{ fontSize: "0.82rem", color: "#7c3aed", marginBottom: 6, fontWeight: 600 }}>
                                          Flat Rate — enter a custom amount (e.g. add-on consultation, package deal)
                                        </div>
                                        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" as const }}>
                                          <div style={{ flex: 1, minWidth: 140 }}>
                                            <div style={{ fontSize: "0.78rem", color: "rgba(255,255,255,0.45)", marginBottom: 4 }}>Invoice Amount ($)</div>
                                            <input
                                              style={{ ...S.input, padding: "10px 12px", fontWeight: 700, border: "1.5px solid #a78bfa" }}
                                              type="number"
                                              step="0.01"
                                              placeholder="e.g. 350"
                                              value={completeAmount}
                                              onChange={e => setCompleteAmount(e.target.value)}
                                              autoFocus
                                            />
                                          </div>
                                          <div style={{ flex: 2, minWidth: 180 }}>
                                            <div style={{ fontSize: "0.78rem", color: "rgba(255,255,255,0.45)", marginBottom: 4 }}>Note (optional)</div>
                                            <input style={{ ...S.input, padding: "10px 12px" }} placeholder="e.g. Ceramic coating consultation" value={completeNote} onChange={e => setCompleteNote(e.target.value)} />
                                          </div>
                                        </div>
                                        {completeAmount && (
                                          <div style={{ marginTop: 8, fontSize: "0.85rem", color: "#7c3aed", fontWeight: 600 }}>
                                            Flat rate: ${parseFloat(completeAmount).toFixed(2)}
                                          </div>
                                        )}
                                      </>
                                    )}
                                  </div>
                                ) : (
                                  /* Maintenance: fixed 2hr amount, can adjust */
                                  <div style={{ display: "flex", gap: 10, marginBottom: 10, flexWrap: "wrap" as const }}>
                                    <div style={{ flex: 1, minWidth: 120 }}>
                                      <div style={{ fontSize: "0.82rem", color: "rgba(255,255,255,0.45)", marginBottom: 4 }}>Amount ($)</div>
                                      <input style={{ ...S.input, padding: "10px 12px" }} type="number" placeholder="0.00" value={completeAmount} onChange={e => setCompleteAmount(e.target.value)} />
                                    </div>
                                    <div style={{ flex: 2, minWidth: 180 }}>
                                      <div style={{ fontSize: "0.82rem", color: "rgba(255,255,255,0.45)", marginBottom: 4 }}>Note (optional)</div>
                                      <input style={{ ...S.input, padding: "10px 12px" }} placeholder="e.g. 2 hrs at $80/hr" value={completeNote} onChange={e => setCompleteNote(e.target.value)} />
                                    </div>
                                  </div>
                                )}

                                <div style={{ fontSize: "0.8rem", color: "rgba(255,255,255,0.35)", marginBottom: 10 }}>This creates a pending invoice. You must release it from the Invoices tab before the client can see it.</div>
                                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" as const }}>
                                  <button onClick={handleMarkComplete} disabled={completeLoading || (!completeAmount && !completeHours)}
                                    style={{ background: "#059669", color: "#fff", border: "none", borderRadius: 8, padding: "9px 18px", fontWeight: 700, fontSize: "0.88rem", cursor: "pointer", opacity: completeLoading || (!completeAmount && !completeHours) ? 0.5 : 1 }}>
                                    {completeLoading ? "Saving..." : "Confirm Complete"}
                                  </button>
                                  <button onClick={async () => {
                                    if (!b.phone) { alert("No phone number on file."); return; }
                                    try { await fetch(SCRIPT_URL, { method: "POST", body: JSON.stringify({ action: "sendJobStartedSMS", customerName: b.name, customerPhone: b.phone, serviceDate: b.date }) }); alert("Job started text sent!"); } catch (e) { alert("SMS failed"); }
                                  }} style={{ background: "#2563eb", color: "#fff", border: "none", borderRadius: 8, padding: "9px 14px", fontWeight: 600, fontSize: "0.82rem", cursor: "pointer" }}>
                                    📱 Text: Job Started
                                  </button>
                                  <button onClick={async () => {
                                    if (!b.phone) { alert("No phone number on file."); return; }
                                    try { await fetch(SCRIPT_URL, { method: "POST", body: JSON.stringify({ action: "sendJobCompletedSMS", customerName: b.name, customerPhone: b.phone, serviceDate: b.date }) }); alert("Job done text sent!"); } catch (e) { alert("SMS failed"); }
                                  }} style={{ background: "#7c3aed", color: "#fff", border: "none", borderRadius: 8, padding: "9px 14px", fontWeight: 600, fontSize: "0.82rem", cursor: "pointer" }}>
                                    📱 Text: Job Done
                                  </button>
                                </div>

                                {/* Photo upload — Before & After (multiple) */}
                                <div style={{ marginTop: 14, padding: 14, background: "rgba(59,130,246,0.08)", borderRadius: 12, border: "1px solid #bae6fd" }}>
                                  <div style={{ fontWeight: 700, color: "#0369a1", marginBottom: 10, fontSize: "0.85rem" }}>Job Photos</div>

                                  {/* Before section */}
                                  {(["before", "after"] as const).map(type => {
                                    const previewKey = `${b.rowIndex}_${type}`;
                                    const previews = localPhotoPreviews[previewKey] || [];
                                    const existingUrls = type === "before"
                                      ? (b.beforePhotoUrl ? b.beforePhotoUrl.split(",").map(u => u.trim()).filter(Boolean) : [])
                                      : (b.afterPhotoUrl  ? b.afterPhotoUrl.split(",").map(u => u.trim()).filter(Boolean) : []);
                                    const allPreviews = [...existingUrls, ...previews];
                                    return (
                                      <div key={type} style={{ marginBottom: 12 }}>
                                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                                          <div style={{ fontSize: "0.75rem", fontWeight: 700, color: type === "before" ? "#7dd3fc" : "#6ee7b7", textTransform: "uppercase" as const, letterSpacing: "0.06em" }}>
                                            {type === "before" ? "Before" : "After"} {allPreviews.length > 0 ? `(${allPreviews.length})` : ""}
                                          </div>
                                          <label style={{ cursor: "pointer" }}>
                                            <input type="file" accept="image/*" multiple style={{ display: "none" }}
                                              onChange={async (e) => {
                                                const files = Array.from(e.target.files || []);
                                                if (!files.length) return;
                                                setPhotoUploading(prev => ({ ...prev, [b.rowIndex]: type }));

                                                // Compress image in browser before uploading (3-5MB → ~300KB)
                                                const compressImage = (file: File): Promise<{base64: string; dataUrl: string}> =>
                                                  new Promise((resolve) => {
                                                    const img = new Image();
                                                    const url = URL.createObjectURL(file);
                                                    img.onload = () => {
                                                      URL.revokeObjectURL(url);
                                                      const MAX = 1200;
                                                      const scale = Math.min(1, MAX / Math.max(img.width, img.height));
                                                      const canvas = document.createElement("canvas");
                                                      canvas.width  = Math.round(img.width  * scale);
                                                      canvas.height = Math.round(img.height * scale);
                                                      canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
                                                      const dataUrl = canvas.toDataURL("image/jpeg", 0.78);
                                                      resolve({ base64: dataUrl.split(",")[1], dataUrl });
                                                    };
                                                    img.src = url;
                                                  });

                                                // Compress all first (fast, browser-side)
                                                const compressed = await Promise.all(files.map(compressImage));

                                                // Show previews immediately after compression
                                                setLocalPhotoPreviews(prev => ({
                                                  ...prev,
                                                  [previewKey]: [...(prev[previewKey] || []), ...compressed.map(c => c.dataUrl)],
                                                }));

                                                // Upload all in parallel
                                                await Promise.all(compressed.map(async ({ base64 }, idx) => {
                                                  try {
                                                    await fetch(SCRIPT_URL, {
                                                      method: "POST",
                                                      body: JSON.stringify({
                                                        action: "uploadJobPhoto",
                                                        customerName: b.name,
                                                        serviceDate: b.date,
                                                        photoType: type,
                                                        base64,
                                                        mimeType: "image/jpeg",
                                                        rowIndex: b.rowIndex,
                                                      }),
                                                    });
                                                  } catch { console.error("Upload error for photo", idx); }
                                                }));

                                                setPhotoUploading(prev => { const n = {...prev}; delete n[b.rowIndex]; return n; });
                                                e.target.value = "";
                                              }}
                                            />
                                            <span style={{ display: "inline-flex", alignItems: "center", gap: 5, background: type === "before" ? "#0369a1" : "#059669", color: "#fff", borderRadius: 8, padding: "6px 12px", fontSize: "0.78rem", fontWeight: 600, cursor: "pointer", opacity: photoUploading[b.rowIndex] ? 0.5 : 1 }}>
                                              {photoUploading[b.rowIndex] === type ? (
                                                <><div style={{ width: 12, height: 12, border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} /> Uploading...</>
                                              ) : (
                                                <>+ Add {type === "before" ? "Before" : "After"}</>
                                              )}
                                            </span>
                                          </label>
                                        </div>

                                        {/* Photo thumbnails */}
                                        {allPreviews.length > 0 ? (
                                          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(72px, 1fr))", gap: 6 }}>
                                            {allPreviews.map((src, i) => (
                                              <div key={i} style={{ position: "relative" as const, aspectRatio: "1", borderRadius: 8, overflow: "hidden", border: `2px solid ${type === "before" ? "rgba(125,211,252,0.4)" : "rgba(110,231,183,0.4)"}` }}>
                                                <img src={src} style={{ width: "100%", height: "100%", objectFit: "cover" as const, display: "block" }} />
                                                <div style={{ position: "absolute" as const, bottom: 0, left: 0, right: 0, background: "rgba(0,0,0,0.5)", fontSize: "0.6rem", color: "#fff", textAlign: "center" as const, padding: "2px 0", fontWeight: 600 }}>
                                                  {i < existingUrls.length ? "✓ saved" : "✓ uploaded"}
                                                </div>
                                              </div>
                                            ))}
                                          </div>
                                        ) : (
                                          <div style={{ background: "rgba(255,255,255,0.04)", border: "1.5px dashed rgba(255,255,255,0.12)", borderRadius: 8, padding: "12px", textAlign: "center" as const, fontSize: "0.75rem", color: "rgba(255,255,255,0.3)" }}>
                                            No {type} photos yet
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                  <div style={{ fontSize: "0.7rem", color: "#0369a1", marginTop: 4 }}>Photos save to Google Drive automatically.</div>
                                </div>
                              </div>
                            )}

                            {/* Admin photo gallery + invoice download */}
                            {isComplete && (b.beforePhotoUrl || b.afterPhotoUrl || b.invoiceLink) && (() => {
                              const bUrls = b.beforePhotoUrl ? b.beforePhotoUrl.split(",").map((u: string) => u.trim()).filter(Boolean) : [];
                              const aUrls = b.afterPhotoUrl  ? b.afterPhotoUrl.split(",").map((u: string) => u.trim()).filter(Boolean) : [];
                              const fullSize = (url: string) => url.replace("sz=w400", "sz=w1600");
                              const dlPhoto = async (url: string, label: string) => {
                                try {
                                  const res = await fetch(fullSize(url));
                                  const blob = await res.blob();
                                  const a = document.createElement("a");
                                  a.href = URL.createObjectURL(blob);
                                  a.download = label + ".jpg";
                                  a.click();
                                  URL.revokeObjectURL(a.href);
                                } catch { window.open(fullSize(url), "_blank"); }
                              };
                              return (
                                <div style={{ marginTop: 14, padding: 14, background: "rgba(59,130,246,0.06)", borderRadius: 12, border: "1px solid rgba(59,130,246,0.2)" }}>
                                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap" as const, gap: 8 }}>
                                    <div style={{ fontWeight: 700, color: "#93c5fd", fontSize: "0.85rem" }}>
                                      📸 Job Photos {bUrls.length + aUrls.length > 0 ? `(${bUrls.length + aUrls.length})` : ""}
                                    </div>
                                    <div style={{ display: "flex", gap: 8 }}>
                                      {(bUrls.length + aUrls.length) > 1 && (
                                        <button onClick={() => { [...bUrls.map((u: string, i: number) => ({u, label:`before_${i+1}`})), ...aUrls.map((u: string, i: number) => ({u, label:`after_${i+1}`}))].forEach(({u, label}) => dlPhoto(u, label)); }}
                                          style={{ background: "rgba(59,130,246,0.2)", color: "#93c5fd", border: "1px solid rgba(59,130,246,0.3)", borderRadius: 8, padding: "5px 12px", fontSize: "0.78rem", fontWeight: 700, cursor: "pointer" }}>
                                          ⬇ Download All
                                        </button>
                                      )}
                                      {b.invoiceLink && (
                                        <a href={b.invoiceLink} target="_blank" rel="noopener noreferrer"
                                          style={{ background: "rgba(16,185,129,0.15)", color: "#34d399", border: "1px solid rgba(16,185,129,0.3)", borderRadius: 8, padding: "5px 12px", fontSize: "0.78rem", fontWeight: 700, cursor: "pointer", textDecoration: "none" }}>
                                          🧾 Invoice PDF
                                        </a>
                                      )}
                                    </div>
                                  </div>
                                  {bUrls.length > 0 && (
                                    <div style={{ marginBottom: aUrls.length > 0 ? 12 : 0 }}>
                                      <div style={{ fontSize: "0.68rem", fontWeight: 700, color: "rgba(255,255,255,0.3)", textTransform: "uppercase" as const, letterSpacing: "0.08em", marginBottom: 6 }}>Before ({bUrls.length})</div>
                                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(80px, 1fr))", gap: 6 }}>
                                        {bUrls.map((url: string, i: number) => (
                                          <div key={i} style={{ position: "relative" as const, borderRadius: 8, overflow: "hidden", aspectRatio: "1", background: "rgba(255,255,255,0.05)" }}>
                                            <img src={url} loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover" as const, display: "block", cursor: "pointer" }} onClick={() => window.open(fullSize(url), "_blank")} />
                                            <button onClick={() => dlPhoto(url, `before_${i+1}`)} style={{ position: "absolute" as const, bottom: 3, right: 3, background: "rgba(0,0,0,0.65)", border: "none", borderRadius: 5, width: 22, height: 22, cursor: "pointer", color: "#fff", fontSize: "0.65rem", display: "flex", alignItems: "center", justifyContent: "center" }}>⬇</button>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                  {aUrls.length > 0 && (
                                    <div>
                                      <div style={{ fontSize: "0.68rem", fontWeight: 700, color: "rgba(255,255,255,0.3)", textTransform: "uppercase" as const, letterSpacing: "0.08em", marginBottom: 6 }}>After ({aUrls.length})</div>
                                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(80px, 1fr))", gap: 6 }}>
                                        {aUrls.map((url: string, i: number) => (
                                          <div key={i} style={{ position: "relative" as const, borderRadius: 8, overflow: "hidden", aspectRatio: "1", background: "rgba(255,255,255,0.05)" }}>
                                            <img src={url} loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover" as const, display: "block", cursor: "pointer" }} onClick={() => window.open(fullSize(url), "_blank")} />
                                            <button onClick={() => dlPhoto(url, `after_${i+1}`)} style={{ position: "absolute" as const, bottom: 3, right: 3, background: "rgba(0,0,0,0.65)", border: "none", borderRadius: 5, width: 22, height: 22, cursor: "pointer", color: "#fff", fontSize: "0.65rem", display: "flex", alignItems: "center", justifyContent: "center" }}>⬇</button>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                  {bUrls.length + aUrls.length === 0 && !b.invoiceLink && (
                                    <div style={{ fontSize: "0.82rem", color: "rgba(255,255,255,0.35)" }}>No photos uploaded yet for this job.</div>
                                  )}
                                </div>
                              );
                            })()}
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}

                {/* Invoices tab */}
                {adminTab === "invoices" && (
                  <>
                    {pendingInvoices.length > 0 && (
                      <>
                        <div style={{ fontWeight: 700, color: "#fbbf24", fontSize: "0.85rem", textTransform: "uppercase" as const, letterSpacing: "0.04em", marginBottom: 10 }}>Pending Review — Not Visible to Client</div>
                        <div style={{ display: "grid", gap: 10, marginBottom: 24 }}>
                        {pendingInvoices.map((b, i) => (
                            <div key={i} style={{ background: "rgba(255,255,255,0.05)", border: "1px solid #fde68a", borderRadius: 14, padding: 16 }}>
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap" as const, gap: 8, marginBottom: editingInvoiceRow === b.rowIndex ? 14 : 0 }}>
                                <div>
                                  <div style={{ fontWeight: 700, color: "#f1f5f9" }}>{b.name} — {formatDateLabel(b.date)}</div>
                                  <div style={{ fontSize: "0.85rem", color: "rgba(255,255,255,0.45)" }}>{b.email}</div>
                                  {b.invoiceNote && editingInvoiceRow !== b.rowIndex && <div style={{ fontSize: "0.82rem", color: "rgba(255,255,255,0.35)", marginTop: 2 }}>{b.invoiceNote}</div>}
                                </div>
                                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" as const }}>
                                  <span style={{ fontWeight: 800, color: "#fbbf24", fontSize: "1.1rem" }}>${b.invoiceAmount}</span>
                                  <button
                                    onClick={() => {
                                      if (editingInvoiceRow === b.rowIndex) { setEditingInvoiceRow(null); }
                                      else { setEditingInvoiceRow(b.rowIndex); setEditInvoiceAmount(b.invoiceAmount || ""); setEditInvoiceNote(b.invoiceNote || ""); }
                                    }}
                                    style={{ background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.7)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 8, padding: "6px 12px", fontWeight: 600, fontSize: "0.82rem", cursor: "pointer" }}>
                                    {editingInvoiceRow === b.rowIndex ? "Cancel Edit" : "✏ Edit"}
                                  </button>
                                  <button onClick={() => handleReleaseInvoice(b)} disabled={processingRows.has(b.rowIndex) || editingInvoiceRow === b.rowIndex}
                                    style={{ background: "linear-gradient(135deg, #3b82f6, #1d4ed8)", color: "#fff", border: "none", borderRadius: 8, padding: "6px 14px", fontWeight: 600, fontSize: "0.82rem", cursor: "pointer", opacity: processingRows.has(b.rowIndex) || editingInvoiceRow === b.rowIndex ? 0.4 : 1 }}>
                                    {processingRows.has(b.rowIndex) ? "Processing..." : "Release to Client"}
                                  </button>
                                </div>
                              </div>

                              {/* Inline edit form */}
                              {editingInvoiceRow === b.rowIndex && (
                                <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, padding: 14 }}>
                                  <div style={{ fontSize: "0.78rem", color: "#fbbf24", fontWeight: 700, marginBottom: 10, textTransform: "uppercase" as const, letterSpacing: "0.06em" }}>Edit Invoice</div>
                                  <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 10, marginBottom: 12 }}>
                                    <div>
                                      <div style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.45)", marginBottom: 4 }}>Amount ($)</div>
                                      <input
                                        type="number"
                                        inputMode="decimal"
                                        step="0.01"
                                        style={{ ...S.input, padding: "10px 12px", fontSize: "1rem", fontWeight: 700 }}
                                        value={editInvoiceAmount}
                                        onChange={e => setEditInvoiceAmount(e.target.value)}
                                        autoFocus
                                      />
                                    </div>
                                    <div>
                                      <div style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.45)", marginBottom: 4 }}>Note (optional)</div>
                                      <input
                                        style={{ ...S.input, padding: "10px 12px" }}
                                        placeholder="e.g. 2.5 hrs at $80/hr"
                                        value={editInvoiceNote}
                                        onChange={e => setEditInvoiceNote(e.target.value)}
                                      />
                                    </div>
                                  </div>
                                  <button
                                    disabled={!editInvoiceAmount || processingRows.has(b.rowIndex)}
                                    onClick={async () => {
                                      const tid = showToast("Saving invoice...", "loading");
                                      try {
                                        const ok = await updateBooking(b.rowIndex, { invoiceAmount: editInvoiceAmount, invoiceNote: editInvoiceNote });
                                        if (ok) {
                                          setAdminBookings(prev => prev.map(bk => bk.rowIndex === b.rowIndex ? { ...bk, invoiceAmount: editInvoiceAmount, invoiceNote: editInvoiceNote } : bk));
                                          setEditingInvoiceRow(null);
                                          updateToast(tid, `✓ Invoice updated to $${editInvoiceAmount}`, "success", 3000);
                                        } else { updateToast(tid, "Failed to update invoice", "error", 3000); }
                                      } catch { updateToast(tid, "Error saving invoice", "error", 3000); }
                                    }}
                                    style={{ background: "#059669", color: "#fff", border: "none", borderRadius: 8, padding: "9px 18px", fontWeight: 700, fontSize: "0.88rem", cursor: "pointer", opacity: !editInvoiceAmount ? 0.5 : 1 }}>
                                    Save Changes
                                  </button>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </>
                    )}

                    {releasedInvoices.length > 0 && (
                      <>
                        <div style={{ fontWeight: 700, color: "rgba(255,255,255,0.7)", fontSize: "0.85rem", textTransform: "uppercase" as const, letterSpacing: "0.04em", marginBottom: 10 }}>Sent to Client — Awaiting Payment</div>
                        <div style={{ display: "grid", gap: 10, marginBottom: 24 }}>
                          {releasedInvoices.map((b, i) => (
                            <div key={i} style={{ background: "rgba(255,255,255,0.05)", border: "1px solid #fde047", borderRadius: 14, padding: 16 }}>
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap" as const, gap: 8 }}>
                                <div>
                                  <div style={{ fontWeight: 700, color: "#f1f5f9" }}>{b.name} — {formatDateLabel(b.date)}</div>
                                  <div style={{ fontSize: "0.85rem", color: "rgba(255,255,255,0.45)" }}>{b.email}</div>
                                  {b.invoiceNote && <div style={{ fontSize: "0.85rem", color: "rgba(255,255,255,0.35)" }}>{b.invoiceNote}</div>}
                                </div>
                                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                  <span style={{ fontWeight: 800, color: "#fbbf24", fontSize: "1.1rem" }}>${b.invoiceAmount}</span>
                                  <button onClick={() => handleMarkPaid(b)} disabled={processingRows.has(b.rowIndex)} style={{ background: "#059669", color: "#fff", border: "none", borderRadius: 8, padding: "7px 14px", fontWeight: 600, fontSize: "0.82rem", cursor: "pointer", opacity: processingRows.has(b.rowIndex) ? 0.5 : 1 }}>{processingRows.has(b.rowIndex) ? "Processing..." : "Mark Paid"}</button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </>
                    )}

                    {paidInvoices.length > 0 && (
                      <>
                        <div style={{ fontWeight: 700, color: "rgba(255,255,255,0.35)", fontSize: "0.85rem", textTransform: "uppercase" as const, letterSpacing: "0.04em", marginBottom: 10 }}>Paid</div>
                        <div style={{ display: "grid", gap: 10 }}>
                          {paidInvoices.map((b, i) => (
                            <div key={i} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: 14 }}>
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <div>
                                  <div style={{ fontWeight: 600, color: "rgba(255,255,255,0.7)" }}>{b.name} — {formatDateLabel(b.date)}</div>
                                  <div style={{ fontSize: "0.82rem", color: "rgba(255,255,255,0.35)" }}>{b.email}</div>
                                </div>
                                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                  <span style={{ fontWeight: 700, color: "rgba(255,255,255,0.7)" }}>${b.invoiceAmount}</span>
                                  <span style={{ background: "rgba(16,185,129,0.15)", color: "#34d399", fontSize: "0.72rem", fontWeight: 700, borderRadius: 999, padding: "2px 8px" }}>PAID</span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </>
                    )}

                    {pendingInvoices.length === 0 && releasedInvoices.length === 0 && paidInvoices.length === 0 && (
                      <div style={{ textAlign: "center", padding: 40, color: "rgba(255,255,255,0.45)" }}>No invoices yet. Mark a service complete to create one.</div>
                    )}
                  </>
                )}

                {/* ── REVENUE TAB ── */}
                {adminTab === "revenue" && (() => {
                  const paid = adminBookings.filter(b => b.invoiceStatus === "paid" && b.invoiceAmount);
                  const upcoming = adminBookings.filter(b => b.status === "Booked" && isUpcoming(b.date));
                  const now = new Date();
                  const thisMonth = now.getMonth();
                  const thisYear = now.getFullYear();

                  // Group revenue by month
                  const monthlyData: Record<string, number> = {};
                  paid.forEach(b => {
                    if (!b.date) return;
                    const [y, m] = b.date.split("-").map(Number);
                    const key = `${y}-${String(m).padStart(2,"0")}`;
                    monthlyData[key] = (monthlyData[key] || 0) + parseFloat(b.invoiceAmount || "0");
                  });

                  const sortedMonths = Object.keys(monthlyData).sort();
                  const last6 = sortedMonths.slice(-6);
                  const maxVal = Math.max(...last6.map(k => monthlyData[k]), 1);

                  const thisMonthKey = `${thisYear}-${String(thisMonth + 1).padStart(2,"0")}`;
                  const lastMonthKey = `${thisMonth === 0 ? thisYear - 1 : thisYear}-${String(thisMonth === 0 ? 12 : thisMonth).padStart(2,"0")}`;
                  const thisMonthRev = monthlyData[thisMonthKey] || 0;
                  const lastMonthRev = monthlyData[lastMonthKey] || 0;
                  const momChange = lastMonthRev > 0 ? ((thisMonthRev - lastMonthRev) / lastMonthRev * 100) : 0;
                  const totalRev = paid.reduce((s, b) => s + parseFloat(b.invoiceAmount || "0"), 0);
                  const avgJob = paid.length > 0 ? totalRev / paid.length : 0;
                  const thisMonthJobs = paid.filter(b => {
                    const [y, m] = (b.date || "").split("-").map(Number);
                    return y === thisYear && m === thisMonth + 1;
                  }).length;

                  // Projected income from upcoming bookings (using hourly rate × avg hours)
                  const projectedIncome = upcoming.reduce((s, b) => {
                    if (b.packageType === "custom") {
                      // Extract flat price from notes: "Custom job: PPF Removal — $575..."
                      const match = (b.notes || "").match(/\$(\d+(\.\d+)?)/);
                      return s + (match ? parseFloat(match[1]) : 0);
                    }
                    const rate = parseFloat(b.hourlyRate || "0");
                    const isMaint = b.clientType === "maintenance";
                    const isBoat = b.vehicle === "boat";
                    const isPartial = b.packageType === "exterior" || b.packageType === "interior" || b.packageType === "exteriorPremium" || b.packageType === "interiorPremium";
                    const hrs = isMaint ? 2 : isBoat ? 4 : isPartial ? 2 : 3;
                    return s + (rate * hrs);
                  }, 0);

                  // Top clients by revenue
                  const clientRev: Record<string, { name: string; email: string; total: number; jobs: number }> = {};
                  paid.forEach(b => {
                    if (!clientRev[b.email]) clientRev[b.email] = { name: b.name, email: b.email, total: 0, jobs: 0 };
                    clientRev[b.email].total += parseFloat(b.invoiceAmount || "0");
                    clientRev[b.email].jobs++;
                  });
                  const topClients = Object.values(clientRev).sort((a, b) => b.total - a.total).slice(0, 5);

                  // Package breakdown
                  const byPkg: Record<string, { count: number; rev: number }> = {};
                  paid.forEach(b => {
                    const pkg = b.packageType === "basic" ? "Basic Detail" : b.packageType === "premium" ? "Premium Detail" : b.packageType === "exterior" ? "Exterior Basic" : b.packageType === "exteriorPremium" ? "Exterior Premium" : b.packageType === "interior" ? "Interior Basic" : b.packageType === "interiorPremium" ? "Interior Premium" : b.packageType || "Other";
                    if (!byPkg[pkg]) byPkg[pkg] = { count: 0, rev: 0 };
                    byPkg[pkg].count++;
                    byPkg[pkg].rev += parseFloat(b.invoiceAmount || "0");
                  });

                  const monthName = (key: string) => {
                    const [y, m] = key.split("-").map(Number);
                    return new Date(y, m - 1).toLocaleDateString("en-US", { month: "short", year: "2-digit" });
                  };

                  return (
                    <>
                      {/* KPI cards */}
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12, marginBottom: 20 }}>
                        {[
                          {
                            label: "This Month",
                            value: `$${thisMonthRev.toFixed(0)}`,
                            sub: lastMonthRev > 0
                              ? `${momChange >= 0 ? "▲" : "▼"} ${Math.abs(momChange).toFixed(0)}% vs last month`
                              : "first month",
                            color: "#059669",
                            subColor: momChange >= 0 ? "#34d399" : "#f87171",
                          },
                          { label: "Jobs This Month", value: String(thisMonthJobs), sub: "completed & paid", color: "#2563eb", subColor: undefined },
                          { label: "All-Time Revenue", value: `$${totalRev.toFixed(0)}`, sub: `${paid.length} jobs total`, color: "#7c3aed", subColor: undefined },
                          { label: "Avg Job Value", value: `$${avgJob.toFixed(0)}`, sub: "per completed job", color: "#d97706", subColor: undefined },
                          { label: "Projected Income", value: `$${projectedIncome.toFixed(0)}`, sub: `${upcoming.length} upcoming booking${upcoming.length !== 1 ? "s" : ""}`, color: "#0891b2", subColor: "#67e8f9" },
                        ].map((card, i) => (
                          <div key={i} style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: "16px 14px" }}>
                            <div style={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.35)", marginBottom: 6, fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: "0.04em" }}>{card.label}</div>
                            <div style={{ fontSize: "1.5rem", fontWeight: 900, color: card.color, letterSpacing: "-1px" }}>{card.value}</div>
                            <div style={{ fontSize: "0.72rem", color: card.subColor || "rgba(255,255,255,0.35)", marginTop: 4 }}>{card.sub}</div>
                          </div>
                        ))}
                      </div>

                      {/* Bar chart */}
                      {last6.length > 0 ? (
                        <div style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 20, marginBottom: 16 }}>
                          <div style={{ fontWeight: 700, color: "#f1f5f9", marginBottom: 16, fontSize: "0.95rem" }}>Revenue — Last 6 Months</div>
                          <svg width="100%" height="160" viewBox={`0 0 ${last6.length * 80} 160`} preserveAspectRatio="none" style={{ overflow: "visible" }}>
                            {last6.map((k, i) => {
                              const barH = Math.max((monthlyData[k] / maxVal) * 110, 6);
                              const x = i * 80 + 10;
                              const barW = 52;
                              const isThis = k === thisMonthKey;
                              const yTop = 120 - barH;
                              const label = monthlyData[k] >= 1000 ? `$${(monthlyData[k]/1000).toFixed(1)}k` : `$${monthlyData[k].toFixed(0)}`;
                              return (
                                <g key={k}>
                                  {/* Bar */}
                                  <rect x={x} y={yTop} width={barW} height={barH} rx={6}
                                    fill={isThis ? "url(#barGrad)" : "rgba(16,185,129,0.25)"}
                                    style={{ filter: isThis ? "drop-shadow(0 0 8px rgba(5,150,105,0.5))" : "none" }}
                                  />
                                  {/* Amount label above bar */}
                                  <text x={x + barW / 2} y={yTop - 6} textAnchor="middle" fontSize="10" fill="rgba(255,255,255,0.5)" fontFamily="Outfit,sans-serif" fontWeight="600">{label}</text>
                                  {/* Month label below */}
                                  <text x={x + barW / 2} y={148} textAnchor="middle" fontSize="10"
                                    fill={isThis ? "#34d399" : "rgba(255,255,255,0.3)"}
                                    fontFamily="Outfit,sans-serif" fontWeight={isThis ? "700" : "400"}>
                                    {monthName(k)}
                                  </text>
                                </g>
                              );
                            })}
                            {/* Baseline */}
                            <line x1="0" y1="121" x2={last6.length * 80} y2="121" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
                            <defs>
                              <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#10b981" />
                                <stop offset="100%" stopColor="#047857" />
                              </linearGradient>
                            </defs>
                          </svg>
                        </div>
                      ) : (
                        <div style={{ textAlign: "center", padding: 40, color: "rgba(255,255,255,0.45)" }}>No paid invoices yet.</div>
                      )}

                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16, marginBottom: 0 }}>

                        {/* Top clients */}
                        {topClients.length > 0 && (
                          <div style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 20 }}>
                            <div style={{ fontWeight: 700, color: "#f1f5f9", marginBottom: 14, fontSize: "0.95rem" }}>Top Clients by Revenue</div>
                            {topClients.map((c, i) => {
                              const barPct = topClients[0].total > 0 ? (c.total / topClients[0].total) * 100 : 0;
                              const medals = ["🥇","🥈","🥉","4.","5."];
                              return (
                                <div key={i} style={{ marginBottom: i < topClients.length - 1 ? 14 : 0 }}>
                                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                      <span style={{ fontSize: "0.9rem" }}>{medals[i]}</span>
                                      <div>
                                        <div style={{ fontWeight: 700, color: "#f1f5f9", fontSize: "0.88rem" }}>{c.name}</div>
                                        <div style={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.35)" }}>{c.jobs} job{c.jobs !== 1 ? "s" : ""}</div>
                                      </div>
                                    </div>
                                    <div style={{ fontWeight: 800, color: "#34d399", fontSize: "0.95rem" }}>${c.total.toFixed(0)}</div>
                                  </div>
                                  <div style={{ height: 4, background: "rgba(255,255,255,0.06)", borderRadius: 999, overflow: "hidden" }}>
                                    <div style={{ height: "100%", width: `${barPct}%`, background: i === 0 ? "linear-gradient(90deg,#059669,#34d399)" : "rgba(16,185,129,0.4)", borderRadius: 999, transition: "width 0.5s ease" }} />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* Package breakdown */}
                        {paid.length > 0 && (
                          <div style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 20 }}>
                            <div style={{ fontWeight: 700, color: "#f1f5f9", marginBottom: 14, fontSize: "0.95rem" }}>Revenue by Service</div>
                            {Object.entries(byPkg).sort((a, b) => b[1].rev - a[1].rev).map(([pkg, data], i) => {
                              const maxPkg = Math.max(...Object.values(byPkg).map(v => v.rev));
                              const pct = maxPkg > 0 ? (data.rev / maxPkg) * 100 : 0;
                              return (
                                <div key={i} style={{ marginBottom: i < Object.keys(byPkg).length - 1 ? 12 : 0 }}>
                                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                                    <div>
                                      <div style={{ fontSize: "0.85rem", fontWeight: 600, color: "rgba(255,255,255,0.7)" }}>{pkg}</div>
                                      <div style={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.35)" }}>{data.count} job{data.count !== 1 ? "s" : ""}</div>
                                    </div>
                                    <div style={{ fontWeight: 800, color: "#3b82f6" }}>${data.rev.toFixed(0)}</div>
                                  </div>
                                  <div style={{ height: 4, background: "rgba(255,255,255,0.06)", borderRadius: 999, overflow: "hidden" }}>
                                    <div style={{ height: "100%", width: `${pct}%`, background: "linear-gradient(90deg,#3b82f6,#60a5fa)", borderRadius: 999, transition: "width 0.5s ease" }} />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* Projected income breakdown */}
                        {upcoming.length > 0 && (
                          <div style={{ background: "rgba(8,145,178,0.08)", border: "1px solid rgba(8,145,178,0.3)", borderRadius: 16, padding: 20, gridColumn: "1 / -1" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                              <div style={{ fontWeight: 700, color: "#67e8f9", fontSize: "0.95rem" }}>Projected Income from Upcoming Bookings</div>
                              <div style={{ fontWeight: 900, color: "#0891b2", fontSize: "1.3rem" }}>${projectedIncome.toFixed(0)}</div>
                            </div>
                            <div style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.35)", marginBottom: 12 }}>Based on hourly rate × estimated hours (2hr maintenance, 3hr auto, 4hr boat). Actual may vary.</div>
                            <div style={{ display: "grid", gap: 6 }}>
                              {upcoming.slice(0, 8).map((b, i) => {
                                const isCustom = b.packageType === "custom";
                                let est = 0;
                                if (isCustom) {
                                  const match = (b.notes || "").match(/\$(\d+(\.\d+)?)/);
                                  est = match ? parseFloat(match[1]) : 0;
                                } else {
                                  const rate = parseFloat(b.hourlyRate || "0");
                                  const isMaint = b.clientType === "maintenance";
                                  const isBoat = b.vehicle === "boat";
                                  const isPartial = b.packageType === "exterior" || b.packageType === "interior" || b.packageType === "exteriorPremium" || b.packageType === "interiorPremium";
                                  const hrs = isMaint ? 2 : isBoat ? 4 : isPartial ? 2 : 3;
                                  est = rate * hrs;
                                }
                                const vl = b.vehicle === "boat" ? [b.boatSize, b.make, b.model].filter(Boolean).join(" ") : [b.year, b.make, b.model].filter(Boolean).join(" ");
                                return (
                                  <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: isCustom ? "rgba(124,58,237,0.08)" : "rgba(255,255,255,0.04)", borderRadius: 10, padding: "8px 12px", fontSize: "0.82rem", border: isCustom ? "1px solid rgba(124,58,237,0.25)" : "none" }}>
                                    <div>
                                      <span style={{ fontWeight: 600, color: "#f1f5f9" }}>{b.name}</span>
                                      <span style={{ color: "rgba(255,255,255,0.4)", margin: "0 6px" }}>·</span>
                                      <span style={{ color: "rgba(255,255,255,0.4)" }}>{formatDateLabel(b.date)}</span>
                                    </div>
                                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                      <span style={{ color: isCustom ? "#a78bfa" : "rgba(255,255,255,0.35)", fontSize: "0.75rem" }}>
                                        {isCustom ? `⚡ ${b.addOns || "Custom Job"}` : vl}
                                      </span>
                                      <span style={{ fontWeight: 700, color: "#67e8f9" }}>${est.toFixed(0)}</span>
                                    </div>
                                  </div>
                                );
                              })}
                              {upcoming.length > 8 && (
                                <div style={{ fontSize: "0.78rem", color: "rgba(255,255,255,0.35)", textAlign: "center" as const, padding: "4px 0" }}>+{upcoming.length - 8} more upcoming bookings</div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </>
                  );
                })()}

                {/* ── AVAILABILITY TAB ── */}
                {adminTab === "availability" && (
                  <>
                    {availLoading ? (
                      <div style={{ textAlign: "center", padding: 40, color: "rgba(255,255,255,0.45)" }}>Loading slots...</div>
                    ) : (
                      <>
                        {/* Add new slot */}
                        <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: 16, marginBottom: 20 }}>
                          <div style={{ fontWeight: 700, color: "rgba(255,255,255,0.7)", marginBottom: 12, fontSize: "0.9rem" }}>Add New Slot</div>
                          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" as const, alignItems: "flex-end" }}>
                            <div>
                              <div style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.45)", marginBottom: 4 }}>Date</div>
                              <input type="date" value={newSlotDate} onChange={e => setNewSlotDate(e.target.value)}
                                style={{ ...S.input, padding: "8px 12px", width: "auto" }} />
                            </div>
                            <div>
                              <div style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.45)", marginBottom: 4 }}>Time</div>
                              <select value={newSlotTime} onChange={e => setNewSlotTime(e.target.value)}
                                style={{ ...S.input, padding: "8px 12px", width: "auto", backgroundColor: "transparent" }}>
                                <option value="">Select time</option>
                                {["8:00 AM","9:00 AM","10:00 AM","11:00 AM","12:00 PM","1:00 PM","2:00 PM","3:00 PM","4:00 PM","4:30 PM","5:00 PM","6:00 PM"].map(t => (
                                  <option key={t} value={t}>{t}</option>
                                ))}
                              </select>
                            </div>
                            <button disabled={!newSlotDate || !newSlotTime || addingSlot}
                              onClick={async () => {
                                setAddingSlot(true);
                                try {
                                  const res = await fetch(SCRIPT_URL, { method: "POST", body: JSON.stringify({ action: "addAvailabilitySlot", date: newSlotDate, time: newSlotTime }) });
                                  const d = await res.json();
                                  if (d.success) {
                                    setAvailSlots(prev => [...prev, { date: newSlotDate, time: newSlotTime, available: "TRUE" }].sort((a,b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time)));
                                    setNewSlotDate(""); setNewSlotTime("");
                                  } else alert("Failed to add slot");
                                } catch { alert("Error adding slot"); }
                                setAddingSlot(false);
                              }}
                              style={{ background: "linear-gradient(135deg, #3b82f6, #1d4ed8)", color: "#fff", border: "none", borderRadius: 10, padding: "9px 18px", fontWeight: 700, fontSize: "0.88rem", cursor: "pointer", opacity: !newSlotDate || !newSlotTime ? 0.4 : 1, boxShadow: "0 4px 16px rgba(59,130,246,0.3)" }}>
                              {addingSlot ? "Adding..." : "+ Add Slot"}
                            </button>
                          </div>
                        </div>

                        {/* Slot list grouped by date */}
                        {(() => {
                          const grouped: Record<string, typeof availSlots> = {};
                          availSlots.forEach(s => {
                            if (!grouped[s.date]) grouped[s.date] = [];
                            grouped[s.date].push(s);
                          });
                          const sortedDates = Object.keys(grouped).sort();
                          const upcoming = sortedDates.filter(d => {
                            const [y,m,day] = d.split("-").map(Number);
                            return new Date(y,m-1,day) >= new Date(new Date().setHours(0,0,0,0));
                          });
                          return upcoming.length === 0 ? (
                            <div style={{ textAlign: "center", padding: 40, color: "rgba(255,255,255,0.45)" }}>No upcoming slots.</div>
                          ) : upcoming.map(date => (
                            <div key={date} style={{ marginBottom: 16 }}>
                              <div style={{ fontSize: "0.82rem", fontWeight: 700, color: "rgba(255,255,255,0.7)", marginBottom: 8, textTransform: "uppercase" as const, letterSpacing: "0.04em" }}>
                                {formatDateLabel(date)}
                              </div>
                              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" as const }}>
                                {grouped[date].map((slot, i) => {
                                  const isOpen = slot.available === "TRUE";
                                  return (
                                    <button key={i}
                                      onClick={async () => {
                                        const newAvail = isOpen ? "FALSE" : "TRUE";
                                        try {
                                          const res = await fetch(SCRIPT_URL, { method: "POST", body: JSON.stringify({ action: "toggleAvailabilitySlot", date: slot.date, time: slot.time, available: newAvail }) });
                                          const d = await res.json();
                                          if (d.success) {
                                            setAvailSlots(prev => prev.map(s => s.date === slot.date && s.time === slot.time ? { ...s, available: newAvail } : s));
                                          }
                                        } catch { alert("Error toggling slot"); }
                                      }}
                                      style={{ background: isOpen ? "#ecfdf5" : "rgba(239,68,68,0.12)", color: isOpen ? "#059669" : "#dc2626", border: `1.5px solid ${isOpen ? "#6ee7b7" : "#fca5a5"}`, borderRadius: 10, padding: "7px 14px", fontSize: "0.85rem", fontWeight: 700, cursor: "pointer" }}>
                                      {slot.time} {isOpen ? "✓" : "✗"}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          ));
                        })()}
                      </>
                    )}
                  </>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  // REQUEST A CHANGE VIEW
  if (view === "requestChange" && changeTarget) {
    const vl = changeTarget.vehicle === "boat"
      ? [changeTarget.boatSize, changeTarget.make, changeTarget.model].filter(Boolean).join(" ")
      : [changeTarget.year, changeTarget.make, changeTarget.model].filter(Boolean).join(" ");

    return (
      <div style={S.page}>

      {/* Animated background */}
      <div className="atx-bg">
        <div className="atx-grid" />
        <div className="atx-orb atx-orb-1" />
        <div className="atx-orb atx-orb-2" />
        <div className="atx-orb atx-orb-3" />
      </div>
        <div style={S.container}>
          <Header />
          <div style={S.card} key={step}>
            <button onClick={() => setView("myBookings")} style={{ ...S.secondary, padding: "9px 14px", fontSize: "0.9rem", marginBottom: 20 }}>Back to My Bookings</button>
            {changeSubmitted ? (
              <div style={S.successWrap}>
                <h2 style={S.title}>Request Sent</h2>
                <p style={S.successText}>Your request has been sent. Someone will reach out to confirm the changes.</p>
                <button onClick={() => { setView("myBookings"); loadMyBookings(); }} style={S.primary}>Back to My Bookings</button>
              </div>
            ) : (
              <>
                <h2 style={S.title}>Request a Change</h2>
                <p style={S.subtitle}>Let us know what you'd like to change about this appointment.</p>
                <div style={{ ...S.summaryCard, marginBottom: 24, background: "rgba(255,255,255,0.04)" }}>
                  <div style={S.summaryHeading}>Appointment</div>
                  <div style={S.summaryValue}>
                    {formatDateLabel(changeTarget.date)}{changeTarget.time ? ` at ${changeTarget.time}` : ""}<br />
                    {vl}<br />
                    {changeTarget.packageType === "basic" ? "Basic Detail" : changeTarget.packageType === "premium" ? "Premium Detail" : changeTarget.packageType}
                  </div>
                </div>
                <div style={{ maxWidth: 560, margin: "0 auto" }}>
                  <div style={S.sectionLabel}>What would you like to change?</div>
                  <textarea
                    style={{ ...S.input, marginTop: 10, minHeight: 130, resize: "vertical" as const, fontFamily: "inherit", lineHeight: 1.5 }}
                    placeholder="Describe what you'd like to change, such as a different date, time, or service update."
                    value={changeNote} onChange={(e) => setChangeNote(e.target.value)}
                  />
                </div>
                <div style={{ ...S.buttonRow, maxWidth: 560, margin: "20px auto 0" }}>
                  <button style={S.secondary} onClick={() => setView("myBookings")}>Cancel</button>
                  <button style={{ ...S.primary, ...(!changeNote.trim() || changeSubmitting ? S.disabled : {}) }}
                    onClick={submitChangeRequest} disabled={!changeNote.trim() || changeSubmitting}>
                    {changeSubmitting ? "Sending..." : "Send Request"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── INVENTORY VIEW ──────────────────────────────────────────────────────────
  if (view === "inventory" && googleUser?.email === ADMIN_EMAIL) {
    const CATEGORIES = ["All", "Microfiber & Towels", "Polishing Pads", "Compounds & Polishes", "Chemicals & Cleaners", "Ceramic Coatings", "Tools & Equipment", "Brushes & Applicators", "Sandpaper & Abrasives", "Accessories & Misc"];

    const isLowStock = (item: { quantity: string; lowStockThreshold: string }) => {
      const qty = parseFloat(item.quantity);
      const threshold = parseFloat(item.lowStockThreshold);
      if (isNaN(qty) || isNaN(threshold) || threshold <= 0) return false; // threshold 0 = no warning
      if (qty <= 0) return false; // that's outOfStock, not low
      return qty <= threshold;
    };

    const isOutOfStock = (item: { quantity: string }) => {
      const qty = parseFloat(item.quantity);
      return !isNaN(qty) && qty <= 0;
    };

    const filtered = inventoryItems.filter(item => {
      const matchCat = invCatFilter === "All" || item.category === invCatFilter;
      const matchSearch = !inventorySearch || item.item.toLowerCase().includes(inventorySearch.toLowerCase()) || item.category.toLowerCase().includes(inventorySearch.toLowerCase());
      const matchLow = inventoryFilter === "all" || isLowStock(item) || isOutOfStock(item);
      return matchCat && matchSearch && matchLow;
    });

    const grouped: Record<string, typeof filtered> = {};
    filtered.forEach(item => {
      const cat = item.category || "Uncategorized";
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(item);
    });

    const lowStockItems = inventoryItems.filter(i => isLowStock(i) || isOutOfStock(i));

    const stockColor = (item: { quantity: string; lowStockThreshold: string }) => {
      if (isOutOfStock(item)) return { bg: "rgba(239,68,68,0.12)", border: "rgba(239,68,68,0.4)", badge: "#f87171", badgeBg: "rgba(239,68,68,0.15)", label: "OUT" };
      if (isLowStock(item))   return { bg: "rgba(234,179,8,0.1)", border: "rgba(234,179,8,0.45)", badge: "#fbbf24", badgeBg: "rgba(234,179,8,0.15)", label: "LOW" };
      return { bg: "rgba(255,255,255,0.03)", border: "rgba(255,255,255,0.08)", badge: "#34d399", badgeBg: "rgba(16,185,129,0.1)", label: "OK" };
    };

    return (
      <div style={S.page}>

      {/* Animated background */}
      <div className="atx-bg">
        <div className="atx-grid" />
        <div className="atx-orb atx-orb-1" />
        <div className="atx-orb atx-orb-2" />
        <div className="atx-orb atx-orb-3" />
      </div>
        <div style={S.container}>
          <Header />
          <div style={S.card}>
            {/* Header row */}
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20, flexWrap: "wrap" as const }}>
              <button onClick={() => setView("booking")} style={{ ...S.secondary, padding: "9px 14px", fontSize: "0.9rem" }}>Back</button>
              <h2 style={{ ...S.title, margin: 0, fontSize: "1.8rem" }}>Inventory</h2>
              <button
                onClick={() => { loadInventory(); }}
                style={{ ...S.secondary, marginLeft: "auto", padding: "9px 14px", fontSize: "0.9rem" }}>
                {inventoryLoading ? "Loading..." : "Refresh"}
              </button>
              <button
                onClick={() => { setAddingInventoryItem(true); }}
                style={{ ...S.primary, padding: "9px 16px", fontSize: "0.9rem" }}>
                + Add Item
              </button>
            </div>

            {/* Low stock alert banner — clean table layout */}
            {(() => {
              const outItems  = lowStockItems.filter(i => isOutOfStock(i));
              const lowItems  = lowStockItems.filter(i => !isOutOfStock(i));
              if (lowStockItems.length === 0) return null;
              return (
                <div style={{ background: "rgba(251,191,36,0.08)", border: "1.5px solid #fcd34d", borderRadius: 14, padding: "16px 18px", marginBottom: 20 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap" as const, gap: 8 }}>
                    <div style={{ fontWeight: 700, color: "#fbbf24", fontSize: "0.95rem" }}>
                      ⚠ Restock Needed
                    </div>
                    <button
                      onClick={() => setInventoryFilter("low")}
                      style={{ background: "#f59e0b", color: "#fff", border: "none", borderRadius: 8, padding: "5px 12px", fontSize: "0.78rem", fontWeight: 700, cursor: "pointer" }}>
                      View All {lowStockItems.length} Items
                    </button>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: outItems.length > 0 && lowItems.length > 0 ? "1fr 1fr" : "1fr", gap: 12 }}>
                    {outItems.length > 0 && (
                      <div>
                        <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "#dc2626", textTransform: "uppercase" as const, letterSpacing: "0.06em", marginBottom: 6 }}>
                          Out of Stock ({outItems.length})
                        </div>
                        {outItems.map((item, i) => (
                          <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "5px 0", borderTop: i > 0 ? "1px solid #fee2e2" : "none" }}>
                            <span style={{ fontSize: "0.82rem", color: "#fca5a5", fontWeight: 500 }}>{item.item}</span>
                            <span style={{ background: "rgba(239,68,68,0.1)", color: "#dc2626", border: "1px solid #fca5a5", borderRadius: 999, padding: "1px 8px", fontSize: "0.7rem", fontWeight: 700, whiteSpace: "nowrap" as const, marginLeft: 8 }}>OUT</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {lowItems.length > 0 && (
                      <div>
                        <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "#d97706", textTransform: "uppercase" as const, letterSpacing: "0.06em", marginBottom: 6 }}>
                          Running Low ({lowItems.length})
                        </div>
                        {lowItems.slice(0, 8).map((item, i) => (
                          <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "5px 0", borderTop: i > 0 ? "1px solid #fef3c7" : "none" }}>
                            <span style={{ fontSize: "0.82rem", color: "#fcd34d", fontWeight: 500 }}>{item.item}</span>
                            <span style={{ fontSize: "0.78rem", color: "#f59e0b", fontWeight: 700, whiteSpace: "nowrap" as const, marginLeft: 8 }}>{item.quantity} {item.unit}</span>
                          </div>
                        ))}
                        {lowItems.length > 8 && (
                          <div style={{ fontSize: "0.75rem", color: "#f59e0b", marginTop: 6 }}>+{lowItems.length - 8} more — tap "View All" above</div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* Search + filters */}
            <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" as const, alignItems: "center" }}>
              <input
                style={{ ...S.input, flex: 1, minWidth: 180, padding: "9px 14px", fontSize: "0.9rem" }}
                placeholder="Search items..."
                value={inventorySearch}
                onChange={e => setInventorySearch(e.target.value)}
              />
              <div style={{ display: "flex", gap: 6 }}>
                {(["all", "low"] as const).map(f => (
                  <button key={f} onClick={() => setInventoryFilter(f)}
                    style={{ background: inventoryFilter === f ? "#111827" : "rgba(255,255,255,0.08)", color: inventoryFilter === f ? "#fff" : "#374151", border: "none", borderRadius: 999, padding: "7px 14px", fontSize: "0.82rem", fontWeight: 600, cursor: "pointer" }}>
                    {f === "all" ? "All Items" : "⚠ Low / Out"}
                  </button>
                ))}
              </div>
            </div>

            {/* Category filter pills */}
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" as const, marginBottom: 20 }}>
              {CATEGORIES.map(cat => (
                <button key={cat} onClick={() => setInvCatFilter(cat)}
                  style={{ background: invCatFilter === cat ? "#7c3aed" : "rgba(255,255,255,0.08)", color: invCatFilter === cat ? "#fff" : "#374151", border: "none", borderRadius: 999, padding: "5px 12px", fontSize: "0.78rem", fontWeight: 600, cursor: "pointer" }}>
                  {cat}
                </button>
              ))}
            </div>

            {/* Add item modal */}
            {addingInventoryItem && (
              <div style={{ position: "fixed" as const, inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 16 }}>
                <div style={{ background: "rgba(255,255,255,0.05)", borderRadius: 20, padding: 28, maxWidth: 560, width: "100%", boxShadow: "0 20px 60px rgba(0,0,0,0.2)", maxHeight: "90vh", overflowY: "auto" as const }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                    <div style={{ fontWeight: 800, color: "#f1f5f9", fontSize: "1.1rem" }}>Add New Item</div>
                    <button onClick={() => { setAddingInventoryItem(false); setNewInventoryItem({ item: "", category: "", quantity: "", unit: "", lowStockThreshold: "", notes: "" }); }}
                      style={{ background: "rgba(255,255,255,0.06)", border: "none", borderRadius: 8, width: 32, height: 32, cursor: "pointer", fontSize: "1rem", color: "rgba(255,255,255,0.7)", fontWeight: 700 }}>✕</button>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
                    <div style={{ gridColumn: "1 / -1" }}>
                      <div style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.45)", marginBottom: 4, fontWeight: 600 }}>Item Name *</div>
                      <input style={{ ...S.input, padding: "10px 12px" }} placeholder="e.g. Rupes Blue Foam Pad" value={newInventoryItem.item} onChange={e => setNewInventoryItem(prev => ({ ...prev, item: e.target.value }))} autoFocus />
                    </div>
                    <div>
                      <div style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.45)", marginBottom: 4, fontWeight: 600 }}>Category</div>
                      <select style={{ ...S.input, padding: "10px 12px", backgroundColor: "transparent" }} value={newInventoryItem.category} onChange={e => setNewInventoryItem(prev => ({ ...prev, category: e.target.value }))}>
                        <option value="">Select category</option>
                        {CATEGORIES.filter(c => c !== "All").map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div>
                      <div style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.45)", marginBottom: 4, fontWeight: 600 }}>Unit</div>
                      <input style={{ ...S.input, padding: "10px 12px" }} placeholder="e.g. each, pack, gallon" value={newInventoryItem.unit} onChange={e => setNewInventoryItem(prev => ({ ...prev, unit: e.target.value }))} />
                    </div>
                    <div>
                      <div style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.45)", marginBottom: 4, fontWeight: 600 }}>Quantity *</div>
                      <input style={{ ...S.input, padding: "10px 12px" }} type="number" step="0.25" placeholder="e.g. 2" value={newInventoryItem.quantity} onChange={e => setNewInventoryItem(prev => ({ ...prev, quantity: e.target.value }))} />
                    </div>
                    <div>
                      <div style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.45)", marginBottom: 4, fontWeight: 600 }}>Low Stock Alert At</div>
                      <input style={{ ...S.input, padding: "10px 12px" }} type="number" step="0.25" placeholder="e.g. 1" value={newInventoryItem.lowStockThreshold} onChange={e => setNewInventoryItem(prev => ({ ...prev, lowStockThreshold: e.target.value }))} />
                    </div>
                    <div style={{ gridColumn: "1 / -1" }}>
                      <div style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.45)", marginBottom: 4, fontWeight: 600 }}>Notes (optional)</div>
                      <input style={{ ...S.input, padding: "10px 12px" }} placeholder="e.g. Pack of 10, check Amazon" value={newInventoryItem.notes} onChange={e => setNewInventoryItem(prev => ({ ...prev, notes: e.target.value }))} />
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 10 }}>
                    <button
                      disabled={!newInventoryItem.item || !newInventoryItem.quantity || inventorySaving}
                      onClick={async () => {
                        setInventorySaving(true);
                        try {
                          const res = await fetch(SCRIPT_URL, { method: "POST", body: JSON.stringify({ action: "addInventoryItem", ...newInventoryItem }) });
                          const d = await res.json();
                          if (d.success) {
                            await loadInventory();
                            setAddingInventoryItem(false);
                            setNewInventoryItem({ item: "", category: "", quantity: "", unit: "", lowStockThreshold: "", notes: "" });
                          } else alert("Failed to add item.");
                        } catch { alert("Error adding item."); }
                        setInventorySaving(false);
                      }}
                      style={{ flex: 1, background: "#059669", color: "#fff", border: "none", borderRadius: 10, padding: "12px 18px", fontWeight: 700, fontSize: "0.95rem", cursor: "pointer", opacity: !newInventoryItem.item || !newInventoryItem.quantity ? 0.5 : 1 }}>
                      {inventorySaving ? "Saving..." : "Save Item"}
                    </button>
                    <button onClick={() => { setAddingInventoryItem(false); setNewInventoryItem({ item: "", category: "", quantity: "", unit: "", lowStockThreshold: "", notes: "" }); }}
                      style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.7)", border: "none", borderRadius: 10, padding: "12px 18px", fontWeight: 600, fontSize: "0.95rem", cursor: "pointer" }}>
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}

            {inventoryLoading ? (
              <div style={{ textAlign: "center", padding: 40, color: "rgba(255,255,255,0.45)" }}>Loading inventory...</div>
            ) : filtered.length === 0 ? (
              <div style={{ textAlign: "center", padding: 40, color: "rgba(255,255,255,0.45)" }}>No items found.</div>
            ) : (
              Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b)).map(([cat, items]) => (
                <div key={cat} style={{ marginBottom: 28 }}>
                  <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "rgba(255,255,255,0.35)", textTransform: "uppercase" as const, letterSpacing: "0.08em", marginBottom: 10, paddingBottom: 6, borderBottom: "1px solid #f3f4f6" }}>
                    {cat} <span style={{ fontWeight: 400 }}>({items.length})</span>
                  </div>
                  <div style={{ display: "grid", gap: 8 }}>
                    {items.map((item) => {
                      const sc = stockColor(item);
                      const isEditing = editingInventoryRow === item.rowIndex;
                      const isEditingThreshold = editingThresholdRow === item.rowIndex;
                      const thresholdNum = parseFloat(item.lowStockThreshold);
                      const hasThreshold = !isNaN(thresholdNum) && thresholdNum > 0;
                      return (
                        <div key={item.rowIndex} className="inv-item" style={{ background: sc.bg, border: `1px solid ${sc.border}`, borderRadius: 12, padding: "12px 16px", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" as const }}>
                          {/* Item name + notes */}
                          <div style={{ flex: 1, minWidth: 160 }}>
                            <div style={{ fontWeight: 600, color: "#f1f5f9", fontSize: "0.9rem" }}>{item.item}</div>
                            {item.notes && <div style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.35)", marginTop: 2 }}>{item.notes}</div>}
                            {/* Threshold editor inline under the name */}
                            <div style={{ marginTop: 4, display: "flex", alignItems: "center", gap: 6 }}>
                              {isEditingThreshold ? (
                                <>
                                  <span style={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.45)" }}>Alert at:</span>
                                  <input
                                    type="number"
                                    step="0.25"
                                    min="0"
                                    value={editingThresholdVal}
                                    onChange={e => setEditingThresholdVal(e.target.value)}
                                    style={{ ...S.input, width: 60, padding: "3px 8px", fontSize: "0.82rem" }}
                                    autoFocus
                                    onKeyDown={async e => {
                                      if (e.key === "Enter") {
                                        try {
                                          const res = await fetch(SCRIPT_URL, { method: "POST", body: JSON.stringify({ action: "updateInventoryThreshold", rowIndex: item.rowIndex, lowStockThreshold: editingThresholdVal }) });
                                          const d = await res.json();
                                          if (d.success) { setInventoryItems(prev => prev.map(i => i.rowIndex === item.rowIndex ? { ...i, lowStockThreshold: editingThresholdVal } : i)); setEditingThresholdRow(null); }
                                        } catch { console.error("Threshold update failed"); }
                                      }
                                      if (e.key === "Escape") setEditingThresholdRow(null);
                                    }}
                                  />
                                  <button onClick={async () => {
                                    try {
                                      const res = await fetch(SCRIPT_URL, { method: "POST", body: JSON.stringify({ action: "updateInventoryThreshold", rowIndex: item.rowIndex, lowStockThreshold: editingThresholdVal }) });
                                      const d = await res.json();
                                      if (d.success) { setInventoryItems(prev => prev.map(i => i.rowIndex === item.rowIndex ? { ...i, lowStockThreshold: editingThresholdVal } : i)); setEditingThresholdRow(null); }
                                      else alert("Failed to update.");
                                    } catch { alert("Error."); }
                                  }} style={{ background: "#059669", color: "#fff", border: "none", borderRadius: 5, padding: "3px 8px", fontWeight: 700, fontSize: "0.72rem", cursor: "pointer" }}>✓</button>
                                  <button onClick={() => setEditingThresholdRow(null)}
                                    style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.7)", border: "none", borderRadius: 5, padding: "3px 6px", fontSize: "0.72rem", cursor: "pointer" }}>✕</button>
                                </>
                              ) : (
                                <button
                                  onClick={() => { setEditingThresholdRow(item.rowIndex); setEditingThresholdVal(item.lowStockThreshold || "0"); setEditingInventoryRow(null); }}
                                  style={{ background: "none", border: "none", padding: 0, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}
                                >
                                  <span style={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.35)" }}>
                                    {hasThreshold ? `⚠ alert at ${item.lowStockThreshold}` : "⚠ no alert set"}
                                  </span>
                                  <span style={{ fontSize: "0.65rem", color: "rgba(255,255,255,0.25)" }}>✏</span>
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Quantity editor */}
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            {isEditing ? (
                              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                <input
                                  type="number"
                                  step="0.25"
                                  value={editingInventoryVal}
                                  onChange={e => setEditingInventoryVal(e.target.value)}
                                  style={{ ...S.input, width: 80, padding: "6px 10px", fontSize: "0.9rem", fontWeight: 700 }}
                                  autoFocus
                                />
                                <span style={{ fontSize: "0.82rem", color: "rgba(255,255,255,0.45)" }}>{item.unit}</span>
                                <button onClick={async () => {
                                  setInventorySaving(true);
                                  try {
                                    const res = await fetch(SCRIPT_URL, { method: "POST", body: JSON.stringify({ action: "updateInventoryQty", rowIndex: item.rowIndex, quantity: editingInventoryVal }) });
                                    const d = await res.json();
                                    if (d.success) {
                                      setInventoryItems(prev => prev.map(i => i.rowIndex === item.rowIndex ? { ...i, quantity: editingInventoryVal } : i));
                                      setEditingInventoryRow(null);
                                    } else alert("Failed to update.");
                                  } catch { alert("Error updating."); }
                                  setInventorySaving(false);
                                }} style={{ background: "#059669", color: "#fff", border: "none", borderRadius: 6, padding: "5px 10px", fontWeight: 700, fontSize: "0.78rem", cursor: "pointer" }}>✓</button>
                                <button onClick={() => setEditingInventoryRow(null)}
                                  style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.7)", border: "none", borderRadius: 6, padding: "5px 8px", fontWeight: 600, fontSize: "0.78rem", cursor: "pointer" }}>✕</button>
                              </div>
                            ) : (
                              <button onClick={() => { setEditingInventoryRow(item.rowIndex); setEditingInventoryVal(item.quantity); setEditingThresholdRow(null); }}
                                style={{ background: sc.badgeBg, border: `1px solid ${sc.border}`, borderRadius: 8, padding: "5px 12px", cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
                                <span style={{ fontWeight: 800, fontSize: "1rem", color: sc.badge }}>{item.quantity}</span>
                                <span style={{ fontSize: "0.78rem", color: "rgba(255,255,255,0.45)" }}>{item.unit}</span>
                                <span style={{ fontSize: "0.68rem", color: "rgba(255,255,255,0.35)" }}>✏</span>
                              </button>
                            )}
                          </div>

                          {/* Quick +/- buttons */}
                          {!isEditing && (
                            <div style={{ display: "flex", gap: 4 }}>
                              <button onClick={async () => {
                                const newQty = String(Math.max(0, parseFloat(item.quantity || "0") - 1));
                                try {
                                  const res = await fetch(SCRIPT_URL, { method: "POST", body: JSON.stringify({ action: "updateInventoryQty", rowIndex: item.rowIndex, quantity: newQty }) });
                                  const d = await res.json();
                                  if (d.success) setInventoryItems(prev => prev.map(i => i.rowIndex === item.rowIndex ? { ...i, quantity: newQty } : i));
                                } catch { console.error("Qty update failed"); }
                              }} style={{ width: 28, height: 28, borderRadius: 6, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.05)", cursor: "pointer", fontWeight: 700, fontSize: "1rem", color: "rgba(255,255,255,0.7)", display: "flex", alignItems: "center", justifyContent: "center" }}>−</button>
                              <button onClick={async () => {
                                const newQty = String(parseFloat(item.quantity || "0") + 1);
                                try {
                                  const res = await fetch(SCRIPT_URL, { method: "POST", body: JSON.stringify({ action: "updateInventoryQty", rowIndex: item.rowIndex, quantity: newQty }) });
                                  const d = await res.json();
                                  if (d.success) setInventoryItems(prev => prev.map(i => i.rowIndex === item.rowIndex ? { ...i, quantity: newQty } : i));
                                } catch { console.error("Qty update failed"); }
                              }} style={{ width: 28, height: 28, borderRadius: 6, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.05)", cursor: "pointer", fontWeight: 700, fontSize: "1rem", color: "rgba(255,255,255,0.7)", display: "flex", alignItems: "center", justifyContent: "center" }}>+</button>
                            </div>
                          )}

                          {/* Status badge */}
                          <span style={{ background: sc.badgeBg, color: sc.badge, fontSize: "0.68rem", fontWeight: 700, borderRadius: 999, padding: "2px 8px", border: `1px solid ${sc.border}`, whiteSpace: "nowrap" as const }}>
                            {sc.label}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    );
  }

  // BOOKING FLOW
  return (
    <div style={S.page}>

      {/* Animated background */}
      <div className="atx-bg">
        <div className="atx-grid" />
        <div className="atx-orb atx-orb-1" />
        <div className="atx-orb atx-orb-2" />
        <div className="atx-orb atx-orb-3" />
      </div>
      <style>{`
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(18px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes checkDraw {
          from { stroke-dashoffset: 50; opacity: 0; }
          to   { stroke-dashoffset: 0;  opacity: 1; }
        }
      `}</style>

      {/* Toast container */}
      <div style={{ position: "fixed" as const, bottom: 24, right: 24, zIndex: 9999, display: "flex", flexDirection: "column" as const, gap: 10, alignItems: "flex-end" }}>
        {toasts.map(t => (
          <div key={t.id} style={{
            display: "flex", alignItems: "center", gap: 10,
            background: t.type === "error" ? "rgba(239,68,68,0.12)" : t.type === "success" ? "#f0fdf4" : "#1e293b",
            color: t.type === "error" ? "#dc2626" : t.type === "success" ? "#065f46" : "#fff",
            border: t.type === "error" ? "1.5px solid #fca5a5" : t.type === "success" ? "1.5px solid #6ee7b7" : "none",
            borderRadius: 14, padding: "12px 18px", fontSize: "0.88rem", fontWeight: 600,
            boxShadow: "0 4px 20px rgba(0,0,0,0.18)", animation: "toastIn 0.25s ease",
            maxWidth: 320, cursor: "pointer",
          }} onClick={() => dismissToast(t.id)}>
            {t.type === "loading" && (
              <div style={{ width: 16, height: 16, border: "2.5px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.7s linear infinite", flexShrink: 0 }} />
            )}
            {t.type === "success" && <span style={{ fontSize: "1rem" }}>✓</span>}
            {t.type === "error" && <span style={{ fontSize: "1rem" }}>✕</span>}
            <span>{t.message}</span>
          </div>
        ))}
      </div>
      <div style={S.container}>
        <SquarePopup />
        <Header />
        {step > 0 && step < TOTAL_STEPS - 1 && <ProgressBar />}
        <div style={S.card} key={step}>

          {/* STEP 0 */}
          {step === 0 && (
            <>
              <div style={{ textAlign: "center" as const, padding: "16px 0 24px" }}>
                <div className="stagger-1" style={{ display: "inline-block", fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.18em", color: "rgba(99,179,237,0.8)", textTransform: "uppercase" as const, marginBottom: 16, background: "rgba(59,130,246,0.1)", border: "1px solid rgba(59,130,246,0.25)", borderRadius: 999, padding: "5px 16px" }}>Premium Auto & Marine Detailing</div>
                <h2 className="stagger-2" style={{ ...S.title, fontSize: "clamp(2.2rem, 7vw, 3.8rem)", marginBottom: 12, background: "linear-gradient(135deg, #ffffff 0%, rgba(255,255,255,0.7) 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>Detailing, Elevated.</h2>
                <p className="stagger-3" style={{ ...S.subtitle, marginBottom: 32, fontSize: "1.05rem" }}>Serving Lago Vista, Cedar Park, and Leander areas.</p>
                <div className="stagger-4" style={{ display: "flex", justifyContent: "center", gap: 12, flexWrap: "wrap" as const, marginBottom: 28 }}>
                  <button style={{ ...S.primary, padding: "16px 32px", fontSize: "1.05rem", letterSpacing: "-0.3px" }} onClick={() => setStep(1)}>Book a Service →</button>
                  {googleUser && googleUser.email === ADMIN_EMAIL && (
                    <button style={{ ...S.primary, background: "linear-gradient(135deg, #059669, #047857)" }} onClick={() => { setView("admin"); loadAdminBookings(); }}>Admin Panel</button>
                  )}
                  {googleUser && googleUser.email === ADMIN_EMAIL && (
                    <button style={{ ...S.primary, background: "linear-gradient(135deg, #7c3aed, #5b21b6)" }} onClick={() => { setView("inventory"); loadInventory(); }}>Inventory</button>
                  )}
                  {googleUser && (
                    <button style={S.secondary} onClick={openMyBookings}>My Bookings</button>
                  )}
                </div>
                {!googleUser && (
                  <p style={{ textAlign: "center" as const, color: "rgba(255,255,255,0.35)", fontSize: "0.85rem", marginBottom: 20 }}>
                    Sign in with Google to view your past and upcoming appointments.
                  </p>
                )}
              </div>
              <div style={{ borderTop: "1px solid rgba(255,255,255,0.07)", paddingTop: 18, display: "flex", gap: 8, flexWrap: "wrap" as const, justifyContent: "center" }}>
                {["Auto Detail", "Marine Detail", "Maintenance Plans", "Mobile Service"].map(tag => (
                  <span key={tag} style={{ background: "rgba(255,255,255,0.06)", borderRadius: 999, padding: "6px 16px", fontSize: "0.82rem", color: "rgba(255,255,255,0.5)", fontWeight: 500, border: "1px solid rgba(255,255,255,0.10)" }}>{tag}</span>
                ))}
              </div>
            </>
          )}

          {/* STEP 1 */}
          {step === 1 && (
            <>
              <h2 style={S.title}>Vehicle Type</h2>
              <p style={S.subtitle}>Select the vehicle you're booking for.</p>
              <div style={S.optionGrid}>
                {vehicleOptions.map((option) => (
                  <button key={option.id}
                    style={{ ...S.optionCard, ...(vehicle === option.id ? S.selectedCard : {}) }}
                    onClick={() => { setVehicle(option.id); setPkg(""); setMake(""); setModel(""); setMakeOptions([]); setModelOptions([]); setBoatMake(""); setBoatModel(""); setBoatSize(""); setAddOns([]); }}
                  >
                    <div style={S.optionTitle}>{option.label}</div>
                    <div style={S.optionMeta}>Basic {formatCurrency(option.basicRate)}/hr<br />Premium {formatCurrency(option.premiumRate)}/hr</div>
                  </button>
                ))}
              </div>
              <div style={S.buttonRow}>
                <button style={S.secondary} onClick={() => setStep(0)}>Back</button>
                <div style={S.rightButtons}>
                  <button style={{ ...S.primary, ...(!vehicle ? S.disabled : {}) }} onClick={next} disabled={!vehicle}>Next</button>
                </div>
              </div>
            </>
          )}

          {/* STEP 2 */}
          {step === 2 && (
            <>
              <h2 style={S.title}>Service Plan</h2>
              <p style={S.subtitle}>Is this a one-time detail or a recurring maintenance plan?</p>
              <div style={S.optionGrid}>
                <button
                  style={{ ...S.optionCard, ...(clientType === "oneTime" ? S.selectedCard : {}) }}
                  onClick={() => { setClientType("oneTime"); setFrequency(""); }}
                >
                  <div style={S.optionTitle}>One-Time Service</div>
                  <div style={S.optionMeta}>A single detail appointment. Great for a deep clean, special occasion, or a first visit.</div>
                </button>
                {vehicle !== "boat" && (
                  <button
                    style={{ ...S.optionCard, ...(clientType === "maintenance" ? S.selectedGreen : {}) }}
                    onClick={() => setClientType("maintenance")}
                  >
                    <div style={{ ...S.optionTitle, color: clientType === "maintenance" ? "#34d399" : "#f1f5f9" }}>Maintenance Plan</div>
                    <div style={S.optionMeta}>Recurring 2-hour details to keep your vehicle in top condition. Choose bi-weekly or monthly.</div>
                  </button>
                )}
              </div>

              {vehicle === "boat" && (
                <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: "12px 16px", marginBottom: 8, fontSize: "0.9rem", color: "rgba(255,255,255,0.45)" }}>
                  Maintenance plans are not available for boats. Please select One-Time Service.
                </div>
              )}

              {clientType === "maintenance" && vehicle !== "boat" && (
                <div style={{ marginTop: 4, marginBottom: 8 }}>
                  <div style={{ background: "rgba(251,191,36,0.12)", border: "1px solid #fde68a", borderRadius: 14, padding: "12px 16px", marginBottom: 16, fontSize: "0.9rem", color: "#fbbf24", lineHeight: 1.6 }}>
                    To sign up for a maintenance plan, you must have had a detail with us within the last 30 days. If you have not booked yet, select One-Time Service first.
                  </div>
                  <div style={{ fontWeight: 700, color: "rgba(255,255,255,0.7)", fontSize: "0.95rem", marginBottom: 12, textAlign: "center" as const }}>
                    How often would you like service?
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <button
                      style={{ ...S.optionCard, ...(frequency === "biweekly" ? S.selectedGreen : {}), textAlign: "center" as const }}
                      onClick={() => setFrequency("biweekly")}
                    >
                      <div style={{ ...S.optionTitle, textAlign: "center" as const, color: frequency === "biweekly" ? "#34d399" : "#f1f5f9" }}>Bi-Weekly</div>
                      <div style={S.optionMeta}>Every two weeks. Good for high-use vehicles.</div>
                    </button>
                    <button
                      style={{ ...S.optionCard, ...(frequency === "monthly" ? S.selectedGreen : {}), textAlign: "center" as const }}
                      onClick={() => setFrequency("monthly")}
                    >
                      <div style={{ ...S.optionTitle, textAlign: "center" as const, color: frequency === "monthly" ? "#065f46" : "#111827" }}>Monthly</div>
                      <div style={S.optionMeta}>Once a month. A good balance of upkeep and convenience.</div>
                    </button>
                  </div>
                </div>
              )}

              <div style={S.buttonRow}>
                <button style={S.secondary} onClick={back}>Back</button>
                <div style={S.rightButtons}>
                  <button
                    style={{ ...S.primary, ...(!clientType || (clientType === "maintenance" && !frequency) ? S.disabled : {}) }}
                    onClick={next}
                    disabled={!clientType || (clientType === "maintenance" && !frequency)}
                  >Next</button>
                </div>
              </div>
            </>
          )}

          {/* STEP 3 */}
          {step === 3 && (
            <>
              <h2 style={S.title}>Detail Package</h2>
              <p style={S.subtitle}>Choose the level of service for this appointment.</p>
              {/* ── Full Detail packages ── */}
              <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "rgba(255,255,255,0.35)", textTransform: "uppercase" as const, letterSpacing: "0.08em", marginBottom: 10 }}>Full Detail</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, marginBottom: 24 }}>
                {([
                  { id: "premium" as PackageType, label: "Premium Detail", badge: "PREMIUM", desc: "Interior + exterior with premium products & techniques.", time: !vehicle ? "" : vehicle === "boat" ? "5-8 hours avg" : "3-5 hours avg", isPremium: true },
                  { id: "basic"   as PackageType, label: "Basic Detail",   badge: "BASIC",   desc: "Full interior + exterior, standard products.",            time: !vehicle ? "" : clientType === "maintenance" ? "2 hours" : vehicle === "boat" ? "3-6 hours avg" : vehicle === "truckSuv" ? "3-5 hours avg" : "3-4 hours avg", isPremium: false },
                ]).map((option) => {
                  const rate = selectedVehicle ? (option.isPremium ? selectedVehicle.premiumRate : selectedVehicle.basicRate) : 0;
                  const isSelected = pkg === option.id;
                  return (
                    <button key={option.id} onClick={() => setPkg(option.id)}
                      style={{ ...S.optionCard, ...(isSelected ? S.selectedCard : {}), position: "relative" as const }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                        <div style={S.optionTitle}>{option.label}</div>
                        <span style={{ background: option.isPremium ? "#111827" : "rgba(255,255,255,0.08)", color: option.isPremium ? "#fff" : "#6b7280", fontSize: "0.65rem", fontWeight: 800, borderRadius: 6, padding: "2px 7px", letterSpacing: "0.06em", flexShrink: 0 }}>{option.badge}</span>
                      </div>
                      <div style={{ fontSize: "1.1rem", fontWeight: 800, color: "#f1f5f9", marginBottom: 4 }}>{selectedVehicle ? `${formatCurrency(rate)}/hr` : "—"}</div>
                      <div style={{ fontSize: "0.85rem", color: "rgba(255,255,255,0.45)", marginBottom: 6 }}>{option.time}</div>
                      <div style={{ fontSize: "0.8rem", color: "rgba(255,255,255,0.35)", lineHeight: 1.4 }}>{option.desc}</div>
                    </button>
                  );
                })}
              </div>

              {/* ── Partial packages (non-boat only) ── */}
              {vehicle !== "boat" && (
                <>
                  <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "rgba(255,255,255,0.35)", textTransform: "uppercase" as const, letterSpacing: "0.08em", marginBottom: 10 }}>Partial Detail</div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
                    {([
                      { id: "exteriorPremium" as PackageType, label: "Exterior Only", badge: "PREMIUM", desc: "Exterior only, premium products.", isPremium: true  },
                      { id: "exterior"        as PackageType, label: "Exterior Only", badge: "BASIC",   desc: "Exterior only, standard products.", isPremium: false },
                      { id: "interiorPremium" as PackageType, label: "Interior Only", badge: "PREMIUM", desc: "Interior only, premium products.", isPremium: true  },
                      { id: "interior"        as PackageType, label: "Interior Only", badge: "BASIC",   desc: "Interior only, standard products.", isPremium: false },
                    ]).map((option) => {
                      const rate = selectedVehicle ? (option.isPremium ? selectedVehicle.premiumRate : selectedVehicle.basicRate) : 0;
                      const isSelected = pkg === option.id;
                      return (
                        <button key={option.id} onClick={() => setPkg(option.id)}
                          style={{ ...S.optionCard, ...(isSelected ? S.selectedCard : {}) }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                            <div style={{ ...S.optionTitle, fontSize: "0.95rem" }}>{option.label}</div>
                            <span style={{ background: option.isPremium ? "#111827" : "rgba(255,255,255,0.08)", color: option.isPremium ? "#fff" : "#6b7280", fontSize: "0.65rem", fontWeight: 800, borderRadius: 6, padding: "2px 7px", letterSpacing: "0.06em", flexShrink: 0 }}>{option.badge}</span>
                          </div>
                          <div style={{ fontSize: "1rem", fontWeight: 800, color: "#f1f5f9", marginBottom: 4 }}>{selectedVehicle ? `${formatCurrency(rate)}/hr` : "—"}</div>
                          <div style={{ fontSize: "0.8rem", color: "rgba(255,255,255,0.45)", marginBottom: 4 }}>2 hours avg</div>
                          <div style={{ fontSize: "0.78rem", color: "rgba(255,255,255,0.35)", lineHeight: 1.4 }}>{option.desc}</div>
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
              <div style={{ marginTop: 8, fontSize: "0.9rem", color: "rgba(255,255,255,0.45)" }}>
                Time estimates are based on average conditions and may vary at the time of service.
              </div>
              <div style={S.estimateBox}><div style={S.estimateLabel}>Estimate</div><div style={S.estimateValue}>{estimateText || "$ per hour"}</div></div>
              <div style={S.noteBox}>
                To see what's included in each package, visit{" "}
                <a href="https://ATXPrestigeDetailing.com" target="_blank" rel="noopener noreferrer" style={{ color: "#f1f5f9", textDecoration: "none", fontWeight: 600, borderBottom: "1px solid #d1d5db" }}>ATXPrestigeDetailing.com</a>
              </div>
              <div style={S.buttonRow}>
                <button style={S.secondary} onClick={back}>Back</button>
                <div style={S.rightButtons}><button style={{ ...S.primary, ...(!pkg ? S.disabled : {}) }} onClick={next} disabled={!pkg}>Next</button></div>
              </div>
            </>
          )}

          {/* STEP 4 */}
          {step === 4 && (
            <>
              <h2 style={S.title}>Add-On Services</h2>
              <p style={S.subtitle}>{vehicle === "boat" ? "Optional marine services for this appointment." : "Optional services to add to your appointment."}</p>
              <div style={S.addOnGrid}>
                {(vehicle === "boat" ? marineAddOnOptions : addOnOptions).map((option) => (
                  <label key={option.label} style={S.addOnRow}>
                    <div style={S.checkWrap}>
                      <input style={S.checkbox} type="checkbox" checked={addOns.includes(option.label)} onChange={() => toggleAddOn(option.label)} />
                      <span>{option.label}</span>
                    </div>
                    <span style={S.addOnPrice}>{option.priceText}</span>
                  </label>
                ))}
              </div>
              <div style={S.estimateBox}>
                <div style={S.estimateLabel}>Estimate</div>
                <div style={S.estimateValue}>{estimateText || "$ per hour"}{addOnSummaryText ? ` + ${addOnSummaryText}` : ""}</div>
              </div>
              <div style={S.buttonRow}>
                <button style={S.secondary} onClick={back}>Back</button>
                <div style={S.rightButtons}><button style={S.primary} onClick={next}>Next</button></div>
              </div>
            </>
          )}

          {/* STEP 5 */}
          {step === 5 && (
            <>
              <h2 style={S.title}>Service Location</h2>
              <p style={S.subtitle}>Choose how you'd like the service to be done.</p>
              <div style={S.optionGrid}>
                <button style={{ ...S.optionCard, ...(serviceType === "mobile" ? S.selectedCard : {}) }} onClick={() => { setServiceType("mobile"); setAddressSelected(false); }}>
                  <div style={S.optionTitle}>Mobile Service</div>
                  <div style={S.optionMeta}>We come to you. Enter your location below after selecting this option.</div>
                </button>
                <button style={{ ...S.optionCard, ...(serviceType === "dropoff" ? S.selectedCard : {}) }}
                  onClick={() => { setServiceType("dropoff"); setAddress(""); setStreet(""); setCity(""); setStateRegion(""); setZip(""); setPlaceId(""); setLat(""); setLng(""); setAddressSelected(false); }}>
                  <div style={S.optionTitle}>Drop-Off Service</div>
                  <div style={S.optionMeta}>Drop off your vehicle with us. We'll follow up with location details.</div>
                </button>
              </div>
              {serviceType === "mobile" && (
                <div style={{ marginTop: 18 }}>
                  <input ref={addressInputRef} type="text" value={address}
                    onChange={(e) => { setAddress(e.target.value); setAddressSelected(false); }}
                    placeholder="Start typing your address" style={S.input} />
                </div>
              )}
              <div style={S.buttonRow}>
                <button style={S.secondary} onClick={back}>Back</button>
                <div style={S.rightButtons}>
                  <button style={{ ...S.primary, ...(!serviceType || (serviceType === "mobile" && !address.trim()) ? S.disabled : {}) }}
                    onClick={next} disabled={!serviceType || (serviceType === "mobile" && !address.trim())}>Next</button>
                </div>
              </div>
            </>
          )}

          {/* STEP 6 */}
          {step === 6 && (
            <>
              <h2 style={S.title}>Book Your Appointment</h2>
              <p style={S.subtitle}>Select a date, time, and fill in your details.</p>

              {/* ── Two-column layout on wider screens ── */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 20, alignItems: "start" }}>

                {/* LEFT: Calendar */}
                <div style={{ gridColumn: "1 / -1" }}>
                  <div style={{ background: "#111827", borderRadius: 20, padding: "24px 20px" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
                      <button
                        onClick={() => { const d = new Date(calYear, calMonth - 1, 1); setCalMonth(d.getMonth()); setCalYear(d.getFullYear()); }}
                        style={{ background: "rgba(255,255,255,0.08)", border: "none", borderRadius: 10, width: 36, height: 36, cursor: "pointer", color: "#fff", fontSize: "1.1rem", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
                      >‹</button>
                      <span style={{ fontWeight: 800, fontSize: "1rem", color: "#fff", letterSpacing: "0.04em", textTransform: "uppercase" as const }}>
                        {new Date(calYear, calMonth).toLocaleDateString("en-US", { month: "long", year: "numeric" })}
                      </span>
                      <button
                        onClick={() => { const d = new Date(calYear, calMonth + 1, 1); setCalMonth(d.getMonth()); setCalYear(d.getFullYear()); }}
                        style={{ background: "rgba(255,255,255,0.08)", border: "none", borderRadius: 10, width: 36, height: 36, cursor: "pointer", color: "#fff", fontSize: "1.1rem", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
                      >›</button>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2, marginBottom: 8 }}>
                      {["S","M","T","W","T","F","S"].map((d, i) => (
                        <div key={i} style={{ textAlign: "center" as const, fontSize: "0.72rem", color: "rgba(255,255,255,0.35)", fontWeight: 700, padding: "3px 0", letterSpacing: "0.05em" }}>{d}</div>
                      ))}
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 }}>
                      {(() => {
                        const firstDay = new Date(calYear, calMonth, 1).getDay();
                        const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
                        const today = new Date(); today.setHours(0,0,0,0);
                        const cells = [];
                        for (let i = 0; i < firstDay; i++) cells.push(<div key={`e${i}`} />);
                        for (let d = 1; d <= daysInMonth; d++) {
                          const dateStr = `${calYear}-${String(calMonth + 1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
                          const isAvail = availableDates.includes(dateStr);
                          const isPast = new Date(calYear, calMonth, d) < today;
                          const isSelected = selectedDate === dateStr;
                          cells.push(
                            <button key={d} disabled={!isAvail || isPast}
                              onClick={() => { setSelectedDate(dateStr); setSelectedTime(""); }}
                              style={{ height: 38, borderRadius: 10, border: "none",
                                background: isSelected ? "#ffffff" : isAvail && !isPast ? "rgba(255,255,255,0.1)" : "transparent",
                                color: isSelected ? "#111827" : isAvail && !isPast ? "#ffffff" : "rgba(255,255,255,0.18)",
                                fontSize: "0.88rem", fontWeight: isSelected ? 800 : isAvail && !isPast ? 600 : 400,
                                cursor: isAvail && !isPast ? "pointer" : "default" }}
                            >{d}</button>
                          );
                        }
                        return cells;
                      })()}
                    </div>
                    {selectedDate && (
                      <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid rgba(255,255,255,0.1)", display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#4ade80", flexShrink: 0 }} />
                        <span style={{ color: "rgba(255,255,255,0.7)", fontSize: "0.85rem" }}>
                          <span style={{ color: "#fff", fontWeight: 700 }}>{formatDateLabel(selectedDate)}</span>
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Time slots — full width, only shown after date picked */}
                {selectedDate && (
                  <div style={{ gridColumn: "1 / -1" }}>
                    <div style={{ fontSize: "0.78rem", fontWeight: 700, color: "rgba(255,255,255,0.35)", textTransform: "uppercase" as const, letterSpacing: "0.08em", marginBottom: 10 }}>Available Times</div>
                    {availableSlots.length === 0 ? (
                      <div style={{ color: "#f87171", fontSize: "0.9rem" }}>No available times for this date.</div>
                    ) : (
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(100px, 1fr))", gap: 10 }}>
                        {availableSlots.map((slot, i) => (
                          <button key={i} onClick={() => setSelectedTime(slot.time)}
                            style={{ padding: "13px 8px", borderRadius: 12,
                              border: selectedTime === slot.time ? "2px solid #111827" : "1.5px solid #e5e7eb",
                              background: selectedTime === slot.time ? "#111827" : "#fff",
                              color: selectedTime === slot.time ? "#fff" : "#374151",
                              fontSize: "0.9rem", fontWeight: 700, cursor: "pointer", textAlign: "center" as const }}
                          >{slot.time}</button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Divider */}
                {selectedDate && selectedTime && (
                  <div style={{ gridColumn: "1 / -1", borderTop: "1px solid rgba(255,255,255,0.07)", paddingTop: 8 }}>
                    <div style={{ fontSize: "0.78rem", fontWeight: 700, color: "rgba(255,255,255,0.35)", textTransform: "uppercase" as const, letterSpacing: "0.08em" }}>Your Details</div>
                  </div>
                )}

                {/* FORM FIELDS — only shown after time selected */}
                {selectedDate && selectedTime && (
                  <>
                    {/* Recurring schedule for maintenance */}
                    {clientType === "maintenance" && frequency && (
                      <div style={{ gridColumn: "1 / -1", background: "rgba(16,185,129,0.1)", border: "1px solid #6ee7b7", borderRadius: 14, padding: "14px 16px" }}>
                        <div style={{ fontWeight: 700, color: "#34d399", marginBottom: 6, fontSize: "0.95rem" }}>Your Recurring Schedule</div>
                        <div style={{ fontSize: "0.85rem", color: "#10b981", marginBottom: 8 }}>{getCadenceLabel(selectedDate, frequency)} starting {formatDateLabel(selectedDate)}</div>
                        <div style={{ display: "grid", gap: 3 }}>
                          {calcRecurringDates(selectedDate, frequency, 6).map((d, i) => (
                            <div key={i} style={{ fontSize: "0.85rem", color: "#34d399" }}>{i + 2}. {d}</div>
                          ))}
                        </div>
                        <div style={{ fontSize: "0.78rem", color: "rgba(255,255,255,0.45)", marginTop: 8 }}>Showing your next 6 scheduled dates. These slots will be held for you.</div>
                      </div>
                    )}

                    {/* Name */}
                    <div style={{ gridColumn: "1 / -1" }}>
                      <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 700, color: "rgba(255,255,255,0.35)", textTransform: "uppercase" as const, letterSpacing: "0.06em", marginBottom: 6 }}>Full Name</label>
                      <input style={{ ...S.input }} placeholder="Your full name" value={name} onChange={(e) => setName(e.target.value)} />
                    </div>

                    {/* Phone + Email — side by side on desktop, stacked on mobile */}
                    <div style={{ gridColumn: "1 / -1", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
                    <div>
                      <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 700, color: "rgba(255,255,255,0.35)", textTransform: "uppercase" as const, letterSpacing: "0.06em", marginBottom: 6 }}>Phone <span style={{ fontWeight: 400, textTransform: "none" as const, letterSpacing: 0, color: "rgba(255,255,255,0.25)", fontSize: "0.72rem" }}>(optional)</span></label>
                      <input style={S.input} placeholder="(512) 000-0000" value={phone} type="tel" inputMode="numeric"
                        onChange={(e) => {
                          const raw = e.target.value.replace(/\D/g, "").slice(0, 10);
                          const fmt = raw.length > 6 ? `(${raw.slice(0,3)}) ${raw.slice(3,6)}-${raw.slice(6)}` : raw.length > 3 ? `(${raw.slice(0,3)}) ${raw.slice(3)}` : raw;
                          setPhone(fmt);
                        }} />
                    </div>
                    <div>
                      <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 700, color: "rgba(255,255,255,0.35)", textTransform: "uppercase" as const, letterSpacing: "0.06em", marginBottom: 6 }}>Email</label>
                      <input style={S.input} placeholder="your@email.com" value={email} onChange={(e) => setEmail(e.target.value)} />
                    </div>
                    </div>{/* end phone/email grid */}

                    {/* Vehicle details */}
                    <div style={{ gridColumn: "1 / -1" }}>
                      <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 700, color: "rgba(255,255,255,0.35)", textTransform: "uppercase" as const, letterSpacing: "0.06em", marginBottom: 10 }}>{vehicle === "boat" ? "Boat Details" : "Vehicle Details"}</label>
                      {vehicle === "boat" ? (
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 12 }}>
                          <input style={S.input} placeholder="Size (e.g. 24 ft)" value={boatSize} onChange={(e) => setBoatSize(e.target.value)} />
                          <input style={S.input} placeholder="Make (e.g. Sea Ray)" value={boatMake} onChange={(e) => setBoatMake(e.target.value)} />
                          <input style={S.input} placeholder="Model" value={boatModel} onChange={(e) => setBoatModel(e.target.value)} />
                        </div>
                      ) : (
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 12 }}>
                          <div>
                            <input style={S.input} placeholder="Year" value={year}
                              onChange={(e) => { setYear(e.target.value); setModel(""); setModelOptions([]); }}
                              list="year-options" />
                            <datalist id="year-options">{yearOptions.map((yr) => <option key={yr} value={yr} />)}</datalist>
                          </div>
                          <div>
                            <input style={S.input} placeholder="Make" value={make}
                              onChange={(e) => { setMake(e.target.value); setModel(""); setModelOptions([]); }}
                              list="make-options" autoComplete="off" />
                            <datalist id="make-options">{makeOptions.map((mk) => <option key={mk} value={mk} />)}</datalist>
                          </div>
                          <div>
                            <input style={S.input} placeholder={!year || !make ? "Model" : "Model"} value={model}
                              onChange={(e) => setModel(e.target.value)}
                              list="model-options" autoComplete="off" />
                            <datalist id="model-options">{modelOptions.map((mdl) => <option key={mdl} value={mdl} />)}</datalist>
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>

              {/* SMS Consent — optional, two separate checkboxes */}
              {selectedDate && selectedTime && name && phone && email && (
                <div style={{ marginTop: 16, background: "rgba(59,130,246,0.06)", border: "1px solid rgba(59,130,246,0.2)", borderRadius: 14, padding: "16px 16px", display: "flex", flexDirection: "column" as const, gap: 14 }}>
                  <div style={{ fontSize: "0.78rem", fontWeight: 700, color: "#93c5fd", textTransform: "uppercase" as const, letterSpacing: "0.06em" }}>SMS Notifications (Optional)</div>

                  {/* Transactional */}
                  <label style={{ display: "flex", alignItems: "flex-start", gap: 12, cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={smsConsent}
                      onChange={e => setSmsConsent(e.target.checked)}
                      style={{ width: 18, height: 18, marginTop: 2, accentColor: "#3b82f6", flexShrink: 0, cursor: "pointer" }}
                    />
                    <span style={{ fontSize: "0.82rem", color: "rgba(255,255,255,0.6)", lineHeight: 1.6 }}>
                      <strong style={{ color: "#f1f5f9" }}>Transactional SMS:</strong> I agree to receive booking confirmations, appointment reminders, job status updates, and payment notifications via SMS from ATX Prestige Detailing. Message frequency varies. Message & data rates may apply. Reply <strong style={{ color: "#f1f5f9" }}>STOP</strong> to unsubscribe. Reply <strong style={{ color: "#f1f5f9" }}>HELP</strong> for help.
                    </span>
                  </label>

                  {/* Marketing */}
                  <label style={{ display: "flex", alignItems: "flex-start", gap: 12, cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={smsMarketingConsent}
                      onChange={e => setSmsMarketingConsent(e.target.checked)}
                      style={{ width: 18, height: 18, marginTop: 2, accentColor: "#3b82f6", flexShrink: 0, cursor: "pointer" }}
                    />
                    <span style={{ fontSize: "0.82rem", color: "rgba(255,255,255,0.6)", lineHeight: 1.6 }}>
                      <strong style={{ color: "#f1f5f9" }}>Marketing SMS:</strong> I agree to receive promotional offers, seasonal specials, and marketing messages from ATX Prestige Detailing. Message frequency varies. Message & data rates may apply. Reply <strong style={{ color: "#f1f5f9" }}>STOP</strong> to unsubscribe at any time.
                    </span>
                  </label>

                  <div style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.35)", lineHeight: 1.5 }}>
                    Both checkboxes are optional. You may submit your booking without checking either. View our{" "}
                    <a href="https://atxprestigedetailing.com/privacy-policy" target="_blank" rel="noopener noreferrer" style={{ color: "#93c5fd" }}>Privacy Policy</a>{" "}and{" "}
                    <a href="https://atxprestigedetailing.com/terms-and-conditions" target="_blank" rel="noopener noreferrer" style={{ color: "#93c5fd" }}>Terms & Conditions</a>.
                  </div>
                </div>
              )}

              <div style={S.buttonRow}>
                <button style={S.secondary} onClick={back}>Back</button>
                <div style={S.rightButtons}>
                  <button style={{ ...S.primary, ...(step6Disabled ? S.disabled : {}) }} onClick={next} disabled={step6Disabled}>Review Booking</button>
                </div>
              </div>
            </>
          )}

          {/* STEP 7 */}
          {step === 7 && (
            <>
              <h2 style={S.title}>Review Your Booking</h2>
              <p style={S.subtitle}>Check everything over before submitting.</p>
              <div style={S.summaryGrid}>
                <div style={S.summaryCard}><div style={S.summaryHeading}>Customer</div><div style={S.summaryValue}>{name}<br />{phone}<br />{email}</div></div>
                <div style={S.summaryCard}><div style={S.summaryHeading}>Appointment</div><div style={S.summaryValue}>{formatDateLabel(selectedDate)}<br />{selectedTime || "N/A"}</div></div>
                <div style={S.summaryCard}>
                  <div style={S.summaryHeading}>Service Plan</div>
                  <div style={S.summaryValue}>
                    {clientType === "oneTime" ? "One-Time Service" : clientType === "maintenance" ? "Maintenance Plan" : "N/A"}
                    {clientType === "maintenance" && frequency && <><br />{frequency === "biweekly" ? "Bi-Weekly" : "Monthly"}</>}
                    {clientType === "maintenance" && selectedDate && frequency && (
                      <><br /><span style={{ fontSize: "0.88rem", fontWeight: 400, color: "#059669" }}>{getCadenceLabel(selectedDate, frequency)}</span></>
                    )}
                  </div>
                </div>
                {clientType === "maintenance" && selectedDate && frequency && (
                  <div style={{ ...S.summaryCard, gridColumn: "1 / -1", background: "rgba(16,185,129,0.08)", border: "1px solid #6ee7b7" }}>
                    <div style={S.summaryHeading}>Recurring Schedule</div>
                    <div style={{ fontSize: "0.9rem", color: "#34d399", fontWeight: 600, marginBottom: 8 }}>
                      {getCadenceLabel(selectedDate, frequency)} — first service {formatDateLabel(selectedDate)}
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 4 }}>
                      {calcRecurringDates(selectedDate, frequency, 6).map((d, i) => (
                        <div key={i} style={{ fontSize: "0.88rem", color: "rgba(255,255,255,0.7)" }}>{i + 2}. {d}</div>
                      ))}
                    </div>
                  </div>
                )}
                <div style={S.summaryCard}><div style={S.summaryHeading}>Package</div><div style={S.summaryValue}>{selectedVehicle?.label || "N/A"}<br />{pkg === "basic" ? "Basic Detail" : pkg === "premium" ? "Premium Detail" : pkg === "exterior" ? "Exterior Only — Basic" : pkg === "interior" ? "Interior Only — Basic" : pkg === "exteriorPremium" ? "Exterior Only — Premium" : pkg === "interiorPremium" ? "Interior Only — Premium" : "N/A"}<br />{estimateText || "N/A"}</div></div>
                <div style={S.summaryCard}><div style={S.summaryHeading}>Location</div><div style={S.summaryValue}>{serviceType === "mobile" ? "Mobile Service" : serviceType === "dropoff" ? "Drop-Off Service" : "N/A"}{serviceType === "mobile" && address && <><br />{address}</>}</div></div>
                <div style={S.summaryCard}><div style={S.summaryHeading}>{vehicle === "boat" ? "Boat" : "Vehicle"}</div><div style={S.summaryValue}>{vehicleSummary}<br />{selectedVehicle?.label || "N/A"}</div></div>
                <div style={S.summaryCard}><div style={S.summaryHeading}>Add-Ons</div><div style={S.summaryValue}>{addOns.length ? addOns.join(", ") : "None"}</div></div>
                <div style={S.summaryCard}><div style={S.summaryHeading}>Add-On Estimate</div><div style={S.summaryValue}>{formatCurrency(addOnEstimate)}</div></div>
                <div style={S.summaryCard}><div style={S.summaryHeading}>Avg Time</div><div style={S.summaryValue}>{packageHours}</div></div>
              </div>

              <div style={{ marginTop: 24 }}>
                <div style={S.sectionLabel}>Additional Notes</div>
                <textarea style={{ ...S.input, marginTop: 10, minHeight: 100, resize: "vertical" as const, fontFamily: "inherit", lineHeight: 1.5 }}
                  placeholder="Any access instructions, special requests, or notes about the vehicle condition."
                  value={bookingNotes} onChange={(e) => setBookingNotes(e.target.value)} />
              </div>

              <div style={S.buttonRow}>
                <button style={S.secondary} onClick={back}>Back</button>
                <div style={S.rightButtons}>
                  <button style={S.primary} onClick={async () => {
                    try {
                      if (serviceType === "mobile") {
                        if (!address.trim()) { alert("Please enter your service address."); return; }
                        if (!addressSelected) { alert("Please select a valid address from the dropdown."); return; }
                      }
                      const [yp, mp, dp] = selectedDate.split("-");
                      const safeDate = `${mp}/${dp}/${yp}`;
                      const res = await fetch(SCRIPT_URL, {
                        method: "POST",
                        body: JSON.stringify({
                          action: "bookAppointment", name, phone, email,
                          date: selectedDate, displayDate: safeDate, time: selectedTime,
                          year: vehicle === "boat" ? "" : year,
                          make: vehicle === "boat" ? boatMake : make,
                          model: vehicle === "boat" ? boatModel : model,
                          boatSize: vehicle === "boat" ? boatSize : "",
                          vehicle, packageType: pkg, hourlyRate,
                          addOns: addOns.join(", "), addOnEstimate,
                          serviceType, address, street, city,
                          state: stateRegion, zip, placeId, lat, lng,
                          avgTime: packageHours, notes: bookingNotes,
                          clientType,
                          recurringFrequency: frequency,
                          smsConsent: smsConsent,
                          smsMarketingConsent: smsMarketingConsent,
                        }),
                      });
                      const data = await res.json();
                      if (data.success) { next(); }
                      else { alert("Something went wrong. Please try again."); console.error(data); }
                    } catch (err) { alert("Something went wrong. Please try again."); console.error(err); }
                  }}>Submit Booking</button>
                </div>
              </div>
            </>
          )}

          {/* STEP 8 */}
          {step === 8 && (
            <>
              <div style={S.successWrap}>
                <div style={{ width: 56, height: 56, background: "#0f0f0f", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 18px" }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                    <polyline points="4,12 9,17 20,6" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <h2 style={S.title}>Booking Submitted</h2>
                <p style={S.successText}>
                  Your booking request has been received. Someone will be in touch shortly to confirm your appointment.
                  {clientType === "maintenance" && ` We'll also follow up to get your ${frequency === "biweekly" ? "bi-weekly" : "monthly"} schedule set up.`}
                </p>
                {googleUser && (
                  <button onClick={openMyBookings} style={{ ...S.secondary, marginTop: 8 }}>View My Bookings</button>
                )}
              </div>
              <div style={S.summaryGrid}>
                <div style={S.summaryCard}><div style={S.summaryHeading}>Customer</div><div style={S.summaryValue}>{name}<br />{phone}<br />{email}</div></div>
                <div style={S.summaryCard}><div style={S.summaryHeading}>Appointment</div><div style={S.summaryValue}>{formatDateLabel(selectedDate)}<br />{selectedTime || "N/A"}</div></div>
                <div style={S.summaryCard}>
                  <div style={S.summaryHeading}>Service Plan</div>
                  <div style={S.summaryValue}>
                    {clientType === "oneTime" ? "One-Time Service" : "Maintenance Plan"}
                    {clientType === "maintenance" && frequency && <><br />{frequency === "biweekly" ? "Bi-Weekly" : "Monthly"}</>}
                    {clientType === "maintenance" && selectedDate && frequency && (
                      <><br /><span style={{ fontSize: "0.88rem", fontWeight: 400, color: "#059669" }}>{getCadenceLabel(selectedDate, frequency)}</span></>
                    )}
                  </div>
                </div>
                {clientType === "maintenance" && selectedDate && frequency && (
                  <div style={{ ...S.summaryCard, gridColumn: "1 / -1", background: "rgba(16,185,129,0.08)", border: "1px solid #6ee7b7" }}>
                    <div style={S.summaryHeading}>Recurring Schedule</div>
                    <div style={{ fontSize: "0.9rem", color: "#34d399", fontWeight: 600, marginBottom: 8 }}>
                      {getCadenceLabel(selectedDate, frequency)} — first service {formatDateLabel(selectedDate)}
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 4 }}>
                      {calcRecurringDates(selectedDate, frequency, 6).map((d, i) => (
                        <div key={i} style={{ fontSize: "0.88rem", color: "rgba(255,255,255,0.7)" }}>{i + 2}. {d}</div>
                      ))}
                    </div>
                  </div>
                )}
                <div style={S.summaryCard}><div style={S.summaryHeading}>Package</div><div style={S.summaryValue}>{selectedVehicle?.label || "N/A"}<br />{pkg === "basic" ? "Basic Detail" : pkg === "premium" ? "Premium Detail" : pkg === "exterior" ? "Exterior Only — Basic" : pkg === "interior" ? "Interior Only — Basic" : pkg === "exteriorPremium" ? "Exterior Only — Premium" : pkg === "interiorPremium" ? "Interior Only — Premium" : "N/A"}<br />{estimateText || "N/A"}</div></div>
                <div style={S.summaryCard}><div style={S.summaryHeading}>Location</div><div style={S.summaryValue}>{serviceType === "mobile" ? "Mobile Service" : serviceType === "dropoff" ? "Drop-Off Service" : "N/A"}<br />{address || "No address provided"}</div></div>
                <div style={S.summaryCard}><div style={S.summaryHeading}>{vehicle === "boat" ? "Boat" : "Vehicle"}</div><div style={S.summaryValue}>{vehicleSummary}<br />{selectedVehicle?.label || "N/A"}</div></div>
                <div style={S.summaryCard}><div style={S.summaryHeading}>Add-Ons</div><div style={S.summaryValue}>{addOns.length ? addOns.join(", ") : "None"}</div></div>
                <div style={S.summaryCard}><div style={S.summaryHeading}>Add-On Estimate</div><div style={S.summaryValue}>{formatCurrency(addOnEstimate)}</div></div>
                <div style={S.summaryCard}><div style={S.summaryHeading}>Avg Time</div><div style={S.summaryValue}>{packageHours}</div></div>
                {bookingNotes.trim() && (
                  <div style={{ ...S.summaryCard, gridColumn: "1 / -1" }}>
                    <div style={S.summaryHeading}>Notes</div>
                    <div style={{ ...S.summaryValue, fontWeight: 400, color: "rgba(255,255,255,0.7)", whiteSpace: "pre-wrap" as const }}>{bookingNotes}</div>
                  </div>
                )}
              </div>

              {/* Action buttons */}
              <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" as const, marginTop: 28 }}>
                <button
                  onClick={() => setStep(0)}
                  style={{ ...S.secondary, padding: "12px 22px", fontSize: "0.95rem" }}
                >
                  Book Another Service
                </button>
                {googleUser ? (
                  <button
                    onClick={openMyBookings}
                    style={{ ...S.primary, padding: "12px 22px", fontSize: "0.95rem" }}
                  >
                    View My Bookings
                  </button>
                ) : (
                  <a
                    href="https://atxprestigedetailing.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ ...S.primary, padding: "12px 22px", fontSize: "0.95rem", textDecoration: "none", display: "inline-block" }}
                  >
                    Visit Our Website
                  </a>
                )}
              </div>
            </>
          )}

        </div>
      </div>
    </div>
  );
}