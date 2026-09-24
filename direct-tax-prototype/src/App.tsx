import { useState, useEffect, useRef } from "react";

/* ─── Types ─────────────────────────────────────────── */
type AvalaraFlow = "existing" | "different" | null;
type FpoaStatus = "idle" | "signing" | "processing";
type AppPage = "overview" | "region-details";

interface NexusRow {
  id: string;
  state: string;
  stateCode: string;
  forms: string[];
}

interface TaxReturnSettingsForm {
  state: string;
  salesTaxAccountNumber: string;
  prepaymentRequired: string;
  legalEntityName: string;
  salesTaxOnly: string;
  efileUsername: string;
  addressLine1: string;
  addressLine2: string;
  zipCode: string;
  phone: string;
  taxpayerId: string;
}

interface RegionRecord extends TaxReturnSettingsForm {
  id: string;
  questionnaireAnswers: Record<string, string>;
  nexusRows: NexusRow[];
  status: "draft" | "configured";
  savedAt: string;
  completedAt: string | null;
}

/* ─── Static data ────────────────────────────────────── */
const NAV_SECTIONS = [
  {
    heading: "ORGANIZATION SETTINGS",
    items: [
      { label: "Organization", expandable: true },
      { label: "Users & Roles", expandable: true },
      {
        label: "Taxes & Compliance",
        expandable: true,
        expanded: true,
        children: [{ label: "Taxes", active: true }],
      },
      { label: "Setup & Configurations", expandable: true },
      { label: "Customisation", expandable: true },
      { label: "Automation", expandable: true },
    ],
  },
  {
    heading: "MODULE SETTINGS",
    items: [
      { label: "General", expandable: true },
      { label: "Inventory", expandable: true },
      { label: "Online Payments", expandable: true },
      { label: "Sales", expandable: true },
      { label: "Purchases", expandable: true },
      { label: "Custom Modules", expandable: true },
    ],
  },
];

const TAX_NAV = [
  { label: "Tax Returns Settings", active: true },
  { label: "Tax Rates" },
  { label: "Tax Exemptions" },
  { label: "Tax Agencies" },
  { label: "Tax Preferences", badge: "NEW" },
];

const QUESTIONNAIRE: {
  id: string;
  label: string;
  options: string[];
  tooltip?: string;
}[] = [
  {
    id: "q1",
    label: "What type of tax are you registered to collect in Alabama?",
    options: [
      "Simplified sellers use tax (flat 8% rate)",
      "Sellers use tax",
      "Sales tax",
      "Both sales and sellers use tax",
    ],
  },
  {
    id: "q2",
    label: "Do you self-assess consumer use tax on purchases that you need to report to Alabama?",
    options: ["Yes", "No"],
  },
  {
    id: "q3",
    label: "Are you required to make estimated payments in Arizona?",
    options: ["Yes", "No"],
    tooltip:
      "Some Arizona taxpayers are required to make an annual accelerated prepayment in June of each year. Avalara calculates this prepayment using 50% of the preceding May's liability. Visit the Arizona Department of Revenue website or contact the Arizona Department of Revenue at 602-255-3381 for more info about prepayments.",
  },
  {
    id: "q4",
    label: "Do you have any retail stores or other company locations in California?",
    options: ["Yes", "No"],
  },
  {
    id: "q5",
    label: "Are you required to make prepayments in California?",
    options: ["Yes", "No"],
  },
  {
    id: "q6",
    label: "How often are you required to file a return in New York?",
    options: ["Monthly", "Quarterly", "Annually", "Part-quarterly (monthly prepay)"],
  },
  {
    id: "q7",
    label: "How do you file for the last month of each quarter?",
    options: [
      "File a return for the last month",
      "Include in quarterly return",
      "File a prepayment",
    ],
  },
];

const STATE_FORMS: Record<string, string[]> = {
  Alabama: ["AL Form 2210AL", "AL BPT-IN"],
  Arizona: ["AZ Form 120", "AZ TPT-2"],
  California: ["CA Form 568", "CA BOE-401-A"],
  "New York": ["NY CT-3", "NY ST-100"],
  Texas: ["TX 05-102", "TX 01-117"],
  Florida: ["FL DR-15", "FL F-1120"],
  Washington: ["WA REV 27 0014", "WA B&O"],
  Illinois: ["IL ST-1", "IL 1065"],
  Pennsylvania: ["PA PA-3", "PA RCT-101"],
  Ohio: ["OH UST-1", "OH IT 1140"],
  Georgia: ["GA ST-3", "GA 600"],
  Colorado: ["CO DR 0100", "CO DR 0104"],
};

const STATE_CODES: Record<string, string> = {
  Alabama: "AL",
  Alaska: "AK",
  Arizona: "AZ",
  Arkansas: "AR",
  California: "CA",
  Colorado: "CO",
  Connecticut: "CT",
  Delaware: "DE",
  Florida: "FL",
  Georgia: "GA",
  Hawaii: "HI",
  Idaho: "ID",
  Illinois: "IL",
  Indiana: "IN",
  Iowa: "IA",
  Kansas: "KS",
  Kentucky: "KY",
  Louisiana: "LA",
  Maine: "ME",
  Maryland: "MD",
  Massachusetts: "MA",
  Michigan: "MI",
  Minnesota: "MN",
  Mississippi: "MS",
  Missouri: "MO",
  Montana: "MT",
  Nebraska: "NE",
  Nevada: "NV",
  "New Hampshire": "NH",
  "New Jersey": "NJ",
  "New Mexico": "NM",
  "New York": "NY",
  "North Carolina": "NC",
  "North Dakota": "ND",
  Ohio: "OH",
  Oklahoma: "OK",
  Oregon: "OR",
  Pennsylvania: "PA",
  "Rhode Island": "RI",
  "South Carolina": "SC",
  "South Dakota": "SD",
  Tennessee: "TN",
  Texas: "TX",
  Utah: "UT",
  Vermont: "VT",
  Virginia: "VA",
  Washington: "WA",
  "West Virginia": "WV",
  Wisconsin: "WI",
  Wyoming: "WY",
};

const QUESTION_STATE_MAP: Record<string, string> = {
  q1: "Alabama",
  q2: "Alabama",
  q3: "Arizona",
  q4: "California",
  q5: "California",
  q6: "New York",
  q7: "New York",
};

const NEXUS_GUIDANCE: Record<
  string,
  {
    threshold: string;
    trigger: string;
    registerBy: string;
  }
> = {
  Alabama: {
    threshold: "$250,000 in sales",
    trigger: "Sales amount only",
    registerBy: "January 1 of the year after the threshold is reached",
  },
  Arizona: {
    threshold: "$100,000 in sales",
    trigger: "Sales amount only",
    registerBy: "At least 30 days after the threshold is reached",
  },
  California: {
    threshold: "$500,000 in sales",
    trigger: "Sales amount only",
    registerBy: "The day you surpass the threshold",
  },
  Colorado: {
    threshold: "$100,000 in sales",
    trigger: "Sales amount only",
    registerBy: "First day of the month after the 90th day of the current year",
  },
  Florida: {
    threshold: "$100,000 in sales",
    trigger: "Sales amount only",
    registerBy: "First day of the next calendar year after reaching the threshold",
  },
  Georgia: {
    threshold: "$100,000 in sales or 200 transactions",
    trigger: "Sales amount or transaction count",
    registerBy: "Next transaction after reaching the threshold",
  },
  Illinois: {
    threshold: "$100,000 in sales or 200 transactions",
    trigger: "Sales amount or transaction count",
    registerBy: "Quarterly review based on the previous 12 months",
  },
  "New York": {
    threshold: "$500,000 in sales or 100 transactions",
    trigger: "Sales amount or transaction count",
    registerBy: "Within 30 days after establishing nexus",
  },
  Ohio: {
    threshold: "$100,000 in sales or 200 transactions",
    trigger: "Sales amount or transaction count",
    registerBy: "Next day after reaching nexus",
  },
  Pennsylvania: {
    threshold: "$100,000 in sales",
    trigger: "Sales amount only",
    registerBy: "April 1 following the calendar year after surpassing the threshold",
  },
  Texas: {
    threshold: "$500,000 in sales",
    trigger: "Sales amount only",
    registerBy: "First day of the fourth month after reaching the threshold",
  },
  Washington: {
    threshold: "$100,000 in sales",
    trigger: "Sales amount only",
    registerBy: "First day of the month, starting 30 days after surpassing the threshold",
  },
};

function formatDateLabel(date: Date) {
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getStateCode(state: string) {
  return STATE_CODES[state] ?? state.substring(0, 2).toUpperCase();
}

function getSuggestedNexusRows(
  answers: Record<string, string>,
  primaryState: string,
  existingRows?: NexusRow[]
) {
  if (existingRows && existingRows.length > 0) {
    return existingRows;
  }

  const derivedStates = Array.from(
    new Set(Object.keys(answers).map((key) => QUESTION_STATE_MAP[key]).filter(Boolean))
  );

  const allStates = Array.from(
    new Set([
      primaryState,
      ...(derivedStates.length > 0 ? derivedStates : ["Alabama", "Arizona", "California", "New York"]),
    ])
  );

  return allStates.map((state) => ({
    id: state,
    state,
    stateCode: getStateCode(state),
    forms: STATE_FORMS[state] ?? ["State Tax Form"],
  }));
}

function getPrimaryStateFromAnswers(answers: Record<string, string>) {
  const derivedStates = Object.keys(answers)
    .map((key) => QUESTION_STATE_MAP[key])
    .filter(Boolean);

  return derivedStates[0] ?? "Alabama";
}

function getEligibleFormsForState(state: string) {
  return STATE_FORMS[state] ?? ["State Tax Form"];
}

function getNexusGuidance(state: string) {
  return NEXUS_GUIDANCE[state] ?? null;
}

function getQuestionsForState(state: string) {
  return QUESTIONNAIRE.filter((question) => QUESTION_STATE_MAP[question.id] === state);
}

function areAnswerMapsEqual(
  left: Record<string, string>,
  right: Record<string, string>
) {
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);

  if (leftKeys.length !== rightKeys.length) {
    return false;
  }

  return leftKeys.every((key) => left[key] === right[key]);
}

function pickRandom<T>(items: T[]) {
  return items[Math.floor(Math.random() * items.length)];
}

function getRandomQuestionnaireAnswers() {
  return Object.fromEntries(
    QUESTIONNAIRE.map((question) => [question.id, pickRandom(question.options)])
  ) as Record<string, string>;
}

function getRandomTaxReturnSettingsForm(): TaxReturnSettingsForm {
  const state = pickRandom(Object.keys(STATE_FORMS));
  const idSuffix = Math.random().toString(36).slice(2, 8).toUpperCase();
  const zipBase = String(10000 + Math.floor(Math.random() * 89999));
  const phoneBase = String(1000000000 + Math.floor(Math.random() * 8999999999));

  return {
    state,
    salesTaxAccountNumber: `SLS-${idSuffix}`,
    prepaymentRequired: pickRandom(["Yes", "No"]),
    legalEntityName: pickRandom([
      "Northwind Commerce LLC",
      "BluePeak Retail Inc.",
      "Summit Cart Solutions",
      "Cedar Point Goods LLC",
      "Brightlane Markets Inc.",
    ]),
    salesTaxOnly: pickRandom(["Yes", "No"]),
    efileUsername: pickRandom([
      "northwind.tax",
      "bluepeak.filing",
      "summit.directtax",
      "cedarpoint.efile",
      "brightlane.taxops",
    ]),
    addressLine1: pickRandom([
      "245 Market Street",
      "18 Riverfront Avenue",
      "920 Commerce Blvd",
      "77 Grand Central Drive",
      "410 Lakeview Parkway",
    ]),
    addressLine2: pickRandom([
      "",
      "Suite 210",
      "Floor 4",
      "Unit B",
      "Building 3",
    ]),
    zipCode: zipBase,
    phone: phoneBase.slice(0, 10),
    taxpayerId: String(100000000 + Math.floor(Math.random() * 899999999)),
  };
}

/* ─── Sub-components ─────────────────────────────────── */

function Toggle({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${
        checked ? "bg-[#0D81FD]" : "bg-gray-300"
      }`}
    >
      <span
        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
          checked ? "translate-x-4" : "translate-x-1"
        }`}
      />
    </button>
  );
}

function Toast({ message, onDone }: { message: string; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 3500);
    return () => clearTimeout(t);
  }, [onDone]);
  return (
    <div className="fixed bottom-16 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-gray-900 text-white text-[12px] px-4 py-2.5 rounded-lg shadow-xl animate-fade-in">
      <svg viewBox="0 0 24 24" className="w-4 h-4 fill-green-400 flex-shrink-0">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14l-5-5 1.41-1.41L10 13.17l7.59-7.59L19 7l-9 9z" />
      </svg>
      {message}
    </div>
  );
}

function SettingsField({
  fieldId,
  label,
  required,
  children,
}: {
  fieldId: string;
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start py-4 border-b border-gray-100 last:border-0">
      <div className="w-72 flex-shrink-0 pr-8 pt-1.5">
        <label
          htmlFor={fieldId}
          className={`text-[13px] leading-snug ${required ? "text-[#d94f3d]" : "text-gray-700"}`}
        >
          {label}
          {required && <span className="text-[#d94f3d]">*</span>}
        </label>
      </div>
      <div className="flex-1">{children}</div>
    </div>
  );
}

/* ─── Avalara Modal ──────────────────────────────────── */
function AvalaraModal({
  onConnect,
  onCancel,
}: {
  onConnect: (flow: Exclude<AvalaraFlow, null>) => void;
  onCancel: () => void;
}) {
  const [understood, setUnderstood] = useState(false);
  const canConnect = understood;

  return (
    <div className="design-modal-backdrop fixed inset-0 z-40 flex items-center justify-center bg-slate-950/35 backdrop-blur-[1.5px]">
      <div className="design-modal-card bg-white w-[460px] max-h-[86vh] overflow-hidden border border-[#edf1f7] flex flex-col">
        <div className="design-modal-header px-5 pt-4 pb-3.5 border-b border-[#edf1f7]">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-[18px] bg-[linear-gradient(180deg,#f8fbff_0%,#e8f0ff_100%)] ring-1 ring-[#d4e1ff] shadow-[inset_0_1px_0_rgba(255,255,255,0.95)]">
                <svg viewBox="0 0 48 48" className="h-8 w-8" aria-hidden="true">
                  <defs>
                    <linearGradient id="avalaraIconGradient" x1="24" y1="6" x2="24" y2="40" gradientUnits="userSpaceOnUse">
                      <stop stopColor="#6F8FEF" />
                      <stop offset="1" stopColor="#5B79E6" />
                    </linearGradient>
                  </defs>
                  <path
                    d="M24 5.5 4.5 39.5h39L24 5.5Z"
                    fill="url(#avalaraIconGradient)"
                  />
                  <path
                    d="M24 13.5 11.5 35h25L24 13.5Z"
                    fill="#FFFFFF"
                    fillOpacity="0.18"
                  />
                  <rect x="22" y="18" width="4" height="11" rx="2" fill="#FFFFFF" />
                  <rect x="21.75" y="31.5" width="4.5" height="4.5" rx="2.25" fill="#FFFFFF" />
                </svg>
              </div>
              <div className="pt-0.5">
                <div className="mb-1.5 inline-flex items-center gap-1 rounded-full border border-[#dce7fb] bg-[#f5f9ff] px-2 py-0.5 text-[9px] uppercase tracking-[0.16em] text-[#5b80e5]">
                  Avalara integration
                </div>
                <h2 className="design-modal-title text-[16px] font-semibold text-slate-900 leading-tight" style={{ fontFamily: "'Inter:Medium', sans-serif" }}>
                  Connect To Avalara
                </h2>
                <p className="mt-1 text-[11px] leading-5 text-slate-500 max-w-[300px]">
                  Avalara automates sales tax filing so you can stay compliant without the manual overhead.
                </p>
              </div>
            </div>
            <button onClick={onCancel} className="design-modal-close text-slate-300 hover:text-slate-500 transition-colors flex-shrink-0 mt-1">
              <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current">
                <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
              </svg>
            </button>
          </div>
        </div>

        <div className="design-modal-body px-5 py-4 flex-1 overflow-y-auto">
          <div className="rounded-[18px] border border-[#f0e4d3] bg-[linear-gradient(180deg,#fffaf2_0%,#fffdf8_100%)] px-4 py-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)]">
            <div className="mb-3 flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-[#d58c27] shadow-sm ring-1 ring-[#f5dfbf]">
                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-current">
                  <path d="M12 2 1 21h22L12 2Zm1 14h-2v-2h2v2Zm0-4h-2V8h2v4Z" />
                </svg>
              </div>
              <div>
                <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-[#c07a18]" style={{ fontFamily: "'Inter:Medium', sans-serif" }}>
                  Before you proceed
                </p>
                <p className="text-[10px] leading-4.5 text-[#8b6e3f]">
                  Review how filing will be handled once Avalara is connected.
                </p>
              </div>
            </div>

            <div className="space-y-2.5">
              <div className="flex items-start gap-2.5 rounded-xl bg-white/75 px-3 py-2.5 ring-1 ring-[#f6ead7]">
                <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[#5b80e5]" />
                <p className="text-[12px] leading-5 text-slate-700">
                  Zoho Books supports direct tax filing through its integration with Avalara, our certified service provider.
                </p>
              </div>
              <div className="flex items-start gap-2.5 rounded-xl bg-white/75 px-3 py-2.5 ring-1 ring-[#f6ead7]">
                <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[#5b80e5]" />
                <p className="text-[12px] leading-5 text-slate-700">
                  Avalara handles tax compliance and filing on your behalf so you can focus on your business.
                </p>
              </div>
            </div>
          </div>

          <label className="mt-4 flex items-start gap-3 cursor-pointer rounded-[18px] border border-[#e8edf5] bg-white px-3.5 py-3.5 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
            <input
              type="checkbox"
              checked={understood}
              onChange={(e) => setUnderstood(e.target.checked)}
              className="mt-0.5 h-[18px] w-[18px] flex-shrink-0 rounded-sm accent-[#5F85E6]"
            />
            <span className="text-[12px] leading-5 text-slate-700">
              I agree to the terms of Zoho Books and Avalara and wish to proceed with the connection.
            </span>
          </label>
        </div>

        <div className="design-modal-footer border-t border-[#edf1f7] px-5 py-3.5 flex items-center gap-2.5 bg-white">
          <button
            onClick={canConnect ? () => onConnect("existing") : undefined}
            disabled={!canConnect}
            className={`min-w-[104px] px-4 py-2 rounded-md text-[12px] font-medium transition-colors ${
              canConnect
                ? "bg-[#0D81FD] text-white hover:bg-[#0A6FE8] cursor-pointer"
                : "bg-[#D6E0F6] text-white/80 cursor-not-allowed"
            }`}
            style={{ fontFamily: "'Inter:Medium', sans-serif" }}
          >
            Proceed
          </button>
          <button
            onClick={onCancel}
            className="min-w-[96px] px-4 py-2 rounded-md text-[12px] text-slate-800 border border-[#dfe5ef] bg-[#f8fafc] hover:bg-[#eef3fb] transition-colors"
          >
            Cancel
          </button>
          <div className="ml-auto hidden text-[9px] text-[#8a93a7] sm:block">
            Secure connection setup
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Overview FPOA Section ──────────────────────────── */
function OverviewFpoaSection({
  fpoaStatus,
  onSign,
}: {
  fpoaStatus: FpoaStatus;
  onSign: () => void;
}) {
  const isComplete = fpoaStatus === "processing";
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (isComplete) {
      setCollapsed(true);
    }
  }, [isComplete]);

  return (
    <div className="space-y-5">
      <div className="bg-white border border-[#ebeaf1] rounded-lg px-6 py-5">
        <div className="flex items-start justify-between gap-4 mb-5">
          <div>
            <h2 className="text-[17px] font-medium text-gray-900" style={{ fontFamily: "'Inter:Medium', sans-serif" }}>
              Sign FPOA
            </h2>
            <p className="text-[11px] text-[#6d7188] leading-5 mt-1">
              Review and digitally sign your Form POA (Power of Attorney) to unlock the tax return configuration for this business.
            </p>
          </div>
          <span
            className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border ${
              isComplete
                ? "bg-green-50 text-green-700 border-green-200"
                : "bg-amber-50 text-amber-700 border-amber-200"
            }`}
            style={{ fontFamily: "'Inter:Medium', sans-serif" }}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                isComplete ? "bg-green-500" : "bg-amber-500"
              }`}
            />
            {isComplete ? "Completed" : "Ready to sign"}
          </span>
        </div>

        {collapsed ? (
          <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 flex items-center justify-between gap-3">
            <div>
              <p
                className="text-[12px] font-medium text-green-700"
                style={{ fontFamily: "'Inter:Medium', sans-serif" }}
              >
                FPOA signed and processed
              </p>
              <p className="text-[10px] text-green-700/80 mt-1">
                Tax return configuration is unlocked for your business regions.
              </p>
            </div>
            <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border border-green-200 bg-white text-green-700">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
              Completed
            </span>
          </div>
        ) : (
          <>
            <div className="border border-gray-200 rounded-lg bg-gray-50 flex flex-col items-center justify-center py-10 gap-4">
              {fpoaStatus === "idle" && (
                <>
                  <div className="w-16 h-20 rounded border-2 border-gray-300 bg-white flex flex-col items-center justify-center gap-1.5 shadow-sm">
                    <svg viewBox="0 0 24 24" className="w-7 h-7 fill-gray-300">
                      <path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.89 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm4 18H6V4h7v5h5v11z" />
                    </svg>
                    <div className="space-y-1 px-2">
                      <div className="h-0.5 w-8 bg-gray-200 rounded" />
                      <div className="h-0.5 w-6 bg-gray-200 rounded" />
                      <div className="h-0.5 w-7 bg-gray-200 rounded" />
                    </div>
                  </div>
                  <p className="text-[11px] text-gray-500">FPOA_Zylker_Canada.pdf</p>
                  <button
                    onClick={onSign}
                    className="bg-[#0D81FD] text-white text-[11px] font-medium px-5 py-2 rounded hover:bg-blue-600 transition-colors flex items-center gap-2"
                    style={{ fontFamily: "'Inter:Medium', sans-serif" }}
                  >
                    <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current">
                      <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" />
                    </svg>
                    Sign FPOA
                  </button>
                </>
              )}

              {fpoaStatus === "signing" && (
                <div className="flex flex-col items-center gap-4">
                  <div className="w-16 h-20 rounded border-2 border-blue-300 bg-white flex flex-col items-center justify-center gap-1.5 shadow-sm relative">
                    <svg viewBox="0 0 24 24" className="w-7 h-7 fill-blue-300">
                      <path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.89 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm4 18H6V4h7v5h5v11z" />
                    </svg>
                    <div className="space-y-1 px-2">
                      <div className="h-0.5 w-8 bg-blue-200 rounded" />
                      <div className="h-0.5 w-6 bg-blue-200 rounded" />
                      <div className="h-0.5 w-7 bg-blue-200 rounded" />
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-blue-600">
                    <svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="60" strokeDashoffset="20" />
                    </svg>
                    Applying digital signature…
                  </div>
                </div>
              )}

              {fpoaStatus === "processing" && (
                <div className="flex flex-col items-center gap-4">
                  <div className="w-16 h-20 rounded border-2 border-green-400 bg-white flex flex-col items-center justify-center gap-1.5 shadow-sm">
                    <svg viewBox="0 0 24 24" className="w-7 h-7 fill-green-400">
                      <path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.89 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm4 18H6V4h7v5h5v11z" />
                    </svg>
                    <div className="space-y-1 px-2">
                      <div className="h-0.5 w-8 bg-green-200 rounded" />
                      <div className="h-0.5 w-6 bg-green-200 rounded" />
                      <div className="h-0.5 w-7 bg-green-200 rounded" />
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-1.5 mb-1">
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-green-600 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full" style={{ fontFamily: "'Inter:Medium', sans-serif" }}>
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                        Signed successfully
                      </span>
                    </div>
                    <p className="text-[10px] text-gray-400">
                      Your FPOA has been signed and submitted. You can now configure tax returns for each business region.
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="text-[10px] text-gray-400">
              {isComplete
                ? "Tax return configuration is now unlocked for all business regions."
                : "Complete the FPOA signing step to unlock the Configure Tax Return section below."}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ─── Searchable dropdown for questionnaire ─────────── */
function QuestionDropdown({
  value,
  options,
  onChange,
  onClear,
}: {
  value: string;
  options: string[];
  onChange: (v: string) => void;
  onClear: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch("");
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtered = options.filter((o) =>
    o.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div ref={ref} className="relative w-[260px] flex-shrink-0">
      <button
        type="button"
        onClick={() => { setOpen((v) => !v); setSearch(""); }}
        className={`w-full flex items-center justify-between border rounded px-3 py-1.5 text-[12px] bg-white transition-colors ${
          value ? "border-[#0D81FD] text-gray-800" : "border-gray-200 text-gray-400"
        } ${open ? "border-[#0D81FD]" : ""}`}
      >
        <span className="truncate">{value || "Select"}</span>
        <span className="flex items-center gap-1 flex-shrink-0 ml-1">
          {value && (
            <span
              role="button"
              onClick={(e) => { e.stopPropagation(); onClear(); }}
              className="text-red-400 hover:text-red-600 transition-colors p-0.5 rounded"
            >
              <svg viewBox="0 0 24 24" className="w-3 h-3 fill-current">
                <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
              </svg>
            </span>
          )}
          <svg viewBox="0 0 24 24" className={`w-3.5 h-3.5 fill-gray-400 transition-transform ${open ? "rotate-180" : ""}`}>
            <path d="M7 10l5 5 5-5z" />
          </svg>
        </span>
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded shadow-lg">
          {/* Search */}
          <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-100">
            <svg viewBox="0 0 24 24" className="w-3 h-3 fill-gray-400 flex-shrink-0">
              <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" />
            </svg>
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search"
              className="flex-1 text-[12px] text-gray-700 outline-none placeholder-gray-300"
            />
          </div>
          <div className="max-h-44 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <p className="px-3 py-2 text-[11px] text-gray-400">No options found</p>
            ) : (
              filtered.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => { onChange(opt); setOpen(false); setSearch(""); }}
                  className={`w-full text-left px-3 py-2 text-[12px] transition-colors ${
                    opt === value
                      ? "bg-[#0D81FD] text-white"
                      : "text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  {opt}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function NexusFormsModal({
  mode,
  stateOptions,
  initialState,
  initialForms,
  onSave,
  onCancel,
}: {
  mode: "add-region" | "add-forms";
  stateOptions: string[];
  initialState: string;
  initialForms: string[];
  onSave: (state: string, forms: string[]) => void;
  onCancel: () => void;
}) {
  const [state, setState] = useState(initialState);
  const [selectedForms, setSelectedForms] = useState<string[]>(initialForms);
  const [formToAdd, setFormToAdd] = useState("");

  const eligibleForms = getEligibleFormsForState(state);
  const availableForms = eligibleForms.filter((form) => !selectedForms.includes(form));
  const nexusGuidance = getNexusGuidance(state);

  useEffect(() => {
    setSelectedForms((current) =>
      current.filter((form) => getEligibleFormsForState(state).includes(form))
    );
    setFormToAdd("");
  }, [state]);

  function addSelectedForm() {
    if (!formToAdd) return;
    setSelectedForms((current) => [...current, formToAdd]);
    setFormToAdd("");
  }

  function removeSelectedForm(form: string) {
    setSelectedForms((current) => current.filter((item) => item !== form));
  }

  const canSave = state && selectedForms.length > 0;

  return (
    <div className="design-modal-backdrop fixed inset-0 z-40 flex items-center justify-center bg-black/35 backdrop-blur-[1px]">
      <div className="design-modal-card bg-white w-[560px] max-h-[90vh] flex flex-col">
        <div className="design-modal-header flex items-center justify-between px-6 py-5 border-b border-[#edf1f7]">
          <div>
            <h3
              className="design-modal-title text-[17px] font-medium text-gray-900"
              style={{ fontFamily: "'Inter:Medium', sans-serif" }}
            >
              {mode === "add-region" ? "Add nexus region" : "Add tax forms"}
            </h3>
            <p className="mt-1 text-[11px] leading-5 text-[#6d7188]">
              Select a region and choose the eligible tax forms that should be tracked for filing.
            </p>
          </div>
          <button onClick={onCancel} className="design-modal-close text-gray-300 hover:text-gray-500 transition-colors">
            <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
            </svg>
          </button>
        </div>

        <div className="design-modal-body flex-1 overflow-y-auto px-6 py-5 space-y-5">
          <div className="space-y-2">
            <label className="block text-[12px] text-gray-700" style={{ fontFamily: "'Inter:Medium', sans-serif" }}>
              Business region
            </label>
            <div className="relative">
              <select
                value={state}
                onChange={(e) => setState(e.target.value)}
                disabled={mode === "add-forms"}
                className={`w-full border border-gray-200 rounded px-3 py-2.5 text-[13px] bg-white text-gray-700 focus:outline-none focus:border-blue-400 appearance-none ${
                  mode === "add-forms" ? "cursor-not-allowed bg-gray-50" : "cursor-pointer"
                }`}
              >
                <option value="">Choose a state</option>
                {stateOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
              <svg viewBox="0 0 24 24" className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 fill-gray-400 pointer-events-none">
                <path d="M7 10l5 5 5-5z" />
              </svg>
            </div>
            {nexusGuidance && (
              <div className="rounded-lg border border-[#e7edf7] bg-white px-4 py-3">
                <div className="text-[11px] font-medium text-gray-900" style={{ fontFamily: "'Inter:Medium', sans-serif" }}>
                  Nexus guidance for {state}
                </div>
                <div className="mt-2 grid grid-cols-1 gap-2 text-[10px] text-[#6d7188] sm:grid-cols-3">
                  <div>
                    <span className="block text-[9px] uppercase tracking-[0.12em] text-gray-400">Threshold</span>
                    <span>{nexusGuidance.threshold}</span>
                  </div>
                  <div>
                    <span className="block text-[9px] uppercase tracking-[0.12em] text-gray-400">Trigger</span>
                    <span>{nexusGuidance.trigger}</span>
                  </div>
                  <div>
                    <span className="block text-[9px] uppercase tracking-[0.12em] text-gray-400">Register by</span>
                    <span>{nexusGuidance.registerBy}</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <label className="block text-[12px] text-gray-700" style={{ fontFamily: "'Inter:Medium', sans-serif" }}>
              Add forms
            </label>
            <div className="flex items-center gap-3">
              <div className="relative flex-1">
                <select
                  value={formToAdd}
                  onChange={(e) => setFormToAdd(e.target.value)}
                  disabled={!state || availableForms.length === 0}
                  className={`w-full border border-gray-200 rounded px-3 py-2.5 text-[13px] bg-white text-gray-700 focus:outline-none focus:border-blue-400 appearance-none ${
                    !state || availableForms.length === 0 ? "cursor-not-allowed bg-gray-50" : "cursor-pointer"
                  }`}
                >
                  <option value="">
                    {!state
                      ? "Choose a state first"
                      : availableForms.length === 0
                      ? "No more eligible forms"
                      : "Select an eligible form"}
                  </option>
                  {availableForms.map((form) => (
                    <option key={form} value={form}>
                      {form}
                    </option>
                  ))}
                </select>
                <svg viewBox="0 0 24 24" className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 fill-gray-400 pointer-events-none">
                  <path d="M7 10l5 5 5-5z" />
                </svg>
              </div>
              <button
                type="button"
                onClick={addSelectedForm}
                disabled={!formToAdd}
                className={`px-4 py-2.5 text-[12px] font-medium rounded transition-colors ${
                  formToAdd
                    ? "bg-[#0D81FD] text-white hover:bg-[#0A6FE8]"
                    : "bg-gray-200 text-gray-400 cursor-not-allowed"
                }`}
                style={{ fontFamily: "'Inter:Medium', sans-serif" }}
              >
                Add
              </button>
            </div>
            <p className="text-[10px] text-gray-400">
              Eligible forms are listed based on the selected state tax region.
            </p>
          </div>

          <div className="space-y-2">
            <label className="block text-[12px] text-gray-700" style={{ fontFamily: "'Inter:Medium', sans-serif" }}>
              Selected forms
            </label>
            {selectedForms.length === 0 ? (
              <div className="rounded-lg border border-dashed border-gray-200 bg-white px-4 py-6 text-[11px] text-gray-400 text-center">
                No forms selected yet.
              </div>
            ) : (
              <div className="flex flex-wrap gap-2 rounded-lg border border-gray-200 bg-white px-4 py-4">
                {selectedForms.map((form) => (
                  <span
                    key={form}
                    className="inline-flex items-center gap-1.5 bg-blue-50 border border-blue-100 text-[11px] text-[#0D81FD] px-2.5 py-1 rounded-full"
                  >
                    {form}
                    <button
                      type="button"
                      onClick={() => removeSelectedForm(form)}
                      className="text-[#0D81FD] hover:text-[#0A6FE8]"
                    >
                      <svg viewBox="0 0 24 24" className="w-3 h-3 fill-current">
                        <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
                      </svg>
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="design-modal-footer flex items-center gap-3 px-6 py-4 border-t border-[#edf1f7] bg-white">
          <button
            type="button"
            onClick={canSave ? () => onSave(state, selectedForms) : undefined}
            disabled={!canSave}
            className={`px-5 py-2.5 text-[13px] font-medium rounded transition-colors ${
              canSave
                ? "bg-[#0D81FD] text-white hover:bg-[#0A6FE8]"
                : "bg-gray-200 text-gray-400 cursor-not-allowed"
            }`}
            style={{ fontFamily: "'Inter:Medium', sans-serif" }}
          >
            {mode === "add-region" ? "Add region" : "Save forms"}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="px-5 py-2.5 text-[13px] text-gray-600 border border-[#dfe5ef] rounded hover:bg-[#f5f8fd] transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Questionnaire Section ──────────────────────────── */
function QuestionnaireLauncher({
  answers,
  onOpen,
}: {
  answers: Record<string, string>;
  onOpen: () => void;
}) {
  const allAnswered = QUESTIONNAIRE.every((q) => !!answers[q.id]);
  const hasSavedAnswers = Object.keys(answers).length > 0;
  const statusLabel = allAnswered
    ? "Complete"
    : hasSavedAnswers
    ? "Saved"
    : "Optional";

  return (
    <div className="bg-white border border-[#ebeaf1] rounded-lg px-4 py-3">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-gray-50 border border-[#ebeaf1]">
            <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-[#0D81FD]">
              <path d="M19 3H5c-1.1 0-2 .9-2 2v14a2 2 0 0 0 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2Zm0 16H5V5h14v14ZM7 7h10v2H7V7Zm0 4h10v2H7v-2Zm0 4h6v2H7v-2Z" />
            </svg>
          </div>
          <div className="min-w-0">
            <h3 className="text-[12px] font-medium text-gray-900" style={{ fontFamily: "'Inter:Medium', sans-serif" }}>
              Answer questions to configure tax return
            </h3>
            <p className="text-[10px] text-[#8a93a7] mt-0.5">{statusLabel}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onOpen}
          className="inline-flex items-center gap-1 text-[11px] text-[#0D81FD] font-medium hover:underline flex-shrink-0"
          style={{ fontFamily: "'Inter:Medium', sans-serif" }}
        >
          Answer questions to configure tax return
          <svg viewBox="0 0 24 24" className="w-3 h-3 fill-current">
            <path d="M7 10l5 5 5-5z" />
          </svg>
        </button>
      </div>
    </div>
  );
}

function QuestionnaireModal({
  answers,
  onChange,
  onClose,
}: {
  answers: Record<string, string>;
  onChange: (answers: Record<string, string>) => void;
  onClose: () => void;
}) {
  const [activeTooltip, setActiveTooltip] = useState<string | null>(null);
  const [draftAnswers, setDraftAnswers] = useState<Record<string, string>>(answers);

  useEffect(() => {
    setDraftAnswers(answers);
  }, [answers]);

  function setAnswer(id: string, val: string) {
    setDraftAnswers((current) => ({ ...current, [id]: val }));
  }

  function clearAnswer(id: string) {
    const nextAnswers = { ...draftAnswers };
    delete nextAnswers[id];
    setDraftAnswers(nextAnswers);
  }

  function saveAnswers() {
    onChange(draftAnswers);
    onClose();
  }

  function autofillAnswers() {
    setDraftAnswers(getRandomQuestionnaireAnswers());
  }

  const draftComplete = QUESTIONNAIRE.every((q) => !!draftAnswers[q.id]);
  const hasUnsavedChanges = !areAnswerMapsEqual(draftAnswers, answers);

  return (
    <div className="design-modal-backdrop fixed inset-0 z-40 flex items-center justify-center bg-black/35 backdrop-blur-[1px]">
      <div className="design-modal-card bg-white w-[820px] max-h-[90vh] flex flex-col">
        <div className="design-modal-header flex items-center justify-between px-6 py-5 border-b border-[#edf1f7]">
          <div>
            <h3 className="design-modal-title text-[17px] font-medium text-gray-900" style={{ fontFamily: "'Inter:Medium', sans-serif" }}>
              Answer questions to configure tax return
            </h3>
            <p className="mt-1 text-[11px] leading-5 text-[#6d7188]">
              Answer these questions to configure the tax return workflow and auto-suggest nexus regions.
            </p>
          </div>
          <button onClick={onClose} className="design-modal-close text-gray-300 hover:text-gray-500 transition-colors">
            <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
            </svg>
          </button>
        </div>
        <div className="design-modal-body overflow-y-auto flex-1 px-6 py-5">
          <div className="divide-y divide-gray-100">
            {QUESTIONNAIRE.map((q) => (
              <div key={q.id} className="flex items-center justify-between gap-6 py-4 first:pt-0">
                <div className="flex items-center gap-1.5 min-w-0">
                  <p className="text-[12px] text-gray-800 leading-snug">{q.label}</p>
                  {q.tooltip && (
                    <div className="relative flex-shrink-0">
                      <button
                        type="button"
                        onMouseEnter={() => setActiveTooltip(q.id)}
                        onMouseLeave={() => setActiveTooltip(null)}
                        className="w-4 h-4 rounded-full border border-gray-300 text-gray-400 hover:border-gray-400 hover:text-gray-600 flex items-center justify-center transition-colors"
                      >
                        <span className="text-[9px] font-bold leading-none" style={{ fontFamily: "'Inter:Medium', sans-serif" }}>?</span>
                      </button>
                      {activeTooltip === q.id && (
                        <div className="absolute z-50 left-5 top-0 w-64 bg-gray-900 text-white text-[10px] leading-[15px] rounded-lg px-3 py-2.5 shadow-xl">
                          {q.tooltip}
                          <div className="absolute left-[-4px] top-2 w-2 h-2 bg-gray-900 rotate-45" />
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <QuestionDropdown
                  value={draftAnswers[q.id] ?? ""}
                  options={q.options}
                  onChange={(v) => setAnswer(q.id, v)}
                  onClear={() => clearAnswer(q.id)}
                />
              </div>
            ))}
          </div>
        </div>
        <div className="design-modal-footer flex items-center gap-3 px-6 py-4 border-t border-[#edf1f7] bg-white">
          <span className="text-[10px] text-gray-400">
            {draftComplete ? "All questions answered" : "You can save partial responses"}
          </span>
          <button
            type="button"
            onClick={autofillAnswers}
            className="px-4 py-2 rounded text-[11px] font-medium text-[#0D81FD] border border-[#bfdbfe] bg-blue-50 hover:bg-blue-100 transition-colors"
            style={{ fontFamily: "'Inter:Medium', sans-serif" }}
          >
            Autofill
          </button>
          <button
            type="button"
            onClick={saveAnswers}
            disabled={!hasUnsavedChanges}
            className={`px-4 py-2 rounded text-[11px] font-medium transition-colors ${
              hasUnsavedChanges
                ? "bg-[#0D81FD] text-white hover:bg-[#0A6FE8]"
                : "bg-gray-200 text-gray-400 cursor-not-allowed"
            }`}
            style={{ fontFamily: "'Inter:Medium', sans-serif" }}
          >
            Save
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded text-[11px] text-gray-600 border border-[#dfe5ef] hover:bg-[#f5f8fd] transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

function StateQuestionnaireModal({
  state,
  answers,
  onSave,
  onClose,
}: {
  state: string;
  answers: Record<string, string>;
  onSave: (answers: Record<string, string>) => void;
  onClose: () => void;
}) {
  const questions = getQuestionsForState(state);
  const [draftAnswers, setDraftAnswers] = useState<Record<string, string>>({});

  useEffect(() => {
    setDraftAnswers({});
  }, [state]);

  function setAnswer(id: string, val: string) {
    setDraftAnswers((current) => ({ ...current, [id]: val }));
  }

  function clearAnswer(id: string) {
    const nextAnswers = { ...draftAnswers };
    delete nextAnswers[id];
    setDraftAnswers(nextAnswers);
  }

  function saveAnswers() {
    const nextAnswers = { ...answers };

    questions.forEach((question) => {
      const nextValue = draftAnswers[question.id];
      if (nextValue) {
        nextAnswers[question.id] = nextValue;
      } else {
        delete nextAnswers[question.id];
      }
    });

    onSave(nextAnswers);
    onClose();
  }

  function autofillAnswers() {
    const nextDraftAnswers = questions.reduce((accumulator, question) => {
      accumulator[question.id] = pickRandom(question.options);
      return accumulator;
    }, {} as Record<string, string>);

    setDraftAnswers(nextDraftAnswers);
  }

  const hasUnsavedChanges = !areAnswerMapsEqual(draftAnswers, answers);

  return (
    <div className="design-modal-backdrop fixed inset-0 z-40 flex items-center justify-center bg-black/35 backdrop-blur-[1px]">
      <div className="design-modal-card bg-white w-[760px] max-h-[88vh] flex flex-col">
        <div className="design-modal-header flex items-center justify-between px-6 py-5 border-b border-[#edf1f7]">
          <div>
            <h3 className="design-modal-title text-[17px] font-medium text-gray-900" style={{ fontFamily: "'Inter:Medium', sans-serif" }}>
              {state} tax return questions
            </h3>
            <p className="mt-1 text-[11px] leading-5 text-[#6d7188]">
              Answer the questions for this nexus region to refine the suggested tax return setup.
            </p>
          </div>
          <button onClick={onClose} className="design-modal-close text-gray-300 hover:text-gray-500 transition-colors">
            <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
            </svg>
          </button>
        </div>
        <div className="design-modal-body overflow-y-auto flex-1 px-6 py-5">
          {questions.length > 0 ? (
            <div className="divide-y divide-gray-100">
              {questions.map((question) => (
                <div key={question.id} className="flex items-center justify-between gap-6 py-4 first:pt-0">
                  <p className="text-[12px] text-gray-800 leading-snug">{question.label}</p>
                  <QuestionDropdown
                    value={draftAnswers[question.id] ?? ""}
                    options={question.options}
                    onChange={(value) => setAnswer(question.id, value)}
                    onClear={() => clearAnswer(question.id)}
                  />
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-gray-200 bg-white px-4 py-6 text-[11px] text-gray-400 text-center">
              No region-specific questionnaire configured for this state.
            </div>
          )}
        </div>
        <div className="design-modal-footer flex items-center gap-3 px-6 py-4 border-t border-[#edf1f7] bg-white">
          <button
            type="button"
            onClick={autofillAnswers}
            className="px-4 py-2 rounded text-[11px] font-medium text-[#0D81FD] border border-[#bfdbfe] bg-blue-50 hover:bg-blue-100 transition-colors"
            style={{ fontFamily: "'Inter:Medium', sans-serif" }}
          >
            Autofill
          </button>
          <button
            type="button"
            onClick={saveAnswers}
            disabled={!hasUnsavedChanges}
            className={`px-4 py-2 rounded text-[11px] font-medium transition-colors ${
              hasUnsavedChanges
                ? "bg-[#0D81FD] text-white hover:bg-[#0A6FE8]"
                : "bg-gray-200 text-gray-400 cursor-not-allowed"
            }`}
            style={{ fontFamily: "'Inter:Medium', sans-serif" }}
          >
            Save
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded text-[11px] text-gray-600 border border-[#dfe5ef] hover:bg-[#f5f8fd] transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Nexus Step ─────────────────────────────────────── */
function NexusStep({
  answers,
  primaryState,
  initialRows,
  onAnswersChange,
  showRegionQuestionnaireLinks = true,
  onDone,
}: {
  answers: Record<string, string>;
  primaryState: string;
  initialRows?: NexusRow[];
  onAnswersChange?: (answers: Record<string, string>) => void;
  showRegionQuestionnaireLinks?: boolean;
  onDone: (rows: NexusRow[]) => void;
}) {
  const [rows, setRows] = useState<NexusRow[]>(
    getSuggestedNexusRows(answers, primaryState, initialRows)
  );
  const [modalState, setModalState] = useState<{
    mode: "add-region" | "add-forms";
    rowId: string | null;
    initialState: string;
    initialForms: string[];
  } | null>(null);
  const [questionnaireState, setQuestionnaireState] = useState<string | null>(null);

  const availableStates = US_STATES.filter(
    (s) => !rows.find((r) => r.state === s)
  );

  function removeRow(id: string) {
    setRows((prev) => prev.filter((r) => r.id !== id));
  }

  function removeForm(rowId: string, form: string) {
    setRows((prev) =>
      prev.map((r) => (r.id === rowId ? { ...r, forms: r.forms.filter((f) => f !== form) } : r))
    );
  }

  function openAddRegionModal() {
    setModalState({
      mode: "add-region",
      rowId: null,
      initialState: "",
      initialForms: [],
    });
  }

  function openAddFormsModal(row: NexusRow) {
    setModalState({
      mode: "add-forms",
      rowId: row.id,
      initialState: row.state,
      initialForms: row.forms,
    });
  }

  function closeModal() {
    setModalState(null);
  }

  function handleModalSave(state: string, forms: string[]) {
    if (!state || forms.length === 0 || !modalState) return;

    if (modalState.mode === "add-region") {
      setRows((prev) => [
        ...prev,
        {
          id: state,
          state,
          stateCode: getStateCode(state),
          forms,
        },
      ]);
    } else if (modalState.rowId) {
      setRows((prev) =>
        prev.map((row) =>
          row.id === modalState.rowId
            ? {
                ...row,
                forms,
              }
            : row
        )
      );
    }

    closeModal();
  }

  function handleStateQuestionnaireSave(nextAnswers: Record<string, string>) {
    onAnswersChange?.(nextAnswers);
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-[13px] font-medium text-gray-900 mb-1" style={{ fontFamily: "'Inter:Medium', sans-serif" }}>
            Configure Nexus &amp; Tax Forms
          </h3>
          <p className="text-[11px] text-[#6d7188] leading-5">
            Based on your answers, we've suggested the nexus states and tax forms below. Review, modify, or add new nexus entries.
          </p>
        </div>
        <button
          onClick={openAddRegionModal}
          className="flex-shrink-0 flex items-center gap-1.5 text-[11px] text-[#0D81FD] border border-[#0D81FD] px-3 py-1.5 rounded hover:bg-blue-50 transition-colors"
          style={{ fontFamily: "'Inter:Medium', sans-serif" }}
        >
          <svg viewBox="0 0 24 24" className="w-3 h-3 fill-current"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" /></svg>
          Add Nexus
        </button>
      </div>

      {/* Suggested badge */}
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center gap-1 text-[10px] bg-green-50 text-green-700 border border-green-200 px-2 py-0.5 rounded-full">
          <svg viewBox="0 0 24 24" className="w-2.5 h-2.5 fill-current"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" /></svg>
          Auto-suggested from your questionnaire
        </span>
        <span className="text-[10px] text-gray-400">{rows.length} nexus state{rows.length !== 1 ? "s" : ""}</span>
      </div>

      {/* Nexus rows */}
      <div className="space-y-2">
        {rows.length === 0 && (
          <div className="text-center py-8 text-[11px] text-gray-400 border border-dashed border-gray-200 rounded-lg">
            No nexus states added yet. Click "Add Nexus" to get started.
          </div>
        )}
        {rows.map((row) => {
          const stateQuestions = getQuestionsForState(row.state);
          const answeredCount = stateQuestions.filter((question) => !!answers[question.id]).length;

          return (
          <div key={row.id} className="border border-gray-200 rounded-lg p-4 bg-white">
            <div className="flex items-start justify-between mb-2.5">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded bg-blue-100 flex items-center justify-center text-[10px] font-bold text-blue-600">
                  {row.stateCode}
                </div>
                <span className="text-[12px] font-medium text-gray-800" style={{ fontFamily: "'Inter:Medium', sans-serif" }}>
                  {row.state}
                </span>
              </div>
              <button
                onClick={() => removeRow(row.id)}
                className="text-gray-300 hover:text-red-400 transition-colors"
                title="Remove nexus"
              >
                <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" /></svg>
              </button>
            </div>
            {false && getNexusGuidance(row.state) && (
              <div className="ml-10.5 mb-3 flex flex-wrap gap-2">
                <span className="inline-flex items-center gap-1 rounded-full border border-[#dce7fb] bg-[#f5f9ff] px-2 py-0.5 text-[10px] text-[#0D81FD]">
                  Threshold: {getNexusGuidance(row.state)?.threshold}
                </span>
                <span className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-[10px] text-gray-500">
                  {getNexusGuidance(row.state)?.trigger}
                </span>
              </div>
            )}
            {showRegionQuestionnaireLinks && (
              <div className="ml-10.5 mb-3">
                <button
                  type="button"
                  onClick={() => setQuestionnaireState(row.state)}
                  className="inline-flex w-full items-center justify-start gap-1 rounded-[999px] border border-[#e7edf7] bg-[#f7faff] px-4 py-2.5 text-left text-[12px] text-[#5e6b82] font-medium hover:bg-[#f0f6ff] transition-colors"
                  style={{ fontFamily: "'Inter:Medium', sans-serif" }}
                >
                  Answer questionnaire to auto-suggest tax forms (optional)
                </button>
              </div>
            )}
            <div className="ml-10.5 flex flex-wrap gap-1.5">
              {row.forms.map((form) => (
                <span
                  key={form}
                  className="inline-flex items-center gap-1 bg-[#eef6ff] border border-[#bfdcff] text-[11px] text-[#0D81FD] px-2.5 py-0.5 rounded-full"
                >
                  {form}
                  <button
                    onClick={() => removeForm(row.id, form)}
                    className="text-[#0D81FD] hover:text-[#0a6fe8] transition-colors"
                  >
                    <svg viewBox="0 0 24 24" className="w-2.5 h-2.5 fill-current"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" /></svg>
                  </button>
                </span>
              ))}
              <button
                onClick={() => openAddFormsModal(row)}
                className="inline-flex items-center gap-0.5 text-[10px] text-[#0D81FD] hover:underline"
              >
                <svg viewBox="0 0 24 24" className="w-2.5 h-2.5 fill-current"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" /></svg>
                Add form
              </button>
            </div>
          </div>
        )})}
      </div>

      <div className="flex justify-end pt-2">
        <button
          onClick={() => rows.length > 0 && onDone(rows)}
          disabled={rows.length === 0}
          className={`px-5 py-2 text-[12px] font-medium rounded transition-colors flex items-center gap-2 ${
            rows.length > 0
              ? "bg-[#0D81FD] text-white hover:bg-blue-600"
              : "bg-gray-100 text-gray-400 cursor-not-allowed"
          }`}
          style={{ fontFamily: "'Inter:Medium', sans-serif" }}
        >
          Save filing setup
        </button>
      </div>

      {modalState && (
        <NexusFormsModal
          mode={modalState.mode}
          stateOptions={
            modalState.mode === "add-region"
              ? availableStates
              : [modalState.initialState]
          }
          initialState={modalState.initialState}
          initialForms={modalState.initialForms}
          onSave={handleModalSave}
          onCancel={closeModal}
        />
      )}

      {questionnaireState && (
        <StateQuestionnaireModal
          state={questionnaireState}
          answers={answers}
          onSave={handleStateQuestionnaireSave}
          onClose={() => setQuestionnaireState(null)}
        />
      )}
    </div>
  );
}

function TaxReturnSetupModal({
  answers,
  onSave,
  onCancel,
}: {
  answers: Record<string, string>;
  onSave: (rows: NexusRow[]) => void;
  onCancel: () => void;
}) {
  return (
    <div className="design-modal-backdrop fixed inset-0 z-30 flex items-center justify-center bg-black/35 backdrop-blur-[1px]">
      <div className="design-modal-card bg-white w-[900px] max-h-[92vh] flex flex-col">
        <div className="design-modal-header flex items-center justify-between px-6 py-5 border-b border-[#edf1f7]">
          <div>
            <h3 className="design-modal-title text-[17px] font-medium text-gray-900" style={{ fontFamily: "'Inter:Medium', sans-serif" }}>
              Configure Tax Return For Your Business
            </h3>
            <p className="mt-1 text-[11px] leading-5 text-[#6d7188]">
              Add as many nexus regions as you need and assign eligible forms for each region before moving to the configure nexus screen.
            </p>
          </div>
          <button onClick={onCancel} className="design-modal-close text-gray-300 hover:text-gray-500 transition-colors">
            <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
            </svg>
          </button>
        </div>
        <div className="design-modal-body overflow-y-auto flex-1 px-6 py-5 bg-gray-50">
          <div className="bg-white border border-[#ebeaf1] rounded-lg px-6 py-6">
            <NexusStep
              answers={answers}
              primaryState={getPrimaryStateFromAnswers(answers)}
              showRegionQuestionnaireLinks={false}
              onDone={onSave}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

const US_STATES = [
  "Alabama","Alaska","Arizona","Arkansas","California","Colorado","Connecticut",
  "Delaware","Florida","Georgia","Hawaii","Idaho","Illinois","Indiana","Iowa",
  "Kansas","Kentucky","Louisiana","Maine","Maryland","Massachusetts","Michigan",
  "Minnesota","Mississippi","Missouri","Montana","Nebraska","Nevada","New Hampshire",
  "New Jersey","New Mexico","New York","North Carolina","North Dakota","Ohio",
  "Oklahoma","Oregon","Pennsylvania","Rhode Island","South Carolina","South Dakota",
  "Tennessee","Texas","Utah","Vermont","Virginia","Washington","West Virginia",
  "Wisconsin","Wyoming",
];

function ConfigureTaxReturnSection({
  regions,
  enabled,
  onAddRegion,
  onOpenRegion,
}: {
  regions: RegionRecord[];
  enabled: boolean;
  onAddRegion: () => void;
  onOpenRegion: (regionId: string) => void;
}) {
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[17px] font-medium text-gray-900" style={{ fontFamily: "'Inter:Medium', sans-serif" }}>
            Configure Tax Return
          </h2>
          <p className="text-[11px] text-[#6d7188] mt-1">
            Launch the setup flow, add all required nexus regions, and manage the eligible forms for each nexus from one place.
          </p>
        </div>
      </div>

      {!enabled ? (
        <div className="bg-white border border-dashed border-[#d7d9e4] rounded-lg px-6 py-12 text-center">
          <div className="mx-auto w-12 h-12 rounded-full bg-amber-50 flex items-center justify-center mb-4">
            <svg viewBox="0 0 24 24" className="w-6 h-6 fill-amber-500"><path d="M12 1a5 5 0 00-5 5v3H6a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2v-8a2 2 0 00-2-2h-1V6a5 5 0 00-5-5zm-3 8V6a3 3 0 116 0v3H9z" /></svg>
          </div>
          <h3 className="text-[14px] font-medium text-gray-900" style={{ fontFamily: "'Inter:Medium', sans-serif" }}>
            Enable tax return filing to begin setup
          </h3>
          <p className="text-[11px] text-[#6d7188] mt-2">
            Once tax return filing is enabled, you can open the setup modal, add nexus regions, and continue to the configure nexus screen.
          </p>
        </div>
      ) : regions.length === 0 ? (
        <div className="bg-white border border-dashed border-[#d7d9e4] rounded-lg px-6 py-12 text-center">
          <div className="mx-auto w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center mb-4">
            <svg viewBox="0 0 24 24" className="w-6 h-6 fill-[#0D81FD]"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" /></svg>
          </div>
          <h3 className="text-[14px] font-medium text-gray-900" style={{ fontFamily: "'Inter:Medium', sans-serif" }}>
            No tax return configurations yet
          </h3>
          <p className="text-[11px] text-[#6d7188] mt-2 mb-5">
            Start by adding the nexus regions and tax forms you want to configure for this business.
          </p>
          <button
            onClick={onAddRegion}
            className="bg-[#0D81FD] text-white text-[12px] px-4 py-2 rounded hover:bg-blue-600 transition-colors"
            style={{ fontFamily: "'Inter:Medium', sans-serif" }}
          >
            Configure tax return for your business
          </button>
        </div>
      ) : (
        <div className="bg-white border border-[#ebeaf1] rounded-lg overflow-hidden">
          <div className="flex items-center justify-end px-6 py-4 border-b border-gray-100">
            <button
              onClick={onAddRegion}
              className="flex items-center gap-1.5 bg-[#0D81FD] text-white text-[12px] px-4 py-2 rounded hover:bg-blue-600 transition-colors"
              style={{ fontFamily: "'Inter:Medium', sans-serif" }}
            >
              <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" /></svg>
              Add Nexus Setup
            </button>
          </div>
          <div className="grid grid-cols-[1fr_0.9fr_0.8fr_0.8fr_0.8fr_1fr] gap-4 px-6 py-3 bg-gray-50 border-b border-gray-100 text-[10px] tracking-wide uppercase text-gray-400">
            <span>Primary nexus</span>
            <span>Questionnaire</span>
            <span>Nexus regions</span>
            <span>Tax forms</span>
            <span>Status</span>
            <span>Actions</span>
          </div>

          <div className="divide-y divide-gray-100">
            {regions.map((region) => {
              const suggestedRows = getSuggestedNexusRows(
                region.questionnaireAnswers,
                region.state,
                region.nexusRows
              );
              const formsCount = suggestedRows.reduce((count, row) => count + row.forms.length, 0);

              return (
                <div key={region.id} className="grid grid-cols-[1fr_0.9fr_0.8fr_0.8fr_0.8fr_1fr] gap-4 px-6 py-4 text-[12px] text-gray-700 items-start">
                  <div>
                    <div className="font-medium text-gray-900" style={{ fontFamily: "'Inter:Medium', sans-serif" }}>
                      {region.state}
                    </div>
                    <div className="text-[10px] text-gray-400 mt-1">
                      Saved {region.savedAt}
                    </div>
                  </div>
                  <div>
                    <div>{Object.keys(region.questionnaireAnswers).length > 0 ? "Saved" : "Not answered"}</div>
                    <div className="text-[10px] text-gray-400 mt-1">Questionnaire responses</div>
                  </div>
                  <div>
                    <div>{suggestedRows.length} region{suggestedRows.length !== 1 ? "s" : ""}</div>
                    <div className="text-[10px] text-gray-400 mt-1">Configured in setup</div>
                  </div>
                  <div>
                    <div>{formsCount} form{formsCount !== 1 ? "s" : ""}</div>
                    <div className="text-[10px] text-gray-400 mt-1">Assigned across nexus rows</div>
                  </div>
                  <div>
                    <span
                      className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border ${
                        region.status === "configured"
                          ? "bg-green-50 text-green-700 border-green-200"
                          : "bg-amber-50 text-amber-700 border-amber-200"
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${region.status === "configured" ? "bg-green-500" : "bg-amber-500"}`} />
                      {region.status === "configured" ? "Configured" : "Pending setup"}
                    </span>
                  </div>
                  <div>
                    <button
                      onClick={() => onOpenRegion(region.id)}
                      className="text-[11px] text-[#0D81FD] font-medium hover:underline"
                      style={{ fontFamily: "'Inter:Medium', sans-serif" }}
                    >
                      {region.status === "configured" ? "View filing setup" : "Launch filing setup"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function RegionSetupPage({
  region,
  onBack,
  onQuestionnaireChange,
  onComplete,
}: {
  region: RegionRecord;
  onBack: () => void;
  onQuestionnaireChange: (answers: Record<string, string>) => void;
  onComplete: (nexusRows: NexusRow[]) => void;
}) {
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <button
            onClick={onBack}
            className="text-[11px] text-[#0D81FD] hover:underline mb-2"
          >
            ← Back to tax return settings
          </button>
          <h2 className="text-[17px] font-medium text-gray-900" style={{ fontFamily: "'Inter:Medium', sans-serif" }}>
            Configure nexus for your business
          </h2>
          <p className="text-[11px] text-[#6d7188] mt-1">
            Review the nexus regions, update the assigned forms, and save any business-specific changes.
          </p>
        </div>
      </div>

      <div className="bg-white border border-[#ebeaf1] rounded-lg px-6 py-5 flex items-center justify-between gap-4">
        <div>
          <h3 className="text-[13px] font-medium text-gray-900" style={{ fontFamily: "'Inter:Medium', sans-serif" }}>
            Nexus configuration summary
          </h3>
          <p className="text-[11px] text-[#6d7188] mt-1">
            Primary nexus: {region.state} • {region.nexusRows.length} region{region.nexusRows.length !== 1 ? "s" : ""} • Saved {region.savedAt}
          </p>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full border border-[#dce7fb] bg-[#f5f9ff] px-2.5 py-1 text-[10px] text-[#0D81FD]">
          Continue setup
        </span>
      </div>

      <div className="bg-white border border-[#ebeaf1] rounded-lg px-6 py-6">
        <NexusStep
          answers={region.questionnaireAnswers}
          primaryState={region.state}
          initialRows={region.nexusRows}
          onAnswersChange={onQuestionnaireChange}
          onDone={onComplete}
        />
      </div>
    </div>
  );
}

/* ─── Tax Return Settings Form ───────────────────────── */
function TaxReturnSettingsModal({
  onSave,
  onCancel,
}: {
  onSave: (form: TaxReturnSettingsForm) => void;
  onCancel: () => void;
}) {
  const firstInputRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState<TaxReturnSettingsForm>({
    state: "Alabama",
    salesTaxAccountNumber: "",
    prepaymentRequired: "",
    legalEntityName: "",
    salesTaxOnly: "",
    efileUsername: "",
    addressLine1: "",
    addressLine2: "",
    zipCode: "",
    phone: "",
    taxpayerId: "",
  });

  function set(key: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function autofillForm() {
    setForm(getRandomTaxReturnSettingsForm());
  }

  useEffect(() => {
    firstInputRef.current?.focus();
  }, []);

  const requiredFilled =
    form.state &&
    form.salesTaxAccountNumber.trim() &&
    form.prepaymentRequired &&
    form.legalEntityName.trim() &&
    form.salesTaxOnly &&
    form.efileUsername.trim() &&
    form.addressLine1.trim() &&
    form.zipCode.trim() &&
    form.phone.trim();

  const inputCls =
    "w-full border border-gray-300 rounded px-3 py-2 text-[13px] text-gray-800 focus:outline-none focus:border-blue-400 bg-white placeholder-gray-300";
  const selectCls =
    "w-full border border-gray-300 rounded px-3 py-2 text-[13px] text-gray-800 focus:outline-none focus:border-blue-400 bg-white appearance-none cursor-pointer";

  return (
    <div className="design-modal-backdrop fixed inset-0 z-40 flex items-center justify-center bg-black/35 backdrop-blur-[1px]">
      <div className="design-modal-card bg-white w-[780px] max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="design-modal-header flex items-center justify-between px-8 py-5 border-b border-[#edf1f7]">
          <h2 className="design-modal-title text-[17px] font-medium text-gray-900" style={{ fontFamily: "'Inter:Medium', sans-serif" }}>
            New Tax Return Settings
          </h2>
          <button onClick={onCancel} className="design-modal-close text-gray-300 hover:text-gray-500 transition-colors">
            <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
            </svg>
          </button>
        </div>

        {/* Form body */}
        <div className="design-modal-body overflow-y-auto flex-1 px-8 py-2">
          <SettingsField fieldId="tax-return-state" label="State" required>
            <div className="relative">
              <select
                id="tax-return-state"
                name="state"
                aria-label="State"
                value={form.state}
                onChange={(e) => set("state", e.target.value)}
                className={selectCls}
              >
                {US_STATES.map((s) => <option key={s}>{s}</option>)}
              </select>
              <svg viewBox="0 0 24 24" className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 fill-gray-400 pointer-events-none">
                <path d="M7 10l5 5 5-5z" />
              </svg>
            </div>
          </SettingsField>

          <SettingsField fieldId="sales-tax-account-number" label="Sales Tax Account Number" required>
            <input
              id="sales-tax-account-number"
              name="salesTaxAccountNumber"
              aria-label="Sales Tax Account Number"
              ref={firstInputRef}
              value={form.salesTaxAccountNumber}
              onChange={(e) => set("salesTaxAccountNumber", e.target.value)}
              placeholder="e.g. SLS-AB12CD34EF"
              className={inputCls}
            />
          </SettingsField>

          <SettingsField fieldId="prepayment-required" label="Are you required to make a prepayment against this return?" required>
            <div className="relative">
              <select
                id="prepayment-required"
                name="prepaymentRequired"
                aria-label="Are you required to make a prepayment against this return?"
                value={form.prepaymentRequired}
                onChange={(e) => set("prepaymentRequired", e.target.value)}
                className={selectCls}
              >
                <option value="">Select</option>
                <option>Yes</option>
                <option>No</option>
              </select>
              <svg viewBox="0 0 24 24" className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 fill-gray-400 pointer-events-none">
                <path d="M7 10l5 5 5-5z" />
              </svg>
            </div>
          </SettingsField>

          <SettingsField fieldId="legal-entity-name" label="Legal Entity Name" required>
            <input
              id="legal-entity-name"
              name="legalEntityName"
              aria-label="Legal Entity Name"
              value={form.legalEntityName}
              onChange={(e) => set("legalEntityName", e.target.value)}
              placeholder="e.g. Zylker Inc."
              className={inputCls}
            />
          </SettingsField>

          <SettingsField fieldId="sales-tax-only" label={'Is your sales and use tax collection settings set to "Sales tax only" for current state?'} required>
            <div className="relative">
              <select
                id="sales-tax-only"
                name="salesTaxOnly"
                aria-label='Is your sales and use tax collection settings set to "Sales tax only" for current state?'
                value={form.salesTaxOnly}
                onChange={(e) => set("salesTaxOnly", e.target.value)}
                className={selectCls}
              >
                <option value="">Select</option>
                <option>Yes</option>
                <option>No</option>
              </select>
              <svg viewBox="0 0 24 24" className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 fill-gray-400 pointer-events-none">
                <path d="M7 10l5 5 5-5z" />
              </svg>
            </div>
          </SettingsField>

          <SettingsField fieldId="efile-username" label="Efile Username" required>
            <input
              id="efile-username"
              name="efileUsername"
              aria-label="Efile Username"
              value={form.efileUsername}
              onChange={(e) => set("efileUsername", e.target.value)}
              placeholder="Your e-file portal username"
              className={inputCls}
            />
          </SettingsField>

          <SettingsField fieldId="address-line-1" label="Address Line 1" required>
            <input
              id="address-line-1"
              name="addressLine1"
              aria-label="Address Line 1"
              value={form.addressLine1}
              onChange={(e) => set("addressLine1", e.target.value)}
              placeholder="Street address"
              className={inputCls}
            />
          </SettingsField>

          <SettingsField fieldId="address-line-2" label="Address Line 2">
            <input
              id="address-line-2"
              name="addressLine2"
              aria-label="Address Line 2"
              value={form.addressLine2}
              onChange={(e) => set("addressLine2", e.target.value)}
              placeholder="Apt, suite, unit, etc. (optional)"
              className={inputCls}
            />
          </SettingsField>

          <SettingsField fieldId="zip-code" label="Zip Code" required>
            <input
              id="zip-code"
              name="zipCode"
              aria-label="Zip Code"
              value={form.zipCode}
              onChange={(e) => set("zipCode", e.target.value)}
              placeholder="e.g. 12345"
              className={inputCls}
            />
          </SettingsField>

          <SettingsField fieldId="phone" label="Phone" required>
            <input
              id="phone"
              name="phone"
              aria-label="Phone"
              value={form.phone}
              onChange={(e) => set("phone", e.target.value)}
              placeholder="e.g. 99887766"
              className={inputCls}
            />
          </SettingsField>

          <SettingsField fieldId="taxpayer-id" label="Taxpayer ID or Employer Identification">
            <input
              id="taxpayer-id"
              name="taxpayerId"
              aria-label="Taxpayer ID or Employer Identification"
              value={form.taxpayerId}
              onChange={(e) => set("taxpayerId", e.target.value)}
              placeholder="e.g. 123456789"
              className={inputCls}
            />
          </SettingsField>
        </div>

        {/* Footer */}
        <div className="design-modal-footer flex items-center gap-3 px-8 py-4 border-t border-[#edf1f7] bg-white">
          <button
            onClick={autofillForm}
            className="px-5 py-2 text-[13px] text-[#0D81FD] border border-[#bfdbfe] bg-blue-50 rounded hover:bg-blue-100 transition-colors"
            style={{ fontFamily: "'Inter:Medium', sans-serif" }}
          >
            Autofill
          </button>
          <button
            onClick={requiredFilled ? () => onSave(form) : undefined}
            disabled={!requiredFilled}
            className={`px-5 py-2 text-[13px] font-medium rounded transition-colors ${
              requiredFilled
                ? "bg-[#0D81FD] text-white hover:bg-[#0A6FE8] cursor-pointer"
                : "bg-gray-200 text-gray-400 cursor-not-allowed"
            }`}
            style={{ fontFamily: "'Inter:Medium', sans-serif" }}
          >
            Save
          </button>
          <button
            onClick={onCancel}
            className="px-5 py-2 text-[13px] text-gray-600 border border-[#dfe5ef] rounded hover:bg-[#f5f8fd] transition-colors"
          >
            Cancel
          </button>
          <p className="ml-auto text-[10px] text-gray-400">
            Fields marked <span className="text-[#d94f3d]">*</span> are required. After saving, use the Avalara link in the card to continue setup.
          </p>
        </div>
      </div>
    </div>
  );
}

/* ─── Main App ───────────────────────────────────────── */
export default function App() {
  const [page, setPage] = useState<AppPage>("overview");
  const [taxEnabled, setTaxEnabled] = useState(false);
  const [fpoaStatus, setFpoaStatus] = useState<FpoaStatus>("idle");
  const [showQuestionnaireModal, setShowQuestionnaireModal] = useState(false);
  const [showTaxReturnSetupModal, setShowTaxReturnSetupModal] = useState(false);
  const [questionnaireAnswers, setQuestionnaireAnswers] = useState<Record<string, string>>({});
  const [regions, setRegions] = useState<RegionRecord[]>([]);
  const [selectedRegionId, setSelectedRegionId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const selectedRegion = regions.find((region) => region.id === selectedRegionId) ?? null;

  function handleToggle() {
    setTaxEnabled((current) => !current);
  }

  function handleFpoaSign() {
    setFpoaStatus("signing");
    setTimeout(() => {
      setFpoaStatus("processing");
      setToastMessage("FPOA signed and processed. Tax return configuration is now unlocked.");
    }, 1200);
  }

  function openRegionSetup(regionId: string) {
    setSelectedRegionId(regionId);
    setPage("region-details");
  }

  function handleTaxReturnSetupSave(nexusRows: NexusRow[]) {
    const primaryState = nexusRows[0]?.state ?? getPrimaryStateFromAnswers(questionnaireAnswers);
    const regionId = `nexus-${regions.length + 1}`;

    setRegions((prev) => [
      ...prev,
      {
        id: regionId,
        state: primaryState,
        salesTaxAccountNumber: "",
        prepaymentRequired: "",
        legalEntityName: "",
        salesTaxOnly: "",
        efileUsername: "",
        addressLine1: "",
        addressLine2: "",
        zipCode: "",
        phone: "",
        taxpayerId: "",
        questionnaireAnswers,
        nexusRows,
        status: "draft",
        savedAt: formatDateLabel(new Date()),
        completedAt: null,
      },
    ]);

    setShowTaxReturnSetupModal(false);
    setSelectedRegionId(regionId);
    setPage("region-details");
    setToastMessage("Nexus setup saved. Continue configuring your nexus details.");
  }

  function handleSelectedRegionQuestionnaireChange(nextAnswers: Record<string, string>) {
    if (!selectedRegionId) {
      return;
    }

    setRegions((prev) =>
      prev.map((region) =>
        region.id === selectedRegionId ? { ...region, questionnaireAnswers: nextAnswers } : region
      )
    );
  }

  function handleWizardComplete(nexusRows: NexusRow[]) {
    if (!selectedRegionId) {
      return;
    }

    setRegions((prev) => [
      ...prev.map((region) =>
        region.id === selectedRegionId
          ? {
              ...region,
              nexusRows,
              status: "configured",
              completedAt: formatDateLabel(new Date()),
            }
          : region
      ),
    ]);

    setPage("overview");
    setSelectedRegionId(null);
    setToastMessage("Filing setup saved for this region.");
  }

  return (
    <div
      className="app-shell flex h-screen bg-white overflow-hidden"
      style={{ fontFamily: "'Inter:Regular', sans-serif" }}
    >
      {/* Left sidebar */}
      <div className="w-48 flex-shrink-0 flex flex-col border-r border-gray-200 bg-white overflow-y-auto">
        <div className="flex items-center gap-2 px-3 py-3 border-b border-gray-200">
          <div className="w-7 h-7 rounded bg-blue-100 flex items-center justify-center">
            <svg viewBox="0 0 24 24" className="w-4 h-4 fill-blue-500">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[11px] font-medium text-gray-800 truncate" style={{ fontFamily: "'Inter:Medium', sans-serif" }}>
              All Settings
            </div>
            <div className="text-[10px] text-gray-500 truncate">Zylker Canada (MT)</div>
          </div>
          <button className="text-gray-400 hover:text-gray-600">
            <svg viewBox="0 0 24 24" className="w-3 h-3 fill-current"><path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z" /></svg>
          </button>
        </div>

        <div className="flex-1 py-2">
          {NAV_SECTIONS.map((section) => (
            <div key={section.heading} className="mb-2">
              <div className="px-3 pt-2 pb-1 text-[9px] tracking-wider text-gray-400 uppercase">
                {section.heading}
              </div>
              {section.items.map((item) => (
                <div key={item.label}>
                  <button
                    className={`w-full flex items-center gap-1 px-3 py-1.5 text-[11px] text-left transition-colors ${
                      item.expanded ? "text-gray-800 font-medium" : "text-gray-600 hover:text-gray-800 hover:bg-gray-50"
                    }`}
                    style={item.expanded ? { fontFamily: "'Inter:Medium', sans-serif" } : {}}
                  >
                    {item.expandable && (
                      <svg viewBox="0 0 24 24" className={`w-3 h-3 fill-current flex-shrink-0 transition-transform ${item.expanded ? "rotate-90" : ""}`}>
                        <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z" />
                      </svg>
                    )}
                    {item.label}
                  </button>
                  {item.expanded && item.children?.map((child) => (
                    <button
                      key={child.label}
                      className={`w-full flex items-center px-3 py-1.5 pl-7 text-[11px] text-left ${
                        child.active ? "bg-blue-600 text-white" : "text-gray-600 hover:bg-gray-50"
                      }`}
                    >
                      {child.label}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          ))}
        </div>

        <div className="border-t border-gray-200 p-2 flex justify-around">
          <button className="flex flex-col items-center text-[9px] text-gray-500 gap-0.5">
            <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z" /></svg>
            Chats
          </button>
          <button className="flex flex-col items-center text-[9px] text-gray-500 gap-0.5">
            <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" /></svg>
            Contacts
          </button>
        </div>
      </div>

      {/* Tax sub-nav */}
      <div className="w-44 flex-shrink-0 flex flex-col border-r border-gray-200 bg-white overflow-y-auto">
        <div className="px-4 py-4">
          <h2 className="text-sm font-semibold text-gray-900 mb-3" style={{ fontFamily: "'Inter:Medium', sans-serif", fontSize: "15px" }}>Taxes</h2>
          <nav className="space-y-0.5">
            {TAX_NAV.map((item) => (
              <button
                key={item.label}
                className={`w-full text-left px-2 py-1.5 text-[11px] rounded transition-colors flex items-center justify-between ${
                  item.active ? "bg-blue-50 text-blue-700 font-medium" : "text-gray-600 hover:bg-gray-50"
                }`}
                style={item.active ? { fontFamily: "'Inter:Medium', sans-serif" } : {}}
              >
                <span>{item.label}</span>
                {item.badge && (
                  <span className="text-[8px] bg-red-500 text-white px-1 py-0.5 rounded font-bold">
                    {item.badge}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </div>
        <div className="mx-3 mt-4 rounded border border-orange-200 bg-orange-50 p-3">
          <div className="flex items-center gap-1 mb-1">
            <span className="text-[11px] font-medium text-orange-700" style={{ fontFamily: "'Inter:Medium', sans-serif" }}>Tax Rules</span>
          </div>
          <p className="text-[10px] text-orange-800 leading-snug mb-2">
            Upgrade to automate the process of associating taxes in your organization.
          </p>
          <button className="text-[11px] text-blue-600 font-medium hover:underline" style={{ fontFamily: "'Inter:Medium', sans-serif" }}>
            Upgrade &rsaquo;
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-gray-200 bg-white">
          <div className="flex-1 flex justify-center">
            <div className="flex items-center gap-2 bg-gray-100 rounded px-3 py-1.5 w-64">
              <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-gray-400 flex-shrink-0"><path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" /></svg>
              <span className="text-[11px] text-gray-400">Search settings ( / )</span>
            </div>
          </div>
          <button className="text-[11px] text-gray-600 hover:text-gray-800 flex items-center gap-1 mr-10">
            Close Settings
            <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" /></svg>
          </button>
        </div>

        {/* Content area */}
        <div className="flex-1 overflow-y-auto px-8 py-6 bg-gray-50">
          {page === "overview" ? (
            <>
              {/* Page header */}
              <div className="flex items-center justify-between mb-5">
                <h1 className="text-[17px] font-medium text-gray-900" style={{ fontFamily: "'Inter:Medium', sans-serif" }}>
                  Tax Returns Settings
                </h1>
                <div className="flex items-center gap-4">
                  <button
                    type="button"
                    onClick={handleToggle}
                    className="text-[12px] text-gray-600 hover:text-gray-800"
                  >
                    {taxEnabled ? "Disable Tax" : "Enable Tax"}
                  </button>
                  <button className="flex items-center gap-1 text-[12px] text-gray-600 hover:text-gray-800">
                    <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" /></svg>
                    Find Accountants
                  </button>
                </div>
              </div>

              <div className="bg-white border border-[#ebeaf1] rounded-lg px-6 py-5">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-[13px] font-medium text-gray-900" style={{ fontFamily: "'Inter:Medium', sans-serif" }}>
                      Enable Tax Return Filing
                    </h3>
                    <p className="text-[11px] text-[#6d7188] leading-5 mt-0.5">
                      Turn on direct tax filing to manage your questionnaire, nexus regions, and eligible forms for this business.
                    </p>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0 ml-6">
                    {taxEnabled && (
                      <span className="text-[10px] text-green-600 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full font-medium" style={{ fontFamily: "'Inter:Medium', sans-serif" }}>
                        Enabled
                      </span>
                    )}
                    <Toggle checked={taxEnabled} onChange={handleToggle} />
                  </div>
                </div>

              </div>

              {taxEnabled && (
                <div className="space-y-6 mt-6">
                  <OverviewFpoaSection
                    fpoaStatus={fpoaStatus}
                    onSign={handleFpoaSign}
                  />
                  <QuestionnaireLauncher
                    answers={questionnaireAnswers}
                    onOpen={() => setShowQuestionnaireModal(true)}
                  />
                  {fpoaStatus === "processing" ? (
                    <ConfigureTaxReturnSection
                      regions={regions}
                      enabled={true}
                      onAddRegion={() => setShowTaxReturnSetupModal(true)}
                      onOpenRegion={openRegionSetup}
                    />
                  ) : (
                    <div className="bg-white border border-dashed border-[#d7d9e4] rounded-lg px-6 py-10 text-center">
                      <h3 className="text-[14px] font-medium text-gray-900" style={{ fontFamily: "'Inter:Medium', sans-serif" }}>
                        Complete the FPOA step to unlock tax return setup
                      </h3>
                      <p className="text-[11px] text-[#6d7188] mt-2">
                        Sign the FPOA to enable the configure tax return flow for this business.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </>
          ) : selectedRegion ? (
            <RegionSetupPage
              region={selectedRegion}
              onBack={() => {
                setPage("overview");
                setSelectedRegionId(null);
              }}
              onQuestionnaireChange={handleSelectedRegionQuestionnaireChange}
              onComplete={handleWizardComplete}
            />
          ) : null}
        </div>

        {/* Bottom bar */}
        <div className="border-t border-gray-200 bg-white px-4 py-2 flex items-center justify-between">
          <p className="text-[11px] text-gray-500">Here is your Smart Chat (Ctrl+Space)</p>
          <div className="flex items-center gap-4">
            <span className="text-[10px] text-gray-400">Mon to Fri 9:00AM - 9:00PM ET</span>
            <button className="bg-blue-600 text-white text-[11px] px-3 py-1 rounded flex items-center gap-1">
              <svg viewBox="0 0 24 24" className="w-3 h-3 fill-current"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z" /></svg>
              Chat with our experts
            </button>
          </div>
        </div>
      </div>

      {showQuestionnaireModal && (
        <QuestionnaireModal
          answers={questionnaireAnswers}
          onChange={setQuestionnaireAnswers}
          onClose={() => setShowQuestionnaireModal(false)}
        />
      )}

      {showTaxReturnSetupModal && (
        <TaxReturnSetupModal
          answers={questionnaireAnswers}
          onSave={handleTaxReturnSetupSave}
          onCancel={() => setShowTaxReturnSetupModal(false)}
        />
      )}

      {/* Toast */}
      {toastMessage && (
        <Toast
          message={toastMessage}
          onDone={() => setToastMessage(null)}
        />
      )}
    </div>
  );
}
