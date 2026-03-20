export const FUEL_TYPES: Record<string, string> = {
  diesel: "ดีเซล",
  diesel_b7: "ดีเซล B7",
  diesel_premium: "ดีเซลพรีเมียม",
  diesel_vpower: "V-Power Diesel",
  gasohol95: "แก๊สโซฮอล์ 95",
  gasohol91: "แก๊สโซฮอล์ 91",
  gasohol95_premium: "แก๊สโซฮอล์ 95 พรีเมียม",
  gasohol97_premium: "แก๊สโซฮอล์ 97",
  gasohol95_power: "Gasohol 95 Power",
  benzene95: "เบนซิน 95",
  e20: "E20",
  e85: "E85",
  ngv: "NGV",
  lpg: "LPG",
};

export const FUEL_STATUS: Record<string, { label: string; color: string; bg: string }> = {
  available: { label: "มีน้ำมัน", color: "text-green-700 dark:text-green-400", bg: "bg-green-100 dark:bg-green-900/30" },
  out: { label: "หมด", color: "text-red-700 dark:text-red-400", bg: "bg-red-100 dark:bg-red-900/30" },
  queue: { label: "คิวยาว", color: "text-amber-700 dark:text-amber-400", bg: "bg-amber-100 dark:bg-amber-900/30" },
};

export const BRAND_COLORS: Record<string, string> = {
  PTT: "#1e3a5f",
  Bangchak: "#00a651",
  Shell: "#fbce07",
  Esso: "#d71920",
  Caltex: "#ed1c24",
  PT: "#003f87",
  Susco: "#e85d26",
  IRPC: "#0072bc",
  Cosmo: "#7b2d8e",
  Petronas: "#00a19c",
  Pure: "#ff6b00",
  "อื่นๆ": "#6b7280",
};

export const BRAND_LIST = [
  "PTT", "Bangchak", "Shell", "Esso", "Caltex", "PT", "Susco", "IRPC", "Cosmo", "Petronas", "Pure", "อื่นๆ"
];

// Default center: Thailand overview
export const DEFAULT_CENTER: [number, number] = [13.7563, 100.5018]; // Bangkok
export const DEFAULT_ZOOM = 6; // Zoom to see all of Thailand
