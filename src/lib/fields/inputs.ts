import type { Component } from 'svelte';
import type { FieldKind, LayoutField } from '$lib/forms/layout';
import ScalarInput from './inputs/ScalarInput.svelte';
import MarkdownInput from './inputs/MarkdownInput.svelte';
import ListInput from './inputs/ListInput.svelte';
import LocationInput from './inputs/LocationInput.svelte';
import RelationInput from './inputs/RelationInput.svelte';

/** Props every field input component receives from the record-entry form. */
export interface FieldInputProps {
  value: unknown;
  field: LayoutField;
  /** Accessibility/control attributes from the form library (spread onto the control). */
  controlProps: Record<string, unknown>;
  hasError: boolean;
  /** Write the new value back to the form. */
  onChange: (value: unknown) => void;
}

/** Entry-form input component per field type (the client half of the registry). */
const FIELD_INPUTS: Record<FieldKind, Component<FieldInputProps>> = {
  text: ScalarInput,
  markdown: MarkdownInput,
  number: ScalarInput,
  date: ScalarInput,
  datetime: ScalarInput,
  list: ListInput,
  location: LocationInput,
  user: RelationInput,
  record: RelationInput,
};

export function getFieldInput(kind: FieldKind): Component<FieldInputProps> {
  return FIELD_INPUTS[kind];
}
