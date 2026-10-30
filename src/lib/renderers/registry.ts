import type { Component } from 'svelte';
import type { RendererDetailProps, RendererProps } from '$lib/render/props';
import * as m from '$lib/paraglide/messages.js';
import HeadlineCard from './headline/HeadlineCard.svelte';
import HeadlineRow from './headline/HeadlineRow.svelte';
import AmountCard from './amount/AmountCard.svelte';
import AmountRow from './amount/AmountRow.svelte';
import CorrespondenceCard from './correspondence/CorrespondenceCard.svelte';
import CorrespondenceRow from './correspondence/CorrespondenceRow.svelte';
import CorrespondenceDetail from './correspondence/CorrespondenceDetail.svelte';
import AirMailCard from './airmail/AirMailCard.svelte';
import AirMailRow from './airmail/AirMailRow.svelte';
import PostcardCard from './postcard/PostcardCard.svelte';
import PostcardRow from './postcard/PostcardRow.svelte';
import EventCard from './event/EventCard.svelte';
import EventRow from './event/EventRow.svelte';
import PublicationCard from './publication/PublicationCard.svelte';
import PublicationRow from './publication/PublicationRow.svelte';
import LetterOneCard from './letter-one/LetterOneCard.svelte';
import LetterOneRow from './letter-one/LetterOneRow.svelte';
import LetterTwoCard from './letter-two/LetterTwoCard.svelte';
import LetterTwoRow from './letter-two/LetterTwoRow.svelte';
import LetterThreeCard from './letter-three/LetterThreeCard.svelte';
import LetterThreeRow from './letter-three/LetterThreeRow.svelte';
import LetterFourCard from './letter-four/LetterFourCard.svelte';
import LetterFourRow from './letter-four/LetterFourRow.svelte';
import LetterFiveCard from './letter-five/LetterFiveCard.svelte';
import LetterFiveRow from './letter-five/LetterFiveRow.svelte';
import { extensionRenderers } from '$extensions/renderers';

/**
 * An installed record renderer. Renderers are defined in code (build time); a
 * Type selects one by `id` (or none → the default field rendering). A renderer
 * may supply a `card` and/or `row` component — whichever it omits falls back to
 * the default for that view. Both receive {@link RendererProps}.
 */
export interface RecordRenderer {
  id: string;
  name: string;
  card?: Component<RendererProps>;
  row?: Component<RendererProps>;
  /** Editable full-record view for the modal / detail route. Receives
   *  {@link RendererDetailProps}. Omit to fall back to the generic field detail. */
  detail?: Component<RendererDetailProps>;
  /** When true, the renderer owns the entire card/row — RecordCard/RecordRow
   *  render only the renderer, with no shared header/badge/avatar/date chrome.
   *  The renderer draws its own (via CardShell/RowShell). */
  fullBleed?: boolean;
}

export const recordRenderers: RecordRenderer[] = [
  {
    id: 'headline',
    get name() {
      return m.clear_left_ladybug_snip();
    },
    card: HeadlineCard,
    row: HeadlineRow,
    fullBleed: true,
  },
  {
    id: 'amount',
    get name() {
      return m.mild_wacky_termite_quiz();
    },
    card: AmountCard,
    row: AmountRow,
    fullBleed: true,
  },
  {
    id: 'correspondence',
    get name() {
      return m.best_fair_tiger_harbor();
    },
    card: CorrespondenceCard,
    row: CorrespondenceRow,
    detail: CorrespondenceDetail,
    fullBleed: true,
  },
  {
    id: 'airmail',
    get name() {
      return m.arable_sweet_whale_praise();
    },
    card: AirMailCard,
    row: AirMailRow,
    fullBleed: true,
  },
  {
    id: 'postcard',
    get name() {
      return m.these_any_shrike_bake();
    },
    card: PostcardCard,
    row: PostcardRow,
    fullBleed: true,
  },
  {
    id: 'event',
    get name() {
      return m.mealy_direct_dog_hint();
    },
    card: EventCard,
    row: EventRow,
    fullBleed: true,
  },
  {
    id: 'publication',
    get name() {
      return m.sweet_bald_termite_cuddle();
    },
    card: PublicationCard,
    row: PublicationRow,
    fullBleed: true,
  },
  // Five alternative looks for a letter. Each restyles the card + row but shares
  // the rich letter detail (body, route map, correspondence-thread navigation).
  {
    id: 'letter-one',
    get name() {
      return m.spare_spry_rook_create();
    },
    card: LetterOneCard,
    row: LetterOneRow,
    detail: CorrespondenceDetail,
    fullBleed: true,
  },
  {
    id: 'letter-two',
    get name() {
      return m.raw_blue_orangutan_dash();
    },
    card: LetterTwoCard,
    row: LetterTwoRow,
    detail: CorrespondenceDetail,
    fullBleed: true,
  },
  {
    id: 'letter-three',
    get name() {
      return m.ideal_maroon_elk_praise();
    },
    card: LetterThreeCard,
    row: LetterThreeRow,
    detail: CorrespondenceDetail,
    fullBleed: true,
  },
  {
    id: 'letter-four',
    get name() {
      return m.clean_plain_mouse_edit();
    },
    card: LetterFourCard,
    row: LetterFourRow,
    detail: CorrespondenceDetail,
    fullBleed: true,
  },
  {
    id: 'letter-five',
    get name() {
      return m.male_stock_clownfish_explore();
    },
    card: LetterFiveCard,
    row: LetterFiveRow,
    detail: CorrespondenceDetail,
    fullBleed: true,
  },
  ...extensionRenderers,
];

export function getRenderer(id: string | null | undefined): RecordRenderer | null {
  if (!id) return null;
  return recordRenderers.find((r) => r.id === id) ?? null;
}
