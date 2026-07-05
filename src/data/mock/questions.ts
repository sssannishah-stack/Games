import type { Question, QuestionAccuracy, TeamPerformance, AnalyticsHighlight, Competition } from "@/types";

/* Preview-only mock data — replaced by MongoDB later. */

export const mockQuestions: Question[] = [
  {
    id: "q-0031",
    emoji: "🍿",
    title: "Guess the movie — 🍿🎬😱",
    subtitle: "edited 2h ago · हिंदी + English",
    type: "Prompt",
    marks: "Host judged",
    usedIn: "Game Night",
    active: true,
    options: [
      { key: "A", label: "Sholay" },
      { key: "B", label: "Bhool Bhulaiyaa" },
      { key: "C", label: "Hera Pheri" },
      { key: "D", label: "Dhamaal" },
    ],
  },
  {
    id: "q-0032",
    emoji: "🎵",
    title: "Guess the song from 5-second beat",
    subtitle: "audio clip · 0:05",
    type: "Audio",
    marks: "+15",
    usedIn: "Antakshari",
  },
  {
    id: "q-0033",
    emoji: "🖼️",
    title: "Chitra thi geet — sing from the picture",
    subtitle: "image · blur reveal ON",
    type: "Image",
    marks: "+20",
    usedIn: "Antakshari",
  },
  {
    id: "q-0034",
    emoji: "⚡",
    title: "Name 5 sweets that start with “L”",
    subtitle: "10s timer · sudden death",
    type: "Rapid Fire",
    marks: "+5",
    usedIn: "3 events",
  },
  {
    id: "q-0035",
    emoji: "🔍",
    title: "Zoom reveal — guess the temple",
    subtitle: "4 zoom steps",
    type: "Zoom",
    marks: "+10",
    usedIn: "Paryushan",
  },
  {
    id: "q-0036",
    emoji: "🎨",
    title: "Draw & guess — “monsoon”",
    subtitle: "canvas · 60s · live sync",
    type: "Drawing",
    marks: "+15",
    usedIn: "—",
  },
];

export const questionFilters = [
  { label: "All", count: null },
  { label: "🎵 Guess Song", count: 38 },
  { label: "😀 Emoji", count: 26 },
  { label: "⚡ Rapid Fire", count: 41 },
  { label: "🎨 Drawing", count: 12 },
  { label: "🔍 Zoom Reveal", count: 9 },
];

export const mockCompetitions: Competition[] = [
  {
    id: "cmp1",
    name: "Sharma Family Game Night",
    icon: "sparkles",
    iconColor: "#6C7BFA",
    date: "Sat, Jul 5 · 7:30 PM",
    meta: "6 teams · 24 scenes · 4 rounds",
    status: "Live",
  },
  {
    id: "cmp2",
    name: "Summer Camp Quiz",
    icon: "tent",
    iconColor: "#2FBFA7",
    date: "Jul 12",
    meta: "4 rooms · draft",
    status: "Draft",
  },
  {
    id: "cmp3",
    name: "Paryushan Quiz",
    icon: "music-4",
    iconColor: "#E8A33D",
    date: "Aug 20",
    meta: "not started",
    status: "Idea",
  },
];

/* ── analytics ── */

export const mockAccuracy: QuestionAccuracy[] = [
  { label: "Q1", correct: 6, total: 6 },
  { label: "Q2", correct: 5, total: 6 },
  { label: "Q3", correct: 4, total: 6 },
  { label: "Q4", correct: 5, total: 6 },
  { label: "Q5", correct: 3, total: 6 },
  { label: "Q6", correct: 4, total: 6 },
  { label: "Q7", correct: 1, total: 6 },
];

export const mockTeamPerformance: TeamPerformance[] = [
  { teamId: "mango", percent: 88 },
  { teamId: "chai", percent: 82 },
  { teamId: "ladoo", percent: 71 },
  { teamId: "kites", percent: 64 },
  { teamId: "stars", percent: 52 },
];

export const mockHighlights: AnalyticsHighlight[] = [
  {
    icon: "flame",
    iconColor: "#FF8383",
    label: "HARDEST QUESTION",
    title: "Q7 · Zoom reveal — temple",
    detail: "1 of 6 correct · avg 17.4s",
    barPercent: 17,
    barColor: "#FF8383",
  },
  {
    icon: "zap",
    iconColor: "#F5B93D",
    label: "FASTEST TEAM",
    title: "Mango · 5.8s average",
    detail: "fastest single: 2.3s on Q4",
    barPercent: 86,
    barColor: "#F5B93D",
  },
  {
    icon: "sparkles",
    iconColor: "#6C7BFA",
    label: "MOST LIFELINES",
    title: "Kites · 6 used",
    detail: "3 freeze · 2 hint · 1 shield",
    barPercent: 64,
    barColor: "#6C7BFA",
  },
  {
    icon: "trending-up",
    iconColor: "#3DD68C",
    label: "HIGHEST COMBO",
    title: "Chai · 5 in a row",
    detail: "Q2 → Q6 · earned +10 combo",
    barPercent: 71,
    barColor: "#3DD68C",
  },
];
