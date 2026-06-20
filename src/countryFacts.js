// Country facts panel — rich info card on country click.
import { COUNTRIES, findCountryByName } from './countryData.js';

// Supplementary data keyed by ISO2 code
const EXTRA = {
  US: { gdp: 63795, lang: 'English', currency: 'USD $', area: '9,833,517 km²', utc: -5 },
  GB: { gdp: 46125, lang: 'English', currency: 'GBP £', area: '243,610 km²', utc: 0 },
  FR: { gdp: 43659, lang: 'French', currency: 'EUR €', area: '643,801 km²', utc: 1 },
  DE: { gdp: 51204, lang: 'German', currency: 'EUR €', area: '357,114 km²', utc: 1 },
  JP: { gdp: 40247, lang: 'Japanese', currency: 'JPY ¥', area: '377,975 km²', utc: 9 },
  CN: { gdp: 12556, lang: 'Mandarin Chinese', currency: 'CNY ¥', area: '9,596,960 km²', utc: 8 },
  IN: { gdp: 2389,  lang: 'Hindi, English', currency: 'INR ₹', area: '3,287,263 km²', utc: 5.5 },
  BR: { gdp: 8920,  lang: 'Portuguese', currency: 'BRL R$', area: '8,515,767 km²', utc: -3 },
  CA: { gdp: 52078, lang: 'English, French', currency: 'CAD $', area: '9,984,670 km²', utc: -5 },
  AU: { gdp: 54907, lang: 'English', currency: 'AUD $', area: '7,692,024 km²', utc: 10 },
  RU: { gdp: 11585, lang: 'Russian', currency: 'RUB ₽', area: '17,098,242 km²', utc: 3 },
  MX: { gdp: 10046, lang: 'Spanish', currency: 'MXN $', area: '1,964,375 km²', utc: -6 },
  KR: { gdp: 31489, lang: 'Korean', currency: 'KRW ₩', area: '100,210 km²', utc: 9 },
  ES: { gdp: 29600, lang: 'Spanish', currency: 'EUR €', area: '505,990 km²', utc: 1 },
  IT: { gdp: 33205, lang: 'Italian', currency: 'EUR €', area: '301,340 km²', utc: 1 },
  NL: { gdp: 57101, lang: 'Dutch', currency: 'EUR €', area: '41,543 km²', utc: 1 },
  CH: { gdp: 93457, lang: 'German, French, Italian', currency: 'CHF Fr.', area: '41,285 km²', utc: 1 },
  SE: { gdp: 55997, lang: 'Swedish', currency: 'SEK kr', area: '450,295 km²', utc: 1 },
  NO: { gdp: 89154, lang: 'Norwegian', currency: 'NOK kr', area: '385,207 km²', utc: 1 },
  DK: { gdp: 67803, lang: 'Danish', currency: 'DKK kr', area: '42,924 km²', utc: 1 },
  PT: { gdp: 23400, lang: 'Portuguese', currency: 'EUR €', area: '92,212 km²', utc: 0 },
  PL: { gdp: 17841, lang: 'Polish', currency: 'PLN zł', area: '312,679 km²', utc: 1 },
  GR: { gdp: 20300, lang: 'Greek', currency: 'EUR €', area: '131,957 km²', utc: 2 },
  TR: { gdp: 10674, lang: 'Turkish', currency: 'TRY ₺', area: '783,562 km²', utc: 3 },
  SA: { gdp: 23139, lang: 'Arabic', currency: 'SAR ﷼', area: '2,149,690 km²', utc: 3 },
  AE: { gdp: 43103, lang: 'Arabic', currency: 'AED د.إ', area: '83,600 km²', utc: 4 },
  EG: { gdp: 4295,  lang: 'Arabic', currency: 'EGP £', area: '1,001,450 km²', utc: 2 },
  ZA: { gdp: 6001,  lang: 'Zulu, Xhosa, Afrikaans + 9 more', currency: 'ZAR R', area: '1,219,090 km²', utc: 2 },
  NG: { gdp: 2097,  lang: 'English', currency: 'NGN ₦', area: '923,768 km²', utc: 1 },
  KE: { gdp: 2006,  lang: 'Swahili, English', currency: 'KES KSh', area: '580,367 km²', utc: 3 },
  ID: { gdp: 4292,  lang: 'Indonesian', currency: 'IDR Rp', area: '1,904,569 km²', utc: 7 },
  MY: { gdp: 11414, lang: 'Malay', currency: 'MYR RM', area: '329,847 km²', utc: 8 },
  SG: { gdp: 65233, lang: 'English, Mandarin, Malay, Tamil', currency: 'SGD $', area: '728 km²', utc: 8 },
  TH: { gdp: 7808,  lang: 'Thai', currency: 'THB ฿', area: '513,120 km²', utc: 7 },
  VN: { gdp: 3757,  lang: 'Vietnamese', currency: 'VND ₫', area: '331,212 km²', utc: 7 },
  PH: { gdp: 3461,  lang: 'Filipino, English', currency: 'PHP ₱', area: '300,000 km²', utc: 8 },
  PK: { gdp: 1505,  lang: 'Urdu, English', currency: 'PKR ₨', area: '881,913 km²', utc: 5 },
  BD: { gdp: 2457,  lang: 'Bengali', currency: 'BDT ৳', area: '147,570 km²', utc: 6 },
  AR: { gdp: 10636, lang: 'Spanish', currency: 'ARS $', area: '2,780,400 km²', utc: -3 },
  CL: { gdp: 16265, lang: 'Spanish', currency: 'CLP $', area: '756,102 km²', utc: -4 },
  CO: { gdp: 6104,  lang: 'Spanish', currency: 'COP $', area: '1,141,748 km²', utc: -5 },
  PE: { gdp: 6622,  lang: 'Spanish, Quechua', currency: 'PEN S/', area: '1,285,216 km²', utc: -5 },
  NZ: { gdp: 48781, lang: 'English, Māori', currency: 'NZD $', area: '268,838 km²', utc: 12 },
  IL: { gdp: 52170, lang: 'Hebrew, Arabic', currency: 'ILS ₪', area: '20,770 km²', utc: 2 },
  PL: { gdp: 17841, lang: 'Polish', currency: 'PLN zł', area: '312,679 km²', utc: 1 },
  UA: { gdp: 4835,  lang: 'Ukrainian', currency: 'UAH ₴', area: '603,550 km²', utc: 2 },
  MA: { gdp: 3344,  lang: 'Arabic, Berber, French', currency: 'MAD د.م.', area: '446,550 km²', utc: 1 },
  ET: { gdp: 925,   lang: 'Amharic', currency: 'ETB Br', area: '1,104,300 km²', utc: 3 },
  TZ: { gdp: 1115,  lang: 'Swahili, English', currency: 'TZS Sh', area: '945,087 km²', utc: 3 },
  GH: { gdp: 2363,  lang: 'English', currency: 'GHS ₵', area: '238,533 km²', utc: 0 },
  UG: { gdp: 883,   lang: 'English, Swahili', currency: 'UGX Sh', area: '241,038 km²', utc: 3 },
  MX: { gdp: 10046, lang: 'Spanish', currency: 'MXN $', area: '1,964,375 km²', utc: -6 },
  IR: { gdp: 7474,  lang: 'Persian', currency: 'IRR ﷼', area: '1,648,195 km²', utc: 3.5 },
  IQ: { gdp: 5839,  lang: 'Arabic, Kurdish', currency: 'IQD ع.د', area: '438,317 km²', utc: 3 },
};

function formatPop(n) {
  if (!n) return '—';
  if (n >= 1e9) return (n / 1e9).toFixed(2) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  return n.toLocaleString();
}

function row(label, value) {
  return `<div class="cf-row"><span class="cf-lbl">${label}</span><span class="cf-val">${value || '—'}</span></div>`;
}

export function createCountryFacts({ visa, pins, flyTo, sound }) {
  const card     = document.getElementById('country-facts-card');
  const closeBtn = document.getElementById('country-facts-close');
  const flagEl   = document.getElementById('cf-flag');
  const nameEl   = document.getElementById('cf-name');
  const bodyEl   = document.getElementById('cf-body');
  const pinBtn   = document.getElementById('cf-pin-btn');

  let currentCountry = null;

  closeBtn?.addEventListener('click', close);
  card?.addEventListener('click', (e) => { if (e.target === card) close(); });

  function close() {
    card?.classList.remove('open');
    sound?.click();
  }

  function show(countryName) {
    const c = findCountryByName(countryName);
    if (!c) return;
    currentCountry = c;

    const ex = EXTRA[c.iso2] || {};
    const visaBadge = visa?.badgeHtml?.(c.name) || '';

    flagEl.textContent = c.flag || '';
    nameEl.textContent = c.name;

    bodyEl.innerHTML = [
      row('Capital', c.capital),
      row('Population', formatPop(c.population)),
      row('Area', ex.area || '—'),
      row('GDP / capita', ex.gdp ? `$${ex.gdp.toLocaleString()}` : '—'),
      row('Language(s)', ex.lang || '—'),
      row('Currency', ex.currency || '—'),
      row('UTC offset', ex.utc != null ? `UTC${ex.utc >= 0 ? '+' : ''}${ex.utc}` : '—'),
      visaBadge ? `<div class="cf-row"><span class="cf-lbl">Visa</span><span class="cf-val">${visaBadge}</span></div>` : '',
      `<div class="cf-fact">${c.fact || ''}</div>`,
    ].join('');

    card?.classList.add('open');
    sound?.chime();
  }

  pinBtn?.addEventListener('click', () => {
    if (!currentCountry) return;
    pins?.addWishlistPin?.({ name: currentCountry.capital, lat: currentCountry.lat, lng: currentCountry.lng, note: `${currentCountry.flag} ${currentCountry.name}` });
    close();
  });

  return { show, close, isOpen: () => card?.classList.contains('open') };
}
