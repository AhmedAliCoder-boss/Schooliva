"use client";

import { useEffect, useState } from "react";

function greetingFor(hour: number) {
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  if (hour < 21) return "Good evening";
  return "Good night";
}

function pakistanHour(date: Date) {
  const hourPart = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Karachi", hour: "numeric", hour12: false }).formatToParts(date).find((part) => part.type === "hour");
  return Number(hourPart?.value ?? 0);
}

export function LiveGreeting({ firstName }: { firstName: string }) {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    const update = () => setNow(new Date());
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, []);

  const greeting = now ? greetingFor(pakistanHour(now)) : "Welcome back";

  return <div className="dashboard-live-greeting"><h1>{greeting}, {firstName}.</h1></div>;
}
