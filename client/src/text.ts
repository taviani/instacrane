import type { Note } from './types';

export function runes(value: string): number {
  return Array.from(value).length;
}

export function cursor(createdAt: string, id: string): string {
  return `${createdAt}|${id}`;
}

export function noteText(note: Note): string {
  const who = note.actor.username || 'Quelqu’un';
  if (note.type === 'like') return `${who} a aimé une publication`;
  if (note.type === 'comment') return `${who} a commenté une publication`;
  return `${who} a demandé à vous suivre`;
}

export function placeText(latitude: number, longitude: number): string {
  return `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
}

export function ago(iso: string, now = Date.now()): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const minutes = Math.round(Math.max(0, now - then) / 60000);
  if (minutes < 1) return 'à l’instant';
  if (minutes < 60) return minutes === 1 ? 'il y a 1 minute' : `il y a ${minutes} minutes`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return hours === 1 ? 'il y a 1 heure' : `il y a ${hours} heures`;
  const days = Math.round(hours / 24);
  if (days < 7) return days === 1 ? 'il y a 1 jour' : `il y a ${days} jours`;
  const weeks = Math.round(days / 7);
  if (weeks < 5) return weeks === 1 ? 'il y a une semaine' : `il y a ${weeks} semaines`;
  const months = Math.round(days / 30);
  if (months < 12) return months <= 1 ? 'il y a un mois' : `il y a ${months} mois`;
  const years = Math.round(days / 365);
  return years <= 1 ? 'il y a un an' : `il y a ${years} ans`;
}
