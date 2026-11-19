/* Noms courts des tournois, en français quand l'usage existe. */
export const court = page => page.replace(/^\d{4}\s+/, '').replace(/\s+–\s+.*$/, '').replace(/\s*\((tennis)\)$/, '');
export const FR = {
  'Australian Open': "Open d'Australie", 'French Open': 'Roland-Garros', 'Wimbledon Championships': 'Wimbledon', 'US Open': 'US Open',
  'BNP Paribas Open': 'Indian Wells', 'Miami Open': 'Miami', 'Monte-Carlo Masters': 'Monte-Carlo', 'Mutua Madrid Open': 'Madrid',
  'Italian Open': 'Rome', 'National Bank Open': 'Canada', 'Cincinnati Open': 'Cincinnati', 'Rolex Shanghai Masters': 'Shanghai',
  'Rolex Paris Masters': 'Paris', 'United Cup': 'United Cup', 'ATP Finals': 'ATP Finals',
  'ATP Hong Kong Tennis Open': 'Hong Kong', 'Brisbane International': 'Brisbane', 'Adelaide International': 'Adélaïde', 'ASB Classic': 'Auckland',
  'Open Occitanie': 'Montpellier', 'Dallas Open': 'Dallas', 'ABN AMRO Open': 'Rotterdam', 'Argentina Open': 'Buenos Aires',
  'Qatar ExxonMobil Open': 'Doha', 'Rio Open': 'Rio', 'Delray Beach Open': 'Delray Beach', 'Dubai Tennis Championships': 'Dubaï',
  'Abierto Mexicano Telcel': 'Acapulco', 'Chile Open': 'Santiago', "U.S. Men's Clay Court Championships": 'Houston',
  'Grand Prix Hassan II': 'Marrakech', 'Țiriac Open': 'Bucarest', 'Barcelona Open Banc Sabadell': 'Barcelone', 'BMW Open': 'Munich',
  'Hamburg Open': 'Hambourg', 'Geneva Open': 'Genève', 'BOSS Open': 'Stuttgart', 'Libéma Open': 'Bois-le-Duc', 'Halle Open': 'Halle',
  "Queen's Club Championships": "Queen's", 'Mallorca Championships': 'Majorque', 'Eastbourne Open': 'Eastbourne', 'Swedish Open': 'Båstad',
  'Swiss Open Gstaad': 'Gstaad', 'Croatia Open Umag': 'Umag', 'Generali Open Kitzbühel': 'Kitzbühel', 'Estoril Open': 'Estoril',
  'Mubadala DC Open': 'Washington', 'Mubadala Citi DC Open': 'Washington', 'Los Cabos Open': 'Los Cabos', 'Winston-Salem Open': 'Winston-Salem',
  'Chengdu Open': 'Chengdu', 'Hangzhou Open': 'Hangzhou', 'China Open': 'Pékin', 'Japan Open Tennis Championships': 'Tokyo',
  'Almaty Open': 'Almaty', 'Grand Prix Auvergne-Rhône-Alpes': 'Lyon', 'European Open': 'Anvers', 'Swiss Indoors': 'Bâle',
  'Erste Bank Open': 'Vienne', 'Stockholm Open': 'Stockholm',
};
