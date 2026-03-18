import {
  AnnouncementSeverity,
  AnnouncementTargetScreen,
  StickyAnnouncement,
  subscribeStickyAnnouncements,
} from './announcementsService';

export type CommunicationSurface = AnnouncementTargetScreen;

export interface StickyInboxItem {
  id: string;
  kind: 'announcement';
  title: string;
  body: string;
  severity: AnnouncementSeverity;
  isPinned: boolean;
  startsAt?: Date | null;
  endsAt?: Date | null;
}

export function mapAnnouncementToStickyInboxItem(item: StickyAnnouncement): StickyInboxItem {
  return {
    id: item.id,
    kind: 'announcement',
    title: item.title,
    body: item.body,
    severity: item.severity,
    isPinned: item.isPinned,
    startsAt: item.startsAt,
    endsAt: item.endsAt,
  };
}

export function subscribeStickyInboxItems(
  surface: CommunicationSurface,
  callback: (items: StickyInboxItem[]) => void
): () => void {
  return subscribeStickyAnnouncements(surface, (items) => {
    callback(items.map(mapAnnouncementToStickyInboxItem));
  });
}