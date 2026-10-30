function todayIsoDate(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function getEndOfMonth(year: number, month1Indexed: number): string {
  const d = new Date(year, month1Indexed, 0);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function isEndOfMonthStr(dateStr: string): boolean {
  const parts = dateStr.split('-').map(Number);
  if (parts.length !== 3) return false;
  const [year, month, day] = parts;
  const maxDay = new Date(year, month, 0).getDate();
  return day === maxDay;
}

export function getDefaultFirstDueDate(approvedDateStr: string): string {
  const parts = approvedDateStr.split('-').map(Number);
  if (parts.length !== 3) return todayIsoDate();
  const [year, month, day] = parts;
  if (day <= 20) {
    return getEndOfMonth(year, month);
  }
  return getEndOfMonth(year, month + 1);
}

export function computeScheduleDueDates(firstDueDateStr: string, tenorMonths: number): string[] {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(firstDueDateStr);
  if (!match) return [];
  const startYear = Number(match[1]);
  const startMonth = Number(match[2]);
  const startDay = Number(match[3]);
  const isEOM = isEndOfMonthStr(firstDueDateStr);

  const dates: string[] = [];
  for (let k = 0; k < tenorMonths; k++) {
    const targetMonth0 = (startMonth - 1) + k;
    const y = startYear + Math.floor(targetMonth0 / 12);
    const m = (targetMonth0 % 12) + 1;

    if (isEOM) {
      dates.push(getEndOfMonth(y, m));
    } else {
      const maxDaysInM = new Date(y, m, 0).getDate();
      const clampedDay = Math.min(startDay, maxDaysInM);
      const mm = String(m).padStart(2, '0');
      const dd = String(clampedDay).padStart(2, '0');
      dates.push(`${y}-${mm}-${dd}`);
    }
  }
  return dates;
}
