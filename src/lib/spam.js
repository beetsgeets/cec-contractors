// Flags obvious sales pitches sent through the estimate form. Flagged requests are
// still saved (under "Probably spam" in the admin) but aren't emailed. The rules
// are deliberately narrow: a real customer mentioning "your website" or pasting a
// single link is never flagged on that alone.

const PITCH = [
  /\bseo\b/i,
  /search engine/i,
  /\b(google|search) (rank|ranking|rankings|results)\b/i,
  /\brank(?:ing|ings)? (?:on|in|at) (?:the )?(?:top|first page|page one|google)/i,
  /\b(?:first|1st) page (?:of|on) google\b/i,
  /\btop (?:of )?google\b/i,
  /\bbacklinks?\b/i,
  /\blink building\b/i,
  /\bguest post/i,
  /\bweb ?design(?:er|ers)?\b/i,
  /\bwebsite (?:design|redesign|development|developer)\b/i,
  /\bredesign (?:your|the) (?:web)?site\b/i,
  /\b(?:boost|increase|improve|grow) (?:your )?(?:web ?site'?s? )?(?:traffic|visibility|rankings?|online presence)\b/i,
  /\bdigital marketing\b/i,
  /\bmarketing (?:services|agency|team|expert|specialist)\b/i,
  /\blead generation\b/i,
  /\bgenerate (?:more )?(?:qualified )?leads\b/i,
  /\bsocial media (?:management|marketing|manager)\b/i,
  /\bppc\b/i,
  /\bgoogle ads (?:management|campaign|expert)\b/i,
  /\b(?:mobile )?app development\b/i,
  /\bvirtual assistants?\b/i,
  /\boutsourc(?:e|ing)\b/i,
  /\bbusiness (?:loan|funding|financing|line of credit)\b/i,
  /\bmerchant cash\b/i,
  /\bworking capital\b/i,
  /\b(?:crypto|bitcoin|forex)\b/i,
  /\bunsubscribe\b/i,
  /\breply (?:with )?["“']?(?:stop|remove|no)["”']?\b/i,
];

const NON_LATIN = /[Ѐ-ӿ֐-ۿ฀-๿぀-ヿ㐀-鿿가-힯]/;

function spamReason(form) {
  const text = [form.name, form.town, form.message].filter(Boolean).join('\n');
  if (!text.trim()) return null;
  if (PITCH.some(re => re.test(text))) return 'Sales pitch';
  // Greets the website itself ("Hello ceccontractors.com,") — customers greet people.
  if (/^\s*(?:hello|hi|hey|dear|greetings)[\s,]+(?:team )?(?:at )?(?:https?:\/\/)?(?:www\.)?ceccontractors\.com/i.test(form.message || '')) return 'Addressed to the website';
  if (NON_LATIN.test(text)) return 'Foreign-language message';
  const links = (form.message || '').match(/https?:\/\/|www\.[a-z0-9-]+\./gi) || [];
  if (links.length >= 2) return 'Several links';
  return null;
}

module.exports = { spamReason };
