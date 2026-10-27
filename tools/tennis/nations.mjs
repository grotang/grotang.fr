/* Nations de la page tennis : nom, adjectif (masculin singulier, pluriel) et
 * code ISO du drapeau, pour chaque code CIO rencontré dans les tableaux.
 * La page propose les nations qui ont gagné au moins un Grand Chelem en
 * simple messieurs depuis 1968 ; la liste se déduit de data.json, donc un
 * nouveau pays titré apparaît tout seul — à condition d'être décrit ici
 * (sinon tools/build.mjs s'arrête et le dit). */
const N = {
  ALG: 'Algérie|algérien|algériens|DZ', ARG: 'Argentine|argentin|argentins|AR', ARM: 'Arménie|arménien|arméniens|AM',
  AUS: 'Australie|australien|australiens|AU', AUT: 'Autriche|autrichien|autrichiens|AT', BAH: 'Bahamas|bahaméen|bahaméens|BS',
  BAR: 'Barbade|barbadien|barbadiens|BB', BEL: 'Belgique|belge|belges|BE', BIH: 'Bosnie-Herzégovine|bosnien|bosniens|BA',
  BLR: 'Biélorussie|biélorusse|biélorusses|BY', BOL: 'Bolivie|bolivien|boliviens|BO', BRA: 'Brésil|brésilien|brésiliens|BR',
  BUL: 'Bulgarie|bulgare|bulgares|BG', CAN: 'Canada|canadien|canadiens|CA', CHI: 'Chili|chilien|chiliens|CL',
  CHN: 'Chine|chinois|chinois|CN', COL: 'Colombie|colombien|colombiens|CO', CRC: 'Costa Rica|costaricien|costariciens|CR',
  CRO: 'Croatie|croate|croates|HR', CUB: 'Cuba|cubain|cubains|CU', CYP: 'Chypre|chypriote|chypriotes|CY',
  CZE: 'Tchéquie|tchèque|tchèques|CZ', DEN: 'Danemark|danois|danois|DK', DOM: 'République dominicaine|dominicain|dominicains|DO',
  ECU: 'Équateur|équatorien|équatoriens|EC', EGY: 'Égypte|égyptien|égyptiens|EG', ESP: 'Espagne|espagnol|espagnols|ES',
  EST: 'Estonie|estonien|estoniens|EE', FIN: 'Finlande|finlandais|finlandais|FI', FRA: 'France|français|français|FR',
  GBR: 'Grande-Bretagne|britannique|britanniques|GB', GEO: 'Géorgie|géorgien|géorgiens|GE', GER: 'Allemagne|allemand|allemands|DE',
  GRE: 'Grèce|grec|grecs|GR', HAI: 'Haïti|haïtien|haïtiens|HT', HKG: 'Hong Kong|hongkongais|hongkongais|HK',
  HUN: 'Hongrie|hongrois|hongrois|HU', INA: 'Indonésie|indonésien|indonésiens|ID', IND: 'Inde|indien|indiens|IN',
  IRI: 'Iran|iranien|iraniens|IR', IRL: 'Irlande|irlandais|irlandais|IE', ISR: 'Israël|israélien|israéliens|IL',
  ITA: 'Italie|italien|italiens|IT', JAM: 'Jamaïque|jamaïcain|jamaïcains|JM', JPN: 'Japon|japonais|japonais|JP',
  KAZ: 'Kazakhstan|kazakh|kazakhs|KZ', KEN: 'Kenya|kényan|kényans|KE', KOR: 'Corée du Sud|sud-coréen|sud-coréens|KR',
  LAT: 'Lettonie|letton|lettons|LV', LBN: 'Liban|libanais|libanais|LB', LTU: 'Lituanie|lituanien|lituaniens|LT',
  LUX: 'Luxembourg|luxembourgeois|luxembourgeois|LU', MAR: 'Maroc|marocain|marocains|MA', MDA: 'Moldavie|moldave|moldaves|MD',
  MEX: 'Mexique|mexicain|mexicains|MX', MON: 'Monaco|monégasque|monégasques|MC', NED: 'Pays-Bas|néerlandais|néerlandais|NL',
  NGR: 'Nigeria|nigérian|nigérians|NG', NOR: 'Norvège|norvégien|norvégiens|NO', NZL: 'Nouvelle-Zélande|néo-zélandais|néo-zélandais|NZ',
  PAK: 'Pakistan|pakistanais|pakistanais|PK', PAR: 'Paraguay|paraguayen|paraguayens|PY', PER: 'Pérou|péruvien|péruviens|PE',
  PHI: 'Philippines|philippin|philippins|PH', POL: 'Pologne|polonais|polonais|PL', POR: 'Portugal|portugais|portugais|PT',
  PUR: 'Porto Rico|portoricain|portoricains|PR', ROU: 'Roumanie|roumain|roumains|RO', RSA: 'Afrique du Sud|sud-africain|sud-africains|ZA',
  RUS: 'Russie|russe|russes|RU', SEN: 'Sénégal|sénégalais|sénégalais|SN', SLO: 'Slovénie|slovène|slovènes|SI',
  SRB: 'Serbie|serbe|serbes|RS', SUI: 'Suisse|suisse|suisses|CH', SVK: 'Slovaquie|slovaque|slovaques|SK',
  SWE: 'Suède|suédois|suédois|SE', TCH: 'Tchécoslovaquie|tchécoslovaque|tchécoslovaques|', THA: 'Thaïlande|thaïlandais|thaïlandais|TH',
  TPE: 'Taïwan|taïwanais|taïwanais|TW', TUN: 'Tunisie|tunisien|tunisiens|TN', TUR: 'Turquie|turc|turcs|TR',
  UKR: 'Ukraine|ukrainien|ukrainiens|UA', URS: 'URSS|soviétique|soviétiques|', URU: 'Uruguay|uruguayen|uruguayens|UY',
  USA: 'États-Unis|américain|américains|US', UZB: 'Ouzbékistan|ouzbek|ouzbeks|UZ', VEN: 'Venezuela|vénézuélien|vénézuéliens|VE',
  YUG: 'Yougoslavie|yougoslave|yougoslaves|', ZIM: 'Zimbabwe|zimbabwéen|zimbabwéens|ZW',
};
/* précisions affichées sous le choix de la nation */
const NOTE = {
  GER: "RFA jusqu'en 1990, puis Allemagne réunifiée.",
  CZE: "Tchécoslovaquie jusqu'en 1992 (Slovaques compris, comme Mečíř).",
  RUS: "Depuis 1992. Depuis 2022, les Russes jouent sous bannière neutre : ils sont comptés ici avec la Russie.",
  SRB: 'Sous ce nom depuis 2006 (avant : Serbie-et-Monténégro, Yougoslavie).',
};
const drapeau = iso => iso ? [...iso].map(c => String.fromCodePoint(0x1F1E6 + c.charCodeAt(0) - 65)).join('') : '';
export function nation(c) {
  if (!N[c]) return null;
  const [nom, as, ap, iso] = N[c].split('|');
  return { c, nom, as, ap, drap: drapeau(iso), note: NOTE[c] || '' };
}
