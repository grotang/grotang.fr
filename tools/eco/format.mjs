/* Mise en forme de data.json : une série par ligne.
 * Ni tout sur une ligne (un diff git illisible), ni un nombre par ligne
 * (dix mille lignes) : chaque tableau, et chaque objet qui ne contient que des
 * nombres, tient sur sa ligne. Un diff montre donc exactement quelles séries
 * Eurostat a révisées. */
export function formate(d) {
  const feuille = v => v === null || typeof v !== 'object' || Array.isArray(v)
    || Object.values(v).every(x => x === null || typeof x !== 'object');
  const f = (v, ind) => {
    if (feuille(v)) return JSON.stringify(v);
    const e = Object.entries(v).map(([k, x]) => ind + '  ' + JSON.stringify(k) + ': ' + f(x, ind + '  '));
    return '{\n' + e.join(',\n') + '\n' + ind + '}';
  };
  return f(d, '') + '\n';
}
