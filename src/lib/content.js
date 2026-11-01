// Every piece of site copy that Mike and Matt can change from the site
// itself (click-to-edit). Each key has a default; the database holds
// overrides. Multiline keys render as paragraphs.
const DEFAULTS = {
  // ---- Settings (structured; edited on the admin Settings page) ----
  settings: {
    business_name: 'CEC Contractors',
    former_name: 'Cutting Edge Carpentry',
    phone_primary: '(216) 309-3631',
    phone_primary_name: 'Mike',
    phone_secondary: '(216) 704-3330',
    phone_secondary_name: 'Matt',
    email_primary: 'mike@cutting-edgecarpentry.com',
    email_secondary: 'matt@cutting-edgecarpentry.com',
    lead_emails: 'mike@cutting-edgecarpentry.com, matt@cutting-edgecarpentry.com',
    service_area: 'Cuyahoga, Lake, Geauga, and Medina counties',
    service_area_short: 'Greater Cleveland',
    facebook_url: 'https://www.facebook.com/profile.php?id=100092479696505',
    hero_image: '', // e.g. "cleveland-heights-living-room-restoration/01" — blank = first featured job's cover
    hero_caption: 'Cleveland Heights — living room restoration',
  },

  // ---- Copy (click-to-edit on the page) ----
  text: {
    // Home
    'home.hero.title': 'Built with experience. Finished with pride.',
    'home.hero.sub': 'Residential and commercial carpentry, remodeling, and millwork across Greater Cleveland. One crew, start to finish.',
    'home.intro.title': 'Carpentry is the trade. Running the whole job is the service.',
    'home.intro.body': 'We are a small, experienced crew that does its own carpentry and manages everything around it. Ceilings, stairs, built-ins, porches, additions, restaurant build-outs. When a job needs other trades, we bring in the electricians, plumbers, and painters we trust and keep them on schedule, so you deal with one person and one plan.',
    'home.work.title': 'Recent work',
    'home.work.sub': 'Every photo on this site is our own job. No stock images.',
    'home.series.title': 'One home, year after year',
    'home.series.body': 'A homeowner in Cleveland Heights has had us back three years running: the living room ceiling and cherry crown in 2023, the third floor and custom radiator covers in 2024, the staircase in 2025. That is the kind of client we want, and the kind of work that earns the next call.',
    'home.services.title': 'What we do',
    'home.how.title': 'How we work',
    'home.cred.title': 'Where our crew has worked',
    'home.cred.body': 'Our crew has worked on Tower City, the Halle Building, Smithers-Oasis headquarters in Kent, and the Union Home Mortgage headquarters, along with doctors’ offices, hospitals, churches, restaurants, and some of the most carefully kept homes in Northeast Ohio.',
    'home.cta.title': 'Have a project in mind?',
    'home.cta.body': 'Call Mike, or send a few details and photos and we will get back to you.',

    // How we work (shared by Home and About)
    'how.1.title': 'One point of contact',
    'how.1.body': 'We run the job. Scheduling, ordering, inspections, and the other trades all go through us, so you are never chasing three people for one answer.',
    'how.2.title': 'Our trades, or yours',
    'how.2.body': 'When a project needs an electrician, plumber, HVAC, or painter, we bring in people we have worked with for years and manage them. If you already have someone you trust, we will coordinate with them instead.',
    'how.3.title': 'We protect your space',
    'how.3.body': 'Occupied home, church, or office: we seal off the work area, sometimes with a full temporary wall and door, cover the floors, and keep the dust where the work is. The rest of the building stays usable.',
    'how.4.title': 'Contractors hire us too',
    'how.4.body': 'General contractors and millwork shops bring us in as their carpentry crew when the finish work has to be right. We are glad to work under another GC and we are glad to run the job ourselves.',

    // Services
    'services.title': 'Services',
    'services.intro': 'We do the carpentry ourselves and manage the rest. Here is the work we are most often hired for, with examples from our own jobs.',
    'services.1.title': 'Finish carpentry and millwork',
    'services.1.body': 'Crown molding, paneling, wainscoting, built-in cabinets, bookcases, radiator covers, custom doors, and trim. Matched to what your house already has, or designed from scratch.',
    'services.2.title': 'Stairs and railings',
    'services.2.body': 'New staircases, re-skinned treads and risers, custom handrails with hand-fitted curves, box newels, iron or wood balusters, and loft and balcony railings.',
    'services.3.title': 'Remodeling and additions',
    'services.3.body': 'Kitchens, third floors, porch-to-room conversions, and additions. We handle the structure, the finish, and the trades in between.',
    'services.4.title': 'Historic restoration',
    'services.4.body': 'Front porches, ceilings, crown, and millwork on older homes, rebuilt to the original design so the house still looks like itself.',
    'services.5.title': 'Porches, decks, and outdoor structures',
    'services.5.body': 'Covered patios from the piers up, front porch restorations, composite and wood decks, railings, privacy screens, and the cornice and column details that finish them.',
    'services.6.title': 'Commercial carpentry',
    'services.6.body': 'Restaurant build-outs, bars and counters, church sanctuaries, metal-stud framing, commercial doors and hardware, structural repair, and tenant improvements, including work under another general contractor.',

    // About
    'about.title': 'About CEC Contractors',
    'about.body': 'CEC Contractors is a family carpentry and construction company based in Lake County, serving Greater Cleveland. The company began as Cutting Edge Carpentry, and the initials carry the name forward.\n\nMike has spent his career in carpentry and estimating, and still prices and runs our jobs. Matt has been doing carpentry since he was thirteen and runs the company today. Between the two of us there are several decades of finish work in some of the most carefully kept homes and buildings in Northeast Ohio.\n\nWe stay small on purpose. The people who give you the estimate are the people who show up to do the work.',
    'about.how.title': 'How we work',
    'about.area.title': 'Where we work',
    'about.area.body': 'Cuyahoga, Lake, Geauga, and Medina counties. If you are a little outside that, ask; we have traveled for the right project.',
    'about.insured.title': 'Fully insured',
    'about.insured.body': 'We carry liability insurance and can provide a certificate on request.',

    // Contact
    'contact.title': 'Request an estimate',
    'contact.intro': 'The fastest way to reach us is a call to Mike. If you would rather send details first, use the form and we will call you back.',
    'contact.current_clients': 'Current clients and project questions',
    'contact.form.thanks_title': 'Thanks, we have it.',
    'contact.form.thanks_body': 'Mike will call or email you, usually within a business day. If it is urgent, call him directly.',

    // Work page
    'work.title': 'Our work',
    'work.intro': 'Residential and commercial projects across Greater Cleveland. Click any job for the full set of photos and what we did.',

    // Footer
    'footer.tagline': 'Residential and commercial carpentry, remodeling, and millwork. Formerly Cutting Edge Carpentry.',
  },
};

const MULTILINE = new Set(Object.keys(DEFAULTS.text).filter(k => DEFAULTS.text[k].includes('\n\n') || /\.(body|intro)$/.test(k)));

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function paragraphs(s) {
  return String(s).split(/\n{2,}/).map(p => `<p>${esc(p.trim()).replace(/\n/g, '<br>')}</p>`).join('');
}

// Build the t() helper for a request. overrides = rows from the content table.
function makeT(overrides, editMode) {
  return function t(key, opts = {}) {
    const raw = Object.prototype.hasOwnProperty.call(overrides, key) ? overrides[key] : (DEFAULTS.text[key] ?? '');
    const multi = opts.multi ?? MULTILINE.has(key);
    const inner = multi ? paragraphs(raw) : esc(raw);
    if (!editMode) return multi ? inner : inner;
    const tag = multi ? 'div' : 'span';
    return `<${tag} class="ed" data-k="${esc(key)}" data-ml="${multi ? 1 : 0}" contenteditable="true" spellcheck="true">${inner}</${tag}>`;
  };
}

function settingsWithDefaults(rows) {
  return { ...DEFAULTS.settings, ...rows };
}

module.exports = { DEFAULTS, MULTILINE, makeT, settingsWithDefaults, esc, paragraphs };
