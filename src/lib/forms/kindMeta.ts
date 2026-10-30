import type { FieldKind } from './layout';
import * as m from '$lib/paraglide/messages.js';

interface KindMeta {
  label: string;
  hint: string;
}

// Built per kind on demand (not the whole map per call) so labels still follow
// the active locale without 18 message lookups for every row.
const META: Record<FieldKind, () => KindMeta> = {
  text: () => ({ label: m.full_candid_dingo_feel(), hint: m.mad_plain_lynx_renew() }),
  markdown: () => ({ label: m.candid_sour_mole_fade(), hint: m.light_teal_elephant_clasp() }),
  number: () => ({ label: m.jolly_ideal_jellyfish_amuse(), hint: m.vexed_every_ant_zap() }),
  date: () => ({ label: m.polite_cuddly_termite_savor(), hint: m.ornate_round_fly_support() }),
  datetime: () => ({ label: m.fresh_new_ocelot_climb(), hint: m.slow_late_osprey_beam() }),
  list: () => ({ label: m.polite_strong_zebra_learn(), hint: m.bald_jolly_firefox_arrive() }),
  location: () => ({ label: m.gross_big_jellyfish_conquer(), hint: m.spare_curly_pig_scold() }),
  user: () => ({ label: m.neat_sleek_gazelle_kiss(), hint: m.aloof_house_poodle_chop() }),
  record: () => ({ label: m.due_frail_iguana_hike(), hint: m.direct_super_mole_fulfill() }),
};

export function kindMeta(kind: FieldKind): KindMeta {
  return META[kind]();
}
