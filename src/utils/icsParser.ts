import { Student, Booking } from '../types';

export interface ParsedIcsEvent {
  uid: string;
  summary: string;
  description?: string;
  startUtc: string;
  endUtc: string;
  durationMinutes: number;
  status: 'scheduled' | 'cancelled';
  matchedStudentId?: string;
  matchedStudentName?: string;
}

// Helper to parse ICS date string (e.g. 20261025T140000Z or 20261025T140000 or 20261025)
export function parseIcsDate(rawDateStr: string, tzid?: string): Date {
  const clean = rawDateStr.trim();

  // Format: YYYYMMDDTHHMMSSZ (UTC)
  if (clean.endsWith('Z')) {
    const year = parseInt(clean.substring(0, 4), 10);
    const month = parseInt(clean.substring(4, 6), 10) - 1;
    const day = parseInt(clean.substring(6, 8), 10);
    const hour = parseInt(clean.substring(9, 11), 10);
    const min = parseInt(clean.substring(11, 13), 10);
    const sec = parseInt(clean.substring(13, 15), 10) || 0;
    return new Date(Date.UTC(year, month, day, hour, min, sec));
  }

  // Format: YYYYMMDDTHHMMSS (local time or with TZID)
  if (clean.includes('T')) {
    const year = parseInt(clean.substring(0, 4), 10);
    const month = parseInt(clean.substring(4, 6), 10) - 1;
    const day = parseInt(clean.substring(6, 8), 10);
    const hour = parseInt(clean.substring(9, 11), 10);
    const min = parseInt(clean.substring(11, 13), 10);
    const sec = parseInt(clean.substring(13, 15), 10) || 0;

    // Use current environment's local timezone or explicit UTC
    return new Date(year, month, day, hour, min, sec);
  }

  // Format: YYYYMMDD (all day)
  if (clean.length >= 8) {
    const year = parseInt(clean.substring(0, 4), 10);
    const month = parseInt(clean.substring(4, 6), 10) - 1;
    const day = parseInt(clean.substring(6, 8), 10);
    return new Date(Date.UTC(year, month, day, 9, 0, 0));
  }

  return new Date();
}

// Unfold lines per RFC 5545 (lines starting with space or tab continue previous line)
function unfoldIcsLines(rawIcs: string): string[] {
  const lines = rawIcs.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const unfolded: string[] = [];

  for (const line of lines) {
    if (line.startsWith(' ') || line.startsWith('\t')) {
      if (unfolded.length > 0) {
        unfolded[unfolded.length - 1] += line.substring(1);
      }
    } else if (line.trim().length > 0) {
      unfolded.push(line);
    }
  }

  return unfolded;
}

// Parse entire ICS file content
export function parseIcsCalendar(icsContent: string, knownStudents: Student[] = []): ParsedIcsEvent[] {
  const lines = unfoldIcsLines(icsContent);
  const events: ParsedIcsEvent[] = [];

  let inEvent = false;
  let currentEvent: Partial<{
    uid: string;
    summary: string;
    description: string;
    dtstart: string;
    dtend: string;
    status: string;
  }> = {};

  for (const line of lines) {
    if (line.startsWith('BEGIN:VEVENT')) {
      inEvent = true;
      currentEvent = {};
      continue;
    }

    if (line.startsWith('END:VEVENT')) {
      inEvent = false;
      if (currentEvent.uid && currentEvent.dtstart) {
        const startDate = parseIcsDate(currentEvent.dtstart);
        let endDate: Date;

        if (currentEvent.dtend) {
          endDate = parseIcsDate(currentEvent.dtend);
        } else {
          // Default duration: 50 minutes
          endDate = new Date(startDate.getTime() + 50 * 60000);
        }

        const durationMinutes = Math.max(15, Math.round((endDate.getTime() - startDate.getTime()) / 60000));
        const summary = currentEvent.summary || 'Cours de français';
        const description = currentEvent.description || '';
        const isCancelled = (currentEvent.status || '').toUpperCase() === 'CANCELLED';

        // Auto-match student if student name appears in summary or description
        let matchedStudentId: string | undefined = undefined;
        let matchedStudentName: string | undefined = undefined;

        for (const s of knownStudents) {
          const nameLower = s.name.toLowerCase();
          if (
            summary.toLowerCase().includes(nameLower) ||
            description.toLowerCase().includes(nameLower)
          ) {
            matchedStudentId = s.id;
            matchedStudentName = s.name;
            break;
          }
        }

        events.push({
          uid: currentEvent.uid,
          summary,
          description,
          startUtc: startDate.toISOString(),
          endUtc: endDate.toISOString(),
          durationMinutes,
          status: isCancelled ? 'cancelled' : 'scheduled',
          matchedStudentId,
          matchedStudentName,
        });
      }
      continue;
    }

    if (!inEvent) continue;

    // Property parsing
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;

    const propHeader = line.substring(0, colonIdx);
    const propValue = line.substring(colonIdx + 1).trim();

    if (propHeader === 'UID') {
      currentEvent.uid = propValue;
    } else if (propHeader === 'SUMMARY') {
      currentEvent.summary = propValue.replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\n/g, ' ');
    } else if (propHeader === 'DESCRIPTION') {
      currentEvent.description = propValue.replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\n/g, '\n');
    } else if (propHeader.startsWith('DTSTART')) {
      currentEvent.dtstart = propValue;
    } else if (propHeader.startsWith('DTEND')) {
      currentEvent.dtend = propValue;
    } else if (propHeader === 'STATUS') {
      currentEvent.status = propValue;
    }
  }

  return events;
}

// Detect overlapping bookings (PRD Section 3.4: "Overlapping bookings show a warning")
export function detectOverlappingBookings(bookings: Booking[]): Map<string, string[]> {
  const overlapMap = new Map<string, string[]>();
  const activeBookings = bookings.filter((b) => !b.deleted && b.status === 'scheduled');

  for (let i = 0; i < activeBookings.length; i++) {
    for (let j = i + 1; j < activeBookings.length; j++) {
      const a = activeBookings[i];
      const b = activeBookings[j];

      const startA = new Date(a.startUtc).getTime();
      const endA = new Date(a.endUtc).getTime();
      const startB = new Date(b.startUtc).getTime();
      const endB = new Date(b.endUtc).getTime();

      // Overlap condition: startA < endB && startB < endA
      if (startA < endB && startB < endA) {
        if (!overlapMap.has(a.id)) overlapMap.set(a.id, []);
        if (!overlapMap.has(b.id)) overlapMap.set(b.id, []);
        overlapMap.get(a.id)!.push(b.id);
        overlapMap.get(b.id)!.push(a.id);
      }
    }
  }

  return overlapMap;
}

