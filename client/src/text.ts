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
