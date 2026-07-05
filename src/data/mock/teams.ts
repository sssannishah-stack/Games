import type { Team } from "@/types";

/* Preview-only mock data — replaced by MongoDB later. */

export const mockTeams: Team[] = [
  {
    id: "mango",
    name: "Mango",
    color: "#F5A93D",
    score: 120,
    rank: 1,
    previousRank: 2,
    status: "ready",
    statusDetail: "at mic · awaiting host call",
    progress: 92,
    members: [
      { id: "m1", name: "Rohan", initial: "R", gradient: "linear-gradient(135deg,#F5A93D,#E8A33D)" },
      { id: "m2", name: "Isha", initial: "I", gradient: "linear-gradient(135deg,#E8C84A,#F5A93D)" },
    ],
  },
  {
    id: "chai",
    name: "Chai",
    color: "#C98A5E",
    score: 115,
    rank: 2,
    status: "requesting",
    statusDetail: "requested Hint",
    streak: 3,
    accuracy: 82,
    mentor: "Ravi uncle",
    progress: 90,
    members: [
      { id: "c1", name: "Meera", initial: "M", gradient: "linear-gradient(135deg,#C98A5E,#E8C84A)", isCaptain: true },
      { id: "c2", name: "Arjun", initial: "A", gradient: "linear-gradient(135deg,#5EC9E8,#6C7BFA)" },
      { id: "c3", name: "Diya", initial: "D", gradient: "linear-gradient(135deg,#B98AE8,#E36A8A)" },
      { id: "c4", name: "Kabir", initial: "K", gradient: "linear-gradient(135deg,#3DD68C,#2FBFA7)" },
    ],
  },
  {
    id: "ladoo",
    name: "Ladoo",
    color: "#E8C84A",
    score: 90,
    rank: 3,
    status: "ready",
    statusDetail: "hand raised",
    progress: 71,
    members: [
      { id: "l1", name: "Anaya", initial: "A", gradient: "linear-gradient(135deg,#E8C84A,#F5B93D)" },
    ],
  },
  {
    id: "kites",
    name: "Kites",
    color: "#5EC9E8",
    score: 85,
    rank: 4,
    previousRank: 3,
    status: "active_power_card",
    statusDetail: "extra time active · 0:07 left",
    progress: 64,
    members: [
      { id: "k1", name: "Veer", initial: "V", gradient: "linear-gradient(135deg,#5EC9E8,#7EB5F0)" },
    ],
  },
  {
    id: "stars",
    name: "Stars",
    color: "#B98AE8",
    score: 60,
    rank: 5,
    status: "offline",
    statusDetail: "offline · reconnecting",
    progress: 52,
    members: [
      { id: "s1", name: "Diya", initial: "D", gradient: "linear-gradient(135deg,#B98AE8,#E36A8A)" },
    ],
  },
  {
    id: "rockets",
    name: "Rockets",
    color: "#E36A8A",
    score: 55,
    rank: 6,
    status: "idle",
    progress: 43,
    members: [
      { id: "r1", name: "Aarav", initial: "A", gradient: "linear-gradient(135deg,#E36A8A,#B98AE8)" },
    ],
  },
];

export const getTeam = (id: string) => mockTeams.find((t) => t.id === id);
