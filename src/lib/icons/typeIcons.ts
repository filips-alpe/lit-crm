// Authoritative icon-name pool for dicebear's `icons` style (7.x).
// Source: https://cdn.jsdelivr.net/npm/@dicebear/icons@7.2.0/lib/schema.js
// — every name here is guaranteed to render via `?icon=<name>`.

import { humanizeIdentifier } from '$lib/utils/humanize';

export const TYPE_ICONS = [
  'alarm',
  'archive',
  'award',
  'bag',
  'bandaid',
  'bank',
  'basket',
  'basket2',
  'basket3',
  'bell',
  'bicycle',
  'binoculars',
  'book',
  'bookshelf',
  'boombox',
  'boxSeam',
  'box',
  'boxes',
  'bricks',
  'briefcase',
  'brightnessHigh',
  'brush',
  'bucket',
  'bug',
  'building',
  'calculator',
  'cameraReels',
  'camera',
  'cart2',
  'cashCoin',
  'clock',
  'cloudDrizzle',
  'cloudMoon',
  'cloudSnow',
  'cloud',
  'clouds',
  'coin',
  'compass',
  'controller',
  'cupStraw',
  'cup',
  'dice5',
  'disc',
  'display',
  'doorClosed',
  'doorOpen',
  'dpad',
  'droplet',
  'easel',
  'eggFried',
  'egg',
  'emojiHeartEyes',
  'emojiLaughing',
  'emojiSmileUpsideDown',
  'emojiSmile',
  'emojiSunglasses',
  'emojiWink',
  'envelope',
  'eyeglasses',
  'flag',
  'flower1',
  'flower2',
  'flower3',
  'gem',
  'gift',
  'globe',
  'globe2',
  'handThumbsUp',
  'handbag',
  'hdd',
  'heart',
  'hourglassSplit',
  'hourglass',
  'houseDoor',
  'house',
  'inbox',
  'inboxes',
  'key',
  'keyboard',
  'ladder',
  'lamp',
  'laptop',
  'lightbulb',
  'lightningCharge',
  'lightning',
  'lock',
  'magic',
  'mailbox',
  'map',
  'megaphone',
  'minecartLoaded',
  'minecart',
  'moonStars',
  'moon',
  'mortarboard',
  'mouse',
  'mouse2',
  'newspaper',
  'paintBucket',
  'palette',
  'palette2',
  'paperclip',
  'pen',
  'pencil',
  'phone',
  'piggyBank',
  'pinAngle',
  'plug',
  'printer',
  'projector',
  'puzzle',
  'router',
  'scissors',
  'sdCard',
  'search',
  'send',
  'shopWindow',
  'shop',
  'signpost2',
  'signpostSplit',
  'signpost',
  'smartwatch',
  'snow',
  'snow2',
  'snow3',
  'speaker',
  'star',
  'stoplights',
  'stopwatch',
  'sun',
  'tablet',
  'thermometer',
  'ticketPerforated',
  'tornado',
  'trash',
  'trash2',
  'tree',
  'trophy',
  'truckFlatbed',
  'truck',
  'tsunami',
  'umbrella',
  'wallet',
  'wallet2',
  'watch',
  'webcam',
] as const;

export type TypeIcon = (typeof TYPE_ICONS)[number];

function isKnownIcon(value: string | null | undefined): value is TypeIcon {
  return !!value && (TYPE_ICONS as readonly string[]).includes(value);
}

export function iconUrl(
  iconSeed: string | null | undefined,
  fallbackSeed: string,
  hex: string,
): string {
  const query = isKnownIcon(iconSeed)
    ? `icon=${encodeURIComponent(iconSeed)}`
    : `seed=${encodeURIComponent(iconSeed ?? fallbackSeed)}`;
  return `https://api.dicebear.com/7.x/icons/svg?${query}&backgroundColor=${hex}&radius=0`;
}

export const humanizeIconName = humanizeIdentifier;

// Fisher–Yates: returns `count` distinct names drawn from the pool with
// names in `exclude` removed first. Used so re-shuffling never resurfaces
// an icon that's already on screen.
export function sampleIcons(count: number, exclude: Iterable<string> = []): TypeIcon[] {
  const excluded = new Set(exclude);
  const pool = TYPE_ICONS.filter((n) => !excluded.has(n));
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, count);
}
