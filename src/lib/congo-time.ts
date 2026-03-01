export const CONGO_TIMEZONE = "Africa/Kinshasa";
const CONGO_UTC_OFFSET_HOURS = 1;

type TimeZoneParts = {
  year: string;
  month: string;
  day: string;
  hour: string;
  minute: string;
};

const toTimeZoneParts = (date: Date, timeZone: string): TimeZoneParts => {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const partMap = formatter.formatToParts(date).reduce<Record<string, string>>((acc, part) => {
    if (part.type !== "literal") {
      acc[part.type] = part.value;
    }
    return acc;
  }, {});

  return {
    year: partMap.year || "",
    month: partMap.month || "",
    day: partMap.day || "",
    hour: partMap.hour || "00",
    minute: partMap.minute || "00",
  };
};

export const normalizeClockTime = (value?: string): string => {
  if (!value) {
    return "";
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }

  if (/^\d{4}$/.test(trimmed)) {
    return `${trimmed.slice(0, 2)}:${trimmed.slice(2, 4)}`;
  }

  const match = trimmed.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) {
    return "";
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    return "";
  }

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
};

export const convertLocalDateTimeToCongo = (date: string, time: string): { date: string; time: string } => {
  const normalizedTime = normalizeClockTime(time);
  if (!date || !normalizedTime) {
    return { date, time: normalizedTime || time };
  }

  const localDateTime = new Date(`${date}T${normalizedTime}:00`);
  if (Number.isNaN(localDateTime.getTime())) {
    return { date, time: normalizedTime };
  }

  const parts = toTimeZoneParts(localDateTime, CONGO_TIMEZONE);
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${parts.hour}:${parts.minute}`,
  };
};

export const parseCongoDateTime = (date?: string, time?: string): Date | undefined => {
  if (!date) {
    return undefined;
  }

  const normalizedTime = normalizeClockTime(time || "00:00") || "00:00";
  const dateMatch = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const timeMatch = normalizedTime.match(/^(\d{2}):(\d{2})$/);

  if (!dateMatch || !timeMatch) {
    return undefined;
  }

  const year = Number(dateMatch[1]);
  const month = Number(dateMatch[2]);
  const day = Number(dateMatch[3]);
  const hour = Number(timeMatch[1]);
  const minute = Number(timeMatch[2]);

  if ([year, month, day, hour, minute].some((value) => Number.isNaN(value))) {
    return undefined;
  }

  return new Date(Date.UTC(year, month - 1, day, hour - CONGO_UTC_OFFSET_HOURS, minute));
};