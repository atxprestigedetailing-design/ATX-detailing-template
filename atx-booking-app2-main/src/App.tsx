import logo from "./assets/logo.png";
import { useEffect, useRef, useState, useCallback } from "react";
import config from "./config";

declare global {
  interface Window { google: any; }
}

const GOOGLE_CLIENT_ID = config.googleClientId;
const SCRIPT_URL       = config.scriptUrl;
const TOTAL_STEPS      = 8;
const ADMIN_EMAILS     = (config as any).adminEmails as string[] || [config.adminEmail];
const isAdminEmail     = (email: string) => ADMIN_EMAILS.includes(email);

// ── AZ Details flat-rate package prices ──────────────────────────────────────
// ── Real (discounted) prices shown to client ──────────────────────────────────
const PACKAGE_PRICES: Record<string, number> = {
  basic:    129,  // Interior + Exterior (was $279)
  interior: 109,  // Interior Only       (was $169)
  exterior:  89,  // Exterior Only       (was $139)
};

// ── Original "crossed out" prices for display ─────────────────────────────────
const PACKAGE_ORIGINAL_PRICES: Record<string, number> = {
  basic:    279,
  interior: 169,
  exterior: 139,
};

const PACKAGE_LABELS: Record<string, string> = {
  basic:    "Interior + Exterior Detail",
  interior: "Interior Detail",
  exterior: "Exterior Detail",
};

const PACKAGE_INCLUDES: Record<string, string[]> = {
  basic: [
    "Thorough Vacuuming","Full Steam Cleaning","High-Pressure Air Blasting",
    "Scrubbing & Decontamination","Streakless Windows & Mirrors","Fabric & Carpet Shampooing",
    "Leather & Plastic Conditioning","Odour Removal / Deodorizing","Seat Shampoo or Leather Cleaning",
    "Full Rims, Tires, Exhaust & Gas Cap Cleaning","Pre-Wash, Foam Bath & Contact Wash",
    "Bug & Tar Removal","Tire Shine & Door Jamb Cleaning",
    "Iron Decontamination","Hydrophobic Protector Wax","Paint Sealant Protection",
  ],
  interior: [
    "Thorough Vacuuming","Full Steam Cleaning","High-Pressure Air Blasting",
    "Scrubbing & Decontamination","Streakless Windows & Mirrors",
    "Fabric & Carpet Shampooing","Leather & Plastic Conditioning",
    "Odour Removal / Deodorizing","Seat Shampoo or Leather Cleaning",
  ],
  exterior: [
    "Full Rims, Tires, Exhaust & Gas Cap Cleaning","Pre-Wash, Foam Bath & Contact Wash",
    "Bug & Tar Removal","Streakless Windows & Mirrors",
    "Tire Shine & Door Jamb Cleaning","Iron Decontamination",
    "Hydrophobic Protector Wax","Paint Sealant Protection",
  ],
};

// ── Slot hours 9am–7pm ────────────────────────────────────────────────────────
const SLOT_HOURS = [
  "9:00 AM","10:00 AM","11:00 AM","12:00 PM",
  "1:00 PM","2:00 PM","3:00 PM","4:00 PM",
  "5:00 PM","6:00 PM","7:00 PM",
];

// ── Types ─────────────────────────────────────────────────────────────────────
type VehicleType  = "truck" | "suv" | "sedan" | "coupe" | "";
type PackageType  = "basic" | "interior" | "exterior" | "";
type ServiceType  = "mobile" | "dropoff" | "";
type ClientType   = "oneTime" | "maintenance" | "";
type FrequencyType = "biweekly" | "monthly" | "";

type AddOn =
  | "Headlight Restoration"
  | "Pet Hair Removal"
  | "Clay Bar Treatment"
  | "Stain Removal"
  | "Paint Correction"
  | "Ceramic Coating"
  | "Engine Compartment Detail";

type GoogleUser = { name: string; email: string; picture: string; };

type Booking = {
  date: string; time: string; year: string; make: string; model: string;
  boatSize: string; vehicle: string; packageType: string; hourlyRate: string;
  addOns: string; serviceType: string; address: string; avgTime: string;
  notes: string; clientType: string; recurringFrequency: string; status: string;
  invoiceAmount: string; invoiceStatus: string; invoiceNote: string;
  photosLink: string; beforePhotoUrl: string; afterPhotoUrl: string;
  invoiceLink: string; name: string; phone: string; email: string; rowIndex: number;
};

type DiscountResult = { valid: boolean; pct: number; amount: number; label: string; type: string; };
type AvailabilitySlot = { date: string; time: string; available?: boolean; };

const vehicleOptions = [
  { id: "truck" as VehicleType, label: "Truck"  },
  { id: "suv"   as VehicleType, label: "SUV"    },
  { id: "sedan" as VehicleType, label: "Sedan"  },
  { id: "coupe" as VehicleType, label: "Coupe"  },
];

const addOnOptions: { label: AddOn; price: number; consultation?: boolean }[] = [
  { label: "Headlight Restoration",    price: 90  },
  { label: "Pet Hair Removal",         price: 50  },
  { label: "Clay Bar Treatment",       price: 70  },
  { label: "Stain Removal",            price: 0,  consultation: true },
  { label: "Paint Correction",         price: 0,  consultation: true },
  { label: "Ceramic Coating",          price: 0,  consultation: true },
  { label: "Engine Compartment Detail",price: 50  },
];

// ── Helper functions ──────────────────────────────────────────────────────────
function fmtDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

function parseBookingDate(dateStr: string): Date | null {
  if (!dateStr) return null;
  if (dateStr.includes("-")) {
    const parts = dateStr.split("-").map(Number);
    if (parts.length === 3 && parts[0] > 100) return new Date(parts[0], parts[1]-1, parts[2]); // YYYY-MM-DD
    if (parts.length === 3) return new Date(parts[2], parts[0]-1, parts[1]); // MM-DD-YYYY fallback
  }
  if (dateStr.includes("/")) {
    const parts = dateStr.split("/").map(Number);
    if (parts.length === 3 && parts[2] > 100) return new Date(parts[2], parts[0]-1, parts[1]); // MM/DD/YYYY
  }
  return null;
}

function formatDateLabel(dateStr: string) {
  if (!dateStr) return "N/A";
  const dt = parseBookingDate(dateStr);
  if (!dt || isNaN(dt.getTime())) return dateStr;
  return dt.toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric",year:"numeric"});
}

function isUpcoming(dateStr: string) {
  const dt = parseBookingDate(dateStr);
  if (!dt) return false;
  const today = new Date(); today.setHours(0,0,0,0);
  return dt >= today;
}

function calcRecurringDates(startDateStr: string, freq: string, count=6): string[] {
  if (!startDateStr || !freq) return [];
  const [y,m,d] = startDateStr.split("-").map(Number);
  const start = new Date(y,m-1,d);
  const dates: string[] = [];
  if (freq === "biweekly") {
    let next = new Date(start); next.setDate(next.getDate()+14);
    while (dates.length < count) { dates.push(formatDateLabel(fmtDate(next))); next.setDate(next.getDate()+14); }
  } else if (freq === "monthly") {
    const dow = start.getDay();
    const weekPos = Math.ceil(start.getDate()/7);
    const isLast = new Date(y,m-1,d+7).getMonth() !== start.getMonth();
    let cm = start.getMonth()+1; let cy = start.getFullYear();
    if (cm>11){cm=0;cy++;}
    while (dates.length < count) {
      const c = getNthWeekday(cy,cm,dow,weekPos,isLast);
      if (c) dates.push(formatDateLabel(fmtDate(c)));
      cm++; if(cm>11){cm=0;cy++;}
      if(cy>start.getFullYear()+3) break;
    }
  }
  return dates;
}

function getNthWeekday(year: number, month: number, dow: number, n: number, isLast: boolean): Date|null {
  if (isLast) { const last=new Date(year,month+1,0); while(last.getDay()!==dow)last.setDate(last.getDate()-1); return last; }
  const first=new Date(year,month,1); const diff=(dow-first.getDay()+7)%7;
  const result=new Date(year,month,1+diff+(n-1)*7);
  return result.getMonth()===month ? result : null;
}

function getCadenceLabel(startDateStr: string, freq: string): string {
  if (!startDateStr||!freq) return "";
  const [y,m,d]=startDateStr.split("-").map(Number);
  const start=new Date(y,m-1,d);
  const dayNames=["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
  if (freq==="biweekly") return `Every other ${dayNames[start.getDay()]}`;
  const weekPos=Math.ceil(start.getDate()/7);
  const isLast=new Date(y,m-1,d+7).getMonth()!==start.getMonth();
  const ordinals=["","1st","2nd","3rd","4th","5th"];
  return `Every ${isLast?"last":ordinals[weekPos]} ${dayNames[start.getDay()]} of the month`;
}

async function fetchAllAvailability(): Promise<AvailabilitySlot[]> {
  const slots: AvailabilitySlot[] = [];
  const today = new Date(); today.setHours(0,0,0,0);
  for (let i=1; i<60; i++) {
    const d = new Date(today); d.setDate(today.getDate()+i);
    const dateStr = fmtDate(d);
    SLOT_HOURS.forEach(time => slots.push({ date: dateStr, time, available: true }));
  }
  try {
    const res = await fetch(`${SCRIPT_URL}?action=getAllBookings`);
    const data: { bookings: Booking[] } = await res.json();
    const active = (data.bookings||[]).filter(b=>b.status!=="Cancelled"&&b.status!=="Skipped");
    active.forEach(booking => {
      const startIdx = SLOT_HOURS.indexOf(booking.time);
      if (startIdx===-1) return;
      for (let h=startIdx; h<Math.min(startIdx+4, SLOT_HOURS.length); h++) {
        const slot = slots.find(s=>s.date===booking.date&&s.time===SLOT_HOURS[h]);
        if (slot) slot.available = false;
      }
    });
  } catch(e) { console.error("Availability fetch failed",e); }
  return slots.filter(s=>s.available);
}

async function fetchBookingsForEmail(email: string): Promise<Booking[]> {
  const res = await fetch(`${SCRIPT_URL}?action=getBookingsByEmail&email=${encodeURIComponent(email)}`);
  const data: { bookings: Booking[] } = await res.json();
  return data.bookings||[];
}

async function fetchAllBookings(): Promise<Booking[]> {
  const res = await fetch(`${SCRIPT_URL}?action=getAllBookings`);
  const data: { bookings: Booking[] } = await res.json();
  return data.bookings||[];
}

async function updateBooking(rowIndex: number, updates: Record<string,string>): Promise<boolean> {
  const res = await fetch(SCRIPT_URL,{method:"POST",body:JSON.stringify({action:"updateBooking",rowIndex,...updates})});
  const data = await res.json(); return data.success;
}

// ── DiscountsTab component ────────────────────────────────────────────────────
function DiscountsTab({ S }: { S: any }) {
  type Discount = { rowIndex:number; code:string; type:string; value:string; label:string; active:string; };
  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [loading, setLoading]     = useState(false);
  const [saving, setSaving]       = useState(false);
  const [newCode, setNewCode]     = useState({ code:"", type:"percent", value:"", label:"" });

  async function loadDiscounts() {
    setLoading(true);
    try {
      const res = await fetch(`${SCRIPT_URL}?action=getDiscounts`);
      const d = await res.json();
      setDiscounts(d.discounts||[]);
    } catch { setDiscounts([]); }
    setLoading(false);
  }
  useEffect(() => { loadDiscounts(); },[]);

  async function addDiscount() {
    if (!newCode.code||!newCode.value) return;
    setSaving(true);
    try {
      const res = await fetch(SCRIPT_URL,{method:"POST",body:JSON.stringify({action:"addDiscount",...newCode,code:newCode.code.toUpperCase()})});
      const d = await res.json();
      if (d.success) { await loadDiscounts(); setNewCode({code:"",type:"percent",value:"",label:""}); }
      else alert("Failed to save code.");
    } catch { alert("Error saving code."); }
    setSaving(false);
  }

  async function toggleDiscount(disc: Discount) {
    const newActive = disc.active==="TRUE" ? "FALSE" : "TRUE";
    try {
      await fetch(SCRIPT_URL,{method:"POST",body:JSON.stringify({action:"toggleDiscount",rowIndex:disc.rowIndex,active:newActive})});
      setDiscounts(prev=>prev.map(d=>d.rowIndex===disc.rowIndex?{...d,active:newActive}:d));
    } catch { alert("Toggle failed."); }
  }

  async function deleteDiscount(disc: Discount) {
    if (!window.confirm(`Delete code "${disc.code}"?`)) return;
    try {
      await fetch(SCRIPT_URL,{method:"POST",body:JSON.stringify({action:"deleteDiscount",rowIndex:disc.rowIndex})});
      setDiscounts(prev=>prev.filter(d=>d.rowIndex!==disc.rowIndex));
    } catch { alert("Delete failed."); }
  }

  return (
    <div>
      <div style={{background:"rgba(251,191,36,0.08)",border:"1.5px solid #fcd34d",borderRadius:14,padding:18,marginBottom:20}}>
        <div style={{fontWeight:700,color:"#fbbf24",marginBottom:14,fontSize:"0.95rem"}}>Create Discount Code</div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit, minmax(140px,1fr))",gap:10,marginBottom:12}}>
          <div>
            <div style={{fontSize:"0.75rem",color:"rgba(255,255,255,0.45)",marginBottom:4}}>Code *</div>
            <input style={{...S.input,padding:"9px 12px",textTransform:"uppercase" as const}} placeholder="e.g. WELCOME10"
              value={newCode.code} onChange={e=>setNewCode(p=>({...p,code:e.target.value.toUpperCase()}))} />
          </div>
          <div>
            <div style={{fontSize:"0.75rem",color:"rgba(255,255,255,0.45)",marginBottom:4}}>Type</div>
            <select style={{...S.input,padding:"9px 12px",backgroundColor:"transparent"}}
              value={newCode.type} onChange={e=>setNewCode(p=>({...p,type:e.target.value}))}>
              <option value="percent">% Percentage Off</option>
              <option value="flat">$ Flat Amount Off</option>
            </select>
          </div>
          <div>
            <div style={{fontSize:"0.75rem",color:"rgba(255,255,255,0.45)",marginBottom:4}}>Value *</div>
            <input style={{...S.input,padding:"9px 12px"}} type="number" step="1"
              placeholder={newCode.type==="percent"?"e.g. 10 (for 10%)":"e.g. 20 (for $20)"}
              value={newCode.value} onChange={e=>setNewCode(p=>({...p,value:e.target.value}))} />
          </div>
          <div>
            <div style={{fontSize:"0.75rem",color:"rgba(255,255,255,0.45)",marginBottom:4}}>Label (optional)</div>
            <input style={{...S.input,padding:"9px 12px"}} placeholder="e.g. New client special"
              value={newCode.label} onChange={e=>setNewCode(p=>({...p,label:e.target.value}))} />
          </div>
        </div>
        <div style={{display:"flex",gap:8}}>
          <button onClick={addDiscount} disabled={!newCode.code||!newCode.value||saving}
            style={{background:"#f59e0b",color:"#fff",border:"none",borderRadius:10,padding:"10px 20px",fontWeight:700,fontSize:"0.9rem",cursor:"pointer",opacity:!newCode.code||!newCode.value?0.5:1}}>
            {saving?"Saving...":"+ Add Code"}
          </button>
          <button onClick={loadDiscounts}
            style={{background:"rgba(255,255,255,0.07)",color:"#e8eaf0",border:"1px solid rgba(255,255,255,0.12)",borderRadius:10,padding:"10px 16px",fontWeight:600,fontSize:"0.9rem",cursor:"pointer"}}>
            Refresh
          </button>
        </div>
      </div>

      {loading ? <div style={{textAlign:"center",padding:30,color:"rgba(255,255,255,0.45)"}}>Loading codes...</div> : (
        <div style={{display:"grid",gap:10}}>
          {discounts.length===0 && <div style={{textAlign:"center",padding:30,color:"rgba(255,255,255,0.45)"}}>No discount codes yet. Create one above.</div>}
          {discounts.map((d,i) => (
            <div key={i} style={{background:d.active==="TRUE"?"rgba(16,185,129,0.08)":"rgba(255,255,255,0.03)",border:`1px solid ${d.active==="TRUE"?"#6ee7b7":"rgba(255,255,255,0.08)"}`,borderRadius:12,padding:"12px 16px",display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,flexWrap:"wrap" as const}}>
              <div>
                <div style={{fontWeight:800,color:"#f1f5f9",fontSize:"1rem",letterSpacing:"0.08em",fontFamily:"monospace"}}>{d.code}</div>
                <div style={{fontSize:"0.82rem",color:"rgba(255,255,255,0.5)",marginTop:2}}>
                  {d.type==="percent"?`${d.value}% off`:`$${d.value} off`}
                  {d.label?` · ${d.label}`:""}
                </div>
              </div>
              <div style={{display:"flex",gap:8}}>
                <button onClick={()=>toggleDiscount(d)}
                  style={{background:d.active==="TRUE"?"rgba(239,68,68,0.1)":"rgba(16,185,129,0.1)",color:d.active==="TRUE"?"#f87171":"#34d399",border:`1px solid ${d.active==="TRUE"?"#fca5a5":"#6ee7b7"}`,borderRadius:8,padding:"6px 12px",fontWeight:700,fontSize:"0.82rem",cursor:"pointer"}}>
                  {d.active==="TRUE"?"Deactivate":"Activate"}
                </button>
                <button onClick={()=>deleteDiscount(d)}
                  style={{background:"rgba(239,68,68,0.08)",color:"#dc2626",border:"1px solid #fca5a5",borderRadius:8,padding:"6px 10px",fontWeight:700,fontSize:"0.82rem",cursor:"pointer"}}>
                  🗑
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── BookingCard ───────────────────────────────────────────────────────────────
function BookingCard({ booking, upcoming, onRequestChange }: {
  booking: Booking; upcoming: boolean; onRequestChange: (b: Booking) => void;
}) {
  const vehicleLabel = [booking.year, booking.make, booking.model].filter(Boolean).join(" ");
  const hasPhotos = booking.beforePhotoUrl || booking.afterPhotoUrl;
  const isCompleted = booking.status === "Completed" || booking.invoiceStatus === "paid";
  const [showPhotos, setShowPhotos] = useState(false);
  const [loadedImgs, setLoadedImgs] = useState<Record<string,boolean>>({});
  const beforeUrls = booking.beforePhotoUrl ? booking.beforePhotoUrl.split(",").map(u=>u.trim()).filter(Boolean) : [];
  const afterUrls  = booking.afterPhotoUrl  ? booking.afterPhotoUrl.split(",").map(u=>u.trim()).filter(Boolean) : [];
  const fullSizeUrl = (url: string) => url.replace("sz=w400","sz=w1600");
  async function downloadPhoto(url: string, label: string) {
    try {
      const res = await fetch(fullSizeUrl(url)); const blob = await res.blob();
      const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
      a.download = label+".jpg"; a.click(); URL.revokeObjectURL(a.href);
    } catch { window.open(fullSizeUrl(url),"_blank"); }
  }
  const pkgLabel = PACKAGE_LABELS[booking.packageType] || booking.packageType;
  return (
    <div style={{background:"rgba(255,255,255,0.05)",border:upcoming?"1px solid rgba(59,130,246,0.45)":"1px solid rgba(255,255,255,0.08)",borderRadius:16,padding:18,position:"relative" as const}}>
      {upcoming && <span style={{position:"absolute" as const,top:14,right:14,background:"rgba(59,130,246,0.15)",color:"#93c5fd",fontSize:"0.75rem",fontWeight:700,borderRadius:999,padding:"3px 10px",border:"1px solid rgba(59,130,246,0.3)"}}>UPCOMING</span>}
      <div style={{fontSize:"1rem",fontWeight:700,color:"#f1f5f9",marginBottom:4}}>{formatDateLabel(booking.date)}{booking.time?` at ${booking.time}`:""}</div>
      <div style={{fontSize:"0.92rem",color:"rgba(255,255,255,0.45)",lineHeight:1.6}}>
        {vehicleLabel && <div>{vehicleLabel}</div>}
        <div>{pkgLabel}</div>
        {booking.serviceType && <div>{booking.serviceType==="mobile"?`Mobile${booking.address?` - ${booking.address}`:""}` : "Drop-Off"}</div>}
        {booking.addOns && <div>Add-Ons: {booking.addOns}</div>}
      </div>
      {booking.invoiceStatus==="released" && booking.invoiceAmount && (
        <div style={{marginTop:10,background:"rgba(251,191,36,0.1)",border:"1px solid rgba(251,191,36,0.3)",borderRadius:10,padding:"10px 14px",fontSize:"0.88rem",color:"#fbbf24"}}>
          <span style={{fontWeight:700}}>Balance due: ${booking.invoiceAmount}</span>
          {booking.invoiceNote?` — ${booking.invoiceNote}`:""}
        </div>
      )}
      {booking.invoiceStatus==="paid" && (
        <div style={{marginTop:10,background:"rgba(16,185,129,0.1)",border:"1px solid rgba(16,185,129,0.25)",borderRadius:10,padding:"8px 14px",fontSize:"0.82rem",color:"#34d399",fontWeight:600}}>
          ✓ Paid ${booking.invoiceAmount}
        </div>
      )}
      <div style={{display:"flex",gap:8,marginTop:14,flexWrap:"wrap" as const}}>
        {upcoming && <button onClick={()=>onRequestChange(booking)} style={{background:"rgba(255,255,255,0.08)",color:"#f1f5f9",border:"1px solid rgba(255,255,255,0.15)",borderRadius:10,padding:"9px 16px",fontSize:"0.9rem",fontWeight:600,cursor:"pointer"}}>Request a Change</button>}
        {isCompleted && hasPhotos && <button onClick={()=>setShowPhotos(p=>!p)} style={{display:"inline-flex",alignItems:"center",gap:6,background:showPhotos?"rgba(59,130,246,0.25)":"rgba(59,130,246,0.12)",color:"#93c5fd",border:"1px solid rgba(59,130,246,0.3)",borderRadius:10,padding:"9px 16px",fontSize:"0.9rem",fontWeight:600,cursor:"pointer"}}>📸 {showPhotos?"Hide":"View Photos"}</button>}
        {isCompleted && booking.invoiceLink && <a href={booking.invoiceLink} target="_blank" rel="noopener noreferrer" style={{display:"inline-flex",alignItems:"center",gap:6,background:"rgba(16,185,129,0.1)",color:"#34d399",border:"1px solid rgba(16,185,129,0.3)",borderRadius:10,padding:"9px 16px",fontSize:"0.9rem",fontWeight:600,cursor:"pointer",textDecoration:"none"}}>🧾 Invoice</a>}
      </div>
      {showPhotos && hasPhotos && (
        <div style={{marginTop:16,background:"rgba(0,0,0,0.3)",borderRadius:14,padding:16}}>
          {[{urls:beforeUrls,label:"Before"},{urls:afterUrls,label:"After"}].map(({urls,label})=>urls.length>0&&(
            <div key={label} style={{marginBottom:12}}>
              <div style={{fontSize:"0.72rem",fontWeight:700,color:"rgba(255,255,255,0.35)",textTransform:"uppercase" as const,letterSpacing:"0.08em",marginBottom:8}}>{label} ({urls.length})</div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill, minmax(90px,1fr))",gap:8}}>
                {urls.map((url,i)=>(
                  <div key={i} style={{position:"relative" as const,borderRadius:10,overflow:"hidden",aspectRatio:"1",background:"rgba(255,255,255,0.06)"}}>
                    {!loadedImgs[url] && <div style={{position:"absolute" as const,inset:0,display:"flex",alignItems:"center",justifyContent:"center"}}><div style={{width:20,height:20,border:"2px solid rgba(255,255,255,0.15)",borderTopColor:"#93c5fd",borderRadius:"50%",animation:"spin 0.7s linear infinite"}}/></div>}
                    <img src={url} loading="lazy" onLoad={()=>setLoadedImgs(p=>({...p,[url]:true}))} style={{width:"100%",height:"100%",objectFit:"cover" as const,display:"block",opacity:loadedImgs[url]?1:0,transition:"opacity 0.3s ease",cursor:"pointer"}} onClick={()=>window.open(fullSizeUrl(url),"_blank")}/>
                    <button onClick={()=>downloadPhoto(url,`${label.toLowerCase()}_${i+1}`)} style={{position:"absolute" as const,bottom:4,right:4,background:"rgba(0,0,0,0.65)",border:"none",borderRadius:6,width:26,height:26,cursor:"pointer",color:"#fff",fontSize:"0.7rem",display:"flex",alignItems:"center",justifyContent:"center"}}>⬇</button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────────────────────────
export default function App() {
  const addressInputRef = useRef<HTMLInputElement>(null);
  const qAddressRef     = useRef<HTMLInputElement>(null);

  const [googleUser, setGoogleUser]     = useState<GoogleUser|null>(()=>{ try{const s=localStorage.getItem("atx_google_user");return s?JSON.parse(s):null;}catch{return null;} });
  const [googleScriptLoaded, setGoogleScriptLoaded] = useState(false);
  const [splashDone, setSplashDone]     = useState(false);
  const [splashPhase, setSplashPhase]   = useState(0);
  const [view, setView]                 = useState<"booking"|"myBookings"|"requestChange"|"admin"|"inventory">("booking");
  const [adminTab, setAdminTab]         = useState<"bookings"|"invoices"|"revenue"|"discounts">("bookings");
  const [adminBookings, setAdminBookings]   = useState<Booking[]>([]);
  const [adminLoading, setAdminLoading]     = useState(false);
  const [adminFilter, setAdminFilter]       = useState<"all"|"upcoming"|"past"|"maintenance">("all");
  const [selectedAdminBooking, setSelectedAdminBooking] = useState<Booking|null>(null);
  const [completeAmount, setCompleteAmount] = useState("");
  const [completeNote, setCompleteNote]     = useState("");
  const [completeLoading, setCompleteLoading] = useState(false);
  const [editingInvoiceRow, setEditingInvoiceRow]   = useState<number|null>(null);
  const [editInvoiceAmount, setEditInvoiceAmount]   = useState("");
  const [editInvoiceNote, setEditInvoiceNote]       = useState("");
  const [quickBookClient, setQuickBookClient]   = useState<Booking|null>(null);
  const [quickBookSearch, setQuickBookSearch]   = useState("");
  const [quickBookOpen, setQuickBookOpen]       = useState(false);
  const [qCalMonth, setQCalMonth] = useState(()=>new Date().getMonth());
  const [qCalYear, setQCalYear]   = useState(()=>new Date().getFullYear());
  const [qAddOnList, setQAddOnList] = useState<AddOn[]>([]);
  const [qDate, setQDate]         = useState("");
  const [qTime, setQTime]         = useState("");
  const [qPkg, setQPkg]           = useState("basic");
  const [qClientType, setQClientType] = useState("oneTime");
  const [qFreq, setQFreq]         = useState("");
  const [qNotes, setQNotes]       = useState("");
  const [qAddress, setQAddress]   = useState("");
  const [qServiceType, setQServiceType] = useState("mobile");
  const [qSubmitting, setQSubmitting]   = useState(false);
  const [qCustomService, setQCustomService] = useState("");
  const [qCustomPrice, setQCustomPrice]     = useState("");
  const [copiedAmount, setCopiedAmount] = useState<number|null>(null);
  const [editingBooking, setEditingBooking] = useState<Booking|null>(null);
  const [editFields, setEditFields]         = useState<Partial<Booking>>({});
  const [editSaving, setEditSaving]         = useState(false);
  const [bookingsTab, setBookingsTab]       = useState<"appointments"|"maintenance">("appointments");
  const [photoUploading, setPhotoUploading] = useState<{[key:number]:string}>({});
  const [localPhotoPreviews, setLocalPhotoPreviews] = useState<{[key:string]:string[]}>({});
  const [processingRows, setProcessingRows] = useState<Set<number>>(new Set());
  const [userBookings, setUserBookings]     = useState<Booking[]>([]);
  const [bookingsLoading, setBookingsLoading] = useState(false);
  const [changeTarget, setChangeTarget]     = useState<Booking|null>(null);
  const [changeNote, setChangeNote]         = useState("");
  const [changeSubmitted, setChangeSubmitted]   = useState(false);
  const [changeSubmitting, setChangeSubmitting] = useState(false);
  // Inventory state — used by inventory view (accessed via setView("inventory"))
  const [inventoryItems, setInventoryItems] = useState<any[]>([]);
  const [inventoryLoading, setInventoryLoading] = useState(false);
  const [inventoryFilter, setInventoryFilter]   = useState<"all"|"low">("all");
  const [inventorySearch, setInventorySearch]   = useState("");
  const [editingInventoryRow, setEditingInventoryRow] = useState<number|null>(null);
  const [editingInventoryVal, setEditingInventoryVal] = useState("");
  const [editingThresholdRow, setEditingThresholdRow] = useState<number|null>(null);
  const [editingThresholdVal, setEditingThresholdVal] = useState("");
  const [inventorySaving, setInventorySaving]       = useState(false);
  const [addingInventoryItem, setAddingInventoryItem] = useState(false);
  const [newInventoryItem, setNewInventoryItem]       = useState({item:"",category:"",quantity:"",unit:"",lowStockThreshold:"",notes:""});
  const [invCatFilter, setInvCatFilter]               = useState("All");
  const [maintTimeConflicts, setMaintTimeConflicts]   = useState<any[]>([]);
  const [maintTimeChecking, setMaintTimeChecking]     = useState(false);
  const [maintTimeCheckedFor, setMaintTimeCheckedFor] = useState<{rowIndex:number;time:string}|null>(null);
  // Touch all the above to satisfy tsc noUnusedLocals when inventory view is split out
  void [inventoryItems,inventoryLoading,inventoryFilter,inventorySearch,editingInventoryRow,editingInventoryVal,editingThresholdRow,editingThresholdVal,inventorySaving,addingInventoryItem,newInventoryItem,invCatFilter,maintTimeConflicts,maintTimeChecking,maintTimeCheckedFor,setInventoryItems,setInventoryLoading,setInventoryFilter,setInventorySearch,setEditingInventoryRow,setEditingInventoryVal,setEditingThresholdRow,setEditingThresholdVal,setInventorySaving,setAddingInventoryItem,setNewInventoryItem,setInvCatFilter,setMaintTimeConflicts,setMaintTimeChecking,setMaintTimeCheckedFor];

  // Toast system
  type Toast = { id:number; message:string; type:"loading"|"success"|"error"; };
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastId = useRef(0);
  function showToast(message:string, type:Toast["type"]="loading", duration?:number):number {
    const id=++toastId.current; setToasts(p=>[...p,{id,message,type}]);
    if(duration) setTimeout(()=>dismissToast(id),duration); return id;
  }
  function dismissToast(id:number){setToasts(p=>p.filter(t=>t.id!==id));}
  function updateToast(id:number,message:string,type:Toast["type"],duration=3000){
    setToasts(p=>p.map(t=>t.id===id?{...t,message,type}:t)); setTimeout(()=>dismissToast(id),duration);
  }

  // Booking flow state
  const [step, setStep]               = useState(0);
  const [vehicle, setVehicle]         = useState<VehicleType>("");
  const [clientType, setClientType]   = useState<ClientType>("");
  const [frequency, setFrequency]     = useState<FrequencyType>("");
  const [pkg, setPkg]                 = useState<PackageType>("");
  const [addOns, setAddOns]           = useState<AddOn[]>([]);
  const [serviceType, setServiceType] = useState<ServiceType>("");
  const [name, setName]               = useState("");
  const [phone, setPhone]             = useState("");
  const [smsConsent] = useState(false);
  const [smsMarketingConsent] = useState(false);
  const [email, setEmail]             = useState("");
  const [year, setYear]               = useState("");
  const [make, setMake]               = useState("");
  const [model, setModel]             = useState("");
  const [bookingNotes, setBookingNotes] = useState("");
  const [selectedDate, setSelectedDate] = useState("");
  const [allAvailableSlots, setAllAvailableSlots] = useState<AvailabilitySlot[]>([]);
  const [availableDates, setAvailableDates]       = useState<string[]>([]);
  const [calMonth, setCalMonth] = useState(()=>new Date().getMonth());
  const [calYear, setCalYear]   = useState(()=>new Date().getFullYear());
  const [selectedTime, setSelectedTime] = useState("");
  const [address, setAddress]           = useState("");
  const [street, setStreet]             = useState("");
  const [city, setCity]                 = useState("");
  const [stateRegion, setStateRegion]   = useState("");
  const [zip, setZip]                   = useState("");
  const [placeId, setPlaceId]           = useState("");
  const [lat, setLat]                   = useState("");
  const [lng, setLng]                   = useState("");
  const [addressSelected, setAddressSelected] = useState(false);
  const [makeOptions, setMakeOptions]   = useState<string[]>([]);
  const [modelOptions, setModelOptions] = useState<string[]>([]);
  const [discountCode, setDiscountCode] = useState("");
  const [discountResult, setDiscountResult] = useState<DiscountResult|null>(null);
  const [discountChecking, setDiscountChecking] = useState(false);

  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({length:currentYear-1995+1},(_,i)=>String(currentYear-i));

  // Job Timer
  const [timerBookingRow, setTimerBookingRow] = useState<number|null>(null);
  const [timerElapsed, setTimerElapsed]       = useState(0);
  const [timerRunning, setTimerRunning]       = useState(false);
  const timerIntervalRef = useRef<ReturnType<typeof setInterval>|null>(null);
  useEffect(()=>{
    if(timerRunning){timerIntervalRef.current=setInterval(()=>setTimerElapsed(p=>p+1),1000);}
    else{if(timerIntervalRef.current)clearInterval(timerIntervalRef.current);}
    return()=>{if(timerIntervalRef.current)clearInterval(timerIntervalRef.current);};
  },[timerRunning]);
  function timerDisplay(secs:number){const h=Math.floor(secs/3600);const m=Math.floor((secs%3600)/60);const s=secs%60;return`${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;}
  function startTimer(rowIndex:number){setTimerBookingRow(rowIndex);setTimerElapsed(0);setTimerRunning(true);}
  async function stopTimer(booking:Booking){
    setTimerRunning(false);
    try{await fetch(SCRIPT_URL,{method:"POST",body:JSON.stringify({action:"updateBookingFields",rowIndex:booking.rowIndex,fields:{timerHours:(timerElapsed/3600).toFixed(2)}})});}
    catch(e){console.error("Timer save failed",e);}
    setTimerBookingRow(null);
  }

  // Splash
  useEffect(()=>{const t=setTimeout(()=>setSplashPhase(1),1200);return()=>clearTimeout(t);},[]);

  // Global styles
  useEffect(()=>{
    const styleId="atx-global-styles";
    if(document.getElementById(styleId))return;
    const style=document.createElement("style");
    style.id=styleId;
    style.textContent=`
      @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&display=swap');
      *,*::before,*::after{box-sizing:border-box;}
      @keyframes fadeSlideUp{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:translateY(0)}}
      @keyframes toastIn{from{opacity:0;transform:translateX(60px) scale(0.95)}to{opacity:1;transform:translateX(0) scale(1)}}
      @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
      @keyframes orb1{0%,100%{transform:translate(0,0) scale(1)}33%{transform:translate(60px,-40px) scale(1.1)}66%{transform:translate(-30px,60px) scale(0.95)}}
      @keyframes orb2{0%,100%{transform:translate(0,0) scale(1)}33%{transform:translate(-80px,50px) scale(1.05)}66%{transform:translate(40px,-70px) scale(1.1)}}
      @keyframes orb3{0%,100%{transform:translate(0,0) scale(1)}50%{transform:translate(50px,80px) scale(1.08)}}
      @keyframes stagger-in{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
      @keyframes glowPulse{0%,100%{box-shadow:0 0 20px rgba(59,130,246,0.5),0 4px 24px rgba(0,0,0,0.5)}50%{box-shadow:0 0 44px rgba(59,130,246,0.85),0 4px 24px rgba(0,0,0,0.5)}}
      .atx-bg{position:fixed;inset:0;overflow:hidden;z-index:0;pointer-events:none;}
      .atx-orb{position:absolute;border-radius:50%;filter:blur(80px);opacity:0.35;}
      .atx-orb-1{width:600px;height:600px;top:-200px;right:-100px;background:radial-gradient(circle,#1e40af 0%,transparent 70%);animation:orb1 18s ease-in-out infinite;}
      .atx-orb-2{width:500px;height:500px;bottom:-100px;left:-150px;background:radial-gradient(circle,#0e7490 0%,transparent 70%);animation:orb2 22s ease-in-out infinite;}
      .atx-orb-3{width:400px;height:400px;top:40%;left:40%;background:radial-gradient(circle,#5b21b6 0%,transparent 70%);animation:orb3 26s ease-in-out infinite;}
      .atx-grid{position:absolute;inset:0;background-image:linear-gradient(rgba(255,255,255,0.03) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.03) 1px,transparent 1px);background-size:60px 60px;}
      button{font-family:'Outfit',sans-serif;transition:transform 0.15s cubic-bezier(0.16,1,0.3,1),box-shadow 0.15s ease,filter 0.15s ease,opacity 0.15s ease;}
      button:hover:not(:disabled){transform:translateY(-2px);filter:brightness(1.12);box-shadow:0 8px 30px rgba(0,0,0,0.35);}
      button:active:not(:disabled){transform:translateY(0px) scale(0.97) !important;filter:brightness(0.92);}
      .booking-card{transition:box-shadow 0.25s ease,transform 0.25s cubic-bezier(0.16,1,0.3,1),border-color 0.2s ease;}
      .booking-card:hover{box-shadow:0 20px 60px rgba(0,0,0,0.5),inset 0 1px 0 rgba(255,255,255,0.12);transform:translateY(-3px);border-color:rgba(255,255,255,0.2) !important;}
      .inv-item{transition:box-shadow 0.2s ease,transform 0.2s cubic-bezier(0.16,1,0.3,1);}
      .inv-item:hover{box-shadow:0 12px 40px rgba(0,0,0,0.4);transform:translateY(-2px);}
      input,select,textarea{font-family:'Outfit',sans-serif;transition:border-color 0.2s ease,box-shadow 0.2s ease;}
      input:focus,select:focus,textarea:focus{outline:none;border-color:rgba(59,130,246,0.7) !important;box-shadow:0 0 0 3px rgba(59,130,246,0.15) !important;}
      .stagger-1{animation:stagger-in 0.4s cubic-bezier(0.16,1,0.3,1) 0.05s both;}
      .stagger-2{animation:stagger-in 0.4s cubic-bezier(0.16,1,0.3,1) 0.10s both;}
      .stagger-3{animation:stagger-in 0.4s cubic-bezier(0.16,1,0.3,1) 0.15s both;}
      .stagger-4{animation:stagger-in 0.4s cubic-bezier(0.16,1,0.3,1) 0.20s both;}
      ::-webkit-scrollbar{width:6px;height:6px;}
      ::-webkit-scrollbar-track{background:rgba(255,255,255,0.03);}
      ::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.12);border-radius:3px;}
      option{background:#0f1623;color:#f1f5f9;}
      ::selection{background:rgba(59,130,246,0.35);color:#fff;}
      .progress-bar-track{background:rgba(255,255,255,0.06) !important;}
      .progress-bar-fill{background:linear-gradient(90deg,#3b82f6,#8b5cf6) !important;box-shadow:0 0 12px rgba(59,130,246,0.5);}
    `;
    document.head.appendChild(style);
  },[]);

  // Google Sign-In
  useEffect(()=>{
    if(document.getElementById("google-gsi-script")){setGoogleScriptLoaded(true);return;}
    const script=document.createElement("script");
    script.id="google-gsi-script";script.src="https://accounts.google.com/gsi/client";
    script.async=true;script.defer=true;script.onload=()=>setGoogleScriptLoaded(true);
    document.body.appendChild(script);
  },[]);
  useEffect(()=>{
    if(!googleScriptLoaded||googleUser)return;
    if(!window.google?.accounts?.id)return;
    window.google.accounts.id.initialize({client_id:GOOGLE_CLIENT_ID,callback:handleGoogleCredential,cancel_on_tap_outside:false});
  },[googleScriptLoaded,googleUser]);

  function handleGoogleCredential(response: any){
    try{
      const payload=JSON.parse(atob(response.credential.split(".")[1]));
      const user={name:payload.name||"",email:payload.email||"",picture:payload.picture||""};
      setGoogleUser(user);setEmail(payload.email||"");
      localStorage.setItem("atx_google_user",JSON.stringify(user));
    }catch(e){console.error("Google sign-in error",e);}
  }
  function handleSignOut(){
    if(window.google?.accounts?.id)window.google.accounts.id.disableAutoSelect();
    localStorage.removeItem("atx_google_user");
    setGoogleUser(null);setEmail("");setView("booking");setUserBookings([]);
  }

  const loadMyBookings = useCallback(async()=>{
    if(!googleUser)return;setBookingsLoading(true);
    try{const bookings=await fetchBookingsForEmail(googleUser.email);setUserBookings(bookings);}
    catch(e){console.error("Failed to load bookings",e);}finally{setBookingsLoading(false);}
  },[googleUser]);

  function openMyBookings(){setView("myBookings");setBookingsTab("appointments");loadMyBookings();}

  const loadAdminBookings=useCallback(async()=>{
    setAdminLoading(true);
    try{const bookings=await fetchAllBookings();setAdminBookings(bookings);}
    catch(e){console.error(e);}finally{setAdminLoading(false);}
  },[]);

  const loadInventory=useCallback(async()=>{
    setInventoryLoading(true);
    try{const res=await fetch(`${SCRIPT_URL}?action=getInventory`);const data=await res.json();setInventoryItems(data.items||[]);}
    catch(e){console.error(e);}finally{setInventoryLoading(false);}
  },[]);

  // Discount code validation
  async function applyDiscountCode(code: string){
    if(!code.trim())return;
    setDiscountChecking(true);
    try{
      const res=await fetch(SCRIPT_URL,{method:"POST",body:JSON.stringify({action:"validateDiscountCode",code:code.trim().toUpperCase()})});
      const d=await res.json();
      if(d.valid){
        const basePrice=PACKAGE_PRICES[pkg]||0;
        const subtotal=basePrice+addOnTotal;
        const discountAmt=d.type==="percent"?Math.round(subtotal*d.value/100):Math.min(d.value,subtotal);
        setDiscountResult({valid:true,pct:d.type==="percent"?d.value:0,amount:discountAmt,label:d.label||code.toUpperCase(),type:d.type});
      }else{
        setDiscountResult({valid:false,pct:0,amount:0,label:"",type:""});
      }
    }catch{setDiscountResult({valid:false,pct:0,amount:0,label:"",type:""});}
    setDiscountChecking(false);
  }

  async function handleMarkComplete(){
    if(!selectedAdminBooking)return;
    if(processingRows.has(selectedAdminBooking.rowIndex))return;
    const savedBooking=selectedAdminBooking;
    const finalAmount=completeAmount;
    if(!finalAmount||parseFloat(finalAmount)<=0){alert("Please enter the invoice amount.");return;}
    setProcessingRows(p=>new Set([...p,savedBooking.rowIndex]));
    setCompleteLoading(true);
    setAdminBookings(p=>p.map(b=>b.rowIndex===savedBooking.rowIndex?{...b,status:"Completed",invoiceAmount:finalAmount,invoiceStatus:"pending",invoiceNote:completeNote}:b));
    setSelectedAdminBooking(null);setCompleteAmount("");setCompleteNote("");
    try{
      const ok=await updateBooking(savedBooking.rowIndex,{status:"Completed",invoiceAmount:finalAmount,invoiceStatus:"pending",invoiceNote:completeNote});
      if(ok){
        if(savedBooking.clientType==="maintenance"&&savedBooking.recurringFrequency&&savedBooking.date){
          const [y,m,d]=savedBooking.date.split("-").map(Number);
          const start=new Date(y,m-1,d);
          const nextDate=savedBooking.recurringFrequency==="biweekly"
            ?new Date(start.getFullYear(),start.getMonth(),start.getDate()+14)
            :getNthWeekday(start.getMonth()+1>11?start.getFullYear()+1:start.getFullYear(),start.getMonth()+1>11?0:start.getMonth()+1,start.getDay(),Math.ceil(start.getDate()/7),new Date(start.getFullYear(),start.getMonth(),start.getDate()+7).getMonth()!==start.getMonth());
          if(nextDate){
            try{await fetch(SCRIPT_URL,{method:"POST",body:JSON.stringify({action:"createNextMaintenanceBooking",...savedBooking,date:fmtDate(nextDate),displayDate:fmtDate(nextDate),status:"Booked",invoiceAmount:"",invoiceStatus:"",invoiceNote:""})});}
            catch(e){console.error("Failed to create next booking",e);}
          }
        }
        await loadAdminBookings();
      }else{alert("Something went wrong.");}
    }catch(e){alert("Something went wrong.");}
    finally{setCompleteLoading(false);setProcessingRows(p=>{const n=new Set(p);n.delete(savedBooking.rowIndex);return n;});}
  }

  async function handleSaveEdit(){
    if(!editingBooking)return;setEditSaving(true);
    const dateChanged=editFields.date&&editFields.date!==editingBooking.date;
    const timeChanged=editFields.time&&editFields.time!==editingBooking.time;
    const scheduleChanged=dateChanged||timeChanged;
    try{
      const res=await fetch(SCRIPT_URL,{method:"POST",body:JSON.stringify({
        action:"updateBookingFields",rowIndex:editingBooking.rowIndex,fields:editFields,
        oldDate:editingBooking.date,oldTime:editingBooking.time,scheduleChanged,
        customerName:editingBooking.name,customerEmail:editingBooking.email,customerPhone:editingBooking.phone,
        vehicle:[editFields.year||editingBooking.year,editFields.make||editingBooking.make,editFields.model||editingBooking.model].filter(Boolean).join(" "),
        packageType:editFields.packageType||editingBooking.packageType,
        serviceType:editFields.serviceType||editingBooking.serviceType,
        address:editFields.address||editingBooking.address,
        hourlyRate:editingBooking.hourlyRate,serviceDate:editFields.date||editingBooking.date,
        hasDetailChanges:false,changeDetails:"[]",
      })});
      const data=await res.json();
      if(data.success){await loadAdminBookings();setEditingBooking(null);setEditFields({});}
      else{alert("Something went wrong.");}
    }catch(e){alert("Something went wrong.");}finally{setEditSaving(false);}
  }

  async function handleReleaseInvoice(booking:Booking){
    if(processingRows.has(booking.rowIndex))return;
    setProcessingRows(p=>new Set([...p,booking.rowIndex]));
    setAdminBookings(p=>p.map(b=>b.rowIndex===booking.rowIndex?{...b,invoiceStatus:"released"}:b));
    try{
      const ok=await updateBooking(booking.rowIndex,{invoiceStatus:"released"});
      if(ok){
        fetch(SCRIPT_URL,{method:"POST",body:JSON.stringify({action:"sendInvoiceEmail",customerName:booking.name,customerEmail:booking.email,customerPhone:booking.phone,invoiceAmount:booking.invoiceAmount,invoiceNote:booking.invoiceNote,serviceDate:booking.date})}).catch(e=>console.error(e));
        await loadAdminBookings();
      }else{setAdminBookings(p=>p.map(b=>b.rowIndex===booking.rowIndex?{...b,invoiceStatus:"pending"}:b));alert("Something went wrong.");}
    }catch(e){alert("Something went wrong.");}
    finally{setProcessingRows(p=>{const n=new Set(p);n.delete(booking.rowIndex);return n;});}
  }

  async function handleMarkPaid(booking:Booking){
    if(processingRows.has(booking.rowIndex))return;
    setProcessingRows(p=>new Set([...p,booking.rowIndex]));
    setAdminBookings(p=>p.map(b=>b.rowIndex===booking.rowIndex?{...b,invoiceStatus:"paid"}:b));
    const tid=showToast("Sending receipt...","loading");
    try{
      const ok=await updateBooking(booking.rowIndex,{invoiceStatus:"paid"});
      if(ok){
        const pkgLabel=PACKAGE_LABELS[booking.packageType]||booking.packageType;
        try{
          const emailRes=await fetch(SCRIPT_URL,{method:"POST",body:JSON.stringify({action:"sendPaymentConfirmedEmail",customerName:booking.name,customerEmail:booking.email,customerPhone:booking.phone,invoiceAmount:booking.invoiceAmount,serviceDate:booking.date,packageType:pkgLabel,vehicle:[booking.year,booking.make,booking.model].filter(Boolean).join(" "),hourlyRate:booking.hourlyRate,addOns:booking.addOns,invoiceNote:booking.invoiceNote,rowIndex:booking.rowIndex,photosLink:booking.photosLink||"",beforePhotoUrl:booking.beforePhotoUrl||"",afterPhotoUrl:booking.afterPhotoUrl||"",invoiceLink:booking.invoiceLink||""})});
          const emailData=await emailRes.json();
          if(emailData.success)updateToast(tid,`✓ Receipt sent to ${booking.name}`,"success",4000);
          else updateToast(tid,"Marked paid but receipt failed","error",5000);
        }catch{updateToast(tid,"Marked paid but receipt failed","error",5000);}
        await loadAdminBookings();
      }else{setAdminBookings(p=>p.map(b=>b.rowIndex===booking.rowIndex?{...b,invoiceStatus:"released"}:b));updateToast(tid,"Something went wrong","error",4000);}
    }catch{updateToast(tid,"Network error","error",4000);}
    finally{setProcessingRows(p=>{const n=new Set(p);n.delete(booking.rowIndex);return n;});}
  }

  // Make options
  useEffect(()=>{
    if(!vehicle){setMakeOptions([]);return;}
    const carMakes=["Acura","Alfa Romeo","Audi","BMW","Buick","Cadillac","Chevrolet","Chrysler","Dodge","Ferrari","Fiat","Ford","Genesis","GMC","Honda","Hyundai","Infiniti","Jaguar","Jeep","Kia","Lamborghini","Land Rover","Lexus","Lincoln","Maserati","Mazda","Mercedes-Benz","Mini","Mitsubishi","Nissan","Porsche","Ram","Rivian","Rolls-Royce","Subaru","Tesla","Toyota","Volkswagen","Volvo"];
    const truckMakes=["Chevrolet","Ford","GMC","Ram","Toyota","Nissan","Honda","Jeep","Land Rover","Lexus","Lincoln","Cadillac","Rivian","Mercedes-Benz"];
    const suvMakes=["Chevrolet","Ford","GMC","Ram","Toyota","Nissan","Honda","Jeep","Land Rover","Lexus","Lincoln","Cadillac","Rivian","Mercedes-Benz","Acura","Audi","BMW","Buick","Dodge","Genesis","Hyundai","Infiniti","Kia","Mazda","Mini","Mitsubishi","Porsche","Subaru","Tesla","Volkswagen","Volvo"];
    setMakeOptions(vehicle==="truck"?truckMakes:vehicle==="suv"?suvMakes:carMakes);
  },[vehicle]);

  useEffect(()=>{
    if(!make||!vehicle){setModelOptions([]);return;}
    const modelMap: Record<string,string[]>={
      "Toyota":["Camry","Corolla","RAV4","Tacoma","Tundra","Highlander","4Runner","Sienna","Prius","Avalon","Sequoia","Land Cruiser","Venza","C-HR"],
      "Ford":["F-150","F-250","F-350","Mustang","Explorer","Escape","Edge","Bronco","Bronco Sport","Expedition","Ranger","Maverick","EcoSport"],
      "Chevrolet":["Silverado 1500","Silverado 2500","Tahoe","Suburban","Equinox","Traverse","Blazer","Malibu","Camaro","Corvette","Colorado","Trax","Trailblazer"],
      "Honda":["Civic","Accord","CR-V","Pilot","Odyssey","HR-V","Ridgeline","Passport","Insight"],
      "Nissan":["Altima","Sentra","Maxima","Rogue","Murano","Pathfinder","Frontier","Titan","Armada","Kicks","Versa"],
      "Hyundai":["Elantra","Sonata","Tucson","Santa Fe","Palisade","Kona","Ioniq 5","Ioniq 6","Santa Cruz","Venue"],
      "Kia":["Forte","K5","Telluride","Sorento","Sportage","Soul","Stinger","EV6","Carnival","Seltos"],
      "Jeep":["Wrangler","Grand Cherokee","Cherokee","Compass","Gladiator","Renegade","Wagoneer","Grand Wagoneer"],
      "GMC":["Sierra 1500","Sierra 2500","Yukon","Yukon XL","Terrain","Acadia","Canyon","Envoy"],
      "Ram":["1500","2500","3500","ProMaster","ProMaster City"],
      "Dodge":["Charger","Challenger","Durango","Journey"],
      "Subaru":["Outback","Forester","Crosstrek","Impreza","Legacy","Ascent","WRX","BRZ","Solterra"],
      "BMW":["3 Series","5 Series","7 Series","X3","X5","X7","M3","M5","i4","iX","4 Series","2 Series"],
      "Mercedes-Benz":["C-Class","E-Class","S-Class","GLC","GLE","GLS","A-Class","CLA","AMG GT","EQS","EQE"],
      "Audi":["A3","A4","A6","A8","Q3","Q5","Q7","Q8","e-tron","RS3","RS6"],
      "Lexus":["ES","IS","GS","LS","RX","NX","GX","LX","UX","LC"],
      "Cadillac":["CT4","CT5","Escalade","Escalade ESV","XT4","XT5","XT6","Lyriq"],
      "Lincoln":["Navigator","Aviator","Corsair","Nautilus","Continental"],
      "Acura":["ILX","TLX","RLX","MDX","RDX","NSX"],
      "Infiniti":["Q50","Q60","QX50","QX60","QX80"],
      "Volkswagen":["Jetta","Passat","Golf","Tiguan","Atlas","Taos","ID.4","Arteon"],
      "Mazda":["Mazda3","Mazda6","CX-3","CX-5","CX-9","CX-30","CX-50","MX-5 Miata"],
      "Volvo":["S60","S90","V60","V90","XC40","XC60","XC90","C40"],
      "Porsche":["911","Cayenne","Macan","Panamera","Taycan","718"],
      "Tesla":["Model 3","Model S","Model X","Model Y","Cybertruck"],
      "Land Rover":["Defender","Discovery","Range Rover","Range Rover Sport","Range Rover Evoque","Range Rover Velar"],
      "Jaguar":["F-Pace","E-Pace","I-Pace","XE","XF","F-Type"],
      "Genesis":["G70","G80","G90","GV70","GV80","GV60"],
      "Mitsubishi":["Outlander","Eclipse Cross","Galant","Mirage","Outlander Sport"],
      "Buick":["Enclave","Encore","Encore GX","Envision","LaCrosse"],
      "Chrysler":["300","Pacifica","Voyager"],
      "Rivian":["R1T","R1S"],
      "Mini":["Cooper","Countryman","Clubman","Paceman"],
      "Fiat":["500","500X","500L"],
      "Alfa Romeo":["Giulia","Stelvio","Tonale"],
      "Maserati":["Ghibli","Quattroporte","Levante","Grecale"],
      "Ferrari":["Roma","Portofino","SF90","F8"],
      "Lamborghini":["Urus","Huracan","Aventador"],
      "Rolls-Royce":["Ghost","Phantom","Cullinan","Wraith","Dawn"],
    };
    setModelOptions((modelMap[make]||[]).sort((a,b)=>a.localeCompare(b)));
  },[make,vehicle]);

  // Google Maps autocomplete
  useEffect(()=>{
    if(step!==5||serviceType!=="mobile")return;
    if(!window.google?.maps?.places||!addressInputRef.current)return;
    const ac=new window.google.maps.places.Autocomplete(addressInputRef.current,{types:["address"],componentRestrictions:{country:"ca"},fields:["address_components","formatted_address","geometry","place_id"]});
    const listener=ac.addListener("place_changed",()=>{
      const place=ac.getPlace();if(!place?.address_components)return;
      let sn="",rt="",loc="",aa="",pc="";
      place.address_components.forEach((c:any)=>{
        if(c.types.includes("street_number"))sn=c.long_name;
        if(c.types.includes("route"))rt=c.long_name;
        if(c.types.includes("locality"))loc=c.long_name;
        if(c.types.includes("administrative_area_level_1"))aa=c.short_name;
        if(c.types.includes("postal_code"))pc=c.long_name;
      });
      setAddress(place.formatted_address||"");setStreet([sn,rt].filter(Boolean).join(" "));
      setCity(loc);setStateRegion(aa);setZip(pc);
      setPlaceId(place.place_id||"");setLat(place.geometry?.location?.lat?.()??"");setLng(place.geometry?.location?.lng?.()??"");
      setAddressSelected(true);
    });
    return()=>{if(listener)window.google.maps.event.removeListener(listener);};
  },[step,serviceType]);

  useEffect(()=>{
    if(!quickBookClient||!qAddressRef.current||!window.google?.maps?.places)return;
    const ac=new window.google.maps.places.Autocomplete(qAddressRef.current,{types:["address"],componentRestrictions:{country:"ca"},fields:["formatted_address"]});
    const listener=ac.addListener("place_changed",()=>{const place=ac.getPlace();if(place?.formatted_address)setQAddress(place.formatted_address);});
    return()=>{if(listener)window.google.maps.event.removeListener(listener);};
  },[quickBookClient]);

  // Load availability
  useEffect(()=>{
    fetchAllAvailability().then(slots=>{
      setAllAvailableSlots(slots);
      setAvailableDates([...new Set(slots.map(s=>s.date))]);
    }).catch(console.error);
  },[]);

  // Computed
  const addOnTotal = addOns.reduce((s,a)=>{const o=addOnOptions.find(x=>x.label===a);return s+(o?.consultation?0:o?.price||0);},0);
  const basePrice  = PACKAGE_PRICES[pkg]||0;
  const discountAmount = discountResult?.valid ? discountResult.amount : 0;
  const finalPrice = Math.max(0, basePrice + addOnTotal - discountAmount);

  const availSlotsForDate = selectedDate ? allAvailableSlots.filter(s=>s.date===selectedDate) : [];
  const vehicleSummary    = [year,make,model].filter(Boolean).join(" ") || "N/A";
  const isDone = (b:Booking)=>b.status==="Completed";
  const standardBookings  = userBookings.filter(b=>b.clientType!=="maintenance");
  const maintenanceBookings=userBookings.filter(b=>b.clientType==="maintenance");
  const isMaintenance     = maintenanceBookings.length>0;
  const upcomingStandard  = standardBookings.filter(b=>isUpcoming(b.date)&&!isDone(b)).sort((a,b)=>a.date.localeCompare(b.date));
  const pastStandard      = standardBookings.filter(b=>!isUpcoming(b.date)||isDone(b)).sort((a,b)=>b.date.localeCompare(a.date));
  const upcomingMaintenance=maintenanceBookings.filter(b=>isUpcoming(b.date)&&!isDone(b)).sort((a,b)=>a.date.localeCompare(b.date));
  const pastMaintenance   = maintenanceBookings.filter(b=>!isUpcoming(b.date)||isDone(b)).sort((a,b)=>b.date.localeCompare(a.date));

  const step6Disabled = !name||!phone||!email||!selectedDate||!selectedTime||!year||!make||!model;

  function next(){setStep(s=>s+1);}
  function back(){setStep(s=>s-1);}

  async function submitChangeRequest(){
    if(!changeTarget||!changeNote.trim())return;setChangeSubmitting(true);
    try{
      const vl=[changeTarget.year,changeTarget.make,changeTarget.model].filter(Boolean).join(" ");
      await fetch(SCRIPT_URL,{method:"POST",body:JSON.stringify({action:"requestChange",customerEmail:googleUser?.email||"",customerName:googleUser?.name||"",bookingDate:changeTarget.date,bookingTime:changeTarget.time,vehicle:vl,packageType:changeTarget.packageType,changeNote})});
      setChangeSubmitted(true);
    }catch(e){console.error(e);}finally{setChangeSubmitting(false);}
  }

  // Styles
  const S = {
    page:      {minHeight:"100vh",background:"#080c12",color:"#e8eaf0",padding:"32px 16px",fontFamily:'"Outfit",ui-sans-serif,system-ui,sans-serif',position:"relative" as const,overflow:"hidden"} as const,
    container: {maxWidth:960,margin:"0 auto",position:"relative" as const,zIndex:1} as const,
    card:      {background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.10)",borderRadius:28,boxShadow:"0 24px 80px rgba(0,0,0,0.5),inset 0 1px 0 rgba(255,255,255,0.08)",padding:32,animation:"fadeSlideUp 0.45s cubic-bezier(0.16,1,0.3,1) both",backdropFilter:"blur(20px)",WebkitBackdropFilter:"blur(20px)"} as const,
    title:     {fontSize:"2.6rem",fontWeight:900,letterSpacing:"-2px",color:"#ffffff",margin:"0 0 14px",textAlign:"center" as const,textShadow:"0 2px 20px rgba(99,179,237,0.3)"},
    subtitle:  {fontSize:"1rem",color:"rgba(255,255,255,0.5)",margin:"0 0 28px",textAlign:"center" as const},
    primary:   {background:"linear-gradient(135deg,#3b82f6 0%,#1d4ed8 100%)",color:"#fff",border:"none",borderRadius:14,padding:"14px 24px",fontSize:"1rem",fontWeight:700,cursor:"pointer",boxShadow:"0 8px 32px rgba(59,130,246,0.4),inset 0 1px 0 rgba(255,255,255,0.2)"} as const,
    secondary: {background:"rgba(255,255,255,0.07)",color:"#e8eaf0",border:"1px solid rgba(255,255,255,0.12)",borderRadius:14,padding:"13px 20px",fontSize:"1rem",fontWeight:600,cursor:"pointer",backdropFilter:"blur(10px)"} as const,
    disabled:  {opacity:0.35,cursor:"not-allowed"} as const,
    optionCard:{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.10)",borderRadius:20,padding:20,cursor:"pointer",textAlign:"left" as const,transition:"all 0.2s cubic-bezier(0.16,1,0.3,1)",backdropFilter:"blur(10px)"},
    selectedCard:{border:"1.5px solid rgba(99,179,237,0.8)",background:"rgba(59,130,246,0.15)",boxShadow:"0 0 0 3px rgba(59,130,246,0.2),0 8px 32px rgba(59,130,246,0.2)",transform:"translateY(-2px)"},
    selectedGreen:{border:"1.5px solid rgba(52,211,153,0.8)",background:"rgba(16,185,129,0.15)",boxShadow:"0 0 0 3px rgba(16,185,129,0.2)"},
    optionTitle:{fontWeight:700,fontSize:"1.05rem",marginBottom:8,color:"#f1f5f9"},
    optionMeta: {color:"rgba(255,255,255,0.5)",fontSize:"0.95rem",lineHeight:1.45},
    addOnRow:  {display:"flex",alignItems:"center",gap:14,padding:16,borderRadius:16,border:"1px solid rgba(255,255,255,0.10)",background:"rgba(255,255,255,0.04)",cursor:"pointer",justifyContent:"space-between",flexWrap:"wrap" as const,backdropFilter:"blur(10px)"},
    input:     {width:"100%",boxSizing:"border-box" as const,background:"rgba(255,255,255,0.06)",color:"#f1f5f9",border:"1px solid rgba(255,255,255,0.12)",borderRadius:14,padding:"14px 16px",fontSize:"1rem",outline:"none",backdropFilter:"blur(10px)"},
    buttonRow: {display:"flex",justifyContent:"space-between",gap:12,flexWrap:"wrap" as const,marginTop:24},
    rightButtons:{display:"flex",gap:12,marginLeft:"auto"} as const,
    summaryCard:{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:16,padding:16},
    sectionLabel:{fontSize:"0.95rem",fontWeight:700,color:"#cbd5e1",marginTop:6,marginBottom:-4,textAlign:"left" as const},
    summaryHeading:{fontSize:"0.82rem",color:"rgba(255,255,255,0.4)",marginBottom:8,textTransform:"uppercase" as const,letterSpacing:"0.08em"},
    summaryValue:{fontSize:"1rem",fontWeight:700,lineHeight:1.5,color:"#f1f5f9",wordBreak:"break-word" as const},
    successWrap:{textAlign:"center" as const,padding:"10px 0"},
    successText:{fontSize:"1.05rem",color:"rgba(255,255,255,0.6)",lineHeight:1.6,maxWidth:620,margin:"0 auto 24px"},
  };

  const Bg = ()=>(
    <div className="atx-bg">
      <div className="atx-grid"/>
      <div className="atx-orb atx-orb-1"/>
      <div className="atx-orb atx-orb-2"/>
      <div className="atx-orb atx-orb-3"/>
    </div>
  );

  const Header = ()=>(
    <div style={{display:"flex",justifyContent:"center",marginBottom:36}}>
      <div style={{maxWidth:760,width:"100%"}}>
        <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:16}}>
          <a href={config.websiteUrl} target="_blank" rel="noopener noreferrer" style={{display:"flex",alignItems:"center",gap:14,textDecoration:"none",flex:1,minWidth:0}}>
            {(config as any).showLogo !== false && (
              <div style={{width:72,height:72,borderRadius:"50%",background:"rgba(255,255,255,0.08)",border:"1px solid rgba(255,255,255,0.15)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,backdropFilter:"blur(10px)",boxShadow:"0 8px 32px rgba(0,0,0,0.3)"}}>
                <img src={logo} alt={config.businessName} style={{width:56,height:56,objectFit:"contain" as const}}/>
              </div>
            )}
            <div style={{flex:1,minWidth:0}}>
              <h1 style={{fontSize:"clamp(1.5rem,5vw,2.6rem)",fontWeight:900,letterSpacing:"-1.5px",color:"#ffffff",margin:0,lineHeight:1.05,textShadow:"0 2px 20px rgba(99,179,237,0.3)"}}>{config.businessName}</h1>
              <p style={{color:"rgba(255,255,255,0.45)",fontSize:"clamp(0.78rem,2.2vw,0.95rem)",marginTop:6,marginBottom:0,lineHeight:1.4,fontStyle:"italic"}}>{config.tagline}</p>
            </div>
          </a>
        </div>
        <div style={{display:"flex",justifyContent:"flex-end",alignItems:"center"}}>
          {googleUser?(
            <div style={{display:"flex",alignItems:"center",gap:10,background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.10)",borderRadius:14,padding:"8px 14px",backdropFilter:"blur(10px)"}}>
              <img src={googleUser.picture} alt={googleUser.name} style={{width:32,height:32,borderRadius:"50%",border:"2px solid rgba(255,255,255,0.2)",flexShrink:0}}/>
              <div>
                <div style={{fontSize:"0.85rem",fontWeight:700,color:"#f1f5f9"}}>{googleUser.name}</div>
                <div style={{fontSize:"0.72rem",color:"rgba(255,255,255,0.45)"}}>{googleUser.email}</div>
              </div>
              <button onClick={handleSignOut} style={{fontSize:"0.78rem",color:"rgba(255,255,255,0.5)",background:"none",border:"1px solid rgba(255,255,255,0.12)",borderRadius:8,padding:"4px 10px",cursor:"pointer",marginLeft:4}}>Sign out</button>
            </div>
          ):(
            <button onClick={()=>{
              if(!window.google?.accounts?.id)return;
              window.google.accounts.id.initialize({client_id:GOOGLE_CLIENT_ID,callback:handleGoogleCredential,cancel_on_tap_outside:false});
              window.google.accounts.id.prompt((notification: any)=>{
                if(notification.isNotDisplayed()||notification.isSkippedMoment()){
                  // Fallback: render button in a temp div and click it
                  const div=document.createElement("div");
                  div.style.cssText="position:fixed;top:-999px;left:-999px";
                  document.body.appendChild(div);
                  window.google.accounts.id.renderButton(div,{theme:"outline",size:"large"});
                  const btn=div.querySelector("div[role=button]") as HTMLElement;
                  if(btn)btn.click();
                  setTimeout(()=>document.body.removeChild(div),3000);
                }
              });
            }} style={{display:"flex",alignItems:"center",gap:10,background:"rgba(255,255,255,0.07)",border:"1px solid rgba(255,255,255,0.12)",borderRadius:12,padding:"10px 18px",fontSize:"0.9rem",fontWeight:600,cursor:"pointer",color:"#e8eaf0",backdropFilter:"blur(10px)",boxShadow:"0 4px 16px rgba(0,0,0,0.2)"}}>
              <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" style={{width:18,height:18}}/>
              Sign in with Google
            </button>
          )}
        </div>
      </div>
    </div>
  );

  const ProgressBar = ()=>(
    <div style={{marginBottom:28}}>
      <div style={{display:"flex",justifyContent:"space-between",color:"rgba(255,255,255,0.45)",fontSize:"0.82rem",marginBottom:8}}>
        <span style={{letterSpacing:"0.05em",textTransform:"uppercase" as const,fontSize:"0.72rem"}}>Booking</span>
        <span>Step {step} of {TOTAL_STEPS-1}</span>
      </div>
      <div className="progress-bar-track" style={{height:3,borderRadius:999,overflow:"hidden"}}>
        <div className="progress-bar-fill" style={{height:"100%",width:`${(step/(TOTAL_STEPS-1))*100}%`,borderRadius:999,transition:"width 0.5s cubic-bezier(0.16,1,0.3,1)"}}/>
      </div>
    </div>
  );

  const Toasts = ()=>(
    <div style={{position:"fixed" as const,bottom:24,right:24,zIndex:9999,display:"flex",flexDirection:"column" as const,gap:10,alignItems:"flex-end"}}>
      {toasts.map(t=>(
        <div key={t.id} onClick={()=>dismissToast(t.id)} style={{display:"flex",alignItems:"center",gap:10,background:t.type==="error"?"rgba(239,68,68,0.12)":t.type==="success"?"#f0fdf4":"#1e293b",color:t.type==="error"?"#dc2626":t.type==="success"?"#065f46":"#fff",border:t.type==="error"?"1.5px solid #fca5a5":t.type==="success"?"1.5px solid #6ee7b7":"none",borderRadius:14,padding:"12px 18px",fontSize:"0.88rem",fontWeight:600,boxShadow:"0 4px 20px rgba(0,0,0,0.18)",animation:"toastIn 0.25s ease",maxWidth:320,cursor:"pointer"}}>
          {t.type==="loading"&&<div style={{width:16,height:16,border:"2.5px solid rgba(255,255,255,0.3)",borderTopColor:"#fff",borderRadius:"50%",animation:"spin 0.7s linear infinite",flexShrink:0}}/>}
          {t.type==="success"&&<span>✓</span>}
          {t.type==="error"&&<span>✕</span>}
          <span>{t.message}</span>
        </div>
      ))}
    </div>
  );

  // ── SPLASH ─────────────────────────────────────────────────────────────────
  if (!splashDone) {
    return (
      <div style={{position:"fixed" as const,inset:0,background:"#080c12",display:"flex",alignItems:"center",justifyContent:"center",zIndex:9999,fontFamily:'"Outfit",sans-serif',opacity:splashPhase===2?0:1,transition:"opacity 0.8s cubic-bezier(0.4,0,0.2,1)",overflow:"hidden"}}>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;700;900&display=swap');
          @keyframes logoIn{0%{opacity:0;transform:scale(0.5);filter:blur(16px)}70%{opacity:1;transform:scale(1.06);filter:blur(0)}100%{opacity:1;transform:scale(1);filter:blur(0)}}
          @keyframes glowPulse{0%,100%{box-shadow:0 0 20px rgba(59,130,246,0.5),0 4px 24px rgba(0,0,0,0.5)}50%{box-shadow:0 0 44px rgba(59,130,246,0.85),0 4px 24px rgba(0,0,0,0.5)}}
        `}</style>
        <div style={{position:"absolute",inset:0,overflow:"hidden"}}>
          <iframe src={config.splineUrl} frameBorder={0} style={{position:"absolute",inset:0,width:"100%",height:"100%",border:"none"}}/>
        </div>
        <div style={{position:"absolute",top:"clamp(16px,3vh,32px)",left:0,right:0,zIndex:2,display:"flex",justifyContent:"center",pointerEvents:"none",animation:"logoIn 1s cubic-bezier(0.16,1,0.3,1) 0.3s both"}}>
          <div style={{display:"flex",alignItems:"center",gap:14}}>
            {(config as any).showLogo!==false&&(
              <div style={{width:"clamp(52px,7vw,72px)",height:"clamp(52px,7vw,72px)",borderRadius:"50%",background:"rgba(6,10,20,0.7)",border:"1.5px solid rgba(255,255,255,0.18)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,backdropFilter:"blur(12px)"}}>
                <img src={logo} alt="logo" style={{width:"82%",height:"82%",objectFit:"contain" as const}}/>
              </div>
            )}
            <div>
              <div style={{fontSize:"clamp(20px,3.5vw,30px)",fontWeight:900,letterSpacing:"-0.5px",lineHeight:1,color:"#fff",textShadow:"0 2px 20px rgba(0,0,0,1),0 0 30px rgba(59,130,246,0.4)",whiteSpace:"nowrap" as const}}>{config.businessName}</div>
              <div style={{fontSize:"clamp(0.52rem,1.1vw,0.62rem)",letterSpacing:"0.22em",textTransform:"uppercase" as const,color:"rgba(255,255,255,0.55)",marginTop:4,textShadow:"0 1px 8px rgba(0,0,0,0.9)"}}>{config.splashTagline}</div>
            </div>
          </div>
        </div>
        <div style={{position:"absolute",bottom:"clamp(16px,4vh,40px)",left:0,right:0,zIndex:2,display:"flex",justifyContent:"center",opacity:splashPhase>=1?1:0,transform:splashPhase>=1?"translateY(0)":"translateY(14px)",transition:"opacity 0.6s ease 0.2s,transform 0.6s ease 0.2s",pointerEvents:splashPhase>=1?"auto":"none" as const}}>
          <button onClick={()=>{setSplashPhase(2);setTimeout(()=>setSplashDone(true),800);}}
            style={{background:"linear-gradient(135deg,#3b82f6 0%,#1d4ed8 100%)",color:"#fff",border:"none",borderRadius:999,padding:"clamp(10px,2vh,14px) clamp(28px,6vw,48px)",fontSize:"clamp(0.88rem,2vw,1rem)",fontWeight:700,cursor:"pointer",letterSpacing:"0.05em",animation:"glowPulse 2.5s ease-in-out infinite",fontFamily:'"Outfit",sans-serif',display:"flex",alignItems:"center",gap:8}}>
            Get Started <span style={{fontSize:"1.1em"}}>→</span>
          </button>
        </div>
      </div>
    );
  }

  // ── MY BOOKINGS ────────────────────────────────────────────────────────────
  if (view==="myBookings") {
    return (
      <div style={S.page}><Bg/><Toasts/>
        <div style={S.container}>
          <Header/>
          <div style={S.card}>
            <div style={{display:"flex",alignItems:"center",gap:16,marginBottom:24,flexWrap:"wrap" as const}}>
              <button onClick={()=>setView("booking")} style={{...S.secondary,padding:"9px 14px",fontSize:"0.9rem"}}>Back</button>
              <h2 style={{...S.title,margin:0,fontSize:"1.8rem"}}>My Bookings</h2>
              <div style={{display:"flex",gap:8,marginLeft:"auto"}}>
                {isAdminEmail(googleUser?.email||"")&&<button onClick={()=>{setView("admin");loadAdminBookings();}} style={{...S.secondary,padding:"10px 16px",fontSize:"0.9rem"}}>Admin</button>}
                <button onClick={()=>{setView("booking");setStep(1);}} style={{...S.primary,padding:"10px 16px",fontSize:"0.9rem"}}>Book New Service</button>
              </div>
            </div>
            <div style={{overflowX:"auto" as const,marginBottom:24,borderBottom:"1.5px solid rgba(255,255,255,0.08)"}}>
              <div style={{display:"flex",gap:0,minWidth:"max-content"}}>
                {["appointments","maintenance","balance"].map(tab=>(
                  <button key={tab} onClick={()=>setBookingsTab(tab as any)} style={{background:"none",border:"none",cursor:"pointer",padding:"10px 16px",fontSize:"0.9rem",fontWeight:700,color:bookingsTab===tab?"#f1f5f9":"rgba(255,255,255,0.35)",borderBottom:bookingsTab===tab?"3px solid #f1f5f9":"3px solid transparent",marginBottom:-2,whiteSpace:"nowrap" as const}}>
                    {tab==="appointments"?"My Appointments":tab==="maintenance"&&isMaintenance?"Maintenance Plan":tab==="balance"?"Balance":tab==="maintenance"?null:null}
                  </button>
                ))}
              </div>
            </div>
            {bookingsLoading?<div style={{textAlign:"center",padding:40,color:"rgba(255,255,255,0.45)"}}>Loading...</div>:(
              <>
                {bookingsTab==="appointments"&&(()=>{
                  const allUp=[...upcomingStandard,...upcomingMaintenance].sort((a,b)=>a.date.localeCompare(b.date));
                  const allPast=[...pastStandard,...pastMaintenance].sort((a,b)=>b.date.localeCompare(a.date));
                  return(<>
                    {allUp.length===0&&allPast.length===0&&<div style={{textAlign:"center",padding:40,color:"rgba(255,255,255,0.45)"}}>No bookings yet.<br/><button onClick={()=>{setView("booking");setStep(1);}} style={{...S.primary,marginTop:16,display:"inline-block"}}>Book Your First Service</button></div>}
                    {allUp.length>0&&<><div style={{fontWeight:700,color:"rgba(255,255,255,0.7)",fontSize:"0.95rem",marginBottom:12,textTransform:"uppercase" as const,letterSpacing:"0.04em"}}>Upcoming</div><div style={{display:"grid",gap:14,marginBottom:28}}>{allUp.map((b,i)=><BookingCard key={i} booking={b} upcoming onRequestChange={b=>{setChangeTarget(b);setChangeNote("");setChangeSubmitted(false);setView("requestChange");}}/>)}</div></>}
                    {allPast.length>0&&<><div style={{fontWeight:700,color:"rgba(255,255,255,0.35)",fontSize:"0.95rem",marginBottom:12,textTransform:"uppercase" as const,letterSpacing:"0.04em"}}>Past Services</div><div style={{display:"grid",gap:14}}>{allPast.map((b,i)=><BookingCard key={i} booking={b} upcoming={false} onRequestChange={()=>{}}/>)}</div></>}
                  </>);
                })()}
                {(bookingsTab as string)==="balance"&&(()=>{
                  const outstanding=userBookings.filter(b=>b.invoiceStatus==="released");
                  const paid=userBookings.filter(b=>b.invoiceStatus==="paid");
                  const totalOwed=outstanding.reduce((s,b)=>s+parseFloat(b.invoiceAmount||"0"),0);
                  return(<>
                    {outstanding.length===0&&paid.length===0&&<div style={{textAlign:"center",padding:40,color:"rgba(255,255,255,0.45)"}}>No invoices yet.</div>}
                    {outstanding.length>0&&(<>
                      <div style={{background:"rgba(251,191,36,0.12)",border:"1px solid #fde047",borderRadius:14,padding:"16px 18px",marginBottom:20,textAlign:"center" as const}}>
                        <div style={{fontWeight:700,color:"#fbbf24",fontSize:"1rem",marginBottom:8}}>Total Balance Due</div>
                        <div style={{fontSize:"2.2rem",fontWeight:900,color:"#fbbf24"}}>${totalOwed.toFixed(2)}</div>
                      </div>
                      {outstanding.map((b,i)=>{
                        const baseAmt=parseFloat(b.invoiceAmount||"0");
                        return(<div key={i} style={{background:"rgba(255,255,255,0.05)",border:"1px solid #fde047",borderRadius:16,padding:18,marginBottom:14}}>
                          <div style={{fontWeight:700,color:"#f1f5f9",marginBottom:4}}>{formatDateLabel(b.date)} — {PACKAGE_LABELS[b.packageType]||b.packageType}</div>
                          <div style={{fontSize:"0.9rem",color:"rgba(255,255,255,0.45)",marginBottom:10}}>{[b.year,b.make,b.model].filter(Boolean).join(" ")}{b.invoiceNote?` — ${b.invoiceNote}`:""}</div>
                          <div style={{background:"rgba(251,191,36,0.12)",border:"1px solid #fde047",borderRadius:12,padding:"14px 16px",marginBottom:14}}>
                            <div style={{fontSize:"2rem",fontWeight:900,color:"#fbbf24",textAlign:"center" as const}}>${baseAmt.toFixed(2)}</div>
                            <button onClick={()=>{navigator.clipboard.writeText(baseAmt.toFixed(2));setCopiedAmount(baseAmt);setTimeout(()=>setCopiedAmount(null),2500);}} style={{width:"100%",marginTop:10,background:copiedAmount===baseAmt?"#059669":"#111827",color:"#fff",border:"none",borderRadius:10,padding:"11px 16px",fontSize:"0.9rem",fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
                              {copiedAmount===baseAmt?<><span>✓</span> Copied!</>:<><span>⎘</span> Copy Amount</>}
                            </button>
                          </div>
                          {config.eTransferEmail&&(
                            <div style={{background:"rgba(255,255,255,0.05)",borderRadius:12,padding:"12px 14px",fontSize:"0.85rem",color:"rgba(255,255,255,0.7)"}}>
                              <div style={{fontWeight:700,color:"#34d399",marginBottom:6}}>E-Transfer</div>
                              <div>📧 {config.eTransferEmail}</div>
                              {config.eTransferPhone&&<div style={{marginTop:4}}>📱 {config.eTransferPhone}</div>}
                              <div style={{marginTop:6,fontWeight:700,color:"#fbbf24"}}>Amount: ${baseAmt.toFixed(2)}</div>
                            </div>
                          )}
                        </div>);
                      })}
                    </>)}
                    {paid.length>0&&(<>
                      <div style={{fontWeight:700,color:"rgba(255,255,255,0.35)",fontSize:"0.85rem",textTransform:"uppercase" as const,letterSpacing:"0.04em",marginTop:16,marginBottom:10}}>Paid</div>
                      {paid.map((b,i)=>(
                        <div key={i} style={{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:14,padding:14,marginBottom:10}}>
                          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                            <div><div style={{fontWeight:600,color:"rgba(255,255,255,0.7)",fontSize:"0.9rem"}}>{formatDateLabel(b.date)}</div><div style={{fontSize:"0.85rem",color:"rgba(255,255,255,0.35)"}}>{PACKAGE_LABELS[b.packageType]||b.packageType}</div></div>
                            <div style={{display:"flex",alignItems:"center",gap:8}}><span style={{fontWeight:700,color:"rgba(255,255,255,0.7)"}}>${b.invoiceAmount}</span><span style={{background:"rgba(16,185,129,0.15)",color:"#34d399",fontSize:"0.72rem",fontWeight:700,borderRadius:999,padding:"2px 8px"}}>PAID</span></div>
                          </div>
                        </div>
                      ))}
                    </>)}
                  </>);
                })()}
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── ADMIN ──────────────────────────────────────────────────────────────────
  if (view==="admin"&&isAdminEmail(googleUser?.email||"")) {
    const filtered=adminBookings.filter(b=>{
      if(adminFilter==="upcoming")return isUpcoming(b.date)&&b.status!=="Completed"&&b.status!=="Cancelled"&&b.status!=="Skipped";
      if(adminFilter==="past")return !isUpcoming(b.date)||b.status==="Completed"||b.status==="Cancelled"||b.status==="Skipped";
      if(adminFilter==="maintenance")return b.clientType==="maintenance";
      return true;
    }).sort((a,b)=>{
      if(adminFilter==="all"){const aD=a.status==="Completed"||a.status==="Cancelled"||a.status==="Skipped";const bD=b.status==="Completed"||b.status==="Cancelled"||b.status==="Skipped";if(aD&&!bD)return-1;if(!aD&&bD)return 1;if(aD&&bD)return b.date.localeCompare(a.date);return a.date.localeCompare(b.date);}
      if(adminFilter==="upcoming")return a.date.localeCompare(b.date);
      if(adminFilter==="past")return b.date.localeCompare(a.date);
      const aUp=isUpcoming(a.date)&&a.status!=="Completed"&&a.status!=="Cancelled"&&a.status!=="Skipped";
      const bUp=isUpcoming(b.date)&&b.status!=="Completed"&&b.status!=="Cancelled"&&b.status!=="Skipped";
      if(aUp&&!bUp)return-1;if(!aUp&&bUp)return 1;return aUp?a.date.localeCompare(b.date):b.date.localeCompare(a.date);
    });
    const pendingInvoices=adminBookings.filter(b=>b.invoiceStatus==="pending");
    const releasedInvoices=adminBookings.filter(b=>b.invoiceStatus==="released");
    const paidInvoices=adminBookings.filter(b=>b.invoiceStatus==="paid");

    return (
      <div style={S.page}><Bg/><Toasts/>
        <div style={S.container}>
          <Header/>
          <div style={S.card}>
            <div style={{display:"flex",alignItems:"center",gap:16,marginBottom:24,flexWrap:"wrap" as const}}>
              <button onClick={()=>setView("myBookings")} style={{...S.secondary,padding:"9px 14px",fontSize:"0.9rem"}}>Back</button>
              <h2 style={{...S.title,margin:0,fontSize:"1.8rem"}}>Admin</h2>
              <button onClick={loadAdminBookings} style={{...S.secondary,marginLeft:"auto",padding:"9px 14px",fontSize:"0.9rem"}}>Refresh</button>
            </div>
            <div style={{display:"flex",gap:0,marginBottom:24,borderBottom:"1.5px solid rgba(255,255,255,0.08)",overflowX:"auto" as const}}>
              {[["bookings","All Bookings","#f1f5f9"],["invoices","Invoices","#d97706"],["revenue","Revenue","#059669"],["discounts","Discounts","#f59e0b"]].map(([id,label,color])=>(
                <button key={id} onClick={()=>setAdminTab(id as any)} style={{background:"none",border:"none",cursor:"pointer",padding:"10px 18px",fontSize:"0.95rem",fontWeight:700,color:adminTab===id?color:"rgba(255,255,255,0.35)",borderBottom:adminTab===id?`3px solid ${color}`:"3px solid transparent",marginBottom:-2,whiteSpace:"nowrap" as const}}>
                  {label}{id==="invoices"&&pendingInvoices.length>0&&<span style={{background:"#ef4444",color:"#fff",borderRadius:999,padding:"1px 6px",fontSize:"0.72rem",marginLeft:4}}>{pendingInvoices.length}</span>}
                </button>
              ))}
            </div>
            {adminLoading?<div style={{textAlign:"center",padding:40,color:"rgba(255,255,255,0.45)"}}>Loading...</div>:(
              <>
                {/* ALL BOOKINGS TAB */}
                {adminTab==="bookings"&&(
                  <>
                    <div style={{display:"flex",gap:8,marginBottom:20,flexWrap:"wrap" as const,alignItems:"center"}}>
                      {(["all","upcoming","past","maintenance"] as const).map(f=>(
                        <button key={f} onClick={()=>setAdminFilter(f)} style={{background:adminFilter===f?"#111827":"rgba(255,255,255,0.08)",color:adminFilter===f?"#fff":"#374151",border:"none",borderRadius:999,padding:"6px 14px",fontSize:"0.85rem",fontWeight:600,cursor:"pointer",textTransform:"capitalize" as const}}>
                          {f==="all"?"All":f==="upcoming"?"Upcoming":f==="past"?"Past":"Maintenance"}
                        </button>
                      ))}
                      <button onClick={()=>{setQuickBookOpen(true);setQuickBookClient(null);setQuickBookSearch("");}} style={{...S.primary,marginLeft:"auto",padding:"7px 16px",fontSize:"0.85rem",background:"linear-gradient(135deg,#7c3aed,#5b21b6)"}}>+ Book Existing Client</button>
                    </div>

                    {/* Quick Book Modal */}
                    {quickBookOpen&&(()=>{
                      const clientMap: Record<string,Booking>={};
                      adminBookings.forEach(b=>{if(!b.name)return;const key=`${b.email||b.name}__${[b.year,b.make,b.model].filter(Boolean).join(" ")}`;if(!clientMap[key])clientMap[key]=b;});
                      const clients=Object.values(clientMap).sort((a,b)=>a.name.localeCompare(b.name));
                      const filt=quickBookSearch?clients.filter(c=>c.name.toLowerCase().includes(quickBookSearch.toLowerCase())||c.email.toLowerCase().includes(quickBookSearch.toLowerCase())):clients;
                      return(
                        <div style={{background:"rgba(124,58,237,0.08)",border:"1.5px solid rgba(124,58,237,0.4)",borderRadius:16,padding:20,marginBottom:20}}>
                          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
                            <div style={{fontWeight:700,color:"#a78bfa",fontSize:"0.95rem"}}>Book Existing Client</div>
                            <button onClick={()=>{setQuickBookOpen(false);setQuickBookSearch("");setQuickBookClient(null);setQCustomService("");setQCustomPrice("");}} style={{background:"none",border:"none",color:"rgba(255,255,255,0.4)",cursor:"pointer",fontSize:"1.1rem"}}>✕</button>
                          </div>
                          {!quickBookClient?(
                            <>
                              <input style={{...S.input,marginBottom:12}} placeholder="Search by name or email..." value={quickBookSearch} onChange={e=>setQuickBookSearch(e.target.value)} autoFocus/>
                              <div style={{display:"grid",gap:8,maxHeight:280,overflowY:"auto" as const}}>
                                {filt.map((c,i)=>(
                                  <button key={i} onClick={()=>{setQuickBookClient(c);setQPkg(c.packageType||"basic");setQClientType(c.clientType||"oneTime");setQFreq(c.recurringFrequency||"");setQAddOnList([]);setQAddress(c.address||"");setQServiceType(c.serviceType||"mobile");setQDate("");setQTime("");setQNotes("");}}
                                    style={{background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.10)",borderRadius:12,padding:"12px 14px",cursor:"pointer",textAlign:"left" as const,display:"flex",justifyContent:"space-between",alignItems:"center",gap:10}}>
                                    <div><div style={{fontWeight:700,color:"#f1f5f9",fontSize:"0.9rem"}}>{c.name}</div><div style={{fontSize:"0.78rem",color:"rgba(255,255,255,0.45)"}}>{c.email} · {c.phone}</div><div style={{fontSize:"0.78rem",color:"rgba(255,255,255,0.35)"}}>{[c.year,c.make,c.model].filter(Boolean).join(" ")}</div></div>
                                    <span style={{color:"#a78bfa",fontSize:"0.8rem",fontWeight:600,whiteSpace:"nowrap" as const}}>Select →</span>
                                  </button>
                                ))}
                                {filt.length===0&&<div style={{color:"rgba(255,255,255,0.35)",fontSize:"0.88rem",padding:8}}>No clients found.</div>}
                              </div>
                            </>
                          ):(()=>{
                            const c=quickBookClient;
                            return(
                              <div>
                                <div style={{background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.10)",borderRadius:12,padding:"12px 14px",marginBottom:14,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                                  <div><div style={{fontWeight:700,color:"#f1f5f9"}}>{c.name}</div><div style={{fontSize:"0.82rem",color:"rgba(255,255,255,0.45)"}}>{c.email} · {c.phone}</div></div>
                                  <button onClick={()=>setQuickBookClient(null)} style={{background:"none",border:"none",color:"rgba(255,255,255,0.4)",cursor:"pointer",fontSize:"0.82rem"}}>Change</button>
                                </div>
                                {/* Calendar */}
                                <div style={{background:"rgba(0,0,0,0.3)",borderRadius:16,padding:"18px 14px",marginBottom:14}}>
                                  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
                                    <button onClick={()=>{const d=new Date(qCalYear,qCalMonth-1,1);setQCalMonth(d.getMonth());setQCalYear(d.getFullYear());}} style={{background:"rgba(255,255,255,0.08)",border:"none",borderRadius:8,width:32,height:32,cursor:"pointer",color:"#fff",fontSize:"1rem"}}>‹</button>
                                    <span style={{fontWeight:700,color:"#fff",fontSize:"0.9rem"}}>{new Date(qCalYear,qCalMonth).toLocaleDateString("en-US",{month:"long",year:"numeric"})}</span>
                                    <button onClick={()=>{const d=new Date(qCalYear,qCalMonth+1,1);setQCalMonth(d.getMonth());setQCalYear(d.getFullYear());}} style={{background:"rgba(255,255,255,0.08)",border:"none",borderRadius:8,width:32,height:32,cursor:"pointer",color:"#fff",fontSize:"1rem"}}>›</button>
                                  </div>
                                  <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:2,marginBottom:6}}>
                                    {["S","M","T","W","T","F","S"].map((d,i)=><div key={i} style={{textAlign:"center" as const,fontSize:"0.68rem",color:"rgba(255,255,255,0.35)",fontWeight:700,padding:"2px 0"}}>{d}</div>)}
                                  </div>
                                  <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:3}}>
                                    {(()=>{
                                      const firstDay=new Date(qCalYear,qCalMonth,1).getDay();
                                      const daysInMonth=new Date(qCalYear,qCalMonth+1,0).getDate();
                                      const today2=new Date();today2.setHours(0,0,0,0);
                                      const cells=[];
                                      for(let i=0;i<firstDay;i++)cells.push(<div key={`e${i}`}/>);
                                      for(let d=1;d<=daysInMonth;d++){
                                        const ds=`${qCalYear}-${String(qCalMonth+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
                                        const isPast=new Date(qCalYear,qCalMonth,d)<today2;
                                        const isSel=qDate===ds;
                                        cells.push(<button key={d} disabled={isPast} onClick={()=>{setQDate(ds);setQTime("");}} style={{height:34,borderRadius:8,border:"none",background:isSel?"#fff":!isPast?"rgba(255,255,255,0.1)":"transparent",color:isSel?"#111":!isPast?"#fff":"rgba(255,255,255,0.18)",fontSize:"0.82rem",fontWeight:isSel?800:500,cursor:!isPast?"pointer":"default"}}>{d}</button>);
                                      }
                                      return cells;
                                    })()}
                                  </div>
                                </div>
                                {qDate&&(()=>{
                                  const slots=allAvailableSlots.filter(s=>s.date===qDate);
                                  return(<div style={{marginBottom:14}}>
                                    <div style={{fontSize:"0.75rem",color:"rgba(255,255,255,0.45)",marginBottom:8,textTransform:"uppercase" as const,letterSpacing:"0.06em"}}>Times — {formatDateLabel(qDate)}</div>
                                    {slots.length===0?<div style={{color:"#f87171",fontSize:"0.85rem"}}>All times booked for this date.</div>:(
                                      <div style={{display:"flex",gap:8,flexWrap:"wrap" as const}}>
                                        {slots.map((s,i)=><button key={i} onClick={()=>setQTime(s.time)} style={{padding:"9px 14px",borderRadius:10,border:qTime===s.time?"2px solid #fff":"1px solid rgba(255,255,255,0.15)",background:qTime===s.time?"#fff":"rgba(255,255,255,0.07)",color:qTime===s.time?"#111":"#fff",fontSize:"0.88rem",fontWeight:700,cursor:"pointer"}}>{s.time}</button>)}
                                      </div>
                                    )}
                                  </div>);
                                })()}
                                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
                                  <div style={{gridColumn:"1 / -1"}}>
                                    <div style={{fontSize:"0.75rem",color:"rgba(255,255,255,0.45)",marginBottom:4}}>Package</div>
                                    <select style={{...S.input,padding:"9px 12px",backgroundColor:"transparent"}} value={qPkg} onChange={e=>{setQPkg(e.target.value);setQCustomService("");setQCustomPrice("");}}>
                                      <option value="basic">Interior + Exterior — $279</option>
                                      <option value="interior">Interior Only — $169</option>
                                      <option value="exterior">Exterior Only — $139</option>
                                      <option value="custom">⚡ Custom Job</option>
                                    </select>
                                  </div>
                                  {qPkg==="custom"&&(
                                    <>
                                      <div style={{gridColumn:"1 / -1"}}><div style={{fontSize:"0.75rem",color:"#a78bfa",marginBottom:4,fontWeight:700}}>Service Name *</div><input style={{...S.input,padding:"9px 12px",border:"1.5px solid rgba(124,58,237,0.5)"}} placeholder="e.g. Paint Correction" value={qCustomService} onChange={e=>setQCustomService(e.target.value)}/></div>
                                      <div style={{gridColumn:"1 / -1"}}><div style={{fontSize:"0.75rem",color:"#a78bfa",marginBottom:4,fontWeight:700}}>Flat Price ($) *</div><input style={{...S.input,padding:"9px 12px",border:"1.5px solid rgba(124,58,237,0.5)",fontWeight:700}} type="number" step="0.01" placeholder="e.g. 250" value={qCustomPrice} onChange={e=>setQCustomPrice(e.target.value)}/></div>
                                    </>
                                  )}
                                  <div><div style={{fontSize:"0.75rem",color:"rgba(255,255,255,0.45)",marginBottom:4}}>Location</div><select style={{...S.input,padding:"9px 12px",backgroundColor:"transparent"}} value={qServiceType} onChange={e=>setQServiceType(e.target.value)}><option value="mobile">Mobile</option><option value="dropoff">Drop-Off</option></select></div>
                                  <div><div style={{fontSize:"0.75rem",color:"rgba(255,255,255,0.45)",marginBottom:4}}>Client Type</div><select style={{...S.input,padding:"9px 12px",backgroundColor:"transparent"}} value={qClientType} onChange={e=>setQClientType(e.target.value)}><option value="oneTime">One-Time</option><option value="maintenance">Maintenance</option></select></div>
                                  {qClientType==="maintenance"&&<div><div style={{fontSize:"0.75rem",color:"rgba(255,255,255,0.45)",marginBottom:4}}>Frequency</div><select style={{...S.input,padding:"9px 12px",backgroundColor:"transparent"}} value={qFreq} onChange={e=>setQFreq(e.target.value)}><option value="">Select</option><option value="biweekly">Bi-Weekly</option><option value="monthly">Monthly</option></select></div>}
                                </div>
                                {qServiceType==="mobile"&&<div style={{marginBottom:10}}><div style={{fontSize:"0.75rem",color:"rgba(255,255,255,0.45)",marginBottom:4}}>Address</div><input ref={qAddressRef} style={{...S.input,padding:"9px 12px"}} placeholder="Start typing address..." value={qAddress} onChange={e=>setQAddress(e.target.value)}/></div>}
                                {qPkg!=="custom"&&(
                                  <div style={{marginBottom:10}}>
                                    <div style={{fontSize:"0.75rem",color:"rgba(255,255,255,0.45)",marginBottom:8,textTransform:"uppercase" as const,letterSpacing:"0.06em"}}>Add-Ons</div>
                                    <div style={{display:"grid",gap:6}}>
                                      {addOnOptions.map(opt=>{const checked=qAddOnList.includes(opt.label as AddOn);return(<label key={opt.label} style={{display:"flex",alignItems:"center",justifyContent:"space-between",background:checked?"rgba(59,130,246,0.1)":"rgba(255,255,255,0.04)",border:`1px solid ${checked?"rgba(59,130,246,0.4)":"rgba(255,255,255,0.08)"}`,borderRadius:10,padding:"9px 12px",cursor:"pointer"}}><div style={{display:"flex",alignItems:"center",gap:10}}><input type="checkbox" checked={checked} style={{accentColor:"#3b82f6",width:15,height:15}} onChange={()=>setQAddOnList(p=>checked?p.filter(a=>a!==opt.label):[...p,opt.label as AddOn])}/><span style={{fontSize:"0.85rem",color:"#f1f5f9"}}>{opt.label}</span></div><span style={{fontSize:"0.82rem",color:"#93c5fd",fontWeight:700}}>${opt.price}</span></label>);})}
                                    </div>
                                  </div>
                                )}
                                <div style={{marginBottom:14}}><div style={{fontSize:"0.75rem",color:"rgba(255,255,255,0.45)",marginBottom:4}}>Notes (optional)</div><input style={{...S.input,padding:"9px 12px"}} placeholder="Any special instructions" value={qNotes} onChange={e=>setQNotes(e.target.value)}/></div>
                                <button disabled={!qDate||!qTime||qSubmitting||(qPkg==="custom"&&(!qCustomService.trim()||!qCustomPrice))}
                                  onClick={async()=>{
                                    setQSubmitting(true);const tid=showToast("Creating booking...","loading");
                                    try{
                                      const isCustom=qPkg==="custom";
                                      const flatPrice=isCustom?parseFloat(qCustomPrice):PACKAGE_PRICES[qPkg]||0;
                                      const addOnAmt=qAddOnList.reduce((s,a)=>{const o=addOnOptions.find(x=>x.label===a);return s+(o?.price||0);},0);
                                      const res=await fetch(SCRIPT_URL,{method:"POST",body:JSON.stringify({action:"bookAppointment",name:c.name,phone:c.phone,email:c.email,date:qDate,displayDate:qDate,time:qTime,year:c.year,make:c.make,model:c.model,boatSize:"",vehicle:c.vehicle,packageType:isCustom?"custom":qPkg,hourlyRate:flatPrice,addOns:isCustom?qCustomService:qAddOnList.join(", "),addOnEstimate:isCustom?flatPrice:addOnAmt,serviceType:qServiceType,address:qAddress,street:"",city:"",state:"",zip:"",placeId:"",lat:"",lng:"",avgTime:"",notes:isCustom?`Custom job: ${qCustomService} — $${qCustomPrice}${qNotes?". "+qNotes:""}`:qNotes,clientType:qClientType,recurringFrequency:qFreq})});
                                      const d=await res.json();
                                      if(d.success){updateToast(tid,`✓ Booking created for ${c.name}`,"success",4000);setQuickBookOpen(false);setQuickBookClient(null);setQuickBookSearch("");setQDate("");setQTime("");setQNotes("");setQAddOnList([]);setQCustomService("");setQCustomPrice("");await loadAdminBookings();}
                                      else updateToast(tid,"Failed: "+(d.error||"unknown"),"error",4000);
                                    }catch{updateToast(tid,"Network error","error",4000);}
                                    setQSubmitting(false);
                                  }}
                                  style={{width:"100%",background:"linear-gradient(135deg,#7c3aed,#5b21b6)",color:"#fff",border:"none",borderRadius:10,padding:"13px",fontWeight:700,fontSize:"0.95rem",cursor:"pointer",opacity:!qDate||!qTime||(qPkg==="custom"&&(!qCustomService.trim()||!qCustomPrice))?0.5:1}}>
                                  {qSubmitting?"Creating...":qPkg==="custom"?`Book Custom Job for ${c.name}`:`Submit Booking for ${c.name}`}
                                </button>
                              </div>
                            );
                          })()}
                        </div>
                      );
                    })()}

                    {filtered.length===0&&<div style={{textAlign:"center",padding:40,color:"rgba(255,255,255,0.45)"}}>No bookings found.</div>}
                    <div style={{display:"grid",gap:12}}>
                      {filtered.map((b,i)=>{
                        const vl=[b.year,b.make,b.model].filter(Boolean).join(" ");
                        const isComplete=b.status==="Completed";
                        const isSelected=selectedAdminBooking?.rowIndex===b.rowIndex;
                        return(
                          <div key={i} className="booking-card" style={{background:b.status==="Cancelled"?"rgba(239,68,68,0.08)":b.status==="Skipped"?"rgba(59,130,246,0.08)":"rgba(255,255,255,0.04)",border:`1px solid ${b.status==="Cancelled"?"rgba(239,68,68,0.35)":b.status==="Skipped"?"rgba(59,130,246,0.35)":isComplete?"rgba(255,255,255,0.07)":isUpcoming(b.date)?"rgba(59,130,246,0.45)":"rgba(255,255,255,0.07)"}`,borderRadius:16,padding:16,opacity:b.status==="Cancelled"||b.status==="Skipped"?0.85:1}}>
                            {b.status==="Cancelled"&&<div style={{background:"rgba(239,68,68,0.25)",border:"1px solid rgba(239,68,68,0.4)",borderRadius:8,padding:"6px 12px",marginBottom:10}}><span style={{color:"#fff",fontWeight:800,fontSize:"0.85rem"}}>✕ CANCELLED</span></div>}
                            {b.status==="Skipped"&&<div style={{background:"rgba(59,130,246,0.25)",border:"1px solid rgba(59,130,246,0.4)",borderRadius:8,padding:"6px 12px",marginBottom:10}}><span style={{color:"#fff",fontWeight:800,fontSize:"0.85rem"}}>⏭ SKIPPED</span></div>}
                            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8,marginBottom:6,flexWrap:"wrap" as const}}>
                              <div>
                                <div style={{fontWeight:700,color:b.status==="Cancelled"?"#fca5a5":b.status==="Skipped"?"rgba(255,255,255,0.45)":"#f1f5f9",fontSize:"0.95rem"}}>{b.name} — {formatDateLabel(b.date)}{b.time?` at ${b.time}`:""}</div>
                                <div style={{fontSize:"0.85rem",color:"rgba(255,255,255,0.45)"}}>{b.email} · {b.phone}</div>
                                <div style={{fontSize:"0.85rem",color:"rgba(255,255,255,0.45)"}}>{vl} · {b.packageType==="custom"?`⚡ ${b.addOns||"Custom"}`:PACKAGE_LABELS[b.packageType]||b.packageType}{b.hourlyRate&&b.packageType!=="custom"?` — $${b.hourlyRate}`:""}</div>
                                {b.clientType==="maintenance"&&<div style={{fontSize:"0.8rem",color:"#059669",fontWeight:600}}>{b.recurringFrequency==="biweekly"?"Bi-Weekly":"Monthly"} Maintenance</div>}
                                {b.serviceType==="mobile"&&b.address&&<div style={{fontSize:"0.8rem",color:"rgba(255,255,255,0.45)"}}>{b.address}</div>}
                                {b.addOns&&b.packageType!=="custom"&&<div style={{fontSize:"0.8rem",color:"#93c5fd"}}>Add-Ons: {b.addOns}</div>}
                                {b.notes&&<div style={{fontSize:"0.8rem",color:"rgba(255,255,255,0.35)"}}>Notes: {b.notes}</div>}
                              </div>
                              <div style={{display:"flex",flexDirection:"column" as const,alignItems:"flex-end",gap:4}}>
                                <span style={{background:b.status==="Cancelled"?"rgba(239,68,68,0.15)":b.status==="Skipped"?"rgba(59,130,246,0.15)":isComplete?"rgba(16,185,129,0.15)":isUpcoming(b.date)?"rgba(59,130,246,0.15)":"rgba(255,255,255,0.06)",color:b.status==="Cancelled"?"#f87171":b.status==="Skipped"?"#93c5fd":isComplete?"#34d399":isUpcoming(b.date)?"#93c5fd":"rgba(255,255,255,0.35)",fontSize:"0.72rem",fontWeight:700,borderRadius:999,padding:"2px 8px"}}>
                                  {b.status==="Cancelled"?"CANCELLED":b.status==="Skipped"?"SKIPPED":isComplete?"COMPLETED":isUpcoming(b.date)?"UPCOMING":"PAST"}
                                </span>
                                {b.invoiceStatus&&b.invoiceStatus!==""&&<span style={{background:b.invoiceStatus==="paid"?"rgba(16,185,129,0.2)":b.invoiceStatus==="released"?"rgba(251,191,36,0.15)":"rgba(251,191,36,0.1)",color:b.invoiceStatus==="paid"?"#34d399":"#fbbf24",fontSize:"0.72rem",fontWeight:700,borderRadius:999,padding:"2px 8px"}}>
                                  {b.invoiceStatus==="pending"?"INVOICE PENDING":b.invoiceStatus==="released"?`INVOICE SENT $${b.invoiceAmount}`:`PAID $${b.invoiceAmount}`}
                                </span>}
                              </div>
                            </div>
                            <div style={{display:"flex",gap:8,flexWrap:"wrap" as const,marginTop:8,alignItems:"center"}}>
                              {!isComplete&&b.status!=="Cancelled"&&b.status!=="Skipped"&&(
                                <button onClick={()=>{setSelectedAdminBooking(isSelected?null:b);setEditingBooking(null);setCompleteAmount(b.hourlyRate||"");setCompleteNote("");}}
                                  style={{background:isSelected?"rgba(255,255,255,0.08)":"rgba(255,255,255,0.1)",color:"#f1f5f9",border:"1px solid rgba(255,255,255,0.15)",borderRadius:8,padding:"7px 14px",fontSize:"0.82rem",fontWeight:600,cursor:"pointer"}}>
                                  {isSelected?"Cancel":"Mark Complete"}
                                </button>
                              )}
                              {!isComplete&&b.status!=="Cancelled"&&b.status!=="Skipped"&&(
                                timerBookingRow===b.rowIndex?(
                                  <div style={{display:"flex",alignItems:"center",gap:8,background:"rgba(251,191,36,0.08)",border:"1px solid #f59e0b",borderRadius:8,padding:"5px 12px"}}>
                                    <span style={{fontSize:"0.9rem",fontWeight:800,color:"#fbbf24",fontVariantNumeric:"tabular-nums"}}>{timerDisplay(timerElapsed)}</span>
                                    <button onClick={()=>stopTimer(b)} style={{background:"#dc2626",color:"#fff",border:"none",borderRadius:6,padding:"4px 10px",fontSize:"0.78rem",fontWeight:700,cursor:"pointer"}}>Stop</button>
                                  </div>
                                ):(
                                  <button onClick={()=>{startTimer(b.rowIndex);setSelectedAdminBooking(b);setEditingBooking(null);setCompleteAmount(b.hourlyRate||"");setCompleteNote("");}} style={{background:"#059669",color:"#fff",border:"none",borderRadius:8,padding:"7px 14px",fontSize:"0.82rem",fontWeight:600,cursor:"pointer"}}>▶ Timer</button>
                                )
                              )}
                              {b.status!=="Cancelled"&&b.status!=="Skipped"&&(
                                <button onClick={()=>{setEditingBooking(editingBooking?.rowIndex===b.rowIndex?null:b);setEditFields({name:b.name,phone:b.phone,email:b.email,date:b.date,time:b.time,year:b.year,make:b.make,model:b.model,packageType:b.packageType,serviceType:b.serviceType,address:b.address,notes:b.notes,clientType:b.clientType,recurringFrequency:b.recurringFrequency,addOns:b.addOns});setSelectedAdminBooking(null);}}
                                  style={{background:"rgba(255,255,255,0.06)",color:"rgba(255,255,255,0.7)",border:"none",borderRadius:8,padding:"7px 14px",fontSize:"0.82rem",fontWeight:600,cursor:"pointer"}}>
                                  {editingBooking?.rowIndex===b.rowIndex?"Cancel Edit":"Edit"}
                                </button>
                              )}
                              {!isComplete&&isUpcoming(b.date)&&b.status!=="Cancelled"&&b.status!=="Skipped"&&(
                                <button onClick={async()=>{
                                  if(!window.confirm(`Cancel ${b.name}'s appointment on ${formatDateLabel(b.date)}?`))return;
                                  try{
                                    const res=await fetch(SCRIPT_URL,{method:"POST",body:JSON.stringify({action:"cancelBooking",rowIndex:b.rowIndex,customerName:b.name,customerEmail:b.email,customerPhone:b.phone,date:b.date,time:b.time,vehicle:[b.year,b.make,b.model].filter(Boolean).join(" "),packageType:b.packageType,address:b.address,clientType:b.clientType})});
                                    const d=await res.json();
                                    if(d.success){setAdminBookings(p=>p.map(bk=>bk.rowIndex===b.rowIndex?{...bk,status:"Cancelled"}:bk));alert(`Cancelled. ${b.name} has been notified.`);}
                                    else alert("Something went wrong.");
                                  }catch{alert("Something went wrong.");}
                                }} style={{background:"rgba(239,68,68,0.1)",color:"#dc2626",border:"1.5px solid #fca5a5",borderRadius:8,padding:"7px 14px",fontSize:"0.82rem",fontWeight:600,cursor:"pointer"}}>Cancel</button>
                              )}
                              {!isComplete&&isUpcoming(b.date)&&b.status!=="Cancelled"&&b.status!=="Skipped"&&b.clientType==="maintenance"&&(
                                <button onClick={async()=>{
                                  if(!window.confirm(`Skip ${b.name}'s maintenance on ${formatDateLabel(b.date)}?`))return;
                                  const tid=showToast("Skipping...","loading");
                                  try{
                                    const res=await fetch(SCRIPT_URL,{method:"POST",body:JSON.stringify({action:"skipMaintenanceBooking",rowIndex:b.rowIndex,customerName:b.name,customerEmail:b.email,customerPhone:b.phone,date:b.date,time:b.time,vehicleLabel:[b.year,b.make,b.model].filter(Boolean).join(" "),packageType:b.packageType,address:b.address,recurringFrequency:b.recurringFrequency,name:b.name,phone:b.phone,email:b.email,year:b.year,make:b.make,model:b.model,boatSize:"",vehicle:b.vehicle,hourlyRate:b.hourlyRate,addOns:b.addOns,serviceType:b.serviceType,clientType:b.clientType,avgTime:b.avgTime,notes:b.notes})});
                                    const d=await res.json();
                                    if(d.success){setAdminBookings(p=>p.map(bk=>bk.rowIndex===b.rowIndex?{...bk,status:"Skipped"}:bk));updateToast(tid,`Skipped ✓ — Next: ${d.nextDate||"see schedule"}`,"success",4000);await loadAdminBookings();}
                                    else updateToast(tid,"Failed: "+(d.error||""),"error",4000);
                                  }catch{updateToast(tid,"Error","error",4000);}
                                }} style={{background:"rgba(59,130,246,0.08)",color:"#0369a1",border:"1.5px solid #7dd3fc",borderRadius:8,padding:"7px 14px",fontSize:"0.82rem",fontWeight:600,cursor:"pointer"}}>⏭ Skip</button>
                              )}
                            </div>

                            {/* Edit form */}
                            {editingBooking?.rowIndex===b.rowIndex&&(
                              <div style={{marginTop:14,padding:16,background:"rgba(255,255,255,0.04)",borderRadius:12,border:"1px solid rgba(255,255,255,0.08)"}}>
                                <div style={{fontWeight:700,color:"rgba(255,255,255,0.7)",marginBottom:12}}>Edit Booking</div>
                                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
                                  {[{label:"Name",key:"name"},{label:"Phone",key:"phone"},{label:"Email",key:"email"},{label:"Year",key:"year"},{label:"Make",key:"make"},{label:"Model",key:"model"},{label:"Address",key:"address"},{label:"Notes",key:"notes"}].map(field=>(
                                    <div key={field.key}><div style={{fontSize:"0.78rem",color:"rgba(255,255,255,0.45)",marginBottom:3}}>{field.label}</div><input style={{...S.input,padding:"8px 10px",fontSize:"0.85rem"}} value={(editFields as any)[field.key]||""} onChange={e=>setEditFields(p=>({...p,[field.key]:e.target.value}))}/></div>
                                  ))}
                                  <div><div style={{fontSize:"0.78rem",color:"rgba(255,255,255,0.45)",marginBottom:3}}>Date</div><input type="date" style={{...S.input,padding:"8px 10px",fontSize:"0.85rem",backgroundColor:"rgba(255,255,255,0.05)"}} value={editFields.date||b.date} min={new Date().toISOString().split("T")[0]} onChange={e=>setEditFields(p=>({...p,date:e.target.value}))}/></div>
                                  <div><div style={{fontSize:"0.78rem",color:"rgba(255,255,255,0.45)",marginBottom:3}}>Time</div><select style={{...S.input,padding:"8px 10px",fontSize:"0.85rem",backgroundColor:"transparent"}} value={editFields.time||b.time} onChange={e=>setEditFields(p=>({...p,time:e.target.value}))}>{SLOT_HOURS.map(t=><option key={t} value={t}>{t}</option>)}</select></div>
                                  <div><div style={{fontSize:"0.78rem",color:"rgba(255,255,255,0.45)",marginBottom:3}}>Package</div><select style={{...S.input,padding:"8px 10px",fontSize:"0.85rem",backgroundColor:"transparent"}} value={(editFields as any).packageType||""} onChange={e=>setEditFields(p=>({...p,packageType:e.target.value}))}><option value="basic">Interior + Exterior ($279)</option><option value="interior">Interior ($169)</option><option value="exterior">Exterior ($139)</option></select></div>
                                  <div><div style={{fontSize:"0.78rem",color:"rgba(255,255,255,0.45)",marginBottom:3}}>Service Type</div><select style={{...S.input,padding:"8px 10px",fontSize:"0.85rem",backgroundColor:"transparent"}} value={(editFields as any).serviceType||""} onChange={e=>setEditFields(p=>({...p,serviceType:e.target.value}))}><option value="mobile">Mobile</option><option value="dropoff">Drop-Off</option></select></div>
                                  <div><div style={{fontSize:"0.78rem",color:"rgba(255,255,255,0.45)",marginBottom:3}}>Client Type</div><select style={{...S.input,padding:"8px 10px",fontSize:"0.85rem",backgroundColor:"transparent"}} value={(editFields as any).clientType||""} onChange={e=>setEditFields(p=>({...p,clientType:e.target.value}))}><option value="oneTime">One-Time</option><option value="maintenance">Maintenance</option></select></div>
                                  <div><div style={{fontSize:"0.78rem",color:"rgba(255,255,255,0.45)",marginBottom:3}}>Frequency</div><select style={{...S.input,padding:"8px 10px",fontSize:"0.85rem",backgroundColor:"transparent"}} value={(editFields as any).recurringFrequency||""} onChange={e=>setEditFields(p=>({...p,recurringFrequency:e.target.value}))}><option value="">None</option><option value="biweekly">Bi-Weekly</option><option value="monthly">Monthly</option></select></div>
                                </div>
                                <div style={{display:"flex",gap:8}}>
                                  <button onClick={handleSaveEdit} disabled={editSaving} style={{background:"#2563eb",color:"#fff",border:"none",borderRadius:8,padding:"9px 18px",fontWeight:700,fontSize:"0.88rem",cursor:"pointer",opacity:editSaving?0.5:1}}>{editSaving?"Saving...":"Save Changes"}</button>
                                  <button onClick={()=>{setEditingBooking(null);setEditFields({});}} style={{background:"rgba(255,255,255,0.06)",color:"rgba(255,255,255,0.7)",border:"none",borderRadius:8,padding:"9px 14px",fontWeight:600,fontSize:"0.88rem",cursor:"pointer"}}>Cancel</button>
                                </div>
                              </div>
                            )}

                            {/* Mark complete form */}
                            {isSelected&&(
                              <div style={{marginTop:14,padding:16,background:"rgba(255,255,255,0.04)",borderRadius:12,border:"1px solid rgba(255,255,255,0.08)"}}>
                                <div style={{fontWeight:700,color:"rgba(255,255,255,0.7)",marginBottom:10}}>Set Invoice Amount</div>
                                <div style={{display:"flex",gap:10,marginBottom:10,flexWrap:"wrap" as const}}>
                                  <div style={{flex:1,minWidth:120}}>
                                    <div style={{fontSize:"0.82rem",color:"rgba(255,255,255,0.45)",marginBottom:4}}>Amount ($) *</div>
                                    <input style={{...S.input,padding:"10px 12px",fontWeight:700,fontSize:"1.1rem"}} type="number" step="0.01" placeholder={b.packageType==="basic"?"279":b.packageType==="interior"?"169":"139"} value={completeAmount} onChange={e=>setCompleteAmount(e.target.value)}/>
                                  </div>
                                  <div style={{flex:2,minWidth:180}}>
                                    <div style={{fontSize:"0.82rem",color:"rgba(255,255,255,0.45)",marginBottom:4}}>Note (optional)</div>
                                    <input style={{...S.input,padding:"10px 12px"}} placeholder="e.g. includes add-ons" value={completeNote} onChange={e=>setCompleteNote(e.target.value)}/>
                                  </div>
                                </div>
                                {/* Quick fill buttons */}
                                <div style={{display:"flex",gap:6,marginBottom:12,flexWrap:"wrap" as const}}>
                                  {[["Interior + Exterior","279"],["Interior","169"],["Exterior","139"]].map(([lbl,amt])=>(
                                    <button key={lbl} onClick={()=>setCompleteAmount(amt)} style={{background:completeAmount===amt?"rgba(16,185,129,0.2)":"rgba(255,255,255,0.06)",color:completeAmount===amt?"#34d399":"rgba(255,255,255,0.6)",border:`1px solid ${completeAmount===amt?"#6ee7b7":"rgba(255,255,255,0.12)"}`,borderRadius:8,padding:"5px 12px",fontSize:"0.78rem",fontWeight:600,cursor:"pointer"}}>{lbl} ${amt}</button>
                                  ))}
                                </div>
                                <div style={{fontSize:"0.8rem",color:"rgba(255,255,255,0.35)",marginBottom:10}}>Creates a pending invoice. Release it from the Invoices tab for client to see.</div>
                                <div style={{display:"flex",gap:8,flexWrap:"wrap" as const}}>
                                  <button onClick={handleMarkComplete} disabled={completeLoading||!completeAmount} style={{background:"#059669",color:"#fff",border:"none",borderRadius:8,padding:"9px 18px",fontWeight:700,fontSize:"0.88rem",cursor:"pointer",opacity:completeLoading||!completeAmount?0.5:1}}>{completeLoading?"Saving...":"Confirm Complete"}</button>
                                </div>
                                {/* Photo upload */}
                                <div style={{marginTop:14,padding:14,background:"rgba(59,130,246,0.08)",borderRadius:12,border:"1px solid #bae6fd"}}>
                                  <div style={{fontWeight:700,color:"#0369a1",marginBottom:10,fontSize:"0.85rem"}}>Job Photos</div>
                                  {(["before","after"] as const).map(type=>{
                                    const previewKey=`${b.rowIndex}_${type}`;
                                    const previews=localPhotoPreviews[previewKey]||[];
                                    const existingUrls=type==="before"?(b.beforePhotoUrl?b.beforePhotoUrl.split(",").map(u=>u.trim()).filter(Boolean):[]):(b.afterPhotoUrl?b.afterPhotoUrl.split(",").map(u=>u.trim()).filter(Boolean):[]);
                                    const allPreviews=[...existingUrls,...previews];
                                    return(<div key={type} style={{marginBottom:12}}>
                                      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
                                        <div style={{fontSize:"0.75rem",fontWeight:700,color:type==="before"?"#7dd3fc":"#6ee7b7",textTransform:"uppercase" as const,letterSpacing:"0.06em"}}>{type==="before"?"Before":"After"}{allPreviews.length>0?` (${allPreviews.length})`:""}</div>
                                        <label style={{cursor:"pointer"}}>
                                          <input type="file" accept="image/*" multiple style={{display:"none"}} onChange={async(e)=>{
                                            const files=Array.from(e.target.files||[]);if(!files.length)return;
                                            setPhotoUploading(p=>({...p,[b.rowIndex]:type}));
                                            const compressImage=(file: File):Promise<{base64:string;dataUrl:string}>=>(new Promise(resolve=>{const img=new Image();const url=URL.createObjectURL(file);img.onload=()=>{URL.revokeObjectURL(url);const MAX=1200;const scale=Math.min(1,MAX/Math.max(img.width,img.height));const canvas=document.createElement("canvas");canvas.width=Math.round(img.width*scale);canvas.height=Math.round(img.height*scale);canvas.getContext("2d")!.drawImage(img,0,0,canvas.width,canvas.height);const dataUrl=canvas.toDataURL("image/jpeg",0.78);resolve({base64:dataUrl.split(",")[1],dataUrl});};img.src=url;}));
                                            const compressed=await Promise.all(files.map(compressImage));
                                            setLocalPhotoPreviews(p=>({...p,[previewKey]:[...(p[previewKey]||[]),...compressed.map(c=>c.dataUrl)]}));
                                            await Promise.all(compressed.map(async({base64},idx)=>{try{await fetch(SCRIPT_URL,{method:"POST",body:JSON.stringify({action:"uploadJobPhoto",customerName:b.name,serviceDate:b.date,photoType:type,base64,mimeType:"image/jpeg",rowIndex:b.rowIndex})});}catch{console.error("Upload error",idx);}}));
                                            setPhotoUploading(p=>{const n={...p};delete n[b.rowIndex];return n;});e.target.value="";
                                          }}/>
                                          <span style={{display:"inline-flex",alignItems:"center",gap:5,background:type==="before"?"#0369a1":"#059669",color:"#fff",borderRadius:8,padding:"6px 12px",fontSize:"0.78rem",fontWeight:600,cursor:"pointer",opacity:photoUploading[b.rowIndex]?0.5:1}}>
                                            {photoUploading[b.rowIndex]===type?<><div style={{width:12,height:12,border:"2px solid rgba(255,255,255,0.3)",borderTopColor:"#fff",borderRadius:"50%",animation:"spin 0.7s linear infinite"}}/>Uploading...</>:`+ Add ${type==="before"?"Before":"After"}`}
                                          </span>
                                        </label>
                                      </div>
                                      {allPreviews.length>0?(
                                        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(72px,1fr))",gap:6}}>
                                          {allPreviews.map((src,i)=>(
                                            <div key={i} style={{position:"relative" as const,aspectRatio:"1",borderRadius:8,overflow:"hidden",border:`2px solid ${type==="before"?"rgba(125,211,252,0.4)":"rgba(110,231,183,0.4)"}`}}>
                                              <img src={src} style={{width:"100%",height:"100%",objectFit:"cover" as const,display:"block"}}/>
                                              <div style={{position:"absolute" as const,bottom:0,left:0,right:0,background:"rgba(0,0,0,0.5)",fontSize:"0.6rem",color:"#fff",textAlign:"center" as const,padding:"2px 0",fontWeight:600}}>{i<existingUrls.length?"✓ saved":"✓ uploaded"}</div>
                                            </div>
                                          ))}
                                        </div>
                                      ):(
                                        <div style={{background:"rgba(255,255,255,0.04)",border:"1.5px dashed rgba(255,255,255,0.12)",borderRadius:8,padding:"12px",textAlign:"center" as const,fontSize:"0.75rem",color:"rgba(255,255,255,0.3)"}}>No {type} photos yet</div>
                                      )}
                                    </div>);
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}

                {/* INVOICES TAB */}
                {adminTab==="invoices"&&(
                  <>
                    {pendingInvoices.length>0&&(
                      <>
                        <div style={{fontWeight:700,color:"#fbbf24",fontSize:"0.85rem",textTransform:"uppercase" as const,letterSpacing:"0.04em",marginBottom:10}}>Pending — Not Visible to Client</div>
                        <div style={{display:"grid",gap:10,marginBottom:24}}>
                          {pendingInvoices.map((b,i)=>(
                            <div key={i} style={{background:"rgba(255,255,255,0.05)",border:"1px solid #fde68a",borderRadius:14,padding:16}}>
                              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap" as const,gap:8,marginBottom:editingInvoiceRow===b.rowIndex?14:0}}>
                                <div>
                                  <div style={{fontWeight:700,color:"#f1f5f9"}}>{b.name} — {formatDateLabel(b.date)}</div>
                                  <div style={{fontSize:"0.85rem",color:"rgba(255,255,255,0.45)"}}>{b.email}</div>
                                  {b.invoiceNote&&editingInvoiceRow!==b.rowIndex&&<div style={{fontSize:"0.82rem",color:"rgba(255,255,255,0.35)",marginTop:2}}>{b.invoiceNote}</div>}
                                </div>
                                <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap" as const}}>
                                  <span style={{fontWeight:800,color:"#fbbf24",fontSize:"1.1rem"}}>${b.invoiceAmount}</span>
                                  <button onClick={()=>{if(editingInvoiceRow===b.rowIndex){setEditingInvoiceRow(null);}else{setEditingInvoiceRow(b.rowIndex);setEditInvoiceAmount(b.invoiceAmount||"");setEditInvoiceNote(b.invoiceNote||"");}}} style={{background:"rgba(255,255,255,0.08)",color:"rgba(255,255,255,0.7)",border:"1px solid rgba(255,255,255,0.15)",borderRadius:8,padding:"6px 12px",fontWeight:600,fontSize:"0.82rem",cursor:"pointer"}}>{editingInvoiceRow===b.rowIndex?"Cancel":"✏ Edit"}</button>
                                  <button onClick={()=>handleReleaseInvoice(b)} disabled={processingRows.has(b.rowIndex)||editingInvoiceRow===b.rowIndex} style={{background:"linear-gradient(135deg,#3b82f6,#1d4ed8)",color:"#fff",border:"none",borderRadius:8,padding:"6px 14px",fontWeight:600,fontSize:"0.82rem",cursor:"pointer",opacity:processingRows.has(b.rowIndex)||editingInvoiceRow===b.rowIndex?0.4:1}}>{processingRows.has(b.rowIndex)?"Processing...":"Release to Client"}</button>
                                </div>
                              </div>
                              {editingInvoiceRow===b.rowIndex&&(
                                <div style={{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:12,padding:14}}>
                                  <div style={{display:"grid",gridTemplateColumns:"1fr 2fr",gap:10,marginBottom:12}}>
                                    <div><div style={{fontSize:"0.75rem",color:"rgba(255,255,255,0.45)",marginBottom:4}}>Amount ($)</div><input type="number" step="0.01" style={{...S.input,padding:"10px 12px",fontSize:"1rem",fontWeight:700}} value={editInvoiceAmount} onChange={e=>setEditInvoiceAmount(e.target.value)} autoFocus/></div>
                                    <div><div style={{fontSize:"0.75rem",color:"rgba(255,255,255,0.45)",marginBottom:4}}>Note</div><input style={{...S.input,padding:"10px 12px"}} placeholder="e.g. includes headlight restoration" value={editInvoiceNote} onChange={e=>setEditInvoiceNote(e.target.value)}/></div>
                                  </div>
                                  <button disabled={!editInvoiceAmount||processingRows.has(b.rowIndex)} onClick={async()=>{const tid=showToast("Saving...","loading");try{const ok=await updateBooking(b.rowIndex,{invoiceAmount:editInvoiceAmount,invoiceNote:editInvoiceNote});if(ok){setAdminBookings(p=>p.map(bk=>bk.rowIndex===b.rowIndex?{...bk,invoiceAmount:editInvoiceAmount,invoiceNote:editInvoiceNote}:bk));setEditingInvoiceRow(null);updateToast(tid,`✓ Updated to $${editInvoiceAmount}`,"success",3000);}else updateToast(tid,"Failed","error",3000);}catch{updateToast(tid,"Error","error",3000);}}} style={{background:"#059669",color:"#fff",border:"none",borderRadius:8,padding:"9px 18px",fontWeight:700,fontSize:"0.88rem",cursor:"pointer",opacity:!editInvoiceAmount?0.5:1}}>Save</button>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                    {releasedInvoices.length>0&&(
                      <>
                        <div style={{fontWeight:700,color:"rgba(255,255,255,0.7)",fontSize:"0.85rem",textTransform:"uppercase" as const,letterSpacing:"0.04em",marginBottom:10}}>Sent to Client — Awaiting Payment</div>
                        <div style={{display:"grid",gap:10,marginBottom:24}}>
                          {releasedInvoices.map((b,i)=>(
                            <div key={i} style={{background:"rgba(255,255,255,0.05)",border:"1px solid #fde047",borderRadius:14,padding:16}}>
                              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap" as const,gap:8}}>
                                <div><div style={{fontWeight:700,color:"#f1f5f9"}}>{b.name} — {formatDateLabel(b.date)}</div><div style={{fontSize:"0.85rem",color:"rgba(255,255,255,0.45)"}}>{b.email}</div>{b.invoiceNote&&<div style={{fontSize:"0.85rem",color:"rgba(255,255,255,0.35)"}}>{b.invoiceNote}</div>}</div>
                                <div style={{display:"flex",alignItems:"center",gap:10}}><span style={{fontWeight:800,color:"#fbbf24",fontSize:"1.1rem"}}>${b.invoiceAmount}</span><button onClick={()=>handleMarkPaid(b)} disabled={processingRows.has(b.rowIndex)} style={{background:"#059669",color:"#fff",border:"none",borderRadius:8,padding:"7px 14px",fontWeight:600,fontSize:"0.82rem",cursor:"pointer",opacity:processingRows.has(b.rowIndex)?0.5:1}}>{processingRows.has(b.rowIndex)?"Processing...":"Mark Paid"}</button></div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                    {paidInvoices.length>0&&(
                      <>
                        <div style={{fontWeight:700,color:"rgba(255,255,255,0.35)",fontSize:"0.85rem",textTransform:"uppercase" as const,letterSpacing:"0.04em",marginBottom:10}}>Paid</div>
                        <div style={{display:"grid",gap:10}}>
                          {paidInvoices.map((b,i)=>(
                            <div key={i} style={{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:14,padding:14}}>
                              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                                <div><div style={{fontWeight:600,color:"rgba(255,255,255,0.7)"}}>{b.name} — {formatDateLabel(b.date)}</div><div style={{fontSize:"0.82rem",color:"rgba(255,255,255,0.35)"}}>{PACKAGE_LABELS[b.packageType]||b.packageType}</div></div>
                                <div style={{display:"flex",alignItems:"center",gap:8}}><span style={{fontWeight:700,color:"rgba(255,255,255,0.7)"}}>${b.invoiceAmount}</span><span style={{background:"rgba(16,185,129,0.15)",color:"#34d399",fontSize:"0.72rem",fontWeight:700,borderRadius:999,padding:"2px 8px"}}>PAID</span></div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                    {pendingInvoices.length===0&&releasedInvoices.length===0&&paidInvoices.length===0&&<div style={{textAlign:"center",padding:40,color:"rgba(255,255,255,0.45)"}}>No invoices yet.</div>}
                  </>
                )}

                {/* REVENUE TAB */}
                {adminTab==="revenue"&&(()=>{
                  const paid=adminBookings.filter(b=>b.invoiceStatus==="paid"&&b.invoiceAmount);
                  const upcoming2=adminBookings.filter(b=>b.status==="Booked"&&isUpcoming(b.date));
                  const now=new Date();const thisMonth=now.getMonth();const thisYear=now.getFullYear();
                  const monthlyData: Record<string,number>={};
                  paid.forEach(b=>{if(!b.date)return;const[y,m]=b.date.split("-").map(Number);const key=`${y}-${String(m).padStart(2,"0")}`;monthlyData[key]=(monthlyData[key]||0)+parseFloat(b.invoiceAmount||"0");});
                  const sortedMonths=Object.keys(monthlyData).sort();const last6=sortedMonths.slice(-6);const maxVal=Math.max(...last6.map(k=>monthlyData[k]),1);
                  const thisMonthKey=`${thisYear}-${String(thisMonth+1).padStart(2,"0")}`;
                  const lastMonthKey=`${thisMonth===0?thisYear-1:thisYear}-${String(thisMonth===0?12:thisMonth).padStart(2,"0")}`;
                  const thisMonthRev=monthlyData[thisMonthKey]||0;const lastMonthRev=monthlyData[lastMonthKey]||0;
                  const momChange=lastMonthRev>0?((thisMonthRev-lastMonthRev)/lastMonthRev*100):0;
                  const totalRev=paid.reduce((s,b)=>s+parseFloat(b.invoiceAmount||"0"),0);
                  const avgJob=paid.length>0?totalRev/paid.length:0;
                  const thisMonthJobs=paid.filter(b=>{const[y,m]=(b.date||"").split("-").map(Number);return y===thisYear&&m===thisMonth+1;}).length;
                  const projectedIncome=upcoming2.reduce((s,b)=>{const price=PACKAGE_PRICES[b.packageType]||0;return s+price;},0);
                  const clientRev: Record<string,{name:string;email:string;total:number;jobs:number}>={};
                  paid.forEach(b=>{if(!clientRev[b.email])clientRev[b.email]={name:b.name,email:b.email,total:0,jobs:0};clientRev[b.email].total+=parseFloat(b.invoiceAmount||"0");clientRev[b.email].jobs++;});
                  const topClients=Object.values(clientRev).sort((a,b)=>b.total-a.total).slice(0,5);
                  const byPkg: Record<string,{count:number;rev:number}>={};
                  paid.forEach(b=>{const p2=PACKAGE_LABELS[b.packageType]||b.packageType||"Other";if(!byPkg[p2])byPkg[p2]={count:0,rev:0};byPkg[p2].count++;byPkg[p2].rev+=parseFloat(b.invoiceAmount||"0");});
                  const monthName=(key:string)=>{const[y,m]=key.split("-").map(Number);return new Date(y,m-1).toLocaleDateString("en-US",{month:"short",year:"2-digit"});};
                  return(<>
                    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))",gap:12,marginBottom:20}}>
                      {[{label:"This Month",value:`$${thisMonthRev.toFixed(0)}`,sub:lastMonthRev>0?`${momChange>=0?"▲":"▼"} ${Math.abs(momChange).toFixed(0)}% vs last month`:"first month",color:"#059669",subColor:momChange>=0?"#34d399":"#f87171"},{label:"Jobs This Month",value:String(thisMonthJobs),sub:"completed & paid",color:"#2563eb",subColor:undefined},{label:"All-Time Revenue",value:`$${totalRev.toFixed(0)}`,sub:`${paid.length} jobs total`,color:"#7c3aed",subColor:undefined},{label:"Avg Job Value",value:`$${avgJob.toFixed(0)}`,sub:"per job",color:"#d97706",subColor:undefined},{label:"Projected",value:`$${projectedIncome.toFixed(0)}`,sub:`${upcoming2.length} upcoming`,color:"#0891b2",subColor:"#67e8f9"}].map((card,i)=>(
                        <div key={i} style={{background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:16,padding:"16px 14px"}}>
                          <div style={{fontSize:"0.72rem",color:"rgba(255,255,255,0.35)",marginBottom:6,fontWeight:600,textTransform:"uppercase" as const,letterSpacing:"0.04em"}}>{card.label}</div>
                          <div style={{fontSize:"1.5rem",fontWeight:900,color:card.color,letterSpacing:"-1px"}}>{card.value}</div>
                          <div style={{fontSize:"0.72rem",color:card.subColor||"rgba(255,255,255,0.35)",marginTop:4}}>{card.sub}</div>
                        </div>
                      ))}
                    </div>
                    {last6.length>0?(
                      <div style={{background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:16,padding:20,marginBottom:16}}>
                        <div style={{fontWeight:700,color:"#f1f5f9",marginBottom:16,fontSize:"0.95rem"}}>Revenue — Last 6 Months</div>
                        <svg width="100%" height="160" viewBox={`0 0 ${last6.length*80} 160`} preserveAspectRatio="none" style={{overflow:"visible"}}>
                          {last6.map((k,i)=>{const barH=Math.max((monthlyData[k]/maxVal)*110,6);const x=i*80+10;const barW=52;const isThis=k===thisMonthKey;const yTop=120-barH;const label=monthlyData[k]>=1000?`$${(monthlyData[k]/1000).toFixed(1)}k`:`$${monthlyData[k].toFixed(0)}`;return(<g key={k}><rect x={x} y={yTop} width={barW} height={barH} rx={6} fill={isThis?"url(#barGrad)":"rgba(16,185,129,0.25)"} style={{filter:isThis?"drop-shadow(0 0 8px rgba(5,150,105,0.5))":"none"}}/><text x={x+barW/2} y={yTop-6} textAnchor="middle" fontSize="10" fill="rgba(255,255,255,0.5)" fontFamily="Outfit,sans-serif" fontWeight="600">{label}</text><text x={x+barW/2} y={148} textAnchor="middle" fontSize="10" fill={isThis?"#34d399":"rgba(255,255,255,0.3)"} fontFamily="Outfit,sans-serif" fontWeight={isThis?"700":"400"}>{monthName(k)}</text></g>);})}
                          <line x1="0" y1="121" x2={last6.length*80} y2="121" stroke="rgba(255,255,255,0.08)" strokeWidth="1"/>
                          <defs><linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#10b981"/><stop offset="100%" stopColor="#047857"/></linearGradient></defs>
                        </svg>
                      </div>
                    ):<div style={{textAlign:"center",padding:40,color:"rgba(255,255,255,0.45)"}}>No paid invoices yet.</div>}
                    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(280px,1fr))",gap:16}}>
                      {topClients.length>0&&(
                        <div style={{background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:16,padding:20}}>
                          <div style={{fontWeight:700,color:"#f1f5f9",marginBottom:14,fontSize:"0.95rem"}}>Top Clients</div>
                          {topClients.map((c,i)=>{const barPct=topClients[0].total>0?(c.total/topClients[0].total)*100:0;const medals=["🥇","🥈","🥉","4.","5."];return(<div key={i} style={{marginBottom:i<topClients.length-1?14:0}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}><div style={{display:"flex",alignItems:"center",gap:8}}><span style={{fontSize:"0.9rem"}}>{medals[i]}</span><div><div style={{fontWeight:700,color:"#f1f5f9",fontSize:"0.88rem"}}>{c.name}</div><div style={{fontSize:"0.72rem",color:"rgba(255,255,255,0.35)"}}>{c.jobs} job{c.jobs!==1?"s":""}</div></div></div><div style={{fontWeight:800,color:"#34d399",fontSize:"0.95rem"}}>${c.total.toFixed(0)}</div></div><div style={{height:4,background:"rgba(255,255,255,0.06)",borderRadius:999,overflow:"hidden"}}><div style={{height:"100%",width:`${barPct}%`,background:i===0?"linear-gradient(90deg,#059669,#34d399)":"rgba(16,185,129,0.4)",borderRadius:999}}/></div></div>);})}
                        </div>
                      )}
                      {paid.length>0&&(
                        <div style={{background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:16,padding:20}}>
                          <div style={{fontWeight:700,color:"#f1f5f9",marginBottom:14,fontSize:"0.95rem"}}>Revenue by Service</div>
                          {Object.entries(byPkg).sort((a,b)=>b[1].rev-a[1].rev).map(([p2,data],i)=>{const maxPkg=Math.max(...Object.values(byPkg).map(v=>v.rev));const pct=maxPkg>0?(data.rev/maxPkg)*100:0;return(<div key={i} style={{marginBottom:i<Object.keys(byPkg).length-1?12:0}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}><div><div style={{fontSize:"0.85rem",fontWeight:600,color:"rgba(255,255,255,0.7)"}}>{p2}</div><div style={{fontSize:"0.72rem",color:"rgba(255,255,255,0.35)"}}>{data.count} job{data.count!==1?"s":""}</div></div><div style={{fontWeight:800,color:"#3b82f6"}}>${data.rev.toFixed(0)}</div></div><div style={{height:4,background:"rgba(255,255,255,0.06)",borderRadius:999,overflow:"hidden"}}><div style={{height:"100%",width:`${pct}%`,background:"linear-gradient(90deg,#3b82f6,#60a5fa)",borderRadius:999}}/></div></div>);})}
                        </div>
                      )}
                    </div>
                  </>);
                })()}

                {/* DISCOUNTS TAB */}
                {adminTab==="discounts"&&<DiscountsTab S={S}/>}
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── REQUEST CHANGE ─────────────────────────────────────────────────────────
  if (view==="requestChange"&&changeTarget) {
    return(
      <div style={S.page}><Bg/>
        <div style={S.container}>
          <Header/>
          <div style={S.card}>
            <button onClick={()=>setView("myBookings")} style={{...S.secondary,padding:"9px 14px",fontSize:"0.9rem",marginBottom:20}}>Back</button>
            {changeSubmitted?(
              <div style={S.successWrap}>
                <h2 style={S.title}>Request Sent</h2>
                <p style={S.successText}>Your request has been sent. We'll be in touch shortly.</p>
                <button onClick={()=>{setView("myBookings");loadMyBookings();}} style={S.primary}>Back to My Bookings</button>
              </div>
            ):(
              <>
                <h2 style={S.title}>Request a Change</h2>
                <p style={S.subtitle}>Let us know what you'd like to change.</p>
                <div style={{...S.summaryCard,marginBottom:24}}>
                  <div style={S.summaryHeading}>Appointment</div>
                  <div style={S.summaryValue}>{formatDateLabel(changeTarget.date)}{changeTarget.time?` at ${changeTarget.time}`:""}<br/>{[changeTarget.year,changeTarget.make,changeTarget.model].filter(Boolean).join(" ")}<br/>{PACKAGE_LABELS[changeTarget.packageType]||changeTarget.packageType}</div>
                </div>
                <textarea style={{...S.input,marginTop:10,minHeight:130,resize:"vertical" as const,fontFamily:"inherit",lineHeight:1.5}} placeholder="Describe what you'd like to change..." value={changeNote} onChange={e=>setChangeNote(e.target.value)}/>
                <div style={{...S.buttonRow,marginTop:16}}>
                  <button style={S.secondary} onClick={()=>setView("myBookings")}>Cancel</button>
                  <button style={{...S.primary,...(!changeNote.trim()||changeSubmitting?S.disabled:{})}} onClick={submitChangeRequest} disabled={!changeNote.trim()||changeSubmitting}>{changeSubmitting?"Sending...":"Send Request"}</button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── BOOKING FLOW ──────────────────────────────────────────────────────────
  return (
    <div style={S.page}><Bg/><Toasts/>
      <div style={S.container}>
        <Header/>
        {step>0&&step<TOTAL_STEPS-1&&<ProgressBar/>}
        <div style={S.card} key={step}>

          {/* STEP 0 — Landing */}
          {step===0&&(
            <>
              <div style={{textAlign:"center" as const,padding:"16px 0 24px"}}>
                <div className="stagger-1" style={{display:"inline-block",fontSize:"0.72rem",fontWeight:700,letterSpacing:"0.18em",color:"rgba(99,179,237,0.8)",textTransform:"uppercase" as const,marginBottom:16,background:"rgba(59,130,246,0.1)",border:"1px solid rgba(59,130,246,0.25)",borderRadius:999,padding:"5px 16px"}}>Premium Auto Detailing</div>
                <h2 className="stagger-2" style={{...S.title,fontSize:"clamp(2.2rem,7vw,3.8rem)",marginBottom:12,background:"linear-gradient(135deg,#ffffff 0%,rgba(255,255,255,0.7) 100%)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",backgroundClip:"text"}}>Bring Back That New Car Feeling</h2>
                <p className="stagger-3" style={{...S.subtitle,marginBottom:32,fontSize:"1.05rem"}}>{config.serviceArea}</p>
                <div className="stagger-4" style={{display:"flex",justifyContent:"center",gap:12,flexWrap:"wrap" as const,marginBottom:28}}>
                  <button style={{...S.primary,padding:"16px 32px",fontSize:"1.05rem",letterSpacing:"-0.3px"}} onClick={()=>setStep(1)}>Book a Service →</button>
                  {googleUser&&isAdminEmail(googleUser.email)&&<button style={{...S.primary,background:"linear-gradient(135deg,#059669,#047857)"}} onClick={()=>{setView("admin");loadAdminBookings();}}>Admin Panel</button>}
                  {googleUser&&isAdminEmail(googleUser.email)&&<button style={{...S.primary,background:"linear-gradient(135deg,#7c3aed,#5b21b6)"}} onClick={()=>{setView("inventory");loadInventory();}}>Inventory</button>}
                  {googleUser&&<button style={S.secondary} onClick={openMyBookings}>My Bookings</button>}
                </div>
                {!googleUser&&<p style={{textAlign:"center" as const,color:"rgba(255,255,255,0.35)",fontSize:"0.85rem",marginBottom:20}}>Sign in with Google to view your bookings.</p>}
              </div>
              <div style={{borderTop:"1px solid rgba(255,255,255,0.07)",paddingTop:18,display:"flex",gap:8,flexWrap:"wrap" as const,justifyContent:"center"}}>
                {["Interior Detail","Exterior Detail","Interior + Exterior","Maintenance Plans","Mobile Service"].map(tag=>(
                  <span key={tag} style={{background:"rgba(255,255,255,0.06)",borderRadius:999,padding:"6px 16px",fontSize:"0.82rem",color:"rgba(255,255,255,0.5)",fontWeight:500,border:"1px solid rgba(255,255,255,0.10)"}}>{tag}</span>
                ))}
              </div>
            </>
          )}

          {/* STEP 1 — Vehicle Type */}
          {step===1&&(
            <>
              <h2 style={S.title}>Vehicle Type</h2>
              <p style={S.subtitle}>What type of vehicle are we detailing?</p>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",gap:14,marginBottom:20}}>
                {vehicleOptions.map(option=>(
                  <button key={option.id} style={{...S.optionCard,...(vehicle===option.id?S.selectedCard:{})}} onClick={()=>{setVehicle(option.id);setPkg("");setMake("");setModel("");setMakeOptions([]);setModelOptions([]);setAddOns([]);}}>
                    <div style={S.optionTitle}>{option.label}</div>
                  </button>
                ))}
              </div>
              <div style={S.buttonRow}>
                <button style={S.secondary} onClick={()=>setStep(0)}>Back</button>
                <div style={S.rightButtons}><button style={{...S.primary,...(!vehicle?S.disabled:{})}} onClick={next} disabled={!vehicle}>Next</button></div>
              </div>
            </>
          )}

          {/* STEP 2 — Service Plan */}
          {step===2&&(
            <>
              <h2 style={S.title}>Service Plan</h2>
              <p style={S.subtitle}>One-time detail or recurring maintenance?</p>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:14,marginBottom:20}}>
                <button style={{...S.optionCard,...(clientType==="oneTime"?S.selectedCard:{})}} onClick={()=>{setClientType("oneTime");setFrequency("");}}>
                  <div style={S.optionTitle}>One-Time Service</div>
                  <div style={S.optionMeta}>A single detail appointment. Great for a deep clean or special occasion.</div>
                </button>
                <button style={{...S.optionCard,...(clientType==="maintenance"?S.selectedGreen:{})}} onClick={()=>setClientType("maintenance")}>
                  <div style={{...S.optionTitle,color:clientType==="maintenance"?"#34d399":"#f1f5f9"}}>Maintenance Plan</div>
                  <div style={S.optionMeta}>Recurring details to keep your vehicle in top condition. Bi-weekly or monthly.</div>
                </button>
              </div>
              {clientType==="maintenance"&&(
                <div style={{marginTop:4,marginBottom:8}}>
                  <div style={{background:"rgba(251,191,36,0.12)",border:"1px solid #fde68a",borderRadius:14,padding:"12px 16px",marginBottom:16,fontSize:"0.9rem",color:"#fbbf24",lineHeight:1.6}}>Must have had a detail with us within the last 30 days to sign up for a maintenance plan.</div>
                  <div style={{fontWeight:700,color:"rgba(255,255,255,0.7)",fontSize:"0.95rem",marginBottom:12,textAlign:"center" as const}}>How often?</div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                    <button style={{...S.optionCard,...(frequency==="biweekly"?S.selectedGreen:{}),textAlign:"center" as const}} onClick={()=>setFrequency("biweekly")}>
                      <div style={{...S.optionTitle,textAlign:"center" as const,color:frequency==="biweekly"?"#34d399":"#f1f5f9"}}>Bi-Weekly</div>
                      <div style={S.optionMeta}>Every two weeks.</div>
                    </button>
                    <button style={{...S.optionCard,...(frequency==="monthly"?S.selectedGreen:{}),textAlign:"center" as const}} onClick={()=>setFrequency("monthly")}>
                      <div style={{...S.optionTitle,textAlign:"center" as const,color:frequency==="monthly"?"#34d399":"#f1f5f9"}}>Monthly</div>
                      <div style={S.optionMeta}>Once a month.</div>
                    </button>
                  </div>
                </div>
              )}
              <div style={S.buttonRow}>
                <button style={S.secondary} onClick={back}>Back</button>
                <div style={S.rightButtons}><button style={{...S.primary,...(!clientType||(clientType==="maintenance"&&!frequency)?S.disabled:{})}} onClick={next} disabled={!clientType||(clientType==="maintenance"&&!frequency)}>Next</button></div>
              </div>
            </>
          )}

          {/* STEP 3 — Package */}
          {step===3&&(
            <>
              <h2 style={S.title}>Choose Your Package</h2>
              <p style={S.subtitle}>All packages are flat-rate — no hidden fees.</p>
              <div style={{display:"grid",gap:16,marginBottom:20}}>
                {([
                  {id:"basic" as PackageType,tag:"BEST VALUE"},
                  {id:"interior" as PackageType,tag:"INTERIOR"},
                  {id:"exterior" as PackageType,tag:"EXTERIOR"},
                ]).map(({id,tag})=>(
                  <button key={id} onClick={()=>setPkg(id)} style={{...S.optionCard,...(pkg===id?S.selectedCard:{}),textAlign:"left" as const,padding:20}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12}}>
                      <div>
                        <span style={{background:id==="basic"?"rgba(16,185,129,0.2)":"rgba(255,255,255,0.08)",color:id==="basic"?"#34d399":"rgba(255,255,255,0.5)",fontSize:"0.65rem",fontWeight:800,borderRadius:6,padding:"2px 8px",letterSpacing:"0.06em",marginBottom:8,display:"inline-block"}}>{tag}</span>
                        <div style={{...S.optionTitle,fontSize:"1.15rem",marginBottom:2}}>{PACKAGE_LABELS[id]}</div>
                      </div>
                      {/* Crossed-out original price + discounted price */}
                      <div style={{textAlign:"right" as const}}>
                        <div style={{fontSize:"1rem",color:"rgba(255,255,255,0.35)",textDecoration:"line-through",lineHeight:1.2}}>${PACKAGE_ORIGINAL_PRICES[id]}</div>
                        <div style={{fontSize:"2rem",fontWeight:900,color:"#34d399",letterSpacing:"-1px",lineHeight:1.1}}>${PACKAGE_PRICES[id]}</div>
                        <div style={{fontSize:"0.65rem",color:"rgba(52,211,153,0.7)",fontWeight:700,letterSpacing:"0.04em"}}>LIMITED OFFER</div>
                      </div>
                    </div>
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"4px 12px"}}>
                      {PACKAGE_INCLUDES[id].map(item=>(
                        <div key={item} style={{display:"flex",alignItems:"center",gap:6,fontSize:"0.78rem",color:"rgba(255,255,255,0.55)"}}>
                          <span style={{color:"#34d399",flexShrink:0}}>✓</span>{item}
                        </div>
                      ))}
                    </div>
                  </button>
                ))}
              </div>
              {pkg&&(
                <div style={{background:"rgba(16,185,129,0.1)",border:"1px solid #6ee7b7",borderRadius:16,padding:16,textAlign:"center" as const,marginBottom:8}}>
                  <div style={{fontSize:"0.85rem",color:"#10b981",marginBottom:4}}>{PACKAGE_LABELS[pkg]}</div>
                  <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:12}}>
                    <div style={{fontSize:"1.2rem",color:"rgba(255,255,255,0.35)",textDecoration:"line-through"}}>${PACKAGE_ORIGINAL_PRICES[pkg]}</div>
                    <div style={{fontSize:"2.5rem",fontWeight:900,color:"#34d399"}}>${PACKAGE_PRICES[pkg]}</div>
                  </div>
                  <div style={{fontSize:"0.78rem",color:"rgba(255,255,255,0.45)",marginTop:4}}>Flat rate · No hidden fees · Limited time offer</div>
                </div>
              )}
              <div style={{marginTop:10,fontSize:"0.85rem",color:"rgba(255,255,255,0.45)",textAlign:"center" as const}}>
                More info at{" "}
                <a href="https://azdetails.ca" target="_blank" rel="noopener noreferrer" style={{color:"#f1f5f9",textDecoration:"none",fontWeight:600,borderBottom:"1px solid rgba(255,255,255,0.3)"}}>azdetails.ca</a>
              </div>
              <div style={S.buttonRow}>
                <button style={S.secondary} onClick={back}>Back</button>
                <div style={S.rightButtons}><button style={{...S.primary,...(!pkg?S.disabled:{})}} onClick={next} disabled={!pkg}>Next</button></div>
              </div>
            </>
          )}

          {/* STEP 4 — Add-Ons */}
          {step===4&&(
            <>
              <h2 style={S.title}>Add-On Services</h2>
              <p style={S.subtitle}>Optional extras to enhance your detail.</p>
              <div style={{display:"grid",gap:12,marginBottom:18}}>
                {addOnOptions.map(option=>(
                  <label key={option.label} style={{...S.addOnRow,...(addOns.includes(option.label)?{background:"rgba(59,130,246,0.12)",border:"1.5px solid rgba(59,130,246,0.4)"}:{})}}>
                    <div style={{display:"flex",alignItems:"center",gap:12,flex:1,minWidth:220}}>
                      <input style={{width:18,height:18,accentColor:"#3b82f6"}} type="checkbox" checked={addOns.includes(option.label)} onChange={()=>setAddOns(p=>p.includes(option.label)?p.filter(a=>a!==option.label):[...p,option.label])}/>
                      <span style={{fontWeight:600,color:"#f1f5f9"}}>{option.label}</span>
                    </div>
                    {option.consultation
                      ? <span style={{color:"rgba(255,255,255,0.4)",fontWeight:500,fontSize:"0.85rem",fontStyle:"italic"}}>Consultation required</span>
                      : <span style={{color:"#93c5fd",fontWeight:700,fontSize:"1rem"}}>${option.price}</span>
                    }
                  </label>
                ))}
              </div>
              {addOns.length>0&&(
                <div style={{background:"rgba(16,185,129,0.1)",border:"1px solid #6ee7b7",borderRadius:16,padding:16,textAlign:"center" as const,marginBottom:8}}>
                  <div style={{fontSize:"0.85rem",color:"#10b981",marginBottom:4}}>Package + Add-Ons</div>
                  <div style={{fontSize:"2rem",fontWeight:900,color:"#34d399"}}>${PACKAGE_PRICES[pkg]||0} + ${addOnTotal} = ${(PACKAGE_PRICES[pkg]||0)+addOnTotal}</div>
                </div>
              )}
              <div style={S.buttonRow}>
                <button style={S.secondary} onClick={back}>Back</button>
                <div style={S.rightButtons}><button style={S.primary} onClick={next}>{addOns.length===0?"Skip — No Add-Ons":"Next"}</button></div>
              </div>
            </>
          )}

          {/* STEP 5 — Location */}
          {step===5&&(
            <>
              <h2 style={S.title}>Service Location</h2>
              <p style={S.subtitle}>Mobile service or drop-off?</p>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:14,marginBottom:20}}>
                <button style={{...S.optionCard,...(serviceType==="mobile"?S.selectedCard:{})}} onClick={()=>{setServiceType("mobile");setAddressSelected(false);}}>
                  <div style={S.optionTitle}>Mobile Service</div>
                  <div style={S.optionMeta}>We come to you — home, office, wherever.</div>
                </button>
                <button style={{...S.optionCard,...(serviceType==="dropoff"?S.selectedCard:{})}} onClick={()=>{setServiceType("dropoff");setAddress("");setStreet("");setCity("");setStateRegion("");setZip("");setPlaceId("");setLat("");setLng("");setAddressSelected(false);}}>
                  <div style={S.optionTitle}>Drop-Off</div>
                  <div style={S.optionMeta}>Drop off your vehicle. We'll send location details.</div>
                </button>
              </div>
              {serviceType==="mobile"&&(
                <div style={{marginTop:18}}>
                  <label style={{display:"block",fontSize:"0.78rem",fontWeight:700,color:"rgba(255,255,255,0.35)",textTransform:"uppercase" as const,letterSpacing:"0.06em",marginBottom:8}}>Your Address *</label>
                  <input ref={addressInputRef} type="text" value={address} onChange={e=>{setAddress(e.target.value);setAddressSelected(false);}} placeholder="Start typing your address (BC, Canada)" style={S.input}/>
                </div>
              )}
              <div style={S.buttonRow}>
                <button style={S.secondary} onClick={back}>Back</button>
                <div style={S.rightButtons}><button style={{...S.primary,...(!serviceType||(serviceType==="mobile"&&!address.trim())?S.disabled:{})}} onClick={next} disabled={!serviceType||(serviceType==="mobile"&&!address.trim())}>Next</button></div>
              </div>
            </>
          )}

          {/* STEP 6 — Date, Time, Details */}
          {step===6&&(
            <>
              <h2 style={S.title}>Book Your Appointment</h2>
              <p style={S.subtitle}>Pick a date and time, then fill in your details.</p>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(280px,1fr))",gap:20,alignItems:"start"}}>
                {/* Calendar */}
                <div style={{gridColumn:"1 / -1"}}>
                  <div style={{background:"#111827",borderRadius:20,padding:"24px 20px"}}>
                    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20}}>
                      <button onClick={()=>{const d=new Date(calYear,calMonth-1,1);setCalMonth(d.getMonth());setCalYear(d.getFullYear());}} style={{background:"rgba(255,255,255,0.08)",border:"none",borderRadius:10,width:36,height:36,cursor:"pointer",color:"#fff",fontSize:"1.1rem",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>‹</button>
                      <span style={{fontWeight:800,fontSize:"1rem",color:"#fff",letterSpacing:"0.04em",textTransform:"uppercase" as const}}>{new Date(calYear,calMonth).toLocaleDateString("en-US",{month:"long",year:"numeric"})}</span>
                      <button onClick={()=>{const d=new Date(calYear,calMonth+1,1);setCalMonth(d.getMonth());setCalYear(d.getFullYear());}} style={{background:"rgba(255,255,255,0.08)",border:"none",borderRadius:10,width:36,height:36,cursor:"pointer",color:"#fff",fontSize:"1.1rem",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>›</button>
                    </div>
                    <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:2,marginBottom:8}}>
                      {["S","M","T","W","T","F","S"].map((d,i)=><div key={i} style={{textAlign:"center" as const,fontSize:"0.72rem",color:"rgba(255,255,255,0.35)",fontWeight:700,padding:"3px 0",letterSpacing:"0.05em"}}>{d}</div>)}
                    </div>
                    <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:4}}>
                      {(()=>{
                        const firstDay=new Date(calYear,calMonth,1).getDay();
                        const daysInMonth=new Date(calYear,calMonth+1,0).getDate();
                        const today=new Date();today.setHours(0,0,0,0);
                        const cells=[];
                        for(let i=0;i<firstDay;i++)cells.push(<div key={`e${i}`}/>);
                        for(let d=1;d<=daysInMonth;d++){
                          const dateStr=`${calYear}-${String(calMonth+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
                          const isAvail=availableDates.includes(dateStr);
                          const isPast=new Date(calYear,calMonth,d)<today;
                          const isSel=selectedDate===dateStr;
                          cells.push(<button key={d} disabled={!isAvail||isPast} onClick={()=>{setSelectedDate(dateStr);setSelectedTime("");}} style={{height:38,borderRadius:10,border:"none",background:isSel?"#ffffff":isAvail&&!isPast?"rgba(255,255,255,0.1)":"transparent",color:isSel?"#111827":isAvail&&!isPast?"#ffffff":"rgba(255,255,255,0.18)",fontSize:"0.88rem",fontWeight:isSel?800:isAvail&&!isPast?600:400,cursor:isAvail&&!isPast?"pointer":"default"}}>{d}</button>);
                        }
                        return cells;
                      })()}
                    </div>
                    {selectedDate&&<div style={{marginTop:16,paddingTop:16,borderTop:"1px solid rgba(255,255,255,0.1)",display:"flex",alignItems:"center",gap:8}}><div style={{width:6,height:6,borderRadius:"50%",background:"#4ade80",flexShrink:0}}/><span style={{color:"#fff",fontWeight:700,fontSize:"0.85rem"}}>{formatDateLabel(selectedDate)}</span></div>}
                  </div>
                </div>

                {/* Time Slots */}
                {selectedDate&&(
                  <div style={{gridColumn:"1 / -1"}}>
                    <div style={{fontSize:"0.78rem",fontWeight:700,color:"rgba(255,255,255,0.35)",textTransform:"uppercase" as const,letterSpacing:"0.08em",marginBottom:10}}>Available Times</div>
                    {availSlotsForDate.length===0?(
                      <div style={{color:"#f87171",fontSize:"0.9rem",padding:"12px 0"}}>All time slots are booked for this date. Please choose another day.</div>
                    ):(
                      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(100px,1fr))",gap:10}}>
                        {availSlotsForDate.map((slot,i)=>(
                          <button key={i} onClick={()=>setSelectedTime(slot.time)} style={{padding:"13px 8px",borderRadius:12,border:selectedTime===slot.time?"2px solid #111827":"1.5px solid #e5e7eb",background:selectedTime===slot.time?"#111827":"#fff",color:selectedTime===slot.time?"#fff":"#374151",fontSize:"0.9rem",fontWeight:700,cursor:"pointer",textAlign:"center" as const}}>{slot.time}</button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {selectedDate&&selectedTime&&(
                  <div style={{gridColumn:"1 / -1",borderTop:"1px solid rgba(255,255,255,0.07)",paddingTop:8}}>
                    <div style={{fontSize:"0.78rem",fontWeight:700,color:"rgba(255,255,255,0.35)",textTransform:"uppercase" as const,letterSpacing:"0.08em"}}>Your Details</div>
                  </div>
                )}

                {selectedDate&&selectedTime&&(
                  <>
                    {clientType==="maintenance"&&frequency&&(
                      <div style={{gridColumn:"1 / -1",background:"rgba(16,185,129,0.1)",border:"1px solid #6ee7b7",borderRadius:14,padding:"14px 16px"}}>
                        <div style={{fontWeight:700,color:"#34d399",marginBottom:6,fontSize:"0.95rem"}}>Your Recurring Schedule</div>
                        <div style={{fontSize:"0.85rem",color:"#10b981",marginBottom:8}}>{getCadenceLabel(selectedDate,frequency)} starting {formatDateLabel(selectedDate)}</div>
                        <div style={{display:"grid",gap:3}}>{calcRecurringDates(selectedDate,frequency,6).map((d,i)=><div key={i} style={{fontSize:"0.85rem",color:"#34d399"}}>{i+2}. {d}</div>)}</div>
                      </div>
                    )}
                    <div style={{gridColumn:"1 / -1"}}>
                      <label style={{display:"block",fontSize:"0.78rem",fontWeight:700,color:"rgba(255,255,255,0.35)",textTransform:"uppercase" as const,letterSpacing:"0.06em",marginBottom:6}}>Full Name *</label>
                      <input style={S.input} placeholder="Your full name" value={name} onChange={e=>setName(e.target.value)}/>
                    </div>
                    <div style={{gridColumn:"1 / -1",display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:12}}>
                      <div>
                        <label style={{display:"block",fontSize:"0.78rem",fontWeight:700,color:"rgba(255,255,255,0.35)",textTransform:"uppercase" as const,letterSpacing:"0.06em",marginBottom:6}}>Phone *</label>
                        <input style={S.input} placeholder="(778) 000-0000" value={phone} type="tel" inputMode="numeric"
                          onChange={e=>{const raw=e.target.value.replace(/\D/g,"").slice(0,10);const fmt=raw.length>6?`(${raw.slice(0,3)}) ${raw.slice(3,6)}-${raw.slice(6)}`:raw.length>3?`(${raw.slice(0,3)}) ${raw.slice(3)}`:raw;setPhone(fmt);}}/>
                      </div>
                      <div>
                        <label style={{display:"block",fontSize:"0.78rem",fontWeight:700,color:"rgba(255,255,255,0.35)",textTransform:"uppercase" as const,letterSpacing:"0.06em",marginBottom:6}}>Email *</label>
                        <input style={S.input} placeholder="your@email.com" value={email} onChange={e=>setEmail(e.target.value)}/>
                      </div>
                    </div>
                    <div style={{gridColumn:"1 / -1"}}>
                      <label style={{display:"block",fontSize:"0.78rem",fontWeight:700,color:"rgba(255,255,255,0.35)",textTransform:"uppercase" as const,letterSpacing:"0.06em",marginBottom:10}}>Vehicle Details *</label>
                      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(120px,1fr))",gap:12}}>
                        <div>
                          <input style={S.input} placeholder="Year" value={year} onChange={e=>{setYear(e.target.value);setModel("");setModelOptions([]);}} list="year-options"/>
                          <datalist id="year-options">{yearOptions.map(yr=><option key={yr} value={yr}/>)}</datalist>
                        </div>
                        <div>
                          <input style={S.input} placeholder="Make" value={make} onChange={e=>{setMake(e.target.value);setModel("");setModelOptions([]);}} list="make-options" autoComplete="off"/>
                          <datalist id="make-options">{makeOptions.map(mk=><option key={mk} value={mk}/>)}</datalist>
                        </div>
                        <div>
                          <input style={S.input} placeholder="Model" value={model} onChange={e=>setModel(e.target.value)} list="model-options" autoComplete="off"/>
                          <datalist id="model-options">{modelOptions.map(mdl=><option key={mdl} value={mdl}/>)}</datalist>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>



              <div style={S.buttonRow}>
                <button style={S.secondary} onClick={back}>Back</button>
                <div style={S.rightButtons}><button style={{...S.primary,...(step6Disabled?S.disabled:{})}} onClick={next} disabled={step6Disabled}>Review Booking</button></div>
              </div>
            </>
          )}

          {/* STEP 7 — Review & Submit */}
          {step===7&&(
            <>
              <h2 style={S.title}>Review Your Booking</h2>
              <p style={S.subtitle}>Check everything before submitting.</p>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:14,marginTop:22}}>
                <div style={S.summaryCard}><div style={S.summaryHeading}>Customer</div><div style={S.summaryValue}>{name}<br/>{phone}<br/>{email}</div></div>
                <div style={S.summaryCard}><div style={S.summaryHeading}>Appointment</div><div style={S.summaryValue}>{formatDateLabel(selectedDate)}<br/>{selectedTime||"N/A"}</div></div>
                <div style={S.summaryCard}>
                  <div style={S.summaryHeading}>Service Plan</div>
                  <div style={S.summaryValue}>{clientType==="oneTime"?"One-Time":"Maintenance Plan"}{clientType==="maintenance"&&frequency&&<><br/>{frequency==="biweekly"?"Bi-Weekly":"Monthly"}</>}</div>
                </div>
                <div style={S.summaryCard}>
                  <div style={S.summaryHeading}>Package & Price</div>
                  <div style={S.summaryValue}>
                    {vehicleOptions.find(v=>v.id===vehicle)?.label||"N/A"}<br/>
                    {PACKAGE_LABELS[pkg]||"N/A"}<br/>
                    <span style={{color:"#34d399",fontSize:"1.1rem"}}>${PACKAGE_PRICES[pkg]||0}{addOns.length>0?` + $${addOnTotal} add-ons`:""}</span>
                  </div>
                </div>
                <div style={S.summaryCard}><div style={S.summaryHeading}>Location</div><div style={S.summaryValue}>{serviceType==="mobile"?"Mobile":serviceType==="dropoff"?"Drop-Off":"N/A"}{serviceType==="mobile"&&address&&<><br/>{address}</>}</div></div>
                <div style={S.summaryCard}><div style={S.summaryHeading}>Vehicle</div><div style={S.summaryValue}>{vehicleSummary}</div></div>
                {addOns.length>0&&<div style={S.summaryCard}><div style={S.summaryHeading}>Add-Ons</div><div style={S.summaryValue}>{addOns.join(", ")}</div></div>}
              </div>

              <div style={{marginTop:24}}>
                <div style={S.sectionLabel}>Additional Notes</div>
                <textarea style={{...S.input,marginTop:10,minHeight:100,resize:"vertical" as const,fontFamily:"inherit",lineHeight:1.5}} placeholder="Access instructions, special requests, condition notes..." value={bookingNotes} onChange={e=>setBookingNotes(e.target.value)}/>
              </div>

              {/* Discount Code */}
              <div style={{marginTop:20}}>
                <div style={S.sectionLabel}>Discount Code (optional)</div>
                <div style={{display:"flex",gap:10,marginTop:10}}>
                  <input style={{...S.input,flex:1,textTransform:"uppercase" as const}} placeholder="Enter code" value={discountCode} onChange={e=>{setDiscountCode(e.target.value.toUpperCase());setDiscountResult(null);}}/>
                  <button onClick={()=>applyDiscountCode(discountCode)} disabled={!discountCode.trim()||discountChecking} style={{...S.primary,padding:"14px 20px",fontSize:"0.9rem",opacity:!discountCode.trim()?0.5:1}}>{discountChecking?"...":"Apply"}</button>
                </div>
                {discountResult&&(
                  <div style={{marginTop:10,padding:"12px 16px",background:discountResult.valid?"rgba(16,185,129,0.1)":"rgba(239,68,68,0.1)",border:`1px solid ${discountResult.valid?"#6ee7b7":"#fca5a5"}`,borderRadius:12,fontSize:"0.9rem",fontWeight:600,color:discountResult.valid?"#34d399":"#f87171"}}>
                    {discountResult.valid?`✓ Code applied — $${discountResult.amount} off${discountResult.pct?` (${discountResult.pct}%)`:""}`:"✕ Invalid or expired code"}
                  </div>
                )}

                {/* Final Price Box */}
                <div style={{marginTop:16,background:"rgba(255,255,255,0.05)",border:"1.5px solid rgba(255,255,255,0.12)",borderRadius:20,padding:"20px 24px",textAlign:"center" as const}}>
                  <div style={{fontSize:"0.85rem",color:"rgba(255,255,255,0.45)",marginBottom:8}}>Total Due</div>
                  {discountResult?.valid&&(
                    <div style={{fontSize:"1.1rem",color:"rgba(255,255,255,0.35)",textDecoration:"line-through",marginBottom:4}}>${basePrice+addOnTotal}</div>
                  )}
                  <div style={{fontSize:"3rem",fontWeight:900,color:"#34d399",letterSpacing:"-2px"}}>${finalPrice}</div>
                  <div style={{fontSize:"0.78rem",color:"rgba(255,255,255,0.4)",marginTop:6}}>
                    {PACKAGE_LABELS[pkg]} {addOns.length>0?`+ ${addOns.length} add-on${addOns.length>1?"s":""}`:""}{discountResult?.valid?` · $${discountResult.amount} discount applied`:""}
                  </div>
                  <div style={{fontSize:"0.75rem",color:"rgba(255,255,255,0.3)",marginTop:4}}>Flat rate · No hidden fees · Payable after service</div>
                </div>
              </div>

              <div style={S.buttonRow}>
                <button style={S.secondary} onClick={back}>Back</button>
                <div style={S.rightButtons}>
                  <button style={S.primary} onClick={async()=>{
                    try{
                      if(serviceType==="mobile"){if(!address.trim()){alert("Please enter your address.");return;}if(!addressSelected){alert("Please select a valid address from the dropdown suggestions.");return;}}
                      const[yp,mp,dp]=selectedDate.split("-");
                      const res=await fetch(SCRIPT_URL,{method:"POST",body:JSON.stringify({
                        action:"bookAppointment",name,phone,email,
                        date:selectedDate,displayDate:`${mp}/${dp}/${yp}`,time:selectedTime,
                        year,make,model,boatSize:"",vehicle,
                        packageType:pkg,hourlyRate:finalPrice,
                        addOns:addOns.join(", "),addOnEstimate:addOnTotal,
                        serviceType,address,street,city,state:stateRegion,zip,placeId,lat,lng,
                        avgTime:"",notes:bookingNotes,clientType,recurringFrequency:frequency,
                        smsConsent,smsMarketingConsent,
                        discountCode:discountResult?.valid?discountCode:"",
                        discountAmount:discountResult?.valid?discountResult.amount:0,
                        finalPrice,
                      })});
                      const data=await res.json();
                      if(data.success)next();
                      else{alert("Something went wrong. Please try again.");console.error(data);}
                    }catch(err){alert("Something went wrong. Please try again.");console.error(err);}
                  }}>Submit Booking</button>
                </div>
              </div>
            </>
          )}

          {/* STEP 8 — Success */}
          {step===8&&(
            <>
              <div style={S.successWrap}>
                <div style={{width:56,height:56,background:"linear-gradient(135deg,#059669,#047857)",borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 18px",boxShadow:"0 8px 32px rgba(16,185,129,0.4)"}}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><polyline points="4,12 9,17 20,6" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </div>
                <h2 style={S.title}>Booking Submitted!</h2>
                <p style={S.successText}>
                  Your appointment request is confirmed. We'll be in touch shortly.
                  {clientType==="maintenance"&&` Your ${frequency==="biweekly"?"bi-weekly":"monthly"} schedule will be set up when we confirm.`}
                </p>
                <div style={{background:"rgba(16,185,129,0.1)",border:"1px solid #6ee7b7",borderRadius:16,padding:"16px 24px",display:"inline-block",marginBottom:24}}>
                  <div style={{fontSize:"0.82rem",color:"#10b981",marginBottom:4}}>Total</div>
                  <div style={{fontSize:"2.5rem",fontWeight:900,color:"#34d399"}}>${finalPrice}</div>
                  <div style={{fontSize:"0.78rem",color:"rgba(255,255,255,0.45)",marginTop:4}}>Payable after service via E-Transfer</div>
                </div>
                {googleUser&&<button onClick={openMyBookings} style={{...S.secondary,marginTop:8,display:"block",margin:"0 auto 16px"}}>View My Bookings</button>}
              </div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:14,marginTop:22}}>
                <div style={S.summaryCard}><div style={S.summaryHeading}>Customer</div><div style={S.summaryValue}>{name}<br/>{phone}<br/>{email}</div></div>
                <div style={S.summaryCard}><div style={S.summaryHeading}>Appointment</div><div style={S.summaryValue}>{formatDateLabel(selectedDate)}<br/>{selectedTime||"N/A"}</div></div>
                <div style={S.summaryCard}><div style={S.summaryHeading}>Package</div><div style={S.summaryValue}>{PACKAGE_LABELS[pkg]||"N/A"}<br/><span style={{color:"#34d399"}}>${finalPrice}</span></div></div>
                <div style={S.summaryCard}><div style={S.summaryHeading}>Vehicle</div><div style={S.summaryValue}>{vehicleSummary}</div></div>
                <div style={S.summaryCard}><div style={S.summaryHeading}>Location</div><div style={S.summaryValue}>{serviceType==="mobile"?"Mobile":serviceType==="dropoff"?"Drop-Off":"N/A"}{serviceType==="mobile"&&address&&<><br/>{address}</>}</div></div>
                {config.eTransferEmail&&<div style={{...S.summaryCard,background:"rgba(16,185,129,0.08)",border:"1px solid #6ee7b7"}}><div style={S.summaryHeading}>Payment (After Service)</div><div style={S.summaryValue}><span style={{color:"#34d399"}}>E-Transfer</span><br/>{config.eTransferEmail}<br/>{config.eTransferPhone}</div></div>}
              </div>
              <div style={{display:"flex",gap:12,justifyContent:"center",flexWrap:"wrap" as const,marginTop:28}}>
                <button onClick={()=>setStep(0)} style={{...S.secondary,padding:"12px 22px",fontSize:"0.95rem"}}>Book Another Service</button>
                {googleUser?<button onClick={openMyBookings} style={{...S.primary,padding:"12px 22px",fontSize:"0.95rem"}}>View My Bookings</button>:<a href={config.websiteUrl} target="_blank" rel="noopener noreferrer" style={{...S.primary,padding:"12px 22px",fontSize:"0.95rem",textDecoration:"none",display:"inline-block"}}>Visit azdetails.ca</a>}
              </div>
            </>
          )}

        </div>
      </div>
    </div>
  );
}// deploy