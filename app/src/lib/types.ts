// ViolaHub shared domain + state types. The contract every module consumes.

export type Device = 'phone' | 'ipad';
export type Tab = 'home' | 'music' | 'practice' | 'learn' | 'profile';
export type Sub = null | 'sheet' | 'trans' | 'browse' | 'course' | 'lesson';
export type HomeVariant = 'a' | 'b' | 'c';
export type Plan = 'Free plan' | 'Subscriber';
export type PracticeTool = 'met' | 'tun' | 'dro' | 'sr';
export type AnnTool = 'select' | 'fing' | 'bow' | 'pen';
export type BowDir = 'up' | 'dn';
export type Browse = 'comm' | 'pro';
export type Overlay = null | 'met' | 'tun';
export type LearnTab = 'crs' | 'prg';
export type TransSource = 'file' | 'yt' | 'rec';
export type RecState = 'idle' | 'recording' | 'analyzing' | 'done';
export type MetMenu = null | 'ts' | 'acc' | 'sound';
export type SrMenu = null | 'key' | 'nv' | 'ts';

export interface Piece {
  t: string;   // title
  s: string;   // subtitle / movement / meta
  star?: string;
}

export interface RecentItem {
  t: string;
  s: string;
}

export interface Mark {
  x: number;
  y: number;
  sym: string;
}

export interface Stroke {
  pts: string; // "x,y x,y ..."
}

export type LessonType = 'quiz' | 'audio';
export type Skill = 'shifting' | 'vibrato' | 'intonation' | 'bow' | 'tuning' | 'reading';

export interface Lesson {
  t: string;
  d: string;               // duration label
  type: LessonType;
  skill?: Skill;
  q?: string;              // quiz question
  opts?: string[];         // quiz options
  a?: number;              // quiz answer index
  markMeasure?: number;
  excerpt?: string;
  target?: string;
  idx?: number;
  course?: string;
}

export interface Course {
  t: string;
  s: string;
  lessons: Lesson[];
}

export interface Feedback {
  score: number;
  strengths: string[];
  work: string[];
}

export interface FeedbackBank {
  strengths: string[];
  work: string[];
}

export interface Toast {
  msg: string;
}

export interface BrowseEntry {
  t: string;
  s: string;
  cta: string;
  cls: string;
}
