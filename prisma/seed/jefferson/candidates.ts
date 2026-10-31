/**
 * Capitalised name candidates: runs of capitalised words in the text that look like names. Used to
 * mine the gazetteer and to count what the linker left unmatched (REPORT.md). Deliberately simple
 * and deterministic. It errs towards counting, so the link rate it yields is a floor, not a boast.
 */
export type NameCandidate = { start: number; end: number; surface: string };

const words = (s: string) => s.split(' ');

/** Function words, sentence openers and citation abbreviations: capitalised by position or habit, not names. */
export const OPENERS = new Set(
  words(
    'The He It But This That In They And If To We These On When For There No So Their As At An His Of By Yet All Some Whether With One What My Besides Every Then See Here How Thus Where Or You Being Before Not Shall Who Which Whose Whom Those Them Its Our Your Was Were Are Is Be Been Have Has Had Do Does Did Will Would Could Should May Might Must Can Other Another Any Each Both Such Many Most More Less Much Few Several After Since Until While Though Although Because Without Within Between Upon From Into Over Under About Against Among During Through Whenever Whereas Resolved Ordered Also Again Now Yes Nor Either Neither Only Even Still Just Once Next Last First Second Third Fourth Fifth Sixth Seventh Eighth Ninth Tenth Said Mr Mrs Messrs Dr St Col Capt Gen Gov Hon Esq Sir Lord Mem Ib Id Vol Art Sec Ch Qu Ans Car Inst Parl Jac Amer Com Stra Thurl Ll Ne Te Ty Bl El Ee Wee Ag Des Le La Th Ss Me Say Wood Warm Hot Red Man Read Town Law Labor Grand',
  ),
);

export const CALENDAR = new Set(
  words(
    'January February March April May June July August September October November December Jan Feb Mar Apr Jun Jul Aug Sep Sept Oct Nov Dec Monday Tuesday Wednesday Thursday Friday Saturday Sunday Mon Tues Wed Thurs Fri Sat Sun',
  ),
);

/** Capitalised common words (offices, institutions, directions, nationality adjectives) that are not names. */
export const GENERIC = new Set(
  words(
    'House Houses President Presidents Presidential State States Senate Senators Senator Government Governments King Kings Queen Speaker Speakers Indians Indian French British English Englishman Englishmen American Americans European Europeans Spanish Spaniards Dutch Greek Latin Roman Romans Saxon Norman Swiss Portuguese Scotch Prussian Hebrew Jew Executive Legislature Legislatures Legislative Judiciary Committee Committees Commons Lords Majesty Governor Governors Secretary Secretaries Minister Ministers Ministry Ambassador Consul Commonwealth Convention Assembly Union Declaration Constitution Constitutions Council Court Crown Republic Parliamentary Parliaments Federal National Common Treasury Representatives Representative Delegates Commissioners Judges Judge General Colonel Captain Major Doctor Attorney Chief Justice Church God Almighty Christian Christianity Anglican Presbyterian Revolution Revolutionary Province Department Departments Administration Militia Navy Army Act Bill Bills Question Order Rule Rules Resolution Resolutions Motion Motions Appendix Chapter Section Query Note Notes Contents Introduction Treaty Articles Amendments Petition Petitions Journals Journal Reasons Opinion Proclamation Ordinance Statute Charter Northern Southern Western Eastern North South East West Patriots Clergy Nobles Noblesse Princes Prince Princess Duke Count Empress Viceroy Archbishop Chancellor Heads Confederation University Independence Rights Military Criminal Civil Royal Peers Ayes Noes Deponent Unit Units Pound Dollar Dollars Financier Revisal',
  ),
);

type Tok = { w: string; at: number; coreStart: number; coreEnd: number; core: string };

const ABBREV = /^(?:Mr|Mrs|Dr|St|Col|Capt|Gen|Gov|Hon|Esq|Messrs)\.?$/;
const EDGE_LEFT = /^[("“‘'[]+/;
const EDGE_RIGHT = /[,;:)"”’?!\]]+$/;

function tokenise(text: string): Tok[] {
  const out: Tok[] = [];
  for (const m of text.matchAll(/\S+/g)) {
    const w = m[0];
    const l = w.length - w.replace(EDGE_LEFT, '').length;
    const r = w.length - w.replace(EDGE_RIGHT, '').length;
    out.push({
      w,
      at: m.index,
      coreStart: m.index + l,
      coreEnd: m.index + w.length - r,
      core: w.slice(l, w.length - r),
    });
  }
  return out;
}

const isInitial = (c: string) => /^[A-Z]\.$/.test(c);
const noPossessive = (c: string) => c.replace(/['’]s$/, '').replace(/['’]$/, '');

function isCapWord(t: Tok): boolean {
  const c = t.core.replace(/\.$/, '');
  if (!/^[A-Z][\p{L}'’-]*$/u.test(c)) return isInitial(t.core);
  const letters = c.replace(/[^\p{L}]/gu, '');
  if (letters.length < 2) return false;
  return /\p{Ll}/u.test(letters); // an all-capitals word is a heading, not a name
}

const endsSentence = (t: Tok) =>
  /[.?!:]["”’)]*$/.test(t.w) && !isInitial(t.core) && !ABBREV.test(t.core);

/** Candidates in `text`: maximal runs of capitalised words, minus openers, calendar words and generics. */
export function nameCandidates(text: string): NameCandidate[] {
  const out: NameCandidate[] = [];
  const toks = tokenise(text);
  const gapHasNewline = (a: Tok, b: Tok) => text.slice(a.at + a.w.length, b.at).includes('\n');
  const dead = (t: Tok) =>
    OPENERS.has(noPossessive(t.core).replace(/\.$/, '')) || CALENDAR.has(t.core.replace(/\.$/, ''));
  for (let k = 0; k < toks.length; ) {
    if (!isCapWord(toks[k])) {
      k++;
      continue;
    }
    const atSentenceStart =
      k === 0 || endsSentence(toks[k - 1]) || gapHasNewline(toks[k - 1], toks[k]);
    let j = k;
    while (
      j + 1 < toks.length &&
      !gapHasNewline(toks[j], toks[j + 1]) &&
      !endsSentence(toks[j]) &&
      !/[,;:]["”’)]*$/.test(toks[j].w)
    ) {
      if (isCapWord(toks[j + 1])) j++;
      else if (
        /^(?:of|de|du|la|le|des|van|von|di|del|y)$/.test(toks[j + 1].core) &&
        j + 2 < toks.length &&
        isCapWord(toks[j + 2])
      )
        j += 2;
      else break;
    }
    let first = k;
    while (first <= j && dead(toks[first])) first++;
    let last = j;
    while (last >= first && dead(toks[last])) last--;
    if (first <= last) {
      const run = toks.slice(first, last + 1);
      const single = run.length === 1;
      const core = run.map((t) => noPossessive(t.core).replace(/\.$/, ''));
      const allGeneric = core.every(
        (c) =>
          GENERIC.has(c) || OPENERS.has(c) || /^(?:of|de|du|la|le|des|van|von|di|del|y)$/.test(c),
      );
      const abbreviation = single && /\.$/.test(run[0].core) && run[0].core.length <= 5;
      const sentenceInitialSingle = single && first === k && atSentenceStart;
      const lone = run.every((t) => isInitial(t.core));
      if (!allGeneric && !abbreviation && !sentenceInitialSingle && !lone) {
        const start = run[0].coreStart;
        let end = run.at(-1)!.coreEnd;
        if (text[end - 1] === '.' && !isInitial(run.at(-1)!.core) && !ABBREV.test(run.at(-1)!.core))
          end--;
        const surface = text.slice(start, end);
        if (surface.length >= 2) out.push({ start, end, surface });
      }
    }
    k = j + 1;
  }
  return out;
}
