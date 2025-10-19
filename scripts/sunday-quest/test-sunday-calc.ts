import { startOfWeek } from "date-fns";

function getCurrentSundayOld(): Date {
  const now = new Date();
  const sunday = startOfWeek(now, { weekStartsOn: 0 });
  sunday.setUTCHours(0, 0, 0, 0);
  return sunday;
}

function getCurrentSundayNew(): Date {
  const now = new Date();
  const dayOfWeek = now.getUTCDay();
  const sunday = new Date(now);
  sunday.setUTCDate(now.getUTCDate() - dayOfWeek);
  sunday.setUTCHours(0, 0, 0, 0);
  return sunday;
}

console.log("Current time:", new Date().toISOString());
console.log("Day of week (UTC):", new Date().getUTCDay(), "(0=Sun, 1=Mon, etc.)");
console.log("\nOld method (startOfWeek):", getCurrentSundayOld().toISOString());
console.log("New method (manual calc):", getCurrentSundayNew().toISOString());
