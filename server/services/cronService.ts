import type { Db } from '../db';
import type { MemberRow } from '../db/entities';
import { getPaymentTolerance } from './loanService';
import { NotificationService } from './notificationService';

export async function processDueDatesJob(
  database: Db
): Promise<{ processed: number; sent: number }> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const todayStr = today.toISOString().split('T')[0];

  const threeDaysFromNow = new Date(today);
  threeDaysFromNow.setDate(today.getDate() + 3);
  const threeDaysStr = threeDaysFromNow.toISOString().split('T')[0];

  const tolerance = getPaymentTolerance();

  const schedules = (await database
    .query(
      `SELECT ls.id, ls.loanId, ls.installmentNo, ls.dueDate, ls.principalAmount, ls.interestAmount, l.memberId 
       FROM loan_schedules ls
       JOIN loans l ON ls.loanId = l.id
       WHERE ls.status != 'Paid' 
         AND (COALESCE(ls.principalAmount, 0) + COALESCE(ls.interestAmount, 0) + COALESCE(ls.lateFee, 0) - COALESCE(ls.paidAmount, 0)) > ?
         AND l.deletedAt IS NULL`
    )
    .all(tolerance)) as any[];

  let processedCount = 0;
  let sentCount = 0;

  for (const schedule of schedules) {
    const scheduleDate = new Date(schedule.dueDate);
    scheduleDate.setHours(0, 0, 0, 0);
    const scheduleDateStr = scheduleDate.toISOString().split('T')[0];

    let type: 'due_in_3_days' | 'due_today' | 'overdue' | null = null;

    if (scheduleDateStr === threeDaysStr) {
      type = 'due_in_3_days';
    } else if (scheduleDateStr === todayStr) {
      type = 'due_today';
    } else if (scheduleDate < today) {
      type = 'overdue';
    }

    if (type) {
      processedCount++;

      const member = await database
        .query("SELECT * FROM members WHERE id = ? AND deletedAt IS NULL")
        .get<MemberRow>(schedule.memberId);

      if (member) {
        const alreadySent = await NotificationService.hasBeenSent(schedule.id, type);
        if (!alreadySent) {
          await NotificationService.notifySchedule(member, schedule, type);
          sentCount++;
        }
      }
    }
  }

  return { processed: processedCount, sent: sentCount };
}
