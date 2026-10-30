import type { Component } from 'svelte';
import {
  buildRendererProps,
  presentFields,
  type RendererCreator,
  type RendererProps,
  type RendererTypeInput,
} from '$lib/render/props';
import { getRenderer } from '$lib/renderers/registry';
import { formatDate } from '$lib/utils/formatDate';

type RecordViewRow = Record<string, unknown> & {
  id: string;
  createdAt: Date | string;
  status: string;
  creator?: RendererCreator | null;
};

/**
 * What a list card or row needs to draw a record: the type's renderer for this
 * slot (if any), whether it owns the whole box, its props, the generic field
 * fallback and the date label. Shared by RecordCard and RecordRow.
 */
export function recordView(row: RecordViewRow, type: RendererTypeInput, slot: 'card' | 'row') {
  const renderer = getRenderer(type.rendererId);
  const Renderer: Component<RendererProps> | null = renderer?.[slot] ?? null;
  return {
    Renderer,
    fullBleed: !!renderer?.fullBleed && !!Renderer,
    rendererProps: buildRendererProps(row, type),
    rendered: presentFields(row, type),
    dateLabel: formatDate(row.createdAt),
  };
}
