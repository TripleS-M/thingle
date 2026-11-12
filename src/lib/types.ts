// Shared types (safe to import from both server and client code).

export type Difficulty = 'easy' | 'medium' | 'hard' | 'expert';
export type AssetStatus = 'review' | 'approved' | 'rejected' | 'archived';
export type HintType = 'category' | 'function' | 'rotation';
export type GameMode = 'daily' | 'practice' | 'preview';
export type PlayStatus = 'playing' | 'won' | 'lost';

export const DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard', 'expert'];
export const CATEGORIES = [
  'Automotive', 'Motorsport', 'Aerospace', 'Technology', 'Electronics', 'Gaming',
  'Industrial machinery', 'Medical equipment', 'Biology', 'Architecture', 'Robotics',
  'Photography', 'Animals', 'Other',
];

/** Camera pose in degrees around the normalised model (centre at origin, radius 1). */
export interface CameraPose {
  az: number;   // azimuth around the vertical axis
  el: number;   // elevation above the horizon (-89..89)
  roll: number; // rotation of the image around the view axis
  zoom: number; // 1 = fit bounding sphere with standard margin
}

export interface AssetMeta {
  displayName: string;
  answer: string;
  accepted: string[];
  category: string;
  subcategory: string;
  difficulty: Difficulty;
  description: string;
  hint1: string; // category reveal
  hint2: string; // function / context clue
  rotation: { h: number; v: number }; // rotation-hint allowance, degrees each way
  camera: CameraPose;
  shadow: boolean; // soft ground shadow under the silhouette
  background: string; // '' = default paper, or a light #rrggbb backdrop
  sourceSite: string;
  sourceUrl: string;
  creator: string;
  licence: string;
  attribution: string;
}

export interface AssetStats {
  triangles: number;
  vertices: number;
  size: [number, number, number];
  bytes: number;
  minArea: number; // smallest / largest silhouette coverage over sampled angles
  maxArea: number;
}

export interface Asset {
  id: string;
  hash: string;
  file: string;      // path relative to the asset library root
  format: string;    // glb | gltf | obj | stl
  status: AssetStatus;
  meta: AssetMeta;
  stats: AssetStats;
  dateAdded: string;
  dateLastUsed: string | null;
  fileMissing: boolean;
  /** Derived: names of required fields that are still empty. */
  missing: string[];
  /** Derived: dates this asset is scheduled on. */
  scheduled: string[];
}

export interface ScheduleEntry {
  date: string; // YYYY-MM-DD in the game timezone
  assetId: string;
  status: 'draft' | 'scheduled';
}

export interface Scoring {
  guessPoints: number[]; // points for solving on guess 1..n; length = max guesses
  hintCosts: Record<HintType, number>;
}

export interface Settings {
  timezone: string;
  scoring: Scoring;
}

export interface GameResult {
  answer: string;
  description: string;
  category: string;
  score: number;
  maxScore: number;
  share: string;
  credit: { creator: string; licence: string; sourceSite: string; sourceUrl: string; attribution: string };
}

/** Everything the player's browser is allowed to know about a puzzle. */
export interface GameState {
  mode: GameMode;
  key: string;            // date (daily / practice) or asset id (preview)
  number: number | null;  // puzzle number
  date: string | null;
  difficulty: Difficulty;
  model: string;          // opaque model URL
  camera: CameraPose;
  rotation: { h: number; v: number };
  shadow: boolean;
  background: string;
  maxGuesses: number;
  guesses: string[];
  status: PlayStatus;
  hints: { category: string | null; function: string | null; rotation: boolean };
  scoring: Scoring;
  result: GameResult | null;
}

export interface PlayerStats {
  played: number;
  won: number;
  winPct: number;
  currentStreak: number;
  maxStreak: number;
  avgGuesses: number;
  avgScore: number;
  totalHints: number;
  hintCounts: Record<HintType, number>;
  mostUsedHint: HintType | null;
  distribution: number[]; // wins by guess count, plus losses in the last slot
}

/** Backdrops must stay light so the black silhouette keeps its contrast. */
export function isLightBackground(v: string): boolean {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(v);
  return !!m && m.slice(1).every((c) => parseInt(c, 16) >= 0x90);
}

export const DEFAULT_CAMERA: CameraPose = { az: 35, el: 20, roll: 0, zoom: 1 };

export const DEFAULT_SETTINGS: Settings = {
  timezone: 'Australia/Melbourne',
  scoring: {
    guessPoints: [500, 400, 300, 200, 100],
    hintCosts: { category: 50, function: 100, rotation: 100 },
  },
};

export function emptyMeta(): AssetMeta {
  return {
    displayName: '', answer: '', accepted: [], category: '', subcategory: '',
    difficulty: 'hard', description: '', hint1: '', hint2: '',
    rotation: { h: 30, v: 15 }, camera: { ...DEFAULT_CAMERA }, shadow: false, background: '',
    sourceSite: '', sourceUrl: '', creator: '', licence: '', attribution: '',
  };
}

/** Difficulty feedback scale, 1..7. */
export const RATING_LABELS = ['Extremely easy', 'Very easy', 'Easy', 'About right', 'Hard', 'Very hard', 'Extremely hard'];
