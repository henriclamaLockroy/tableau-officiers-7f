'use strict';

/* ================= Utilitaires ================= */
const JOURS = ['dimanche','lundi','mardi','mercredi','jeudi','vendredi','samedi'];
const MOIS = ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
const pad = n => String(n).padStart(2,'0');
const iso = d => d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
function parseISO(s){ const [a,m,j] = s.split('-').map(Number); return new Date(a, m-1, j); }
function addDays(s,n){ const d = parseISO(s); d.setDate(d.getDate()+n); return iso(d); }
function todayISO(){ return iso(new Date()); }
function sundayOf(s){ const d = parseISO(s); d.setDate(d.getDate()-d.getDay()); return iso(d); }
function weeksBetween(a,b){ return Math.round((parseISO(b) - parseISO(a)) / (7*86400000)); }
function frShort(s){ const d = parseISO(s); return JOURS[d.getDay()] + ' ' + d.getDate(); }
function frLong(s){ const d = parseISO(s); return JOURS[d.getDay()] + ' ' + d.getDate() + ' ' + MOIS[d.getMonth()] + ' ' + d.getFullYear(); }
function frWeekRange(sunday){
  const a = parseISO(sunday), b = parseISO(addDays(sunday,6));
  if (a.getMonth() === b.getMonth()) return 'Du ' + a.getDate() + ' au ' + b.getDate() + ' ' + MOIS[b.getMonth()];
  return 'Du ' + a.getDate() + ' ' + MOIS[a.getMonth()] + ' au ' + b.getDate() + ' ' + MOIS[b.getMonth()];
}
function esc(s){ return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
const $ = s => document.querySelector(s);

/* ================= Données par défaut ================= */
const STATUTS = { pretre:'Prêtre', diacre:'Diacre', frere:'Frère', postulant:'Postulant' };
// Types de fêtes par défaut ; l'utilisateur peut en ajouter (state.feteTypes). solennel = jour de
// solennité (Père Abbé célébrant, homélie / P.U. / épître / thuriféraire, ligne en rouge sur la feuille)
const FETE_TYPES_DEFAUT = [
  { key:'solennite', label:'Solennité', solennel:true },
  { key:'fete', label:'Fête', solennel:false },
  { key:'dimanche', label:'Dimanche', solennel:false },
  { key:'memoire', label:'Mémoire', solennel:false },
  { key:'memoire_fac', label:'Mémoire facultative', solennel:false },
];
// RANGS : { key: label } — recalculé depuis state.feteTypes (Proxy pour rester compatible avec le code existant)
const RANGS = new Proxy({}, {
  get: (_, k) => { const t = (state && state.feteTypes || FETE_TYPES_DEFAUT).find(x => x.key === k); return t ? t.label : undefined; },
  ownKeys: () => (state && state.feteTypes || FETE_TYPES_DEFAUT).map(x => x.key),
  getOwnPropertyDescriptor: (_, k) => ({ enumerable: true, configurable: true, value: RANGS[k] }),
});
const feteType = k => (state && state.feteTypes || FETE_TYPES_DEFAUT).find(x => x.key === k);
const rangSolennel = k => !!(feteType(k) && feteType(k).solennel);
const POLICES = {
  defaut:  ['Par défaut', ''],
  playfair:['Playfair Display', "'Playfair Display', Georgia, serif"],
  noto:    ['Noto Serif', "'Noto Serif', Georgia, serif"],
  opensans:['Open Sans', "'Open Sans', 'Segoe UI', sans-serif"],
  georgia: ['Georgia', 'Georgia, serif'],
  times:   ['Times New Roman', "'Times New Roman', Times, serif"],
  arial:   ['Arial', 'Arial, sans-serif'],
};

function defaultFeteStyles(){
  return {
    solennite: { couleur:'#D0021B', gras:true,  italique:false, majuscule:true,  taille:14, police:'defaut' },
    fete:      { couleur:'#111111', gras:true,  italique:false, majuscule:true,  taille:13, police:'defaut' },
    dimanche:  { couleur:'#D0021B', gras:false, italique:false, majuscule:false, taille:13, police:'defaut' },
    memoire:   { couleur:'#111111', gras:false, italique:false, majuscule:false, taille:13, police:'defaut' },
    memoire_fac:{ couleur:'#111111', gras:false, italique:true,  majuscule:false, taille:13, police:'defaut' },
  };
}

/* groupe : les services d'un même groupe comptent comme « le même service » (statistiques,
   dernière/prochaine fois). optionnel : jamais rempli par le générateur, case « + » à la main. */
function defaultServices(){
  const S = (id, nom, portee, opts={}) => Object.assign(
    { id, nom, portee, quand:'tous', statuts:[], francophone:false, conflitDejeuner:false, manuel:false, optionnel:false, groupe:null, ordre:0 }, opts);
  return [
    S('celebrant','Célébrant principal','jour',{ statuts:['pretre'], ordre:1 }),
    S('homelie','Homélie','jour',{ quand:'dim_sol', statuts:['pretre','diacre'], manuel:true, ordre:2 }),
    S('priere_univ','Prière universelle','jour',{ quand:'dim_sol', francophone:true, ordre:3 }),
    // Épître : une par semaine, inscrite sur la ligne du lundi (convention du classeur OFFICIERS et de l'archive)
    S('epitre','Épître','jour',{ quand:'lundi', statuts:['frere','postulant'], francophone:true, ordre:4 }),
    S('thuriferaire','Thuriféraire','jour',{ quand:'dim_sol_fete', statuts:['frere','postulant'], ordre:5 }),
    S('hebdomadier','Hebdomadier','semaine',{ statuts:['pretre','diacre','frere'], francophone:true, ordre:10 }),
    S('lecteur','Lecteur','semaine',{ groupe:'Lecteur', francophone:true, ordre:11 }),
    S('lecteur2','Lecteur 2','semaine',{ groupe:'Lecteur', optionnel:true, francophone:true, ordre:11.5 }),
    S('serviteur_eglise',"Serviteur d'église",'semaine',{ statuts:['frere','postulant'], ordre:12 }),
    S('lecteur_table','Lecteur de table','semaine',{ francophone:true, conflitDejeuner:true, ordre:13 }),
    S('chantre_pu','Chantre P.U.','semaine',{ groupe:'Chantre P.U.', francophone:true, ordre:14 }),
    // Chantre principal + remplaçant PAR MOIS (le principal devient remplaçant le mois suivant) ; la feuille affiche « X / Y »
    S('chantre_pu2','Chantre P.U. — remplaçant','semaine',{ groupe:'Chantre P.U.', francophone:true, ordre:14.5 }),
    // Lecture de la Règle : un lecteur + un remplaçant PAR QUINZAINE (le remplaçant devient lecteur la quinzaine suivante)
    S('lecture_regle','Lecture de la Sainte Règle','semaine',{ conflitDejeuner:true, groupe:'Lecture de la Sainte Règle', quinzaine:true, ordre:15 }),
    S('lecture_regle2','Lecture de la Sainte Règle — remplaçant','semaine',{ conflitDejeuner:true, groupe:'Lecture de la Sainte Règle', quinzaine:true, ordre:15.5 }),
    // Serviteur de table 1 = serviteur en chef (compté à part) ; 2-3-4 = un seul et même service, sans distinction
    // (les trois cases sont rangées par ancienneté ; l'équité se mesure sur l'ensemble des trois)
    S('st1','Serviteur de table 1','semaine',{ conflitDejeuner:true, groupe:'Serviteur de table 1', ordre:16 }),
    S('st2','Serviteur de table','semaine',{ conflitDejeuner:true, groupe:'Serviteur de table', ordre:17 }),
    S('st3','Serviteur de table','semaine',{ conflitDejeuner:true, groupe:'Serviteur de table', ordre:18 }),
    S('st4','Serviteur de table','semaine',{ conflitDejeuner:true, groupe:'Serviteur de table', ordre:19 }),
    S('st_soupe','Serviteur soupe / salade','semaine',{ conflitDejeuner:true, groupe:'Serviteur soupe / salade', ordre:20 }),
    S('st_soupe2','Serviteur soupe / salade 2','semaine',{ conflitDejeuner:true, groupe:'Serviteur soupe / salade', ordre:20.5 }),
    S('st_viande','Serviteur viande','semaine',{ conflitDejeuner:true, ordre:21 }),
    // Services de l'ancien tableau (2019-2025), conservés pour l'historique seulement (masque = pas dans le planning)
    S('st5','Serviteur de table 5','semaine',{ conflitDejeuner:true, groupe:'Serviteur de table', masque:true, ordre:40 }),
    S('plat3_1','Serviteur 3e plat 1','semaine',{ conflitDejeuner:true, groupe:'Serviteur 3e plat', masque:true, ordre:41 }),
    S('plat3_2','Serviteur 3e plat 2','semaine',{ conflitDejeuner:true, groupe:'Serviteur 3e plat', masque:true, ordre:42 }),
    S('st_soupe3','Serviteur soupe / salade 3','semaine',{ conflitDejeuner:true, groupe:'Serviteur soupe / salade', masque:true, ordre:43 }),
  ];
}
// Services visibles dans le planning (hors services d'archive)
const servicesVisibles = () => servicesTries().filter(s => !s.masque);
// Groupes dont l'ordre d'affichage suit l'ancienneté au monastère (du plus ancien au plus jeune)
const GROUPES_ANCIENNETE = [['st2','st3','st4'], ['st_soupe','st_soupe2']];
// Jubilés (entrée au monastère, profession temporaire, sacerdoce) rappelés dans le bandeau du planning
const JUBILES = [10, 20, 25, 30, 40, 50, 60, 70, 75];

/* Feuille de référence : quinzaine du 9 au 22 août 2026, telle qu'affichée (classeur OFFICIERS.xlsx,
   onglet « tableau rose PU1 »). Chargée au départ et ré-appliquée par la migration v7. */
const FEUILLE_AOUT_2026 = {
  fetes: [
    ['2026-08-08','St Dominique','memoire'],
    ['2026-08-09','19e dimanche du temps ordinaire','dimanche'],
    ['2026-08-10','St Laurent','fete'],
    ['2026-08-11','Ste Claire','memoire'],
    ['2026-08-12','Ste Jeanne de Chantal','memoire'],
    ['2026-08-14','St Maximilien Kolbe','memoire'],
    ['2026-08-15','Assomption','solennite'],
    ['2026-08-16','20e dimanche du temps ordinaire','dimanche'],
    ['2026-08-18','Bx Paul et Élie de Sept-Fons','memoire'],
    ['2026-08-19','Bh Guerric','memoire'],
    ['2026-08-20','St Bernard','solennite'],
    ['2026-08-21','St Pie X','memoire'],
    ['2026-08-22','B.V. Marie-Reine','memoire'],
  ],
  // [date, service, nom]
  jours: [
    ['2026-08-08','celebrant','P. Sébastien'],
    ['2026-08-09','celebrant','P. Prieur'], ['2026-08-09','homelie','P. Sébastien'], ['2026-08-09','priere_univ','P. Georges'], ['2026-08-09','thuriferaire','F. Jean-Gabriel'],
    ['2026-08-10','celebrant','Dom Petr'], ['2026-08-10','epitre','F. Siméon'],
    ['2026-08-11','celebrant','P. Joseph'],
    ['2026-08-12','celebrant','P. Timothée'],
    ['2026-08-13','celebrant','P. Louis-Marie'],
    ['2026-08-14','celebrant','P. Antoine'],
    ['2026-08-15','celebrant','R.P. Abbé'], ['2026-08-15','homelie','P. Vianney'], ['2026-08-15','priere_univ','P. Maître'], ['2026-08-15','thuriferaire','F. André'],
    ['2026-08-16','celebrant','R.P. Abbé'], ['2026-08-16','homelie','P. Guillaume'], ['2026-08-16','priere_univ','F. Gabriel'], ['2026-08-16','thuriferaire','F. Christian'],
    ['2026-08-17','celebrant','P. Raphaël'], ['2026-08-17','epitre','F. Jean de Dieu'],
    ['2026-08-18','celebrant','P. Maître'],
    ['2026-08-19','celebrant','P. Jean-Théophane'],
    ['2026-08-20','celebrant','R.P. Abbé'], ['2026-08-20','homelie','Dom Petr'], ['2026-08-20','priere_univ','P. Guillaume'], ['2026-08-20','thuriferaire','F. Jean-Bosco'],
    ['2026-08-21','celebrant','P. Adam'],
    ['2026-08-22','celebrant','P. Joseph'], ['2026-08-22','thuriferaire','F. Gabriel'],
  ],
  // [semaine, service, nom]
  semaines: [
    ['2026-08-09','hebdomadier','P. Nathanaël'], ['2026-08-09','lecteur','P. Guillaume'], ['2026-08-09','serviteur_eglise','F. Matthias'],
    ['2026-08-09','lecteur_table','P. Jean-Théophane'], ['2026-08-09','chantre_pu','F. Martin de R.'], ['2026-08-09','chantre_pu2','F. Jacques'],
    ['2026-08-09','lecture_regle','P. Sébastien'], ['2026-08-09','lecture_regle2','P. Antoine'],
    ['2026-08-09','st1','F. Basile'], ['2026-08-09','st2','P. Timothée'], ['2026-08-09','st3','P. Antoine'], ['2026-08-09','st4','F. Christian'],
    ['2026-08-09','st_soupe','Dom Petr'], ['2026-08-09','st_soupe2','P. Louis-Marie'], ['2026-08-09','st_viande','F. Cyrille'],
    ['2026-08-16','hebdomadier','P. Timothée'], ['2026-08-16','lecteur','F. Basile'], ['2026-08-16','serviteur_eglise','F. Paul'],
    ['2026-08-16','lecteur_table','P. Joseph'],
    ['2026-08-16','st1','F. Barnabé'], ['2026-08-16','st2','F. Godefroid'], ['2026-08-16','st3','F. Maximilien'], ['2026-08-16','st4','F. Gérard'],
    ['2026-08-16','st_soupe','F. Mutien'], ['2026-08-16','st_soupe2','F. Charles'], ['2026-08-16','st_viande','F. Antoine'],
  ],
};

function seedState(){
  const moines = [];
  let seq = 1;
  const mk = (nom, statut, equipe) => {
    const m = { id:'m'+(seq++), nom, statut, francophone:true, regime:'permanent', actif:true,
                periodes:[], equipe: equipe || null, capacites:{}, notes:'',
                naissance:null, fete:null, entree:null };
    moines.push(m); return m;
  };
  [['R.P. Abbé','pretre'],['P. Maître','pretre'],['P. Timothée','pretre'],['P. Antoine','pretre'],
   ['P. Jean-Théophane','pretre'],['F. Mutien','frere'],['F. Romain','frere'],['F. Dismas','frere'],
   ['F. Charles','frere'],['F. Paul','frere'],['F. Basile','frere'],['F. Luc','frere'],
   ['F. Siméon','frere'],['F. Benoît','frere'],['Robert','postulant'],['Josué','postulant']]
   .forEach(([n,s]) => mk(n,s,1));
  [['P. Prieur','pretre'],['F. Benoît-Joseph','frere'],['F. Guerric','frere'],['F. Matthieu','frere'],
   ['F. Laurent','frere'],['F. Antoine','frere'],['P. Joseph','pretre'],['P. Pacôme','pretre'],
   ['F. Jean-Gabriel','frere'],['F. Jacques','frere'],['P. Raphaël','pretre'],['F. Godefroid','frere'],
   ['F. Jean-Bosco','frere'],['F. Matthias','frere'],['F. Maximilien','frere'],['F. Jean','frere'],
   ['F. Barnabé','frere'],['F. Irénée','frere'],['F. Élisée','frere']]
   .forEach(([n,s]) => mk(n,s,2));
  [['P. Sous-Prieur','pretre'],['P. Sébastien','pretre'],['F. Cyrille','frere'],['P. Nathanaël','pretre'],
   ['F. Christophe','frere'],['Dom Petr','pretre'],['P. Guillaume','pretre'],['F. Jean de Dieu','frere'],
   ['P. Adam','pretre'],['P. Georges','pretre'],['F. Yves','frere'],['F. Adrien','frere'],
   ['P. Vianney','pretre'],['F. Christian','frere'],['F. Patrick','frere'],['F. Marc','frere'],
   ['F. Gabriel','frere'],['F. Foucauld','frere'],['P. Pascal','pretre']]
   .forEach(([n,s]) => mk(n,s,3));
  [['P. Louis-Marie','pretre'],['F. André','frere'],['F. Gérard','frere'],['F. Martin de R.','frere']]
   .forEach(([n,s]) => mk(n,s,null));

  const byNom = {};
  moines.forEach(m => byNom[m.nom] = m.id);

  const fetes = FEUILLE_AOUT_2026.fetes.map(([date,nom,rang],i) => ({ id:'f'+(i+1), date, nom, rang }));

  const affectations = [];
  let aseq = 1;
  const S1 = '2026-08-09';
  const A = (serviceId, semaine, date, nom) => {
    const mid = byNom[nom];
    if (!mid) return;
    affectations.push({ id:'a'+(aseq++), serviceId, semaine, date: date || null, moineId: mid, nomLibre:null, verrouille:false });
  };
  for (const [date, sid, nom] of FEUILLE_AOUT_2026.jours) A(sid, sundayOf(date), date, nom);
  for (const [semaine, sid, nom] of FEUILLE_AOUT_2026.semaines) A(sid, semaine, null, nom);

  return {
    version: 4,   // les migrations v5 (fêtes/homélies 2026), v6 (archive) et v7 (feuille de référence) s'appliquent au 1er chargement
    seq: { moine: seq, service: 1, fete: fetes.length + 1, affect: aseq },
    moines, fetes, affectations,
    services: defaultServices(),
    feteStyles: defaultFeteStyles(),
    feteTypes: JSON.parse(JSON.stringify(FETE_TYPES_DEFAUT)),
    vaisselleSem: {},
    impressions: {},
    settings: {
      abbeId: byNom['R.P. Abbé'] || null,
      prieurId: byNom['P. Prieur'] || null,
      vaisselleRef: { sunday: S1, equipe: 1 },
      quinzaine: { sunday: S1, couleur: 'rose' },
      communaute: 'Abbaye de Sept-Fons',
    },
    ui: { tab:'planning', sunday: S1, statsAnnee: 2026, statsMois: 0, rechercheMoine: '', histService: '', histMoine: '' },
  };
}

/* ================= Persistance / migration ================= */
const LS_KEY = 'planning-moines-v1';
let state = null;
function save(){ _affIdx = null; localStorage.setItem(LS_KEY, JSON.stringify(state)); planifierSauvAuto(); }

/* ===== Sauvegarde automatique dans un dossier (API File System Access — Chrome / Edge) =====
   Le dossier est choisi une fois (idéalement un dossier OneDrive / Drive / Dropbox : le fichier part
   alors aussi sur le cloud). À chaque modification, le .json du jour y est réécrit quelques secondes
   plus tard ; les 10 derniers jours sont conservés. L'accès au dossier (« handle ») ne peut pas être
   mémorisé dans localStorage : il est gardé dans IndexedDB. Selon les réglages du navigateur, une
   confirmation d'accès peut être redemandée à chaque session : on la déclenche au premier clic. */
const APP_BUILD = '2026-09-04';
const sauvDispo = () => !!window.showDirectoryPicker;
let sauvTimer = null, sauvEtat = { ok: null, quand: null, msg: '' };
function fsdb(){
  return new Promise((res, rej) => {
    const r = indexedDB.open('planning-moines-fs', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('h');
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
async function fsGet(k){ const db = await fsdb(); return new Promise((res, rej) => { const t = db.transaction('h').objectStore('h').get(k); t.onsuccess = () => res(t.result); t.onerror = () => rej(t.error); }); }
async function fsSet(k, v){ const db = await fsdb(); return new Promise((res, rej) => { const t = db.transaction('h','readwrite').objectStore('h').put(v, k); t.onsuccess = () => res(); t.onerror = () => rej(t.error); }); }
async function fsDel(k){ const db = await fsdb(); return new Promise((res, rej) => { const t = db.transaction('h','readwrite').objectStore('h').delete(k); t.onsuccess = () => res(); t.onerror = () => rej(t.error); }); }
async function choisirDossierSauv(){
  try {
    const h = await showDirectoryPicker({ id: 'sauvegarde', mode: 'readwrite', startIn: 'documents' });
    try {
      const hm = await fsGet('dossierMoine');
      if (hm && await h.isSameEntry(hm)){
        alert("Ce dossier est celui de la consultation (données de l'autre ordinateur).\nLes fichiers des deux machines portent les mêmes noms et s'écraseraient mutuellement via OneDrive : choisir un autre dossier pour la sauvegarde de CET ordinateur.");
        return;
      }
    } catch(e){ /* comparaison impossible : on laisse passer */ }
    await fsSet('dossier', h);
    state.settings.sauvAuto = { actif: true, dossier: h.name };
    save();
    bannerMsg = 'Sauvegarde automatique activée — dossier « ' + esc(h.name) + ' ». Le fichier du jour y sera réécrit après chaque modification (10 derniers jours conservés).';
    render();
  } catch(e){ /* choix annulé */ }
}
function desactiverSauvAuto(){
  state.settings.sauvAuto = { actif: false, dossier: null, refus: true };
  fsDel('dossier').catch(() => {});
  sauvEtat = { ok: null, quand: null, msg: '' };
  save(); render(); majChipSauv();
}
function planifierSauvAuto(){
  const o = state && state.settings && state.settings.sauvAuto;
  if (!o || !o.actif || !sauvDispo()) return;
  clearTimeout(sauvTimer);
  sauvTimer = setTimeout(ecrireSauvAuto, 4000);
}
async function ecrireSauvAuto(){
  const o = state.settings.sauvAuto;
  if (!o || !o.actif) return;
  try {
    const h = await fsGet('dossier');
    if (!h) throw new Error('dossier non retrouvé — le rechoisir dans Réglages');
    if (await h.queryPermission({ mode: 'readwrite' }) !== 'granted')
      throw new Error('accès au dossier à confirmer');
    const nom = 'tableau-officiers-' + todayISO() + '.json';
    const f = await h.getFileHandle(nom, { create: true });
    const w = await f.createWritable();
    await w.write(JSON.stringify(state));
    await w.close();
    const anciens = [];
    for await (const n of h.keys()) if (/^tableau-officiers-\d{4}-\d{2}-\d{2}\.json$/.test(n)) anciens.push(n);
    anciens.sort();
    for (const n of anciens.slice(0, -10)) await h.removeEntry(n).catch(() => {});
    sauvEtat = { ok: true, quand: new Date(), msg: '' };
  } catch(e){
    sauvEtat = { ok: false, quand: new Date(), msg: e.message || String(e) };
  }
  majChipSauv();
  if (state.ui.tab === 'reglages'){ const el = $('#sauvEtatLigne'); if (el) el.innerHTML = sauvEtatHTML(); }
}
// Confirmation d'accès au dossier : doit être demandée pendant un clic (règle du navigateur)
async function reactiverSauvAuto(){
  try {
    const h = await fsGet('dossier');
    if (!h) { choisirDossierSauv(); return; }
    if (await h.requestPermission({ mode: 'readwrite' }) === 'granted'){ sauvEtat = { ok: null, quand: null, msg: '' }; ecrireSauvAuto(); }
  } catch(e){ choisirDossierSauv(); }
}
// Au premier clic de la session : si l'accès doit être confirmé, on le demande discrètement
async function amorcerSauvAuto(){
  const o = state.settings && state.settings.sauvAuto;
  if (!o || !o.actif || !sauvDispo()) return;
  try {
    const h = await fsGet('dossier');
    if (!h) return;
    if (await h.queryPermission({ mode: 'readwrite' }) !== 'granted')
      await h.requestPermission({ mode: 'readwrite' });
    ecrireSauvAuto();
  } catch(e){ /* silencieux : le badge signalera le problème au besoin */ }
}
// Petit badge fixe en bas à droite : uniquement si la sauvegarde automatique a un problème
function majChipSauv(){
  let el = document.getElementById('sauvChip');
  const o = state.settings && state.settings.sauvAuto;
  const souci = o && o.actif && sauvEtat.ok === false;
  if (!souci){ if (el) el.remove(); return; }
  if (!el){
    el = document.createElement('div');
    el.id = 'sauvChip';
    document.body.appendChild(el);
  }
  el.innerHTML = `💾 Sauvegarde automatique en attente — <b>cliquer pour réactiver</b> <span class="hint">(${esc(sauvEtat.msg)})</span>`;
  el.onclick = reactiverSauvAuto;
}
function sauvEtatHTML(){
  const o = state.settings && state.settings.sauvAuto;
  if (!sauvDispo()) return `<span class="hint">Non disponible dans ce navigateur (utiliser Chrome ou Edge).</span>`;
  if (!o || !o.actif) return `<span class="hint">Désactivée — choisir un dossier (idéalement dans OneDrive / Drive / Dropbox) pour que la sauvegarde parte aussi sur le cloud.</span>`;
  let s = `Dossier : <b>${esc(o.dossier || '?')}</b>.`;
  if (sauvEtat.ok === true) s += ` <span style="color:#2e7d32">Dernier enregistrement : ${sauvEtat.quand.toLocaleTimeString('fr-FR', {hour:'2-digit',minute:'2-digit'})}.</span>`;
  else if (sauvEtat.ok === false) s += ` <span class="rouge">Problème : ${esc(sauvEtat.msg)}</span> <button class="btn small secondary" onclick="reactiverSauvAuto()">Réactiver</button>`;
  else s += ` <span class="hint">En attente de la première modification.</span>`;
  return s;
}
/* ===== Consultation des données d'un autre ordinateur (dossier de sauvegarde partagé) =====
   Sur le PC de suivi : on désigne une fois le dossier OneDrive partagé où l'autre ordinateur dépose
   ses sauvegardes automatiques, puis « Recharger » importe le fichier le plus récent (remplace tout,
   comme un import). Réglage propre à CETTE machine : jamais emporté dans les exports. */
async function choisirDossierMoine(){
  try {
    const h = await showDirectoryPicker({ id: 'dossier-moine', mode: 'read', startIn: 'documents' });
    try {
      const hs = await fsGet('dossier');
      if (hs && await h.isSameEntry(hs)){
        alert("Ce dossier est celui de la sauvegarde automatique de CET ordinateur.\nChoisir le dossier partagé de l'AUTRE ordinateur (les fichiers des deux machines portent les mêmes noms et s'écraseraient mutuellement via OneDrive).");
        return;
      }
    } catch(e){ /* comparaison impossible : on laisse passer */ }
    await fsSet('dossierMoine', h);
    state.settings.dossierMoine = { actif: true, dossier: h.name };
    save(); render();
    rechargerDonneesMoine();
  } catch(e){ /* choix annulé */ }
}
function retirerDossierMoine(){
  delete state.settings.dossierMoine;
  fsDel('dossierMoine').catch(() => {});
  save(); render();
}
async function rechargerDonneesMoine(){
  try {
    const h = await fsGet('dossierMoine');
    if (!h){ choisirDossierMoine(); return; }
    if (await h.requestPermission({ mode: 'read' }) !== 'granted')
      throw new Error('accès au dossier refusé — recliquer sur le bouton et choisir « Autoriser »');
    const noms = [];
    for await (const n of h.keys()) if (/^tableau-officiers-\d{4}-\d{2}-\d{2}\.json$/.test(n)) noms.push(n);
    if (!noms.length) throw new Error('aucun fichier tableau-officiers-AAAA-MM-JJ.json dans « ' + h.name + ' »');
    noms.sort();
    const nom = noms[noms.length - 1];
    const f = await (await h.getFileHandle(nom)).getFile();
    const data = JSON.parse(await f.text());
    if (!data.moines || !data.services) throw new Error('format inattendu (' + nom + ')');
    const quand = new Date(f.lastModified);
    const qd = quand.toLocaleDateString('fr-FR') + ' à ' + quand.toLocaleTimeString('fr-FR', { hour:'2-digit', minute:'2-digit' });
    if (!confirm('Remplacer toutes les données affichées sur cet ordinateur par le fichier\n« ' + nom + ' » (enregistré le ' + qd + ') ?')) return;
    remplacerDonnees(data);
    bannerMsg = 'Données rechargées depuis « ' + esc(nom) + ' » (dossier « ' + esc(h.name) + ' », enregistré le ' + qd + ').';
    render();
  } catch(e){ alert('Rechargement impossible : ' + (e.message || e)); }
}
// Index des affectations par moine (reconstruit après chaque sauvegarde ou ajout) — l'historique
// depuis 2019 compte ~12 000 lignes, on évite de tout parcourir à chaque calcul
let _affIdx = null, _affIdxLen = -1;
function affsDe(mid){
  if (!_affIdx || _affIdxLen !== state.affectations.length){
    _affIdx = new Map(); _affIdxLen = state.affectations.length;
    for (const a of state.affectations){
      if (!a.moineId) continue;
      let l = _affIdx.get(a.moineId); if (!l) { l = []; _affIdx.set(a.moineId, l); }
      l.push(a);
    }
  }
  return _affIdx.get(mid) || [];
}
function migrate(){
  if (!state.feteStyles) state.feteStyles = defaultFeteStyles();
  for (const r of Object.keys(RANGS)) if (!state.feteStyles[r]) state.feteStyles[r] = defaultFeteStyles()[r];
  if (!state.vaisselleSem) state.vaisselleSem = {};
  for (const w of Object.keys(state.vaisselleSem))
    (state.vaisselleSem[w].ajouts || []).forEach(a => { if (a.pour === undefined) a.pour = null; });
  state.services.forEach(s => { if (s.manuel === undefined) s.manuel = (s.id === 'homelie'); });
  state.affectations.forEach(a => { if (a.nomLibre === undefined) a.nomLibre = null; });
  if ((state.version || 2) < 3){
    // La lecture de la Sainte Règle se fait au réfectoire : même incompatibilité que les services de table
    const lr = state.services.find(s => s.id === 'lecture_regle');
    if (lr) lr.conflitDejeuner = true;
  }
  if ((state.version || 2) < 4){
    const defs = defaultServices();
    // Nouveaux services (2e lecteur, remplaçant de la Règle, 2e soupe) et groupes
    for (const d of defs){
      const s = state.services.find(x => x.id === d.id);
      if (!s) state.services.push(d);
      else { s.groupe = d.groupe; if (s.optionnel === undefined) s.optionnel = d.optionnel; }
    }
    // Soupe avant viande ; hebdomadier ouvert à tous sauf postulants
    const soupe = state.services.find(s => s.id === 'st_soupe'), viande = state.services.find(s => s.id === 'st_viande');
    if (soupe && viande && soupe.ordre > viande.ordre) { soupe.ordre = 20; viande.ordre = 21; }
    const heb = state.services.find(s => s.id === 'hebdomadier');
    if (heb && heb.statuts.length === 1 && heb.statuts[0] === 'pretre') heb.statuts = ['pretre','diacre','frere'];
    if (!state.settings.quinzaine) state.settings.quinzaine = { sunday: state.ui.sunday, couleur: 'rose' };
  }
  state.services.forEach(s => { if (s.optionnel === undefined) s.optionnel = false; if (s.groupe === undefined) s.groupe = null; });
  state.moines.forEach(m => { for (const k of ['naissance','fete','entree']) if (m[k] === undefined) m[k] = null; });
  if (!state.impressions) state.impressions = {};
  if (state.ui.histService === undefined) { state.ui.histService = ''; state.ui.histMoine = ''; }
  // v5 : fêtes de l'année 2026 (ordo) et homélies du 2e semestre 2026, sans écraser l'existant
  if ((state.version || 2) < 5) importerDonnees2026();
  // v6 : types de fêtes personnalisables, fiches inactives, services d'archive, Règle par quinzaine, archive 2019-2026
  if (!state.feteTypes) state.feteTypes = JSON.parse(JSON.stringify(FETE_TYPES_DEFAUT));
  for (const t of state.feteTypes) if (!state.feteStyles[t.key]) state.feteStyles[t.key] = Object.assign({}, defaultFeteStyles().memoire);
  state.moines.forEach(m => { if (m.actif === undefined) m.actif = true; });
  for (const d of defaultServices()){
    const s = state.services.find(x => x.id === d.id);
    if (!s) { if (d.masque) state.services.push(d); }
    else { if (s.masque === undefined) s.masque = !!d.masque; if (s.quinzaine === undefined) s.quinzaine = !!d.quinzaine; }
  }
  state.services.forEach(s => { if (s.masque === undefined) s.masque = false; if (s.quinzaine === undefined) s.quinzaine = false; });
  // L'archive se charge dès qu'elle est disponible et pas encore intégrée (indépendamment de la version :
  // si archive.js manquait à la première ouverture, on réessaie à la suivante)
  if (!state.archiveImportee){
    if (typeof ARCHIVE !== 'undefined') { importerArchive(); state.archiveImportee = true; }
    else bannerMsg = (bannerMsg ? bannerMsg + '<br>' : '') + '⚠ Le fichier <b>archive.js</b> (historique 2019-2026) est introuvable à côté de index.html : copier les 6 fichiers du zip ensemble, puis recharger.';
  }
  // v7 : épître = une par semaine sur la ligne du lundi ; 2e chantre P.U. ; quinzaine du 9-22 août 2026 = feuille affichée
  if ((state.version || 2) < 7) migrerV7();
  // v8 : sacerdoce / profession / saint patron / lecteurs désignés de la Règle, Père Prieur, chantre P.U. mensuel,
  //      mémoires facultatives (italique), corrections de l'ordo 2026
  state.moines.forEach(m => { for (const k of ['ordination','profession','patron']) if (m[k] === undefined) m[k] = null; });
  if (state.settings.prieurId === undefined) state.settings.prieurId = null;
  if (state.corbeille === undefined) state.corbeille = null;
  if ((state.version || 2) < 8) migrerV8();
  // v9 : lecteurs de la Règle = cases « Lecture de la Sainte Règle » / « — remplaçant » des fiches (P. Sébastien / P. Antoine),
  //      chantre remplaçant aligné sur la case chantre
  if ((state.version || 2) < 10) migrerV9();   // (v10 : ré-exécution après correction du rattachement frères / postulants)
  // v11 : date du saint patron (m.patronDate) distincte de la fête du prénom ; affichée dans la colonne Fête de la feuille
  state.moines.forEach(m => { if (m.patronDate === undefined) m.patronDate = null; });
  if ((state.version || 2) < 11){
    for (const m of state.moines)
      if (m.patron === 'St Raphaël Arnaiz Baron' && m.fete === '04-27' && !m.patronDate) { m.patronDate = '04-27'; m.fete = '09-29'; }
  }
  if (state.verrous === undefined) state.verrous = {};   // quinzaines bloquées à la main (garde-fou)
  // v12 : la quinzaine du 9 au 22 août 2026 est remise telle que la feuille imprimée (photo du 18/08/2026)
  if ((state.version || 2) < 12){
    appliquerFeuilleAout2026();
    if (state.corbeille && state.corbeille.start >= '2026-08-09' && state.corbeille.start < '2026-08-23') state.corbeille = null;
    bannerMsg = (bannerMsg ? bannerMsg + '<br>' : '') + 'Quinzaine du 9 au 22 août 2026 remise à l\'identique de la feuille imprimée (fêtes et attributions).';
  }
  // v13 : noms saisis en « personne extérieure » (homélies importées avant la création des fiches de l'archive)
  //       rattachés à la fiche du même nom quand elle existe (P. Xavier, P. Joaquim…) — plus de badge « invité » à tort
  if ((state.version || 2) < 13){
    const r = rattacherNomsLibres();
    if (r.length) bannerMsg = (bannerMsg ? bannerMsg + '<br>' : '') + `${r.length} case${r.length>1?'s':''} « invité » rattachée${r.length>1?'s':''} à la fiche du frère : ${esc([...new Set(r)].join(', '))}.`;
  }
  // v14 : prêtres et diacres jamais serviteur d'église, thuriféraire ni épître (statuts requis sur le service,
  //       case décochée et bloquée dans toutes les fiches)
  if ((state.version || 2) < 14){
    let n = 0;
    for (const sid of ['serviteur_eglise','thuriferaire','epitre']){
      const s = serviceById(sid);
      if (!s) continue;
      s.statuts = sid === 'thuriferaire' ? ['frere'] : ['frere','postulant'];   // thuriféraire : frères seulement (inchangé)
      for (const m of state.moines){
        if (m.statut !== 'pretre' && m.statut !== 'diacre') continue;
        const c = m.capacites[sid];
        if (c && c.ok) { c.ok = false; n++; }
        else if (!c) m.capacites[sid] = { ok:false, max:null, par:'semaine' };
      }
    }
    bannerMsg = (bannerMsg ? bannerMsg + '<br>' : '') + `Serviteur d'église, thuriféraire et épître réservés aux frères et postulants : case décochée et bloquée pour tous les prêtres et diacres${n ? ` (${n} fiches modifiées)` : ''}.`;
    // Attributions déjà posées (quinzaine en cours et suivantes) qui contredisent la règle : signalées, pas retirées
    const q0 = quinzaineDe(todayISO());
    const contra = state.affectations.filter(a => ['serviteur_eglise','thuriferaire','epitre'].includes(a.serviceId) && a.semaine >= q0 && a.moineId
      && ['pretre','diacre'].includes((monkById(a.moineId) || {}).statut))
      .sort((a,b) => (a.date||a.semaine) < (b.date||b.semaine) ? -1 : 1)
      .map(a => `${serviceById(a.serviceId).nom} ${a.date ? 'le ' + frShort(a.date) : 'semaine du ' + frShort(a.semaine)} : ${monkById(a.moineId).nom}`);
    if (contra.length) bannerMsg += ` <span class="rouge">À corriger à la main (déjà attribués à un prêtre) :</span> ${esc(contra.join(' · '))}.`;
  }
  // v15 : services de lecture / chant réservés aux francophones (hebdomadier, lecteur, lecteur 2, chantre P.U. et
  //       remplaçant, lecteur de table, épître) : case décochée et bloquée dans la fiche des non-francophones
  if ((state.version || 2) < 15){
    let n = 0;
    for (const sid of SERVICES_FRANCOPHONES){
      const s = serviceById(sid);
      if (!s) continue;
      s.francophone = true;
      for (const m of state.moines){
        if (m.francophone) continue;
        const c = m.capacites[sid];
        if (c && c.ok) { c.ok = false; n++; }
        else if (!c) m.capacites[sid] = { ok:false, max:null, par:'semaine' };
      }
    }
    if (n) bannerMsg = (bannerMsg ? bannerMsg + '<br>' : '') + `Non-francophones : hebdomadier, lecteur, chantre P.U., lecteur de table et épître décochés et bloqués (${n} cases dans ${state.moines.filter(m => !m.francophone).length} fiches).`;
  }
  // v16 : « P. Prieur » / « R.P. Abbé » restés en nom libre (fiche de ce nom absente) → fiche désignée dans Réglages
  if ((state.version || 2) < 16){
    const r = rattacherNomsLibres();
    if (r.length) bannerMsg = (bannerMsg ? bannerMsg + '<br>' : '') + `${r.length} case${r.length>1?'s':''} « invité » rattachée${r.length>1?'s':''} à la fiche du frère : ${esc([...new Set(r)].join(', '))}.`;
  }
  // v17 : serviteurs de table 2-3-4 = un seul service « Serviteur de table » (sans numéro, compté ensemble) ;
  //       le 1 (serviteur en chef) compté à part ; une seule case dans la fiche pour les trois
  if ((state.version || 2) < 17){
    const s1 = serviceById('st1');
    if (s1 && s1.groupe === 'Serviteur de table') s1.groupe = 'Serviteur de table 1';
    for (const sid of ['st2','st3','st4']){
      const s = serviceById(sid);
      if (!s) continue;
      if (/^Serviteur de table \d$/.test(s.nom)) s.nom = 'Serviteur de table';
      s.groupe = 'Serviteur de table';
    }
    const s5 = serviceById('st5'); if (s5) s5.groupe = 'Serviteur de table';
    for (const m of state.moines){
      const cs = ['st2','st3','st4'].map(sid => m.capacites[sid]).filter(Boolean);
      if (!cs.length) continue;
      const u = { ok: cs.some(c => c.ok), max: cs[0].max || null, par: cs[0].par || 'semaine' };
      for (const sid of ['st2','st3','st4']) m.capacites[sid] = Object.assign({}, u);
    }
  }
  // v18 (retours du frère sur les règles, sept. 2026) :
  //  - Prière universelle réservée aux francophones (case décochée et bloquée ; forçage manuel possible)
  //  - thuriféraire ouvert aux postulants et attendu aussi les jours de FÊTE (pas seulement dim. + solennités)
  //  - nouveaux champs de fiche : profession solennelle, « toujours un 2e lecteur »
  state.moines.forEach(m => { if (m.professionSolennelle === undefined) m.professionSolennelle = null;
                              if (m.besoin2eLecteur === undefined) m.besoin2eLecteur = false;
                              if (m.messePrivee === undefined) m.messePrivee = []; });
  if ((state.version || 2) < 18){
    const pu = serviceById('priere_univ');
    let n = 0;
    if (pu){
      pu.francophone = true;
      for (const m of state.moines){
        if (m.francophone) continue;
        const c = m.capacites.priere_univ;
        if (c && c.ok) { c.ok = false; n++; }
        else if (!c) m.capacites.priere_univ = { ok:false, max:null, par:'semaine' };
      }
    }
    const th = serviceById('thuriferaire');
    if (th){
      th.statuts = ['frere','postulant'];
      if (th.quand === 'dim_sol') th.quand = 'dim_sol_fete';
      // La case thuriféraire des postulants était bloquée d'office (statut interdit) : on la réouvre
      for (const m of state.moines)
        if (m.statut === 'postulant' && m.capacites.thuriferaire && !m.capacites.thuriferaire.ok)
          m.capacites.thuriferaire.ok = true;
    }
    bannerMsg = (bannerMsg ? bannerMsg + '<br>' : '')
      + `Règles mises à jour : prière universelle réservée aux francophones${n ? ` (${n} fiches décochées)` : ''} ; `
      + `thuriféraire ouvert aux postulants et prévu aussi les jours de fête ; délais minimaux entre services lourds `
      + `(3 semaines : serviteur de table / d'église ; 2 semaines : lecteur de table, hebdomadier, lecteur) ; `
      + `un seul service hebdomadaire par frère et par semaine ; samedis sans fête notés « BVM ».`;
  }
  state.version = 18;
}
const SERVICES_FRANCOPHONES = ['hebdomadier','lecteur','lecteur2','chantre_pu','chantre_pu2','lecteur_table','epitre'];
// Affectations à nom libre dont le nom correspond exactement à une (seule) fiche : on les rattache à la fiche
function rattacherNomsLibres(){
  const out = [];
  // « P. Prieur » / « R.P. Abbé » sans fiche de ce nom : la fiche désignée dans Réglages
  const roles = { [normNom('P. Prieur')]: state.settings.prieurId, [normNom('R.P. Abbé')]: state.settings.abbeId };
  for (const a of state.affectations){
    if (a.moineId || !a.nomLibre || a.ancien) continue;
    let ms = state.moines.filter(m => m.actif !== false && normNom(m.nom) === normNom(a.nomLibre));
    if (!ms.length && roles[normNom(a.nomLibre)]) ms = state.moines.filter(m => m.id === roles[normNom(a.nomLibre)]);
    if (ms.length !== 1) continue;
    a.moineId = ms[0].id; a.nomLibre = null; out.push(ms[0].nom);
  }
  if (out.length) _affIdx = null;
  return out;
}
function migrerV9(){
  const parNom = n => state.moines.find(m => normNom(m.nom) === normNom(n)) || null;
  const princ = state.moines.find(m => m.regle === 'principal') || parNom('P. Sébastien');
  const rempl = state.moines.find(m => m.regle === 'remplacant') || parNom('P. Antoine');
  for (const m of state.moines){
    delete m.regle;
    m.capacites.lecture_regle  = Object.assign(m.capacites.lecture_regle  || { max:null, par:'semaine' }, { ok: m === princ });
    m.capacites.lecture_regle2 = Object.assign(m.capacites.lecture_regle2 || { max:null, par:'semaine' }, { ok: m === rempl });
    if (m.capacites.chantre_pu) m.capacites.chantre_pu2 = Object.assign({}, m.capacites.chantre_pu);
  }
  // Les lectures de la Règle à venir (non verrouillées) reviennent aux lecteurs désignés
  const q0 = quinzaineDe(todayISO());
  for (const a of state.affectations){
    if (a.semaine < q0 || a.verrouille || a.date) continue;
    if (a.serviceId === 'lecture_regle' && princ && a.moineId !== princ.id) { a.moineId = princ.id; a.nomLibre = null; }
    if (a.serviceId === 'lecture_regle2' && rempl && a.moineId !== rempl.id) { a.moineId = rempl.id; a.nomLibre = null; }
  }
  _affIdx = null;
  // Liste de la communauté du 22/02/2026 : naissance, entrée, profession, ordination, membres à l'extérieur
  const r = importerCommunaute();
  const li = (t, arr) => arr && arr.length ? ` ${t} : ${esc(arr.join(', '))}.` : '';
  bannerMsg = (bannerMsg ? bannerMsg + '<br>' : '') + `Liste de la communauté (22/02/2026) : ${r.maj} fiches complétées (naissance, entrée, profession, ordination), ${r.crees.length} créées.`
    + li('À l\'extérieur (Latroun, Bádi… → « de passage », proposés seulement pendant un séjour)', r.hors)
    + li('Marqués à l\'extérieur en février mais présents sur le tableau récemment (laissés permanents)', r.revenus)
    + li('Créées', r.crees) + li('Ambigus, non rattachés', r.ambigus) + li('Non rattachés', r.nonTrouves);
  _affIdx = null;
}
// Lecteurs désignés de la Règle : les fiches où la case du service est cochée (normalement une seule chacune)
const lecteursRegle = sid => state.moines.filter(m => m.actif !== false && capOf(m, serviceById(sid)).ok);
function migrerV8(){
  // Type « mémoire facultative » (italique)
  if (!state.feteTypes.find(t => t.key === 'memoire_fac')) state.feteTypes.push({ key:'memoire_fac', label:'Mémoire facultative', solennel:false });
  if (!state.feteStyles.memoire_fac) state.feteStyles.memoire_fac = defaultFeteStyles().memoire_fac;
  // Corrections des fêtes 2026 chargées en v5 (seulement si non modifiées à la main)
  for (const [date, ancien, nouveau, rang] of FETES_V8){
    const f = feteOn(date);
    if (ancien === null) { if (!f) state.fetes.push({ id:'f'+(state.seq.fete++), date, nom: nouveau, rang }); }
    else if (f && f.nom === ancien) { f.nom = nouveau; f.rang = rang; }
  }
  // Père Prieur
  const parNom = n => state.moines.find(m => normNom(m.nom) === normNom(n)) || null;
  if (!state.settings.prieurId && parNom('P. Prieur')) state.settings.prieurId = parNom('P. Prieur').id;
  // Chantre P.U. remplaçant : rempli désormais par la règle du mois (plus « facultatif »)
  const c2 = serviceById('chantre_pu2');
  if (c2) { c2.optionnel = false; if (c2.nom === 'Chantre P.U. 2') c2.nom = 'Chantre P.U. — remplaçant'; }
  // Saint patron cistercien des Raphaël : St Raphaël Arnaiz Baron (27 avril)
  for (const m of state.moines){
    if (/^raphael$/.test(prenomDe(m.nom)) && !m.patron) { m.patron = 'St Raphaël Arnaiz Baron'; m.patronDate = '04-27'; }
  }
  _affIdx = null;
}
function migrerV7(){
  const defs = defaultServices();
  if (!serviceById('chantre_pu2')) state.services.push(defs.find(d => d.id === 'chantre_pu2'));
  const ch = serviceById('chantre_pu'); if (ch && !ch.groupe) ch.groupe = 'Chantre P.U.';
  const ep = serviceById('epitre'); if (ep && ep.quand === 'dim_sol') ep.quand = 'lundi';
  // Les épîtres inscrites un autre jour que le lundi (dimanches générés, archive) passent au lundi de leur semaine ;
  // s'il y en avait deux dans la même semaine, la première est gardée
  const lundis = new Set(state.affectations.filter(a => a.serviceId === 'epitre' && a.date && parseISO(a.date).getDay() === 1).map(a => a.semaine));
  state.affectations = state.affectations.filter(a => {
    if (a.serviceId !== 'epitre' || !a.date || parseISO(a.date).getDay() === 1) return true;
    if (lundis.has(a.semaine)) return false;
    a.date = addDays(a.semaine, 1); lundis.add(a.semaine);
    return true;
  });
  appliquerFeuilleAout2026();
  // Fêtes des moines d'après leur prénom (fiches où elle manque)
  const r = completerFetesPrenoms();
  if (r.n) bannerMsg = (bannerMsg ? bannerMsg + '<br>' : '') + `${r.n} fêtes de moines renseignées d'après les prénoms (onglet Moines).`
    + (r.ambigus.length ? ` À vérifier, plusieurs saints portent ce nom : <b>${esc(r.ambigus.join(', '))}</b>.` : '')
    + (r.inconnus.length ? ` Prénom non reconnu, à saisir à la main : ${esc(r.inconnus.join(', '))}.` : '');
}
/* Remet la quinzaine du 9 au 22 août 2026 (fêtes et affectations) exactement comme la feuille affichée */
function appliquerFeuilleAout2026(){
  const S1 = '2026-08-09', fin = '2026-08-23', samedi = '2026-08-08';
  state.fetes = state.fetes.filter(f => f.date < samedi || f.date >= fin);
  for (const [date, nom, rang] of FEUILLE_AOUT_2026.fetes) state.fetes.push({ id:'f'+(state.seq.fete++), date, nom, rang });
  state.affectations = state.affectations.filter(a => !((a.semaine >= S1 && a.semaine < fin) || (a.serviceId === 'celebrant' && a.date === samedi)));
  const trouver = nom => state.moines.find(m => normNom(m.nom) === normNom(nom)) || null;
  const push = (sid, semaine, date, nom) => {
    if (!serviceById(sid)) return;
    const m = trouver(nom);
    if (m && m.actif === false) m.actif = true;
    state.affectations.push({ id:'a'+(state.seq.affect++), serviceId: sid, semaine, date, moineId: m ? m.id : null, nomLibre: m ? null : nom, verrouille:false });
  };
  for (const [date, sid, nom] of FEUILLE_AOUT_2026.jours) push(sid, sundayOf(date), date, nom);
  for (const [semaine, sid, nom] of FEUILLE_AOUT_2026.semaines) push(sid, semaine, null, nom);
  _affIdx = null;
}
// Première quinzaine consultable : celle de la plus ancienne donnée connue (archive 2019), jamais avant
function premiereQuinzaine(){
  let d = state.affectations.length ? state.affectations.reduce((m, a) => a.semaine < m ? a.semaine : m, '9999') : todayISO();
  if (typeof ARCHIVE !== 'undefined' && ARCHIVE.length && ARCHIVE[0][0] < d) d = ARCHIVE[0][0];
  return quinzaineDe(d);
}
function load(){
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) { state = JSON.parse(raw); migrate(); save(); return; }
  } catch(e) { console.error(e); }
  state = seedState();
  migrate();
  save();
}

const monkById = id => state.moines.find(m => m.id === id);
const serviceById = id => state.services.find(s => s.id === id);
const servicesTries = () => [...state.services].sort((a,b) => a.ordre - b.ordre);
const feteOn = date => state.fetes.find(f => f.date === date);
const isSolennite = date => { const f = feteOn(date); return !!f && rangSolennel(f.rang); };
// Nom du groupe d'un service (Serviteur de table 1..4 → « Serviteur de table »)
const groupeDe = s => s ? (s.groupe || s.nom.replace(/\s+\d+$/, '')) : '?';
// Tous les services du même groupe (pour « ce service » : dernière fois, fréquence, statistiques)
function groupeIds(sid){
  const s = serviceById(sid);
  if (!s) return [sid];
  const g = groupeDe(s);
  return state.services.filter(x => groupeDe(x) === g).map(x => x.id);
}
/* Catégories de charge, indépendantes les unes des autres :
   célébrant / table (services de table + vaisselle) / officiers (tout le reste). */
function catService(s){ return !s ? 'officier' : s.id === 'celebrant' ? 'celebrant' : s.conflitDejeuner ? 'table' : 'officier'; }
function chargeCat(mid, cat, from, to, excludeId){
  let n = 0;
  for (const a of affsDe(mid)){
    if (a.id === excludeId) continue;
    const k = keyOf(a);
    if (k < from || k >= to) continue;
    if (catService(serviceById(a.serviceId)) === cat) n++;
  }
  if (cat === 'table') for (let w = sundayOf(from); w < to; w = addDays(w, 7)) if (deVaisselleSemaine(mid, w)) n++;
  return n;
}
// Charge « pieuse » de la semaine (services d'officiers, hors célébrant, hors table/vaisselle qui sont
// indépendants) — pour le plafond « 2 services par semaine »
function weekLoadTotal(mid, semaine, excludeId){
  return affsDe(mid).filter(a => a.semaine === semaine && a.id !== excludeId && catService(serviceById(a.serviceId)) === 'officier').length;
}
const PLAFOND_SEMAINE = 2;

/* Quinzaines : alignées sur la quinzaine de référence ; couleur de feuille alternée rose / bleu */
function quinzaineDe(date){
  const ref = state.settings.quinzaine.sunday;
  const n = weeksBetween(ref, sundayOf(date));
  return addDays(ref, 14 * Math.floor(n / 2));
}
function couleurQuinzaine(start){
  const ref = state.settings.quinzaine;
  const n = Math.floor(weeksBetween(ref.sunday, start) / 2);
  const paire = ((n % 2) + 2) % 2 === 0;
  return paire ? ref.couleur : (ref.couleur === 'rose' ? 'bleu' : 'rose');
}

/* Anniversaires, fêtes, jubilés d'un moine à une date donnée */
/* Événements d'un moine à une date : fête (saint patron), anniversaire de naissance, anniversaire d'entrée
   au monastère, de sacerdoce ; jubilés (JUBILES) d'entrée, de profession, de sacerdoce. Tous donnent la
   priorité « célébrant principal » à un prêtre ce jour-là (sauf la profession : simple rappel). */
function evenementsMoine(m, date, avecProfession){
  const ev = [], md = date.slice(5), an = Number(date.slice(0,4));
  const ans = d => an - Number(d.slice(0,4));
  const nAns = n => n + ' an' + (n > 1 ? 's' : '');
  const jub = n => JUBILES.includes(n) ? ' — jubilé' : '';
  if (m.fete && m.fete === md) ev.push('fête' + (m.patron && !m.patronDate ? ' (' + m.patron + ')' : ''));
  if (m.patron && m.patronDate && m.patronDate === md) ev.push('saint patron : ' + m.patron);
  if (m.naissance && m.naissance.slice(5) === md) ev.push('anniversaire (' + nAns(ans(m.naissance)) + ')');
  if (m.entree && m.entree.slice(5) === md && ans(m.entree) > 0) ev.push(nAns(ans(m.entree)) + ' d\'entrée au monastère' + jub(ans(m.entree)));
  if (m.ordination && m.ordination.slice(5) === md && ans(m.ordination) > 0) ev.push(nAns(ans(m.ordination)) + ' de sacerdoce' + jub(ans(m.ordination)));
  if (avecProfession && m.profession && m.profession.slice(5) === md && JUBILES.includes(ans(m.profession))) ev.push(nAns(ans(m.profession)) + ' de profession — jubilé');
  if (avecProfession && m.professionSolennelle && m.professionSolennelle.slice(5) === md && JUBILES.includes(ans(m.professionSolennelle))) ev.push(nAns(ans(m.professionSolennelle)) + ' de profession solennelle — jubilé');
  return ev;
}
function fmtFete(md){ return md ? md.slice(3) + '/' + md.slice(0,2) : ''; }   // 'MM-DD' → 'JJ/MM'
function anciennete(m, ref){
  if (!m.entree) return '';
  const n = Math.floor((parseISO(ref || todayISO()) - parseISO(m.entree)) / (365.25 * 86400000));
  return 'entré en ' + m.entree.slice(0,4) + ' (' + n + ' an' + (n > 1 ? 's' : '') + ')';
}
/* Fête du saint patron d'après le prénom de religion (calendrier romain / cistercien) : 'MM-DD'.
   Un point d'interrogation en tête = choix discutable (plusieurs saints du même nom), signalé au moment du remplissage. */
const FETES_PRENOMS = {
  'adam':'12-24', 'adrien':'09-08', 'alexandre':'04-22', 'alexis':'07-17', 'alois':'06-21', 'andre':'11-30',
  'antoine':'?01-17',           // Antoine le Grand, père des moines (Antoine de Padoue = 13 juin)
  'arnaud':'02-10', 'athanase':'05-02', 'augustin':'08-28', 'barnabe':'06-11', 'barthelemy':'08-24', 'basile':'01-02',
  'baudouin':'10-17', 'benjamin':'03-31', 'benoit':'07-11', 'benoit joseph':'04-16', 'bernard':'08-20', 'bernardus':'08-20',
  'charles':'11-04', 'christian':'11-12', 'christophe':'?07-25', 'clement':'11-23', 'corentin':'12-12', 'cyprien':'09-16',
  'cyrille':'?02-14',           // Cyrille et Méthode (Cyrille de Jérusalem = 18 mars, d'Alexandrie = 27 juin)
  'damien':'?09-26',            // Côme et Damien (Damien de Molokaï = 10 mai)
  'daniel':'12-11', 'david':'12-29', 'dismas':'03-25', 'dominique':'08-08', 'dominik':'08-08', 'elisee':'06-14', 'emmanuel':'12-25',
  'etienne':'12-26', 'foucauld':'12-01', 'francois':'10-04', 'francois xavier':'12-03', 'gabriel':'09-29', 'georges':'04-23',
  'gerard':'?10-03', 'godefroid':'11-08', 'godefrois':'11-08', 'gregoire':'09-03', 'guerric':'08-19', 'guillaume':'01-10', 'henri':'07-13',
  'irenee':'06-28', 'jacques':'07-25', 'jean':'?12-27', 'jean baptiste':'06-24', 'jean de dieu':'03-08', 'jean de la croix':'12-14',
  'jean bosco':'01-31', 'jean gabriel':'09-11', 'jean paul':'10-22', 'jean theophane':'02-02', 'jerome':'09-30', 'joachim':'07-26',
  'joaquim':'07-26', 'joseph':'03-19', 'josue':'09-01', 'laurent':'08-10', 'louis':'08-25', 'louis marie':'04-28', 'luc':'10-18',
  'lukas':'10-18', 'marc':'04-25', 'martin':'11-11', 'matej':'05-14', 'matthias':'05-14', 'matthieu':'09-21', 'maxime':'04-14',
  'maximilien':'08-14', 'michel':'09-29', 'mickael':'09-29', 'mutien':'01-30', 'nathanael':'08-24', 'nicolas':'12-06', 'noel':'12-25',
  'pacome':'05-09', 'pascal':'05-17', 'patrick':'03-17', 'paul':'06-29', 'petr':'06-29', 'philippe':'05-03', 'pierre':'06-29',
  'raphael':'?09-29',           // archange (Raphaël Arnaïz, cistercien = 27 avril)
  'remi':'01-15', 'robert':'?01-26', // Robert de Molesme, fondateur de Cîteaux (calendrier civil = 30 avril)
  'roch':'08-16', 'romain':'02-28', 'samuel':'08-20', 'sebastien':'01-20', 'simeon':'02-18', 'theodore':'11-09', 'thierry':'07-01',
  'thomas':'?07-03',            // apôtre (Thomas d'Aquin = 28 janvier)
  'timothee':'01-26', 'vianney':'08-04', 'xavier':'12-03', 'yves':'05-19',
};
// Prénom de religion normalisé : « P. Jean de Dieu » → 'jean de dieu', « F. Martin de R. » → 'martin', « Guillaume II » → 'guillaume'
function prenomDe(nom){
  return normNom(nom).replace(/^(r p|p|f|fr|dom|mgr|pere|frere) /, '').replace(/ (ii|iii|de r)$/, '').trim();
}
const ROLES = ['abbe','prieur','sous prieur','maitre','hote'];
// Remplit la fête des fiches où elle manque ; renvoie { n, ambigus:[noms], inconnus:[noms] }
function completerFetesPrenoms(){
  const res = { n:0, ambigus:[], inconnus:[] };
  for (const m of state.moines){
    if (m.fete) continue;
    const p = prenomDe(m.nom);
    if (ROLES.includes(p)) continue;
    let d = FETES_PRENOMS[p];
    if (!d) { if (m.actif !== false) res.inconnus.push(m.nom); continue; }
    if (d.startsWith('?')) { d = d.slice(1); res.ambigus.push(m.nom + ' (' + fmtFete(d) + ')'); }
    m.fete = d; res.n++;
  }
  return res;
}
function doCompleterFetes(){
  const r = completerFetesPrenoms();
  save(); render();
  alert(`${r.n} fête${r.n>1?'s':''} renseignée${r.n>1?'s':''} d'après les prénoms.`
    + (r.ambigus.length ? `\n\nÀ vérifier (plusieurs saints portent ce nom) : ${r.ambigus.join(', ')}.` : '')
    + (r.inconnus.length ? `\n\nPrénom non reconnu, à saisir à la main : ${r.inconnus.join(', ')}.` : ''));
}
// Rentre-t-il d'absence ce jour-là ? (les 2 premiers jours après son retour, un prêtre n'est pas proposé célébrant)
function retourAbsence(m, date){
  if (m.regime === 'externe')
    return presentOn(m, date) && presentOn(m, addDays(date,-1)) && !presentOn(m, addDays(date,-2));
  return presentOn(m, date) && !presentOn(m, addDays(date,-1));
}
/* Le saint du jour (fête de l'ordo) porte-t-il le prénom de religion de ce moine ? « St Georges et St Adalbert »
   → Georges ; « Sts Basile le Grand et Grégoire… » → Basile, Grégoire ; « St Jean-Marie Vianney » → Vianney. */
const MOTS_FETE = ['st','ste','sts','stes','saint','sainte','saints','bx','bse','bh','b','s','les','de','du','la','le','d'];
function saintDuJourEst(m, date){
  const f = feteOn(date);
  if (!f) return false;
  const norm = s => s.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').replace(/[^a-z\- ]+/g, ' ').replace(/\s+/g, ' ').trim();
  const p = norm(m.nom.replace(/^(R\.?\s?P\.?|P\.|F\.|Fr\.|Dom|Mgr)\s+/i, '')).replace(/ (ii|iii|de r)$/, '');   // 'jean-marie', 'jean de dieu', 'georges'
  if (!p || ROLES.includes(p.replace(/-/g, ' '))) return false;
  const pt = p.split(' ').filter(t => !MOTS_FETE.includes(t)).join(' ');   // 'jean de dieu' → 'jean dieu'
  if (!pt) return false;
  for (const part of norm(f.nom).split(/ et |, | ou /)){
    const toks = part.split(' ').filter(t => t && !MOTS_FETE.includes(t));
    if (!toks.length) continue;
    if (toks.join(' ') === pt || (!pt.includes(' ') && (toks[0] === pt || toks[toks.length-1] === pt))) return true;
  }
  return false;
}
// Le Père Abbé est-il là ce jour-là ? (sinon le Père Prieur le remplace comme célébrant des dimanches / solennités)
function abbePresent(date){
  const a = state.settings.abbeId ? monkById(state.settings.abbeId) : null;
  return !!a && a.actif !== false && presentOn(a, date);
}
/* Priorité d'un moine pour un créneau : 0 = absolue (Père Abbé — ou Père Prieur s'il est absent — dimanche /
   solennité ; lecteur et remplaçant désignés de la Règle), 1 = saint du jour de l'ordo à son prénom,
   1.5 = sa fête / anniversaire / anniversaire d'entrée ou de sacerdoce, 2 = jour de sa messe privée, 3 = aucune */
function prioSlot(m, slot){
  const s = serviceById(slot.serviceId);
  if (s && s.id === 'celebrant' && slot.date){
    const dim = parseISO(slot.date).getDay() === 0, sol = isSolennite(slot.date);
    if (dim || sol){
      if (m.id === state.settings.abbeId) return { n:0, label:'Père Abbé — ' + (sol ? 'solennité' : 'dimanche') };
      if (m.id === state.settings.prieurId && state.settings.prieurId && !abbePresent(slot.date)) return { n:0, label:'Père Prieur — remplace le Père Abbé absent' };
    }
    if (saintDuJourEst(m, slot.date)) return { n:1, label:'saint du jour : ' + feteOn(slot.date).nom };
    const ev = evenementsMoine(m, slot.date);
    if (ev.length) return { n:1.5, label:ev.join(', ') };
    // Jour de messe privée (fiche du prêtre) : proposé en priorité célébrant principal — être célébrant
    // lui tient lieu de messe du jour, et on ne retire aucun concélébrant de la messe conventuelle
    if ((m.messePrivee || []).includes(parseISO(slot.date).getDay())) return { n:2, label:'jour de sa messe privée' };
  }
  if (s && (s.id === 'lecture_regle' || s.id === 'lecture_regle2') && !slot.date){
    // Lecteur et remplaçant désignés dans les fiches (case cochée) : toujours les mêmes
    if (capOf(m, s).ok) return { n:0, label: s.id === 'lecture_regle' ? 'lecteur désigné de la Règle' : 'remplaçant désigné de la Règle' };
  }
  return { n:3, label:'' };
}
// Le célébrant du jour ne fait pas la prière universelle (et inversement)
function conflitCelebrantPU(m, slot, excludeId){
  if (!slot.date) return '';
  const autre = slot.serviceId === 'celebrant' ? 'priere_univ' : slot.serviceId === 'priere_univ' ? 'celebrant' : null;
  if (!autre) return '';
  const a = findAssign(autre, slot.semaine, slot.date);
  return a && a.moineId === m.id && a.id !== excludeId ? (autre === 'celebrant' ? 'célébrant ce jour-là' : 'fait la P.U. ce jour-là') : '';
}
/* Serviteur de table (1 à 4) : la semaine où il sert à table, un frère ne rend aucun autre service
   d'officier, sauf thuriféraire et prière universelle. Célébrant, homélie et lecture de la Règle
   (désignés d'office) ne sont pas concernés ; les autres services de table le sont déjà par la règle
   « un seul service de table par semaine ». */
const SERVITEURS_TABLE = ['st1','st2','st3','st4','st5'];
const COMPAT_SERVITEUR = ['thuriferaire','priere_univ','celebrant','homelie','lecture_regle','lecture_regle2'];
function conflitServiteurTable(m, slot, excludeId){
  const s = serviceById(slot.serviceId);
  if (!s) return '';
  const affs = affsDe(m.id).filter(a => a.semaine === slot.semaine && a.id !== excludeId);
  if (SERVITEURS_TABLE.includes(s.id)){
    const autres = affs.map(a => serviceById(a.serviceId))
      .filter(x => x && !SERVITEURS_TABLE.includes(x.id) && !COMPAT_SERVITEUR.includes(x.id) && !x.conflitDejeuner);
    return autres.length ? 'serviteur de table : incompatible avec « ' + autres[0].nom + ' » cette semaine' : '';
  }
  if (COMPAT_SERVITEUR.includes(s.id) || s.conflitDejeuner) return '';
  return affs.some(a => SERVITEURS_TABLE.includes(a.serviceId)) ? 'serviteur de table cette semaine (compatible seulement avec thuriféraire et P.U.)' : '';
}
/* Services lourds : délai minimal entre deux tours, même si le frère l'a peu rendu.
   3 semaines pleines après serviteur de table (1 à 4), 3 semaines après serviteur d'église —
   chacun de son côté : table et église sont indépendants (table S1 puis église S2 est permis) ;
   2 semaines pleines après lecteur de table, hebdomadier ou lecteur (pris ensemble). */
const DELAIS_SERVICES = [
  { ids:['st1','st2','st3','st4','st5'], semaines:3, label:'serviteur de table' },
  { ids:['serviteur_eglise'], semaines:3, label:"serviteur d'église" },
  { ids:['lecteur_table','hebdomadier','lecteur','lecteur2'], semaines:2, label:'lecteur de table, hebdomadier ou lecteur' },
];
function conflitDelai(m, slot, excludeId){
  for (const d of DELAIS_SERVICES){
    if (!d.ids.includes(slot.serviceId)) continue;
    for (const a of affsDe(m.id)){
      if (a.id === excludeId || a.semaine === slot.semaine || !d.ids.includes(a.serviceId)) continue;
      const ecart = Math.abs(weeksBetween(a.semaine, slot.semaine));
      if (ecart <= d.semaines)
        return d.label + ' la semaine du ' + frShort(a.semaine) + ' (laisser passer ' + d.semaines + ' semaines)';
    }
  }
  return '';
}
/* Pas plus d'un service qui occupe toute la semaine (hebdomadier, lecteur, serviteur d'église,
   lecteur de table, épître, serviteurs de table / soupe / viande) : ces services hebdomadaires
   s'excluent mutuellement sur une même semaine. La vaisselle N'EN FAIT PAS PARTIE (incompatible
   seulement avec les services de table / repas) ; lecture de la Règle (frères désignés) et
   chantre P.U. (mécanique mensuelle) ne comptent pas non plus. */
const SERVICES_HEBDO_EXCLUSIFS = ['hebdomadier','lecteur','lecteur2','serviteur_eglise','lecteur_table','epitre',
  'st1','st2','st3','st4','st5','st_soupe','st_soupe2','st_soupe3','st_viande','plat3_1','plat3_2'];
function conflitHebdo(m, slot, excludeId){
  const s = serviceById(slot.serviceId);
  if (!s) return '';
  // Serviteur d'église et thuriféraire : incompatibles sur une même semaine (dans les deux sens)
  if (s.id === 'thuriferaire' && affsDe(m.id).some(a => a.semaine === slot.semaine && a.id !== excludeId && a.serviceId === 'serviteur_eglise'))
    return "serviteur d'église cette semaine (incompatible avec thuriféraire)";
  if (s.id === 'serviteur_eglise' && affsDe(m.id).some(a => a.semaine === slot.semaine && a.id !== excludeId && a.serviceId === 'thuriferaire'))
    return 'thuriféraire cette semaine (incompatible avec serviteur d\'église)';
  if (!SERVICES_HEBDO_EXCLUSIFS.includes(s.id)) return '';
  // La vaisselle n'entre PAS dans cette exclusion : elle n'est incompatible qu'avec les services
  // de table / repas (règle « de vaisselle cette semaine », via conflitDejeuner)
  const a = affsDe(m.id).find(a => a.semaine === slot.semaine && a.id !== excludeId
    && a.serviceId !== s.id && SERVICES_HEBDO_EXCLUSIFS.includes(a.serviceId)
    && !(s.conflitDejeuner && serviceById(a.serviceId)?.conflitDejeuner));   // les paires table/repas sont déjà signalées
  return a ? 'fait déjà « ' + (serviceById(a.serviceId)?.nom || '?') + ' » cette semaine (un seul service hebdomadaire)' : '';
}
// Modifié depuis la première impression / export de la feuille ? (case jaune)
function estModifie(a, start){
  const t = state.impressions[start];
  return !!(t && a && a.modifieLe && a.modifieLe > t);
}
const maintenant = () => new Date().toISOString();

/* ================= Styles des fêtes ================= */
function feteStyleCss(rang){
  const st = state.feteStyles[rang] || {};
  let css = 'color:' + (st.couleur || '#333') + ';font-size:' + (st.taille || 13) + 'px;';
  if (st.gras) css += 'font-weight:700;';
  if (st.italique) css += 'font-style:italic;';
  if (st.majuscule) css += 'text-transform:uppercase;';
  const pol = POLICES[st.police];
  if (pol && pol[1]) css += 'font-family:' + pol[1] + ';';
  return css;
}
// Saints patrons des frères fêtés ce jour-là (date saisie dans la fiche) → affichés dans la colonne Fête
// de la feuille quand l'ordo n'y met rien (sinon ajoutés après la fête de l'ordo)
function patronsDuJour(date){
  const md = date.slice(5), out = [];
  for (const m of state.moines){
    if (m.actif === false || !m.patron || m.patronDate !== md) continue;
    if (!out.includes(m.patron)) out.push(m.patron);
  }
  return out;
}
function feteAffichee(date){
  const f = feteOn(date), p = patronsDuJour(date);
  // Samedi sans fête ni saint patron : mémoire de la Bienheureuse Vierge Marie (« BVM »)
  if (!f && !p.length && parseISO(date).getDay() === 6) return { nom:'BVM', rang:'memoire' };
  if (!p.length) return f;
  const dejaDedans = f && p.every(x => normNom(f.nom).includes(normNom(x)));
  if (dejaDedans) return f;
  return f ? { nom: f.nom + ' — ' + p.join(', '), rang: f.rang } : { nom: p.join(' et '), rang: 'memoire' };
}
function feteHTML(date){
  const f = feteAffichee(date);
  return f ? `<span style="${feteStyleCss(f.rang)}">${esc(f.nom)}</span>` : '';
}

/* ================= Vaisselle (rotation + ajustements par semaine) ================= */
function vsem(sunday){ return state.vaisselleSem[sunday] || { equipe:null, retraits:[], ajouts:[] }; }
function vsemEdit(sunday){
  if (!state.vaisselleSem[sunday]) state.vaisselleSem[sunday] = { equipe:null, retraits:[], ajouts:[] };
  return state.vaisselleSem[sunday];
}
function equipeVaisselle(sunday){
  const o = vsem(sunday);
  if (o.equipe) return o.equipe;
  const r = state.settings.vaisselleRef;
  const n = weeksBetween(sundayOf(r.sunday), sunday);
  return ((r.equipe - 1 + n) % 3 + 3) % 3 + 1;
}
function membresBaseVaisselle(sunday){
  const eq = equipeVaisselle(sunday), o = vsem(sunday);
  return state.moines.filter(m => m.equipe === eq && !o.retraits.includes(m.id));
}
// Le moine compte-t-il comme « de vaisselle » cette semaine (pour les incompatibilités) ?
function deVaisselleSemaine(mid, sunday){
  const o = vsem(sunday);
  if (o.ajouts.some(a => a.mid === mid)) return true;
  if (o.retraits.includes(mid)) return false;
  const m = monkById(mid);
  return !!m && m.equipe === equipeVaisselle(sunday);
}
// Services de table / repas (conflit déjeuner) du moine cette semaine-là
function servicesDejeuner(mid, sunday, excludeId){
  return affsDe(mid)
    .filter(a => a.semaine === sunday && a.id !== excludeId)
    .map(a => serviceById(a.serviceId))
    .filter(s => s && s.conflitDejeuner)
    .map(s => s.nom);
}
function joursAbsents(m, sunday){
  const out = [];
  for (let i=0;i<7;i++){ const d = addDays(sunday,i); if (!presentOn(m,d)) out.push(d); }
  return out;
}

/* ================= Présence / éligibilité ================= */
// Services « désignés » : jamais cochés par défaut (seuls les frères explicitement cochés les font — Lecture de la Règle)
const SERVICES_DESIGNES = ['lecture_regle', 'lecture_regle2'];
function capOf(m, s){
  return m.capacites[s.id] || { ok: statutAllowed(m, s) && !SERVICES_DESIGNES.includes(s.id), max: null, par: 'semaine' };
}
function statutAllowed(m, s){
  return !s.statuts || s.statuts.length === 0 || s.statuts.includes(m.statut);
}
function presentOn(m, date){
  const dans = (m.periodes || []).some(p => p.debut <= date && date <= p.fin);
  return m.regime === 'externe' ? dans : !dans;
}
function presentAllWeek(m, sunday){
  for (let i=0;i<7;i++) if (!presentOn(m, addDays(sunday,i))) return false;
  return true;
}
function findAssign(serviceId, semaine, date){
  return state.affectations.find(a => a.serviceId === serviceId && a.semaine === semaine && (a.date || null) === (date || null));
}
function keyOf(a){ return a.date || a.semaine; }
function countService(mid, sid, from, to, excludeId){
  const ids = sid === null ? null : groupeIds(sid);
  return affsDe(mid).filter(a =>
    (ids === null || ids.includes(a.serviceId)) &&
    a.id !== excludeId && keyOf(a) >= from && keyOf(a) < to).length;
}
function weekLoad(mid, semaine, excludeId){
  return affsDe(mid).filter(a => a.semaine === semaine && a.id !== excludeId).length;
}
function freqAtteinte(m, s, slot, excludeId){
  const cap = capOf(m, s);
  if (!cap.max) return false;
  let from, to;
  if (cap.par === 'semaine') { from = slot.semaine; to = addDays(slot.semaine, 7); }
  else if (cap.par === 'quinzaine') { from = addDays(slot.semaine, -7); to = addDays(slot.semaine, 14); }
  else if (cap.par === 'trimestre' || cap.par === 'annee') {
    // fenêtre glissante autour de la date visée : les 3 / 12 mois qui précèdent et ceux qui suivent
    const ref = slot.date || slot.semaine, n = cap.par === 'annee' ? 365 : 91;
    from = addDays(ref, -n); to = addDays(ref, n + 1);
    // trop de fois dans les 12 (3) mois avant OU dans les 12 (3) mois après (affectations déjà posées)
    return countService(m.id, s.id, from, addDays(ref, 1), excludeId) >= cap.max
        || countService(m.id, s.id, ref, to, excludeId) >= cap.max;
  }
  else { const d = parseISO(slot.date || slot.semaine); from = iso(new Date(d.getFullYear(), d.getMonth(), 1)); to = iso(new Date(d.getFullYear(), d.getMonth()+1, 1)); }
  return countService(m.id, s.id, from, to, excludeId) >= cap.max;
}

// Raisons d'exclusion STRICTES (utilisées par le générateur)
function reasons(m, slot, excludeId){
  const s = serviceById(slot.serviceId);
  const r = [];
  if (m.actif === false) r.push('ancien membre (fiche inactive)');
  if (!statutAllowed(m, s)) r.push('statut « ' + (STATUTS[m.statut]||m.statut) + ' » non autorisé');
  if (!capOf(m, s).ok) r.push('service désactivé dans sa fiche');
  if (s.francophone && !m.francophone) r.push('non francophone');
  if (slot.date ? !presentOn(m, slot.date) : !presentAllWeek(m, slot.semaine)) r.push('absent sur la période');
  if (s.conflitDejeuner && deVaisselleSemaine(m.id, slot.semaine)) r.push('de vaisselle cette semaine');
  // Un seul service de table / repas par moine et par semaine
  if (s.conflitDejeuner)
    for (const n of servicesDejeuner(m.id, slot.semaine, excludeId)) r.push('fait déjà « ' + n + ' » cette semaine');
  const cpu = conflitCelebrantPU(m, slot, excludeId);
  if (cpu) r.push(cpu);
  const cst = conflitServiteurTable(m, slot, excludeId);
  if (cst) r.push(cst);
  const chd = conflitHebdo(m, slot, excludeId);
  if (chd) r.push(chd);
  const cdl = conflitDelai(m, slot, excludeId);
  if (cdl) r.push(cdl);
  // Un prêtre qui rentre d'absence n'est pas célébrant les 2 premiers jours (sauf le Père Abbé
  // et le Père Prieur un dimanche / une solennité : leur règle passe devant)
  if (s.id === 'celebrant' && slot.date
      && (retourAbsence(m, slot.date) || retourAbsence(m, addDays(slot.date, -1)))
      && !((parseISO(slot.date).getDay() === 0 || isSolennite(slot.date)) && (m.id === state.settings.abbeId || m.id === state.settings.prieurId)))
    r.push("rentre d'absence (pas célébrant les 2 premiers jours)");
  const ccs = conflitCelebrantSuite(m, slot, excludeId);
  if (ccs) r.push(ccs);
  if (freqAtteinte(m, s, slot, excludeId)) r.push('fréquence max atteinte');
  return r;
}
// Pas célébrant principal deux semaines consécutives — sauf si une priorité le désigne ce jour-là
// (Père Abbé / Prieur, saint du jour, fête ou anniversaire, jour de sa messe privée)
function conflitCelebrantSuite(m, slot, excludeId){
  if (slot.serviceId !== 'celebrant' || !slot.date) return '';
  if (prioSlot(m, slot).n < 3) return '';
  const voisin = affsDe(m.id).find(a => a.id !== excludeId && a.serviceId === 'celebrant'
    && a.semaine !== slot.semaine && Math.abs(weeksBetween(a.semaine, slot.semaine)) === 1);
  return voisin ? 'célébrant principal la semaine ' + (voisin.semaine < slot.semaine ? 'précédente' : 'suivante') + ' (pas deux semaines de suite)' : '';
}
// Détail d'absence sur la période du créneau ('' si présent)
function absencePeriode(m, slot){
  if (slot.date) return presentOn(m, slot.date) ? '' : 'absent ce jour';
  const js = joursAbsents(m, slot.semaine);
  if (!js.length) return '';
  return js.length === 7 ? 'absent toute la semaine' : 'absent ' + js.map(frShort).join(', ');
}
// Autres services du même jour (pour signaler « fait déjà l'homélie ce jour-là »)
function memeJour(m, slot, excludeId){
  if (!slot.date) return [];
  return affsDe(m.id)
    .filter(a => a.date === slot.date && a.id !== excludeId)
    .map(a => serviceById(a.serviceId)?.nom || '?');
}
// Avertissements SOUPLES (liste complète : on peut passer outre)
function softWarns(m, slot, excludeId){
  const s = serviceById(slot.serviceId);
  const w = [];
  const abs = absencePeriode(m, slot);
  if (abs) w.push(abs);
  const mj = memeJour(m, slot, excludeId);
  if (mj.length) w.push('fait déjà ' + mj.join(' + ') + ' ce jour-là');
  if (s.conflitDejeuner && deVaisselleSemaine(m.id, slot.semaine)) w.push('de vaisselle cette semaine');
  if (s.conflitDejeuner)
    for (const n of servicesDejeuner(m.id, slot.semaine, excludeId)) w.push('fait déjà « ' + n + ' » cette semaine');
  const cpu = conflitCelebrantPU(m, slot, excludeId);
  if (cpu) w.push(cpu);
  const cst = conflitServiteurTable(m, slot, excludeId);
  if (cst) w.push(cst);
  const chd = conflitHebdo(m, slot, excludeId);
  if (chd) w.push(chd);
  const cdl = conflitDelai(m, slot, excludeId);
  if (cdl) w.push(cdl);
  if (s.id === 'celebrant' && slot.date && (retourAbsence(m, slot.date) || retourAbsence(m, addDays(slot.date, -1))))
    w.push("rentre d'absence (pas célébrant les 2 premiers jours)");
  const ccs = conflitCelebrantSuite(m, slot, excludeId);
  if (ccs) w.push(ccs);
  if (s.francophone && !m.francophone) w.push('non francophone');
  if (freqAtteinte(m, s, slot, excludeId)) w.push('fréquence max atteinte');
  const cs = weekLoadTotal(m.id, slot.semaine, excludeId);
  if (s.id !== 'celebrant' && cs >= PLAFOND_SEMAINE) w.push('déjà ' + cs + ' services cette semaine');
  return w;
}

/* Tri : priorités (Père Abbé, anniversaires, lecteurs désignés de la Règle), puis externes présents,
   puis ceux dont CE service est le plus éloigné (jamais fait = le plus éloigné ; l'a fait récemment
   OU va le faire dans la quinzaine = en dernier), puis les moins chargés de la semaine. La charge de
   la semaine est comptée PAR CATÉGORIE (célébrant / table / officiers) : un service de table ou la
   vaisselle ne pénalise pas pour un service d'officier. Le nombre de fois sur 12 mois reste affiché
   à titre d'information mais n'entre plus dans le tri. */
function scoreMoine(m, slot, excludeId){
  const s = serviceById(slot.serviceId);
  const cat = catService(s);
  const refKey = slot.date || slot.semaine;
  const dp = dernierProchain(m.id, slot.serviceId, refKey, excludeId,
    EQUITE_TABLE.includes(slot.serviceId) ? EQUITE_TABLE : null);
  const jours = (a, b) => Math.round((parseISO(b) - parseISO(a)) / 86400000);
  // Distance (en jours) à la fois la plus proche de ce service : la dernière fois, ou la prochaine
  // si elle tombe dans la quinzaine qui suit (au-delà, elle ne compte pas)
  const aVenir = dp.prochain ? jours(refKey, dp.prochain) : Infinity;
  const prox = Math.min(dp.dernier ? jours(dp.dernier, refKey) : Infinity, aVenir <= PROCHAIN_JOURS ? aVenir : Infinity);
  const pr = prioSlot(m, slot);
  // Les moines de passage sont prioritaires, SAUF pour les services de table / liés à la vaisselle —
  // et seulement pour LEUR PREMIER service pieux de la quinzaine : de retour quelques jours, un frère
  // ne doit pas être enchaîné (thuriféraire trois fois + serviteur d'église...)
  const q0 = quinzaineDe(slot.semaine);
  const pieuxQuinzaine = weekLoadTotal(m.id, q0, excludeId) + weekLoadTotal(m.id, addDays(q0, 7), excludeId);
  return {
    m, cat, prio: pr.n, prioLabel: pr.label,
    externe: (m.regime === 'externe' && !(s && s.conflitDejeuner) && pieuxQuinzaine === 0) ? 0 : 1,
    chargeSemaine: chargeCat(m.id, cat, slot.semaine, addDays(slot.semaine,7), excludeId),
    douzeMois: countService(m.id, slot.serviceId, addDays(refKey, -365), refKey, excludeId),
    total: weekLoadTotal(m.id, slot.semaine, excludeId),
    prox, dp,
    alea: Math.random(),
  };
}
const PROCHAIN_JOURS = 14;   // « va le rendre prochainement » = dans la quinzaine qui suit
function cmpProx(a, b){
  if (a.prox === b.prox) return 0;            // (évite NaN quand les deux valent Infinity)
  return b.prox - a.prox;                     // le plus éloigné (ou jamais fait) d'abord
}
/* Ordre des propositions — le critère d'équité est l'ancienneté du dernier tour (celui qui a rendu
   ce service il y a le plus longtemps passe devant), PAS le nombre de fois sur 12 mois.
   Services pieux (officiers, célébrant) : priorités, moines de passage, puis CE service le plus éloigné
   (jamais fait en tête ; rendu récemment ou à rendre dans la quinzaine en queue), puis le moins
   chargé de la semaine.
   Services de table : priorités, moines de passage, le moins chargé de la semaine, puis le plus éloigné. */
const cmpScore = (a,b) => a.prio - b.prio || a.externe - b.externe ||
  (a.cat === 'table'
    ? (a.chargeSemaine - b.chargeSemaine || cmpProx(a,b))
    : (cmpProx(a,b) || a.chargeSemaine - b.chargeSemaine))
  || a.alea - b.alea;

function candidats(slot, excludeId, exclureMoineId){
  const s = serviceById(slot.serviceId);
  return state.moines
    .filter(m => m.id !== exclureMoineId && reasons(m, slot, excludeId).length === 0)
    .map(m => {
      const sc = scoreMoine(m, slot, excludeId);
      sc.warns = memeJour(m, slot, excludeId).map(n => 'fait déjà ' + n + ' ce jour-là');
      if (s.id !== 'celebrant' && sc.total >= (m.regime === 'externe' ? 1 : PLAFOND_SEMAINE)) sc.warns.push('déjà ' + sc.total + ' service' + (sc.total>1?'s':'') + ' cette semaine' + (m.regime === 'externe' ? ' (de passage : un seul)' : ''));
      return sc;
    })
    .sort((a,b) => a.prio - b.prio || a.warns.length - b.warns.length || cmpScore(a,b));
}
/* Services de la semaine d'un moine. cat = 'table' → seulement les services de table + vaisselle ;
   'officier'/'celebrant' → seulement les services « pieux » (les services de table et la vaisselle
   sont indépendants et n'influencent pas le choix) ; null → tout. */
function tachesSemaine(mid, semaine, excludeId, cat){
  const garde = s => !cat ? true : cat === 'table' ? catService(s) === 'table' : catService(s) !== 'table';
  const t = affsDe(mid)
    .filter(a => a.semaine === semaine && a.id !== excludeId && garde(serviceById(a.serviceId)))
    .map(a => (serviceById(a.serviceId)?.nom || '?') + (a.date ? ' (' + frShort(a.date) + ')' : ''));
  if (!cat || cat === 'table'){
    // La vaisselle est un service d'équipe : on l'affiche aussi
    const aj = vsem(semaine).ajouts.find(x => x.mid === mid);
    if (aj) t.push('Vaisselle (' + (aj.dates ? aj.dates.map(frShort).join(', ') : 'toute la semaine') + ')');
    else if (deVaisselleSemaine(mid, semaine)) t.push('Vaisselle');
  }
  return t;
}
function frCourt(s){ const d = parseISO(s); return JOURS[d.getDay()].slice(0,3) + '. ' + d.getDate() + ' ' + MOIS[d.getMonth()]; }
/* Équité commune entre serviteur de table (2-3-4), soupe et viande : pour l'ordre des propositions,
   ces services comptent comme un seul et même tour (un frère qui vient de faire la soupe passe en
   queue aussi pour serviteur de table). Le serviteur en chef (1) reste compté à part ; les
   statistiques et fréquences max restent par service. */
const EQUITE_TABLE = ['st2','st3','st4','st5','st_soupe','st_soupe2','st_soupe3','st_viande','plat3_1','plat3_2'];
// Dernière fois (≤ réf) et prochaine fois (> réf) où le moine fait CE service
// (idsOverride : services comptés ensemble pour l'occasion — équité commune des services de table)
function dernierProchain(mid, sid, refKey, excludeId, idsOverride){
  let dernier = null, prochain = null;
  const ids = idsOverride || groupeIds(sid);
  for (const a of affsDe(mid)){
    if (!ids.includes(a.serviceId) || a.id === excludeId) continue;
    const k = keyOf(a);
    if (k <= refKey) { if (!dernier || k > dernier) dernier = k; }
    else { if (!prochain || k < prochain) prochain = k; }
  }
  const s = serviceById(sid);
  const fmt = k => (s && s.portee === 'semaine' ? 'la semaine du ' : 'le ') + frDate(k);
  // Vide si le moine n'a ni fait ni à faire ce service : on n'affiche alors rien
  const parts = [];
  if (dernier) parts.push('rendu ' + fmt(dernier));
  if (prochain) parts.push('prochain ' + fmt(prochain));
  return { dernier, prochain, txt: parts.length ? 'Ce service : ' + parts.join(' · ') : '' };
}
// « 7 février 2026 »
function frDate(k){ const d = parseISO(k); return d.getDate() + ' ' + MOIS[d.getMonth()] + ' ' + d.getFullYear(); }

function absentInfo(a){
  const m = a.moineId && monkById(a.moineId);
  if (!m) return '';
  if (a.date) return presentOn(m, a.date) ? '' : 'absent ce jour';
  const js = joursAbsents(m, a.semaine);
  return js.length ? 'absent : ' + js.map(frShort).join(', ') : '';
}

/* ================= Génération ================= */
// Jour où un service quotidien est attendu : tous les jours / dimanches + solennités / chaque lundi (épître de la semaine)
/* Fête de la Vierge Marie ? (quel que soit son rang : « Ste Marie (samedi) », Notre-Dame de…,
   B.V. Marie-Reine, Cœur immaculé, BVM des samedis vides…). Les saints à prénom marial
   (St Jean-Marie Vianney, St Louis-Marie Grignion, Ste Marie-Madeleine…) ne comptent pas. */
const FETE_MARIALE_RE = /notre[ -]dame|vierge marie|^ste marie(?!-)|b\.?v\.? ?marie|^bvm$|immacul|assompt|nom de marie|marie[ -]reine|visitation|annonciation/i;
function estJourParDefaut(s, date){
  if (s.quand === 'dim_sol') return parseISO(date).getDay() === 0 || isSolennite(date);
  if (s.quand === 'dim_sol_fete'){
    if (parseISO(date).getDay() === 0 || isSolennite(date)) return true;
    const f = feteAffichee(date);   // fête affichée : inclut le « BVM » des samedis sans fête
    return !!(f && (f.rang === 'fete' || FETE_MARIALE_RE.test(f.nom)));
  }
  if (s.quand === 'lundi') return parseISO(date).getDay() === 1;
  return true;
}
const QUAND_LABELS = { tous:'tous les jours', dim_sol:'dimanches + solennités', dim_sol_fete:'dimanches + solennités + fêtes + fêtes de la Vierge', lundi:'chaque lundi (un par semaine)' };
function slotsQuinzaine(start){
  const slots = [];
  for (const w of [start, addDays(start,7)])
    for (const s of servicesVisibles().filter(x => x.portee === 'semaine' && (!x.quinzaine || w === start)))
      slots.push({ serviceId: s.id, semaine: w, date: null });
  for (let i=0;i<14;i++){
    const date = addDays(start,i);
    const w = i < 7 ? start : addDays(start,7);
    for (const s of servicesVisibles().filter(x => x.portee === 'jour')){
      if (!estJourParDefaut(s, date)) continue;
      slots.push({ serviceId: s.id, semaine: w, date });
    }
  }
  return slots;
}
// Retire les affectations (non verrouillées, services non manuels) dont le moine est absent, inactif
// ou contredit désormais une règle stricte (fiche modifiée, nouvelle incompatibilité…), pour qu'elles
// soient remplies à nouveau ; renvoie la liste de ce qui a été retiré
function retirerAbsents(start){
  const fin = addDays(start,14);
  const retires = [];
  state.affectations = state.affectations.filter(a => {
    if (a.semaine < start || a.semaine >= fin || a.verrouille || !a.moineId) return true;
    const s = serviceById(a.serviceId);
    if (!s || s.manuel) return true;
    if (s.id === 'lecture_regle' || s.id === 'lecture_regle2') return true;   // lecteurs désignés : toujours les mêmes, même absents
    const m = monkById(a.moineId);
    const abs = absentInfo(a);
    const regles = m && m.actif !== false ? reasons(m, { serviceId: a.serviceId, semaine: a.semaine, date: a.date }, a.id) : [];
    if (!abs && m && m.actif !== false && !regles.length) return true;
    retires.push(m ? m.nom + ' (' + s.nom + (a.date ? ', ' + frShort(a.date) : '')
      + (regles.length && !abs ? ' — ' + regles[0] : '') + ')' : s.nom);
    return false;
  });
  _affIdx = null;   // l'index doit être reconstruit avant la génération (des affectations viennent d'être retirées)
  return retires;
}
/* Chantre P.U. : un chantre principal et un remplaçant PAR MOIS ; le principal du mois devient le
   remplaçant du mois suivant. Le mois d'une semaine = celui de la majorité de ses jours (le mercredi). */
const moisDe = semaine => addDays(semaine, 3).slice(0, 7);
const moisPrec = mois => { const [a, m] = mois.split('-').map(Number); return m === 1 ? (a-1) + '-12' : a + '-' + pad(m-1); };
function chantreDuMois(sid, mois, excludeMid){
  const a = state.affectations.find(x => x.serviceId === sid && !x.date && x.moineId && x.moineId !== excludeMid && moisDe(x.semaine) === mois);
  return a ? a.moineId : null;
}
function ajouterAff(slot, mid){
  state.affectations.push({ id:'a'+(state.seq.affect++), serviceId: slot.serviceId, semaine: slot.semaine, date: slot.date,
    moineId: mid, nomLibre:null, verrouille:false, modifieLe: maintenant() });
}
// Le lecteur de cette semaine a-t-il « toujours un 2e lecteur » coché dans sa fiche ?
function besoin2eLecteur(semaine){
  const a = findAssign('lecteur', semaine, null);
  const m = a && a.moineId && monkById(a.moineId);
  return !!(m && m.besoin2eLecteur);
}
function genererManquants(start){
  const nonPourvus = [];
  for (const slot of slotsQuinzaine(start)){
    const s = serviceById(slot.serviceId);
    // Services à remplir uniquement à la main — sauf le 2e lecteur, rempli d'office quand le lecteur
    // de la semaine a « toujours un 2e lecteur » coché dans sa fiche
    if (s?.manuel) continue;
    if (s?.optionnel && !(s.id === 'lecteur2' && besoin2eLecteur(slot.semaine))) continue;
    if (findAssign(slot.serviceId, slot.semaine, slot.date)) continue;
    // Lecture de la Règle : lecteur et remplaçant désignés dans les fiches, toujours les mêmes
    if (s.id === 'lecture_regle' || s.id === 'lecture_regle2'){
      const ds = lecteursRegle(s.id);
      if (ds.length === 1) { ajouterAff(slot, ds[0].id); continue; }   // même absent : la case reste la sienne
    }
    // Chantre P.U. : même chantre tout le mois ; remplaçant = chantre principal du mois précédent.
    // Jamais reconduit une semaine où il est absent : la case passe alors au circuit normal
    // (candidats présents seulement), comme pour n'importe quel service
    if (s.id === 'chantre_pu' || s.id === 'chantre_pu2'){
      const mois = moisDe(slot.semaine);
      let mid = s.id === 'chantre_pu' ? chantreDuMois('chantre_pu', mois)
        : (chantreDuMois('chantre_pu2', mois) || chantreDuMois('chantre_pu', moisPrec(mois)));
      const cm = mid && monkById(mid);
      if (cm && cm.actif !== false && presentAllWeek(cm, slot.semaine)) { ajouterAff(slot, mid); continue; }
    }
    let c = candidats(slot);
    // Nouveau chantre principal : ni le principal ni le remplaçant du mois précédent
    if (s.id === 'chantre_pu' || s.id === 'chantre_pu2'){
      const mois = moisDe(slot.semaine), autre = s.id === 'chantre_pu' ? 'chantre_pu2' : 'chantre_pu';
      const exclus = [chantreDuMois('chantre_pu', moisPrec(mois)), chantreDuMois('chantre_pu2', moisPrec(mois)), chantreDuMois(autre, mois)].filter(Boolean);
      c = c.filter(x => !exclus.includes(x.m.id));
    }
    // Plafond : 2 services par semaine (hors célébrant), 1 seul pour un moine de passage — dépassé
    // seulement si personne d'autre ; les priorités (Père Abbé, anniversaires…) passent devant le plafond
    const choix = c.find(x => x.prio < 3 || x.total < (x.m.regime === 'externe' ? 1 : PLAFOND_SEMAINE)) || c[0];
    if (choix){
      state.affectations.push({ id:'a'+(state.seq.affect++), serviceId: slot.serviceId,
        semaine: slot.semaine, date: slot.date, moineId: choix.m.id, nomLibre:null, verrouille: false,
        modifieLe: maintenant() });
    } else {
      nonPourvus.push(s.nom + (slot.date ? ' — ' + frShort(slot.date) : ' — semaine du ' + frShort(slot.semaine)));
    }
  }
  ordonnerAnciennete(start); ordonnerAnciennete(addDays(start,7));
  save();
  return nonPourvus;
}
function regenerer(start){
  const fin = addDays(start,14);
  state.affectations = state.affectations.filter(a =>
    a.verrouille || serviceById(a.serviceId)?.manuel || serviceById(a.serviceId)?.optionnel || a.semaine < start || a.semaine >= fin);
  return genererManquants(start);
}
// Serviteurs de table 2-3-4 et soupe 1-2 : du plus ancien au plus jeune (le 1er serviteur = chef, libre)
function ordonnerAnciennete(semaine){
  for (const ids of GROUPES_ANCIENNETE){
    const affs = ids.map(id => findAssign(id, semaine, null)).filter(a => a && a.moineId);
    if (affs.length < 2) continue;
    const cle = m => m.entree || '9999-99-99';
    const moines = affs.map(a => monkById(a.moineId)).sort((x,y) => cle(x) < cle(y) ? -1 : cle(x) > cle(y) ? 1 : 0);
    affs.forEach((a,i) => { if (a.moineId !== moines[i].id) { a.moineId = moines[i].id; a.modifieLe = maintenant(); } });
  }
}

/* ================= Rendu général ================= */
const TABS = [
  ['planning','Planning'], ['agenda','Agenda'], ['moines','Moines'], ['fetes','Apparence des fêtes'],
  ['vaisselle','Vaisselle'], ['stats','Statistiques'], ['reglages','Réglages'],
];
let bannerMsg = '';
function render(){
  $('#tabs').innerHTML = TABS.map(([id,label]) =>
    `<button class="${state.ui.tab===id?'active':''}" onclick="setTab('${id}')">${label}</button>`).join('');
  const r = { planning: renderPlanning, agenda: renderAgenda, moines: renderMoines, fetes: renderStylesFetes,
              vaisselle: renderVaisselle, stats: renderStats, reglages: renderReglages }[state.ui.tab] || renderPlanning;
  // Onglet Planning : aucun bandeau (résultats de « Vider », « Remplir », migrations…) — la grille suffit
  $('#main').innerHTML = (bannerMsg && state.ui.tab !== 'planning' ? `<div class="banner">${bannerMsg}</div>` : '') + r();
  bannerMsg = '';
}
function setTab(t){
  state.ui.tab = t;
  state.ui.rechercheMoine = '';                        // on ne garde pas la recherche d'un onglet à l'autre
  if (t === 'planning') { const q = quinzaineDe(todayISO()); if (q !== state.ui.sunday) debloquees.clear(); state.ui.sunday = q; }   // toujours revenir à la quinzaine en cours
  save(); render();
}

/* ===== Quinzaines bloquées (garde-fou) =====
   Une quinzaine passée est bloquée d'office ; une quinzaine quelconque peut être bloquée à la main (state.verrous).
   « Débloquer pour cette fois » lève le blocage jusqu'au changement de quinzaine ou au rechargement de la page. */
const debloquees = new Set();
function motifBlocage(start){
  if (state.verrous && state.verrous[start]) return 'bloquée à la main';
  if (start < quinzaineDe(todayISO())) return 'passée';
  return null;
}
const quinzaineBloquee = start => !!motifBlocage(start) && !debloquees.has(start);
// Vrai (et fenêtre d'avertissement) si la quinzaine contenant `semaine` est bloquée
function garde(semaine){
  let q = quinzaineDe(semaine || state.ui.sunday);
  // le samedi précédent (1re ligne de la feuille) appartient à la quinzaine affichée, pas à la précédente
  if (semaine === addDays(state.ui.sunday, -7)) q = state.ui.sunday;
  if (!quinzaineBloquee(q)) return false;
  openModal(`<h3>🔒 Quinzaine bloquée</h3>
    <p>La quinzaine du <b>${frShort(q)}</b> est <b>${motifBlocage(q)}</b> : ses cases, fêtes et vaisselle ne se modifient pas par mégarde.</p>
    <p class="hint">« Débloquer pour cette fois » autorise les modifications jusqu'au changement de quinzaine ou au rechargement de la page.</p>
    <div class="modalActions">
      <button class="btn" onclick="debloquer('${q}')">🔓 Débloquer pour cette fois</button>
      <button class="btn secondary" onclick="closeModal()">Fermer</button>
    </div>`);
  return true;
}
function debloquer(start){ debloquees.add(start); closeModal(); }
function rebloquer(start){ debloquees.delete(start); render(); }
function bloquerManuel(start, on){
  if (!state.verrous) state.verrous = {};
  if (on) state.verrous[start] = true; else delete state.verrous[start];
  debloquees.delete(start); save(); render();
}
// Bandeau / bouton de blocage affiché dans le planning
function blocageHTML(start){
  const motif = motifBlocage(start);
  if (!motif) return `<button class="btn ghost" title="Bloquer cette quinzaine (feuille distribuée) : plus aucune modification sans déblocage explicite" onclick="bloquerManuel('${start}', true)">🔒 Bloquer</button>`;
  if (debloquees.has(start))
    return `<span class="badge warn" style="font-size:12px;padding:3px 9px" title="Débloquée pour cette fois : se rebloque au changement de quinzaine ou au rechargement">🔓 débloquée</span>
      <button class="btn small secondary" onclick="rebloquer('${start}')">Rebloquer</button>
      ${state.verrous[start] ? `<button class="btn small ghost" title="Retirer définitivement le blocage manuel de cette quinzaine" onclick="bloquerManuel('${start}', false)">retirer le blocage</button>` : ''}`;
  return `<span class="badge warn" style="font-size:12px;padding:3px 9px" title="Quinzaine ${motif} : cases, fêtes et vaisselle protégées contre les modifications par mégarde">🔒 ${motif}</span>
    <button class="btn small secondary" title="Autoriser les modifications jusqu'au changement de quinzaine ou au rechargement" onclick="debloquer('${start}')">🔓 Débloquer</button>`;
}

/* ================= Onglet Planning ================= */
function slotCell(sid, semaine, date, horsDefaut, start){
  const a = findAssign(sid, semaine, date);
  let cls = 'slot' + (horsDefaut && !a ? ' hors' : '');
  let inner;
  if (a){
    const m = a.moineId && monkById(a.moineId);
    const nom = m ? m.nom : (a.nomLibre || '?');
    const abs = absentInfo(a);
    // Toute modification (fiche, autre case) est répercutée aussitôt : une case qui contredit désormais
    // une règle stricte passe en rouge avec le détail — quinzaines en cours et à venir seulement
    let regles = [];
    if (m && (start || state.ui.sunday) >= quinzaineDe(todayISO()))
      regles = reasons(m, { serviceId: sid, semaine, date }, a.id).filter(x => x !== 'absent sur la période' && x !== 'absent ce jour');
    if (abs || regles.length) cls += ' absCell';
    if (estModifie(a, start || state.ui.sunday)) cls += ' modif';
    inner = esc(nom)
      + (a.verrouille ? '<span class="lock" title="Verrouillé">🔒</span>' : '')
      + (m && m.regime === 'externe' ? '<span class="badge externe">ext.</span>' : '')
      + (!m && !a.ancien ? '<span class="badge invite">invité</span>' : '')
      + (abs ? `<span class="badge warn" title="${esc(abs)}">absent</span>` : '')
      + (regles.length ? `<span class="badge warn" title="${esc(regles.join(' · '))}">règle</span>` : '');
  } else {
    inner = `<span class="empty">${horsDefaut ? '+' : '—'}</span>`;
  }
  return `<td class="${cls}" onclick="openSlot('${sid}','${semaine}','${date||''}')">${inner}</td>`;
}

// Périodes chevauchant la quinzaine affichée, bornées à celle-ci
function periodesQuinzaine(start, regime){
  const fin = addDays(start, 13);
  const out = [];
  for (const m of state.moines){
    if (m.regime !== regime) continue;
    for (const p of (m.periodes || [])){
      if (p.debut <= fin && p.fin >= start){
        const d1 = p.debut < start ? start : p.debut;
        const d2 = p.fin > fin ? fin : p.fin;
        out.push(esc(m.nom) + ' (' + (d1 === d2 ? frShort(d1) : frShort(d1) + ' → ' + frShort(d2)) + ')');
      }
    }
  }
  return out;
}

/* ================= Onglet Agenda : absences, séjours, fêtes / anniversaires / jubilés ================= */
function renderAgenda(){
  const start = quinzaineDe(state.ui.sunday || todayISO());
  const horizon = state.ui.agendaJours || 28;
  const fin = addDays(start, horizon);
  const nomLien = m => `<a href="#" onclick="editMoine('${m.id}');return false">${esc(m.nom)}</a>`;
  // Absences (permanents) et séjours (de passage) chevauchant la période
  const periodes = regime => {
    const rows = [];
    for (const m of state.moines){
      if (m.regime !== regime || m.actif === false) continue;
      for (const p of (m.periodes || [])) if (p.debut < fin && p.fin >= start) rows.push({ m, p });
    }
    return rows.sort((a,b) => a.p.debut < b.p.debut ? -1 : a.p.debut > b.p.debut ? 1 : a.m.nom.localeCompare(b.m.nom));
  };
  const tablePeriodes = (rows, titre, vide, rouge) => {
    let h = `<div class="card"><h3>${titre}</h3>`;
    if (!rows.length) return h + `<p class="hint">${vide}</p></div>`;
    h += `<table class="grid"><tr><th>Moine</th><th>Du</th><th>Au</th><th>Durée</th></tr>`;
    for (const { m, p } of rows){
      const j = Math.round((parseISO(p.fin) - parseISO(p.debut)) / 86400000) + 1;
      h += `<tr><td class="${rouge?'rouge':''}"><b>${nomLien(m)}</b></td><td>${frLong(p.debut)}</td><td>${frLong(p.fin)}</td><td class="hint">${j} jour${j>1?'s':''}</td></tr>`;
    }
    return h + `</table></div>`;
  };
  // Fêtes, anniversaires, entrée, sacerdoce, jubilés, saint du jour au prénom d'un frère
  let ev = '';
  let n = 0;
  for (let d = start; d < fin; d = addDays(d, 1)){
    const items = [];
    for (const m of state.moines){
      if (m.actif === false) continue;
      const e = evenementsMoine(m, d, true);
      if (m.fete !== d.slice(5) && saintDuJourEst(m, d)) e.push('saint du jour : ' + feteOn(d).nom);
      for (const x of e) items.push({ m, x });
    }
    if (!items.length) continue;
    n++;
    const f = feteOn(d);
    items.forEach(({ m, x }, i) => {
      ev += `<tr class="${parseISO(d).getDay()===0?'dimRow':''}">${i === 0 ? `<td rowspan="${items.length}"><b>${frLong(d)}</b>${f ? `<br><span class="hint">${esc(f.nom)}</span>` : ''}</td>` : ''}
        <td>${nomLien(m)}${m.statut==='pretre'?' <span class="hint">(prêtre)</span>':''}</td><td>${/jubil/.test(x) ? '<b>' + esc(x) + '</b>' : esc(x)}</td></tr>`;
    });
  }
  const opts = [[28,'4 semaines'],[91,'3 mois'],[182,'6 mois'],[365,'12 mois']];
  return `
  <div class="toolbar">
    <span>À partir de la quinzaine du <b>${frLong(start)}</b></span>
    <button class="btn secondary" onclick="state.ui.sunday=addDays(state.ui.sunday,-14);save();render()">◀</button>
    <button class="btn secondary" onclick="state.ui.sunday=quinzaineDe(todayISO());save();render()">Aujourd'hui</button>
    <button class="btn secondary" onclick="state.ui.sunday=addDays(state.ui.sunday,14);save();render()">▶</button>
    <label>Horizon <select onchange="state.ui.agendaJours=Number(this.value);save();render()">
      ${opts.map(([v,l]) => `<option value="${v}" ${horizon===v?'selected':''}>${l}</option>`).join('')}</select></label>
  </div>
  <div class="twoCol">
    ${tablePeriodes(periodes('permanent'), 'Absences', 'Aucune absence signalée sur la période.', true)}
    ${tablePeriodes(periodes('externe'), 'Séjours des moines de passage', 'Aucun séjour sur la période.', false)}
  </div>
  <div class="card"><h3>Fêtes, anniversaires, entrée au monastère, sacerdoce, jubilés</h3>
    <p class="hint">Les prêtres concernés sont proposés célébrant principal ce jour-là (saint du jour de l'ordo d'abord, puis fête, anniversaire, entrée, sacerdoce). Les jubilés (${JUBILES.join('/')} ans) sont en gras.</p>
    ${n ? `<table class="grid"><tr><th>Date</th><th>Moine</th><th>Événement</th></tr>${ev}</table>` : '<p class="hint">Rien sur la période.</p>'}
  </div>`;
}

function conflitsAbsences(start){
  const fin = addDays(start,14);
  return state.affectations
    .filter(a => a.semaine >= start && a.semaine < fin)
    .map(a => ({ a, abs: absentInfo(a) }))
    .filter(x => x.abs)
    .map(x => {
      const s = serviceById(x.a.serviceId);
      const m = monkById(x.a.moineId);
      return `<b>${esc(m?.nom||'?')}</b> (${esc(s?.nom||'?')}${x.a.date ? ', ' + frShort(x.a.date) : ', semaine du ' + frShort(x.a.semaine)}) — ${esc(x.abs)}`;
    });
}

function vaissellePanel(w){
  const eq = equipeVaisselle(w), o = vsem(w);
  const membres = membresBaseVaisselle(w).sort((a,b) => a.nom.localeCompare(b.nom));
  let html = `<div class="card"><h3>Vaisselle — ${frWeekRange(w)}</h3>
  <div style="margin-bottom:8px">Équipe de service :
    <select onchange="setEquipeSemaine('${w}', this.value)">
      <option value="">rotation normale (équipe ${(function(){ const o2=vsem(w); const bak=o2.equipe; o2.equipe=null; const e=equipeVaisselle(w); o2.equipe=bak; return e; })()})</option>
      ${[1,2,3].map(n => `<option value="${n}" ${o.equipe===n?'selected':''}>équipe ${n}</option>`).join('')}
    </select></div><ul class="vList">`;
  const ajoutsIdx = o.ajouts.map((aj,idx) => ({ aj, idx }));
  for (const m of membres){
    const js = joursAbsents(m, w);
    const rempl = ajoutsIdx.filter(x => x.aj.pour === m.id);
    html += `<li>${esc(m.nom)}`;
    if (js.length){
      html += ` <span class="rouge">absent ${js.map(frShort).join(', ')}</span>`;
      if (!rempl.length) html += ` <button class="btn small secondary" onclick="openRenfort('${w}','${js.join('|')}','${m.id}')">Remplacer ces jours</button>`;
    }
    html += ` <button class="btn small ghost" title="Retirer de la vaisselle cette semaine" onclick="retirerVaisselle('${w}','${m.id}')">✕ semaine</button>`;
    for (const x of rempl){
      const rm = monkById(x.aj.mid);
      if (rm) html += `<div class="sousLigne rouge">→ remplaçant : ${esc(rm.nom)}
        ${x.aj.dates ? '(' + x.aj.dates.map(frShort).join(', ') + ')' : '(toute la semaine)'}
        <button class="btn small ghost" onclick="retirerAjout('${w}',${x.idx})">✕</button></div>`;
    }
    html += `</li>`;
  }
  for (const mid of o.retraits){
    const m = monkById(mid);
    if (m) html += `<li class="strike">${esc(m.nom)} <button class="btn small ghost" onclick="reintegrerVaisselle('${w}','${mid}')">réintégrer</button></li>`;
  }
  for (const x of ajoutsIdx.filter(x => !x.aj.pour || !membres.some(m => m.id === x.aj.pour))){
    const m = monkById(x.aj.mid);
    if (m) html += `<li class="rouge">＋ ${esc(m.nom)} ${x.aj.dates ? '(' + x.aj.dates.map(frShort).join(', ') + ')' : '(toute la semaine)'}
      <button class="btn small ghost" onclick="retirerAjout('${w}',${x.idx})">✕</button></li>`;
  }
  html += `</ul><button class="btn small secondary" onclick="openRenfort('${w}','','')">+ Ajouter un renfort (toute la semaine)</button>
  <p class="hint">Les remplaçants ajoutés apparaissent <span class="rouge">en rouge</span>.
  Un moine retiré redevient disponible pour les services du déjeuner (lecture de table…).</p></div>`;
  return html;
}

// Anniversaires, fêtes et jubilés sur la période [start-1, start+13]
// Fêtes, anniversaires de naissance et d'entrée au monastère des 4 semaines à venir (à partir de la quinzaine affichée)
function evenementsQuinzaine(start){
  const out = [];
  for (let i=-1;i<28;i++){
    const date = addDays(start,i);
    const items = [];
    for (const m of state.moines){
      if (m.actif === false) continue;
      const ev = evenementsMoine(m, date, true);
      if (m.fete !== date.slice(5) && saintDuJourEst(m, date)) ev.push('saint du jour : ' + feteOn(date).nom);
      if (ev.length) items.push(esc(m.nom) + ' (' + esc(ev.join(', ')) + ')');
    }
    if (items.length) out.push('<b>' + frCourt(date) + '</b> : ' + items.join(', '));
  }
  return out;
}

function renderPlanning(){
  const start = state.ui.sunday;
  const jours = servicesVisibles().filter(s => s.portee === 'jour');
  const semaines = servicesVisibles().filter(s => s.portee === 'semaine');
  const weeks = [start, addDays(start,7)];
  const imprimee = state.impressions[start];
  const bloquee = quinzaineBloquee(start);

  // Barre unique : navigation, blocage, actions. Les absences / fêtes / jubilés sont dans l'onglet Agenda ;
  // les cases d'un frère absent sont en rouge dans la grille (badge « absent »), les cases modifiées depuis l'impression en jaune.
  let html = `<div class="${bloquee ? 'bloquee' : ''}">
  <div class="toolbar compact">
    <button class="btn secondary" onclick="movePlanning(-14)" title="Quinzaine précédente" ${start <= premiereQuinzaine() ? 'disabled' : ''}>◀</button>
    <input type="date" value="${start}" min="${premiereQuinzaine()}" onchange="setSunday(this.value)">
    <button class="btn secondary" onclick="movePlanning(14)" title="Quinzaine suivante">▶</button>
    ${blocageHTML(start)}
    <span style="flex:1"></span>
    <button class="btn" onclick="doGenerer()" ${bloquee ? 'disabled' : ''} title="Remplit les cases vides et remplace les moines absents (sauf cases verrouillées et homélie)">Remplir</button>
    <button class="btn danger" onclick="viderFeuille()" ${bloquee ? 'disabled' : ''} title="Retire toutes les attributions de la quinzaine affichée (fêtes, homélies et vaisselle conservées) pour repartir d'une feuille vierge">Vider</button>
    ${state.corbeille ? `<button class="btn secondary" onclick="annulerVidage()" title="Rétablit les ${state.corbeille.affs.length} attributions retirées (${esc(state.corbeille.quoi)})">↶ Annuler</button>` : ''}
    <button class="btn secondary" onclick="imprimer()" title="Imprimer la feuille">🖨 Imprimer</button>
    <button class="btn secondary" onclick="exportXLSX()" title="Télécharger la feuille en Excel">⬇ Excel</button>
    ${imprimee ? `<button class="btn ghost" title="Les cases modifiées depuis la première impression sont en jaune : remettre à zéro" onclick="effacerSurlignage()">effacer le jaune</button>` : ''}
  </div>`;

  html += `<div class="card"><h3>Services quotidiens</h3><div style="overflow-x:auto"><table class="grid sheet"><tr><th>Date</th><th>Fête</th>`;
  jours.forEach(s => html += `<th>${esc(s.nom)}</th>`);
  html += `</tr>`;
  // La feuille commence au samedi précédent (elle est affichée le vendredi soir)
  for (let i=-1;i<14;i++){
    const date = addDays(start,i);
    const w = i < 0 ? addDays(start,-7) : i < 7 ? weeks[0] : weeks[1];
    if (i === 0 || i === 7)
      html += `<tr class="weekSep"><td colspan="${jours.length+2}">${frWeekRange(w)}</td></tr>`;
    const dim = parseISO(date).getDay() === 0;
    html += `<tr class="${i<0?'prevSat':''}"><td class="dateCol ${dim?'dimRow':''}">${frShort(date)}${i<0?' <span class="hint">(sem. préc.)</span>':''}</td>
      <td class="slot feteCell" onclick="openFete('${date}')">${feteHTML(date) || '<span class="empty">+</span>'}</td>`;
    for (const s of jours) html += slotCell(s.id, w, date, !estJourParDefaut(s, date), start);
    html += `</tr>`;
  }
  html += `</table></div></div>`;

  html += `<div class="twoCol">`;
  for (const w of weeks){
    html += `<div class="card"><h3 style="display:flex;align-items:center;gap:10px">${frWeekRange(w)}
      <button class="btn small danger" style="margin-left:auto;font-weight:400" onclick="viderFeuille('${w}')" ${bloquee ? 'disabled' : ''} title="Retire toutes les attributions de cette semaine (homélies, fêtes et vaisselle conservées)">Vider la semaine</button></h3><table class="grid sheet">`;
    for (const s of semaines){
      if (s.quinzaine && w !== start) continue;   // services de la quinzaine : une seule fois, sous la 1re semaine
      html += `<tr><th style="width:45%">${esc(s.nom)}${s.optionnel ? ' <span style="font-weight:400;opacity:.7">(facultatif)</span>' : ''}${s.quinzaine ? ' <span style="font-weight:400;opacity:.7">(quinzaine)</span>' : ''}</th>${slotCell(s.id, w, null, s.optionnel, start)}</tr>`;
    }
    html += `</table></div>`;
  }
  html += `</div><div class="twoCol">`;
  for (const w of weeks) html += `<div>${vaissellePanel(w)}</div>`;
  html += `</div></div>`;
  return html;
}
// Changer de quinzaine affichée (les déblocages « pour cette fois » tombent)
function allerQuinzaine(q){
  const min = premiereQuinzaine();
  q = q < min ? min : q;
  if (q !== state.ui.sunday) debloquees.clear();
  state.ui.sunday = q; save(); render();
}
function setSunday(v){ if(!v) return; allerQuinzaine(quinzaineDe(v)); }
function movePlanning(n){ allerQuinzaine(addDays(state.ui.sunday, n)); }
// Feuille vierge : retire toutes les attributions de la quinzaine (y compris verrouillées), sauf les services
// remplis à la main (homélie) ; fêtes et vaisselle intactes
function viderFeuille(semaine){
  if (garde(semaine)) return;
  const start = semaine || state.ui.sunday, fin = addDays(start, semaine ? 7 : 14);
  const quoi = semaine ? 'la semaine ' + frWeekRange(start).toLowerCase() : 'la quinzaine du ' + frShort(start);
  const cible = a => a.semaine >= start && a.semaine < fin && !serviceById(a.serviceId)?.manuel;
  const n = state.affectations.filter(cible).length;
  if (!n) { alert('Aucune attribution à retirer pour ' + quoi + '.'); return; }
  if (!confirm(`Retirer les ${n} attributions de ${quoi} (cases verrouillées comprises) ?\nHomélies, fêtes et vaisselle sont conservées. (« Annuler » permet de revenir en arrière.)`)) return;
  state.corbeille = { quoi, start, affs: state.affectations.filter(cible) };   // pour « Annuler »
  state.affectations = state.affectations.filter(a => !cible(a));
  save();
  bannerMsg = `${n} attributions retirées (${quoi}) — « Remplir les cases » pour tout reproposer, ou <button class="btn small secondary" onclick="annulerVidage()">↶ Annuler</button>`;
  render();
}
// Rétablit les attributions retirées par le dernier « Vider »
function annulerVidage(){
  const c = state.corbeille;
  if (!c || garde(c.start)) return;
  const ids = new Set(state.affectations.map(a => a.id));
  const cles = new Set(state.affectations.map(a => a.serviceId + '|' + a.semaine + '|' + (a.date || '')));
  let n = 0;
  for (const a of c.affs){
    if (ids.has(a.id) || cles.has(a.serviceId + '|' + a.semaine + '|' + (a.date || ''))) continue;   // case déjà re-remplie : on ne l'écrase pas
    state.affectations.push(a); n++;
  }
  state.corbeille = null;
  state.ui.sunday = quinzaineDe(c.start);
  save();
  bannerMsg = `${n} attributions rétablies (${c.quoi}).` + (n < c.affs.length ? ` ${c.affs.length - n} cases avaient été re-remplies entre-temps et ont été laissées telles quelles.` : '');
  render();
}
function effacerSurlignage(){ state.impressions[state.ui.sunday] = maintenant(); save(); render(); }
function doGenerer(){
  if (garde()) return;
  const start = state.ui.sunday;
  const retires = retirerAbsents(start);
  const manquants = genererManquants(start);
  const parts = [];
  if (retires.length) parts.push('<b>Remplacés (absents) :</b> ' + retires.map(esc).join(' · '));
  parts.push(manquants.length
    ? '<b>Services non pourvus (aucun moine éligible) :</b> ' + manquants.map(esc).join(' · ')
    : 'Quinzaine complète : toutes les cases sont remplies.');
  bannerMsg = parts.join('<br>');
  render();
}

/* ===== Vaisselle par semaine : actions ===== */
function setEquipeSemaine(w, v){ if (garde(w)) { render(); return; } vsemEdit(w).equipe = v ? Number(v) : null; save(); render(); }
function retirerVaisselle(w, mid){ if (garde(w)) return; vsemEdit(w).retraits.push(mid); save(); render(); }
function reintegrerVaisselle(w, mid){
  if (garde(w)) return;
  const o = vsemEdit(w); o.retraits = o.retraits.filter(x => x !== mid); save(); render();
}
function retirerAjout(w, idx){
  if (garde(w)) return;
  const o = vsemEdit(w); o.ajouts.splice(idx, 1); save(); render();
}
function openRenfort(w, datesStr, pourMid, forcer){
  if (garde(w)) return;
  const dates = datesStr ? datesStr.split('|') : null;
  const eq = equipeVaisselle(w);
  const pour = pourMid ? monkById(pourMid) : null;
  const jours = dates || [0,1,2,3,4,5,6].map(i => addDays(w, i));
  // Déjà de vaisselle (équipe de la semaine ou déjà renfort) : jamais listés
  const dejaVaisselle = m => m.actif === false || m.equipe === eq || vsem(w).ajouts.some(a => a.mid === m.id);
  // Motifs d'exclusion : service de table / repas cette semaine, ou absent sur les jours voulus
  const motifs = m => {
    const r = servicesDejeuner(m.id, w).map(n => 'fait « ' + n + ' » cette semaine');
    const abs = jours.filter(d => !presentOn(m, d));
    if (abs.length) r.push(abs.length === jours.length ? 'absent' : 'absent ' + abs.map(frShort).join(', '));
    return r;
  };
  const score = m => ({ m, chargeSemaine: weekLoad(m.id, w),
    douzeMois: chargeCat(m.id, 'table', addDays(w,-365), w),   // services de table + vaisselle sur 12 mois
    taches: tachesSemaine(m.id, w) });
  const cands = state.moines
    .filter(m => !dejaVaisselle(m) && motifs(m).length === 0)
    .map(score)
    .sort((a,b) => (a.m.regime==='externe') - (b.m.regime==='externe') ||
      a.chargeSemaine - b.chargeSemaine || a.douzeMois - b.douzeMois || a.m.nom.localeCompare(b.m.nom));
  const exclus = forcer ? state.moines
    .filter(m => !dejaVaisselle(m) && motifs(m).length > 0)
    .map(m => ({ m, raisons: motifs(m), taches: tachesSemaine(m.id, w) }))
    .sort((x,y) => x.m.nom.localeCompare(y.m.nom)) : [];
  let html = `<h3>${pour ? 'Remplaçant vaisselle de ' + esc(pour.nom) : 'Renfort vaisselle'} — ${frWeekRange(w)}</h3>
  <p>${dates ? 'Jours : <b>' + dates.map(frShort).join(', ') + '</b>' : 'Toute la semaine'}
  — tous les moines hors équipe ${eq}, présents et sans service de table ou de réfectoire cette semaine
  (lecteur et serviteurs de table, viande, soupe : incompatibles), les moins chargés d'abord. Cliquer pour choisir.</p>
  <input id="listFilter" placeholder="🔎 Rechercher un moine…" style="width:250px;margin-bottom:8px"
    oninput="filtrerListe(this.value)">
  <div style="max-height:420px;overflow:auto"><table class="grid">
  <tr><th>Moine</th><th>Ses services cette semaine</th><th>Semaine</th><th title="Services de table et vaisselle sur les 12 derniers mois">Table / vaisselle<br>sur 12 mois</th></tr>`;
  for (const c of cands)
    html += `<tr class="candRow" data-nom="${esc(c.m.nom.toLowerCase())}"
      onclick="addRenfort('${w}','${c.m.id}','${datesStr}','${pourMid||''}')">
      <td>${esc(c.m.nom)}${c.m.regime==='externe'?'<span class="badge externe">de passage</span>':''}</td>
      <td class="hint">${c.taches.length ? esc(c.taches.join(', ')) : '—'}</td>
      <td style="text-align:center">${c.chargeSemaine}</td>
      <td style="text-align:center">${c.douzeMois}</td></tr>`;
  if (forcer){
    html += `<tr><th colspan="4" style="background:#fdecec;color:#a00">Hors critères — forçage possible, avec confirmation</th></tr>`;
    for (const x of exclus)
      html += `<tr class="candRow" data-nom="${esc(x.m.nom.toLowerCase())}"
        onclick="addRenfort('${w}','${x.m.id}','${datesStr}','${pourMid||''}')">
        <td class="rouge">${esc(x.m.nom)}</td>
        <td class="hint">${x.taches.length ? esc(x.taches.join(', ')) : '—'}</td>
        <td></td>
        <td><span class="rouge">${esc(x.raisons.join(' · '))}</span></td></tr>`;
    if (!exclus.length) html += `<tr><td colspan="4" class="hint">Aucun moine hors critères.</td></tr>`;
  }
  html += `</table></div><div class="modalActions">
    ${forcer ? '' : `<button class="btn secondary" onclick="openRenfort('${w}','${datesStr}','${pourMid||''}',1)">Forcer un moine hors critères…</button>`}
    <button class="btn secondary" onclick="closeModal()">Annuler</button></div>`;
  openModal(html);
}
function addRenfort(w, mid, datesStr, pourMid){
  const m = monkById(mid);
  const jours = datesStr ? datesStr.split('|') : [0,1,2,3,4,5,6].map(i => addDays(w, i));
  const warns = servicesDejeuner(mid, w).map(n => 'fait « ' + n + ' » cette semaine (incompatible avec la vaisselle)');
  const abs = jours.filter(d => !presentOn(m, d));
  if (abs.length) warns.push('absent ' + abs.map(frShort).join(', '));
  if (warns.length && !confirm(m.nom + ' — déconseillé :\n– ' + warns.join('\n– ') + '\n\nMettre quand même à la vaisselle ?')) return;
  vsemEdit(w).ajouts.push({ mid, dates: datesStr ? datesStr.split('|') : null, pour: pourMid || null });
  save(); closeModal();
}

/* ================= Modales génériques ================= */
function openModal(html){
  const box = $('#modalBox');
  box.oninput = box.onchange = null;
  box.innerHTML = html;
  $('#modalOverlay').classList.remove('hidden');
}
function closeModal(){ $('#modalOverlay').classList.add('hidden'); render(); }

/* ================= Modale d'affectation ================= */
function openSlot(sid, semaine, dateStr){
  if (garde(semaine)) return;
  const date = dateStr || null;
  const s = serviceById(sid);
  const a = findAssign(sid, semaine, date);
  const slot = { serviceId: sid, semaine, date };
  const cur = a && a.moineId ? monkById(a.moineId) : null;
  const best = candidats(slot, a ? a.id : undefined, cur ? cur.id : null)[0];

  let html = `<h3>${esc(s.nom)} — ${date ? frLong(date) : frWeekRange(semaine)}</h3>`;
  if (a){
    const abs = absentInfo(a);
    html += `<p>Actuellement : <b>${esc(cur ? cur.nom : (a.nomLibre || '?'))}</b> ${a.verrouille?'🔒':''}
      ${abs ? `<span class="rouge">⚠ ${esc(abs)}</span>` : ''}</p>`;
    // Badge « règle » sur la case : détail en clair de ce qui ne va pas
    const regles = cur ? reasons(cur, slot, a.id).filter(x => x !== 'absent sur la période' && x !== 'absent ce jour') : [];
    if (regles.length)
      html += `<div style="background:#fdecec;border:1px solid #f0b8b8;border-radius:6px;padding:8px 12px;margin:6px 0">
        <b class="rouge">⚠ Cette case contredit ${regles.length > 1 ? 'des règles' : 'une règle'} :</b>
        <ul style="margin:6px 0 0;padding-left:20px">${regles.map(x => `<li class="rouge">${esc(x)}</li>`).join('')}</ul>
        <span class="hint">Remplacer le frère (proposition ci-dessous), ou laisser tel quel en connaissance de cause —
        « Remplir » remplacera cette case sauf si elle est verrouillée 🔒.</span>
      </div>`;
  }
  if (s.manuel){
    html += `<p class="hint">Service à remplir manuellement — aucune proposition automatique.
    La liste ci-dessous reste disponible pour choisir.</p>`;
  } else if (best){
    html += `<div class="propBox">${a ? 'Remplaçant proposé' : 'Proposition'} :
      <b class="${best.warns.length?'rouge':''}">${esc(best.m.nom)}</b>${best.m.regime==='externe'?'<span class="badge externe">de passage</span>':''}
      ${best.prioLabel ? `<span class="badge eq">priorité : ${esc(best.prioLabel)}</span>` : ''}
      <span class="hint">(${best.chargeSemaine} service${best.chargeSemaine>1?'s':''} de ce type cette semaine ;
      ce service rendu ${best.douzeMois} fois sur les 12 derniers mois)</span>
      ${(t => t ? `<span class="dpInfo">${t}</span>` : '')(dernierProchain(best.m.id, sid, date || semaine, a ? a.id : undefined).txt)}
      ${best.warns.length ? `<span class="rouge">${esc(best.warns.join(' · '))}</span>` : ''}
      <button class="btn" onclick="assignSlot('${sid}','${semaine}','${dateStr}','${best.m.id}')">
        ${a ? 'Remplacer par ' : 'Affecter '}${esc(best.m.nom)}</button></div>`;
  } else if (!s.manuel) {
    html += `<p class="hint">Aucun moine pleinement éligible — voir toutes les possibilités ci-dessous.</p>`;
  }
  html += `<div class="modalActions">
    <button class="btn secondary" onclick="openSlotListe('${sid}','${semaine}','${dateStr}')">Voir toutes les possibilités…</button>
  </div>
  <h4>Personne extérieure (sans créer de fiche)</h4>
  <input id="inviteNom" placeholder="ex. Père Jean (Cîteaux)" style="width:240px">
  <button class="btn small secondary" onclick="assignInvite('${sid}','${semaine}','${dateStr}')">Affecter</button>
  <div class="modalActions">`;
  if (a){
    html += `<button class="btn secondary" onclick="toggleLock('${a.id}')">${a.verrouille?'Déverrouiller':'Verrouiller 🔒'}</button>
             <button class="btn danger" onclick="clearSlot('${a.id}')">Retirer l'affectation</button>`;
  }
  html += `<button class="btn secondary" onclick="closeModal()">Fermer</button></div>`;
  openModal(html);
}

function openSlotListe(sid, semaine, dateStr, forcer){
  const date = dateStr || null;
  const s = serviceById(sid);
  const a = findAssign(sid, semaine, date);
  const exId = a ? a.id : undefined;
  const slot = { serviceId: sid, semaine, date };
  // Les absents ne sont jamais proposés (un service hebdomadaire exige la présence toute la semaine) ;
  // les anciens (fiche inactive) non plus
  const totalementAbsent = m => m.actif === false || (date ? !presentOn(m, date) : joursAbsents(m, semaine).length > 0);
  // Critères stricts du service : statut, capacité cochée, francophone si requis ;
  // pour les services de table / repas : hors vaisselle et sans autre service de table cette semaine
  const critere = m => statutAllowed(m, s) && capOf(m, s).ok && (!s.francophone || m.francophone)
    && !(s.conflitDejeuner && (deVaisselleSemaine(m.id, semaine) || servicesDejeuner(m.id, semaine, exId).length))
    && !conflitCelebrantPU(m, slot, exId);
  const pasActuel = m => !a || m.id !== a.moineId;
  const rows = state.moines
    .filter(m => pasActuel(m) && critere(m) && !totalementAbsent(m))
    .map(m => Object.assign(scoreMoine(m, slot, exId), { warns: softWarns(m, slot, exId) }))
    .sort((x,y) => x.prio - y.prio || (x.warns.length?1:0) - (y.warns.length?1:0) || cmpScore(x,y));
  const exclus = forcer ? state.moines
    .filter(m => pasActuel(m) && !(critere(m) && !totalementAbsent(m)))
    .map(m => ({ m, raisons: reasons(m, slot, exId).concat(memeJour(m, slot, exId).map(n => 'fait déjà ' + n + ' ce jour-là')) }))
    .sort((x,y) => x.m.nom.localeCompare(y.m.nom)) : [];

  const quiPeut = s.statuts && s.statuts.length
    ? 'Tous les ' + s.statuts.map(k => (STATUTS[k]||k).toLowerCase() + 's').join(' ou ')
    : 'Tous les moines';
  const cat = catService(s);
  let html = `<h3>${esc(s.nom)} — ${date ? frLong(date) : frWeekRange(semaine)}</h3>
  <p class="hint">${quiPeut} capables et présents${s.francophone ? ' et francophones' : ''}${s.conflitDejeuner ? ', hors vaisselle et sans autre service de table cette semaine' : ''},
  ${cat === 'table' ? 'les moins chargés de la semaine d\'abord, puis ceux qui ont le moins rendu ce service sur les 12 derniers mois'
    : 'd\'abord ceux qui n\'ont jamais rendu ce service ou l\'ont rendu il y a le plus longtemps, en dernier ceux qui l\'ont rendu récemment ou vont le rendre dans les 3 semaines ; à égalité, ceux qui l\'ont le moins rendu sur 12 mois'}.
  Cliquer pour affecter ; les lignes <span class="rouge">en rouge</span>
  demandent confirmation. Les absents ne sont pas proposés.${cat !== 'table' ? ' Les services de table et la vaisselle, indépendants, ne sont pas affichés.' : ''}</p>
  <input id="listFilter" placeholder="🔎 Rechercher un moine…" style="width:250px;margin-bottom:8px"
    oninput="filtrerListe(this.value)">
  <div style="max-height:420px;overflow:auto"><table class="grid">
  <tr><th>Moine</th><th>${cat === 'table' ? 'Ses services de table cette semaine' : 'Ses autres services pieux cette semaine'}</th><th title="Nombre de fois que ce moine a rendu ce service sur les 12 derniers mois">Ce service<br>sur 12 mois</th><th></th></tr>`;
  const refKey = date || semaine;
  const celTaches = (mid) => {
    const taches = tachesSemaine(mid, semaine, exId, cat);
    const dp = dernierProchain(mid, sid, refKey, exId);
    return `${taches.length ? esc(taches.join(', ')) : '—'}${dp.txt ? `<br><span class="dpInfo">${dp.txt}</span>` : ''}`;
  };
  for (const r of rows){
    html += `<tr class="candRow" data-nom="${esc(r.m.nom.toLowerCase())}" onclick="assignSlot('${sid}','${semaine}','${dateStr}','${r.m.id}')">
      <td class="${r.warns.length?'rouge':''}">${esc(r.m.nom)}${r.m.regime==='externe'?'<span class="badge externe">de passage</span>':''}${r.prioLabel?`<span class="badge eq">${esc(r.prioLabel)}</span>`:''}</td>
      <td class="hint">${celTaches(r.m.id)}</td>
      <td style="text-align:center">${r.douzeMois}</td>
      <td>${r.warns.length ? '<span class="rouge">' + esc(r.warns.join(' · ')) + '</span>' : ''}</td></tr>`;
  }
  if (forcer){
    html += `<tr><th colspan="4" style="background:#fdecec;color:#a00">Hors critères — forçage possible, avec confirmation</th></tr>`;
    for (const x of exclus){
      html += `<tr class="candRow" data-nom="${esc(x.m.nom.toLowerCase())}" onclick="assignSlot('${sid}','${semaine}','${dateStr}','${x.m.id}')">
        <td class="rouge">${esc(x.m.nom)}</td>
        <td class="hint">${celTaches(x.m.id)}</td>
        <td></td>
        <td><span class="rouge">${esc(x.raisons.join(' · '))}</span></td></tr>`;
    }
    if (!exclus.length) html += `<tr><td colspan="4" class="hint">Aucun moine hors critères.</td></tr>`;
  }
  html += `</table></div>
  <div class="modalActions">
    ${forcer ? '' : `<button class="btn secondary" onclick="openSlotListe('${sid}','${semaine}','${dateStr}',1)">Forcer un moine hors critères…</button>`}
    <button class="btn secondary" onclick="openSlot('${sid}','${semaine}','${dateStr}')">◀ Retour</button>
    <button class="btn secondary" onclick="closeModal()">Fermer</button>
  </div>`;
  openModal(html);
}

function filtrerListe(v){
  v = (v || '').toLowerCase();
  document.querySelectorAll('#modalBox tr.candRow').forEach(tr => {
    tr.style.display = (tr.dataset.nom || '').includes(v) ? '' : 'none';
  });
}

function assignSlot(sid, semaine, dateStr, mid){
  const date = dateStr || null;
  const m = monkById(mid);
  const a = findAssign(sid, semaine, date);
  const s = serviceById(sid);
  const warns = softWarns(m, { serviceId: sid, semaine, date }, a ? a.id : undefined);
  if (!capOf(m, s).ok) warns.unshift('service désactivé dans sa fiche');
  if (!statutAllowed(m, s)) warns.unshift('statut « ' + (STATUTS[m.statut]||m.statut) + ' » normalement non autorisé');
  if (warns.length && !confirm(m.nom + ' — déconseillé :\n– ' + warns.join('\n– ') + '\n\nAffecter quand même ?')) return;
  if (a) { a.moineId = mid; a.nomLibre = null; a.modifieLe = maintenant(); }
  else state.affectations.push({ id:'a'+(state.seq.affect++), serviceId: sid, semaine, date, moineId: mid, nomLibre:null, verrouille:false, modifieLe: maintenant() });
  ordonnerAnciennete(semaine);
  save(); closeModal();
}
function assignInvite(sid, semaine, dateStr){
  const nom = $('#inviteNom').value.trim();
  if (!nom) { alert('Saisir un nom.'); return; }
  const date = dateStr || null;
  // Nom d'une fiche existante saisi ici : on rattache la fiche plutôt que de créer un « invité »
  const ms = state.moines.filter(m => normNom(m.nom) === normNom(nom));
  const mid = ms.length === 1 ? ms[0].id : null;
  const a = findAssign(sid, semaine, date);
  if (a) { a.moineId = mid; a.nomLibre = mid ? null : nom; a.modifieLe = maintenant(); }
  else state.affectations.push({ id:'a'+(state.seq.affect++), serviceId: sid, semaine, date, moineId: mid, nomLibre: mid ? null : nom, verrouille:false, modifieLe: maintenant() });
  save(); closeModal();
}
function toggleLock(aid){
  const a = state.affectations.find(x => x.id === aid);
  if (a && garde(a.semaine)) return;
  if (a) { a.verrouille = !a.verrouille; save(); closeModal(); }
}
function clearSlot(aid){
  state.affectations = state.affectations.filter(x => x.id !== aid);
  save(); closeModal();
}

/* ================= Fête du jour (édition depuis le planning) ================= */
let feteDate = null;
function openFete(date){
  if (garde(sundayOf(date))) return;
  feteDate = date;
  const f = feteOn(date);
  let html = `<h3>Fête — ${frLong(date)}</h3>
  <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap">
    <label>Nom <input id="fe_nom" value="${f?esc(f.nom):''}" style="width:280px" placeholder="ex. St Bernard"></label>
    <label>Type <select id="fe_rang">${Object.entries(RANGS).map(([k,v]) =>
      `<option value="${k}" ${f && f.rang===k?'selected':''}>${v}</option>`).join('')}</select></label>
  </div>
  <p class="hint">Enregistrement automatique. L'apparence (couleur, gras…) de chaque type se règle
  dans l'onglet « Apparence des fêtes ». Vider le nom supprime la fête.</p>
  <div class="modalActions">
    ${f ? `<button class="btn danger" onclick="delFeteAt()">Supprimer la fête</button>` : ''}
    <button class="btn secondary" onclick="closeModal()">Fermer</button>
  </div>`;
  openModal(html);
  const box = $('#modalBox');
  box.oninput = box.onchange = autoFete;
}
function autoFete(){
  const nom = $('#fe_nom') ? $('#fe_nom').value.trim() : '';
  const rang = $('#fe_rang') ? $('#fe_rang').value : 'memoire';
  let f = feteOn(feteDate);
  if (!nom){
    if (f) { state.fetes = state.fetes.filter(x => x !== f); save(); }
    return;
  }
  if (f){ f.nom = nom; f.rang = rang; }
  else state.fetes.push({ id:'f'+(state.seq.fete++), date: feteDate, nom, rang });
  save();
}
function delFeteAt(){
  state.fetes = state.fetes.filter(f => f.date !== feteDate);
  save(); closeModal();
}

/* ================= Onglet Moines ================= */
function moinesListHTML(){
  const q = (state.ui.rechercheMoine || '').toLowerCase();
  const list = [...state.moines].sort((a,b) => a.nom.localeCompare(b.nom))
    .filter(m => m.nom.toLowerCase().includes(q))
    .filter(m => state.ui.voirAnciens || m.actif !== false);
  let html = `<table class="grid">
  <tr><th>Nom</th><th>Statut</th><th>Franco.</th><th>Régime</th><th>Équipe vaisselle</th><th>Ancienneté</th><th>Anniv. / fête</th><th>Périodes</th><th></th></tr>`;
  for (const m of list){
    const per = (m.periodes||[]).map(p => frShort(p.debut) + ' → ' + frShort(p.fin)).join(', ');
    const af = [m.naissance ? 'né le ' + m.naissance.slice(8) + '/' + m.naissance.slice(5,7) : '',
      m.fete ? 'fête le ' + fmtFete(m.fete) : '',
      m.patron ? m.patron + (m.patronDate ? ' le ' + fmtFete(m.patronDate) : '') : '',
      m.ordination ? 'ordonné le ' + m.ordination.slice(8) + '/' + m.ordination.slice(5,7) + '/' + m.ordination.slice(0,4) : ''].filter(Boolean).join(', ');
    html += `<tr class="${m.actif===false?'strike':''}">
      <td><b>${esc(m.nom)}</b>${state.settings.abbeId===m.id?' <span class="badge eq">Père Abbé</span>':''}${state.settings.prieurId===m.id?' <span class="badge eq">Père Prieur</span>':''}${capOf(m, serviceById('lecture_regle')).ok?' <span class="badge eq">lecteur de la Règle</span>':''}${capOf(m, serviceById('lecture_regle2')).ok?' <span class="badge eq">remplaçant Règle</span>':''}${m.actif===false?' <span class="badge warn">ancien</span>':''}</td>
      <td>${STATUTS[m.statut]||m.statut}</td>
      <td>${m.francophone?'oui':'<span class="badge warn">non</span>'}</td>
      <td>${m.regime==='externe'?'<span class="badge externe">de passage</span>':'permanent'}</td>
      <td>${m.equipe?('équipe '+m.equipe):'—'}</td>
      <td class="hint">${anciennete(m)||'—'}</td>
      <td class="hint">${af||'—'}</td>
      <td class="hint">${per||'—'}</td>
      <td><button class="btn small secondary" onclick="editMoine('${m.id}')">Éditer</button>
          <button class="btn small danger" onclick="delMoine('${m.id}')">✕</button></td></tr>`;
  }
  return html + `</table>`;
}
function renderMoines(){
  const nAnc = state.moines.filter(m => m.actif === false).length;
  return `<div class="toolbar">
    <input id="moineSearch" placeholder="Rechercher…" value="${esc(state.ui.rechercheMoine||'')}"
      oninput="filtreMoines(this.value)">
    ${nAnc ? `<label title="Fiches créées depuis l'archive pour des frères qui n'apparaissent plus : jamais proposées"><input type="checkbox" ${state.ui.voirAnciens?'checked':''} onchange="state.ui.voirAnciens=this.checked;save();render()"> voir les anciens (${nAnc})</label>
    <button class="btn small secondary" onclick="supprimerAnciens()" title="Supprime ces ${nAnc} fiches ; leurs services restent inscrits sur les feuilles passées">Supprimer les ${nAnc} anciens</button>` : ''}
    <span style="flex:1"></span>
    <button class="btn secondary" title="Renseigne la fête (saint patron) des fiches où elle manque, d'après le prénom" onclick="doCompleterFetes()">Fêtes d'après les prénoms</button>
    <button class="btn" onclick="editMoine(null)">+ Ajouter un moine</button>
  </div>
  <p class="hint">${state.moines.filter(m => m.actif!==false).length} moines. « De passage » = présent uniquement pendant ses séjours ;
  pour un permanent, les périodes sont des absences. Une absence signalée fait apparaître en rouge
  ses services déjà planifiés (onglet Planning) pour les remplacer en un clic. Un frère qui quitte la communauté :
  supprimer sa fiche (✕) — ses services restent inscrits sur les feuilles passées.</p>
  <div class="card" id="moinesList">${moinesListHTML()}</div>`;
}
function filtreMoines(v){
  state.ui.rechercheMoine = v;
  save();
  $('#moinesList').innerHTML = moinesListHTML();
}

let editTemp = null;
function editMoine(id){
  const m = id ? monkById(id) : { id:null, nom:'', statut:'frere', francophone:true, regime:'permanent', actif:true, periodes:[], equipe:null, capacites:{}, notes:'', naissance:null, fete:null, entree:null };
  editTemp = id ? m : m;   // fiche existante : édition directe (autosauvegarde)
  renderMoineModal();
}
function renderMoineModal(){
  const m = editTemp;
  let html = `<h3>${m.id ? 'Fiche : ' + esc(m.nom) : 'Nouveau moine'}</h3>
  ${m.id ? '<p class="hint">Les modifications sont enregistrées automatiquement (le bouton « Enregistrer » ferme la fiche).</p>' : ''}
  <div style="display:flex;gap:14px;flex-wrap:wrap;align-items:center">
    <label>Nom <input id="fm_nom" value="${esc(m.nom)}" style="width:180px"></label>
    <label>Statut <select id="fm_statut">${Object.entries(STATUTS).map(([k,v]) =>
      `<option value="${k}" ${m.statut===k?'selected':''}>${v}</option>`).join('')}</select></label>
    <label><input type="checkbox" id="fm_fr" ${m.francophone?'checked':''}> Francophone</label>
    <label>Régime <select id="fm_regime">
      <option value="permanent" ${m.regime==='permanent'?'selected':''}>Permanent</option>
      <option value="externe" ${m.regime==='externe'?'selected':''}>De passage (externe)</option></select></label>
    <label>Équipe vaisselle <select id="fm_eq">
      <option value="">aucune</option>
      ${[1,2,3].map(n => `<option value="${n}" ${m.equipe===n?'selected':''}>équipe ${n}</option>`).join('')}</select></label>
    ${m.actif === false ? `<span class="badge warn">ancien (fiche de l'archive)</span> <button class="btn small secondary" onclick="reactiverMoine('${m.id}')">Réactiver</button>` : ''}
  </div>
  <div style="display:flex;gap:14px;flex-wrap:wrap;align-items:center;margin-top:10px">
    <label>Date de naissance <input type="date" id="fm_naiss" value="${m.naissance||''}"></label>
    <label>Fête (jj/mm) <input id="fm_fete" value="${fmtFete(m.fete)}" placeholder="ex. 20/08" style="width:70px"></label>
    <label>Saint patron <input id="fm_patron" value="${esc(m.patron||'')}" placeholder="ex. St Raphaël Arnaiz Baron" style="width:200px"></label>
    <label>fêté le (jj/mm) <input id="fm_patronDate" value="${fmtFete(m.patronDate)}" placeholder="ex. 27/04" style="width:70px" title="Le saint patron est affiché dans la colonne Fête de la feuille ce jour-là et le prêtre est proposé célébrant"></label>
  </div>
  <div style="display:flex;gap:14px;flex-wrap:wrap;align-items:center;margin-top:10px">
    <label>Entrée au monastère <input type="date" id="fm_entree" value="${m.entree||''}"></label>
    <label>Profession temporaire <input type="date" id="fm_prof" value="${m.profession||''}"></label>
    <label>Profession solennelle <input type="date" id="fm_profSol" value="${m.professionSolennelle||''}"></label>
    ${m.statut === 'pretre' ? `<label>Ordination sacerdotale <input type="date" id="fm_ordi" value="${m.ordination||''}"></label>` : ''}
  </div>
  <div style="margin-top:10px">
    <label title="Quand ce frère est lecteur, « Remplir les cases » lui adjoint automatiquement un 2e lecteur">
      <input type="checkbox" id="fm_lect2" ${m.besoin2eLecteur?'checked':''}> Toujours lui adjoindre un 2e lecteur (quand il est lecteur)</label>
  </div>
  ${m.statut === 'pretre' ? `<div style="margin-top:10px">Messe privée les :
    ${[1,2,3,4,5,6,0].map(j => `<label style="margin-right:10px"><input type="checkbox" id="fm_mp_${j}" ${(m.messePrivee||[]).includes(j)?'checked':''}> ${JOURS[j]}</label>`).join('')}
    <span class="hint">— ces jours-là, il est proposé en priorité célébrant principal (être célébrant lui tient lieu
    de messe du jour : aucun concélébrant n'est retiré de la messe conventuelle)</span></div>` : ''}
  <p class="hint">Un prêtre est proposé célébrant principal le jour de sa fête (ou du saint patron), de son anniversaire,
    de son anniversaire d'entrée et de sacerdoce. Les jubilés (${JUBILES.join('/')} ans) d'entrée, de profession (temporaire
    et solennelle) et de sacerdoce sont rappelés dans le bandeau du planning. L'ancienneté ordonne les serviteurs de table
    2-3-4 et de soupe.</p>
  <h4>Périodes ${m.regime==='externe'?'de présence (séjours)':"d'absence"}</h4>
  <table class="grid" style="max-width:440px">`;
  (m.periodes||[]).forEach((p,i) => {
    html += `<tr><td>${frLong(p.debut)}</td><td>→ ${frLong(p.fin)}</td>
      <td><button class="btn small danger" onclick="delPeriode(${i})">✕</button></td></tr>`;
  });
  html += `</table>
  <div style="margin-top:6px">
    <input type="date" id="fm_pd"> → <input type="date" id="fm_pf">
    <button class="btn small secondary" onclick="addPeriode()">Ajouter la période</button>
  </div>
  <h4>Services possibles et fréquence max</h4>
  <p class="hint">Décocher = ce moine ne fait jamais ce service. Fréquence vide = pas de limite
  (semaine, quinzaine et mois = calendaires ; trimestre et année = 3 / 12 mois glissants autour de la date).
  Les règles de statut (ex. célébrant = prêtre) et de langue (lectures et chant = francophone) bloquent la case automatiquement.</p>
  <table class="grid capGrid">`;
  const vus = new Set();
  for (const s of servicesVisibles()){   // services de l'ancien tableau (masqués, historique seulement) : pas dans la fiche
    if (vus.has(s.nom)) continue;        // services de même nom (serviteurs de table 2-3-4) : une seule ligne
    vus.add(s.nom);
    const cap = m.capacites[s.id] || { ok: statutAllowed(m, s), max:null, par:'semaine' };
    const nonFr = s.francophone && !m.francophone;
    const disabled = !statutAllowed(m, s) || nonFr;
    const motif = !statutAllowed(m, s) ? 'statut requis : ' + s.statuts.map(x=>STATUTS[x]).join(' ou ') : nonFr ? 'francophone requis' : '';
    html += `<tr><td><label><input type="checkbox" id="cap_ok_${s.id}" ${cap.ok&&!disabled?'checked':''} ${disabled?'disabled':''}>
      ${esc(s.nom)}${disabled?' <span class="hint">('+motif+')</span>':''}</label></td>
      <td>max <input type="number" min="1" style="width:52px" id="cap_max_${s.id}" value="${cap.max||''}" ${disabled?'disabled':''}>
      par <select id="cap_par_${s.id}" ${disabled?'disabled':''}>
        <option value="semaine" ${cap.par==='semaine'?'selected':''}>semaine</option>
        <option value="quinzaine" ${cap.par==='quinzaine'?'selected':''}>quinzaine</option>
        <option value="mois" ${cap.par==='mois'?'selected':''}>mois</option>
        <option value="trimestre" ${cap.par==='trimestre'?'selected':''}>trimestre</option>
        <option value="annee" ${cap.par==='annee'?'selected':''}>année</option></select></td></tr>`;
  }
  html += `</table>
  <div class="modalActions">
    ${m.id ? '<button class="btn" onclick="enregistrerMoine()">Enregistrer</button>' : '<button class="btn" onclick="creerMoine()">Créer</button>'}
    <button class="btn secondary" onclick="closeModal()">Fermer</button>
  </div>`;
  openModal(html);
  const box = $('#modalBox');
  box.oninput = box.onchange = () => { if (editTemp && editTemp.id) { grabMoineForm(); save(); } };
  for (const sel of ['#fm_regime', '#fm_statut', '#fm_fr'])
    $(sel).addEventListener('change', () => { grabMoineForm(); if (editTemp.id) save(); renderMoineModal(); });
}
function enregistrerMoine(){
  grabMoineForm();
  if (!editTemp.nom) { alert('Le nom est obligatoire.'); return; }
  save();
  bannerMsg = 'Fiche de ' + esc(editTemp.nom) + ' enregistrée.';
  closeModal();
}
function addPeriode(){
  const d = $('#fm_pd').value, f = $('#fm_pf').value;
  if (!d || !f || f < d) { alert('Dates invalides.'); return; }
  grabMoineForm();
  editTemp.periodes.push({ debut: d, fin: f });
  if (editTemp.id) save();
  renderMoineModal();
}
function delPeriode(i){
  grabMoineForm();
  editTemp.periodes.splice(i,1);
  if (editTemp.id) save();
  renderMoineModal();
}
function grabMoineForm(){
  const m = editTemp;
  if (!$('#fm_nom')) return;
  m.nom = $('#fm_nom').value.trim();
  m.statut = $('#fm_statut').value;
  m.francophone = $('#fm_fr').checked;
  m.regime = $('#fm_regime').value;
  m.equipe = $('#fm_eq').value ? Number($('#fm_eq').value) : null;
  m.naissance = $('#fm_naiss').value || null;
  m.entree = $('#fm_entree').value || null;
  m.profession = $('#fm_prof').value || null;
  m.professionSolennelle = $('#fm_profSol').value || null;
  m.besoin2eLecteur = $('#fm_lect2').checked;
  if ($('#fm_ordi')) m.ordination = $('#fm_ordi').value || null;
  if ($('#fm_mp_1')) m.messePrivee = [0,1,2,3,4,5,6].filter(j => $('#fm_mp_' + j) && $('#fm_mp_' + j).checked);
  m.patron = $('#fm_patron').value.trim() || null;
  const pd = $('#fm_patronDate').value.trim().match(/^(\d{1,2})\s*[\/\-.]\s*(\d{1,2})$/);
  m.patronDate = pd ? pad(pd[2]) + '-' + pad(pd[1]) : null;
  const fe = $('#fm_fete').value.trim().match(/^(\d{1,2})\s*[\/\-.]\s*(\d{1,2})$/);   // 'jj/mm' → 'MM-DD'
  m.fete = fe ? pad(fe[2]) + '-' + pad(fe[1]) : null;
  for (const s of state.services){
    // services de même nom (serviteurs de table 2-3-4) : la ligne unique de la fiche vaut pour tous
    const ref = servicesVisibles().find(x => x.nom === s.nom) || s;
    const okEl = $('#cap_ok_' + ref.id);
    if (!okEl) continue;
    const max = $('#cap_max_' + ref.id).value;
    m.capacites[s.id] = { ok: okEl.disabled ? false : okEl.checked,
      max: max ? Number(max) : null, par: $('#cap_par_' + ref.id).value };
  }
}
function creerMoine(){
  grabMoineForm();
  if (!editTemp.nom) { alert('Le nom est obligatoire.'); return; }
  editTemp.id = 'm' + (state.seq.moine++);
  state.moines.push(editTemp);
  save(); closeModal();
}
function delMoine(id){
  const m = monkById(id);
  const n = state.affectations.filter(a => a.moineId === id).length;
  const q0 = quinzaineDe(todayISO());
  const futur = state.affectations.filter(a => a.moineId === id && a.semaine >= q0).length;
  if (!confirm('Supprimer la fiche de ' + m.nom + ' ?'
    + (n ? `\nSes ${n} services déjà inscrits restent sur les feuilles (sous son nom, sans fiche) ; il n'apparaîtra plus dans les statistiques ni dans les propositions.` : '')
    + (futur ? `\n⚠ ${futur} case${futur>1?'s':''} à venir (quinzaine en cours et suivantes) porte${futur>1?'nt':''} encore son nom : à remplacer sur le planning.` : ''))) return;
  supprimerFiche(id);
  save(); render();
}
// Retire une fiche ; ses affectations restent (nom seul, marqué « ancien ») pour que les feuilles passées soient intactes
function supprimerFiche(id){
  const m = monkById(id);
  if (!m) return;
  state.moines = state.moines.filter(x => x.id !== id);
  for (const a of state.affectations) if (a.moineId === id) { a.moineId = null; a.nomLibre = m.nom; a.ancien = true; }
  for (const w of Object.keys(state.vaisselleSem)){
    const o = state.vaisselleSem[w];
    o.retraits = o.retraits.filter(x => x !== id);
    o.ajouts = o.ajouts.filter(x => x.mid !== id);
  }
  if (state.settings.abbeId === id) state.settings.abbeId = null;
  if (state.settings.prieurId === id) state.settings.prieurId = null;
  _affIdx = null;
}
function reactiverMoine(id){ const m = monkById(id); if (m) { m.actif = true; save(); renderMoineModal(); } }
function supprimerAnciens(){
  const anciens = state.moines.filter(m => m.actif === false);
  if (!anciens.length) return;
  if (!confirm(`Supprimer les ${anciens.length} fiches « anciens » (frères de l'archive qui n'apparaissent plus) ?\nLeurs services restent inscrits sur les feuilles passées, sous leur nom.`)) return;
  anciens.forEach(m => supprimerFiche(m.id));
  state.ui.voirAnciens = false;
  save(); render();
}

/* ================= Onglet Apparence des fêtes ================= */
const EXEMPLES = { solennite:'Assomption', fete:'St Laurent', dimanche:'19e dimanche du temps ordinaire', memoire:'Ste Claire' };
function renderStylesFetes(){
  let html = `<p class="hint">Les fêtes se saisissent directement dans l'onglet Planning (colonne « Fête »).
  Ici, on règle l'apparence de chaque type — appliquée à l'écran et à l'impression.
  Enregistrement automatique.</p>`;
  for (const t of state.feteTypes){
    const rang = t.key, label = t.label;
    const st = state.feteStyles[rang];
    const nb = state.fetes.filter(f => f.rang === rang).length;
    const defaut = FETE_TYPES_DEFAUT.some(d => d.key === rang);
    html += `<div class="card"><h3>${esc(label)} <span class="hint" style="font-weight:400">(${nb} fête${nb>1?'s':''})</span>
      ${defaut ? '' : `<button class="btn small ghost" style="float:right" onclick="supprimerTypeFete('${rang}')">✕ supprimer ce type</button>`}</h3>
    <div style="display:flex;gap:18px;align-items:center;flex-wrap:wrap">
      <span style="min-width:280px;${feteStyleCss(rang)}">${EXEMPLES[rang] || esc(label)}</span>
      <label title="Jour de solennité : Père Abbé célébrant, homélie / P.U. / épître / thuriféraire, ligne en rouge sur la feuille"><input type="checkbox" ${t.solennel?'checked':''} onchange="setTypeSolennel('${rang}',this.checked)"> solennité</label>
      <label>Couleur <input type="color" value="${st.couleur}" onchange="setFeteStyle('${rang}','couleur',this.value)"></label>
      <label><input type="checkbox" ${st.gras?'checked':''} onchange="setFeteStyle('${rang}','gras',this.checked)"> Gras</label>
      <label><input type="checkbox" ${st.italique?'checked':''} onchange="setFeteStyle('${rang}','italique',this.checked)"> Italique</label>
      <label><input type="checkbox" ${st.majuscule?'checked':''} onchange="setFeteStyle('${rang}','majuscule',this.checked)"> MAJUSCULES</label>
      <label>Taille <input type="number" min="8" max="28" style="width:56px" value="${st.taille}"
        onchange="setFeteStyle('${rang}','taille',Number(this.value))"> px</label>
      <label>Police <select onchange="setFeteStyle('${rang}','police',this.value)">
        ${Object.entries(POLICES).map(([k,[n]]) => `<option value="${k}" ${st.police===k?'selected':''}>${n}</option>`).join('')}
      </select></label>
    </div></div>`;
  }
  html += `<div class="card"><h3>Ajouter un type de fête</h3>
    <input id="nvType" placeholder="ex. Fête de l'Ordre" style="width:240px">
    <label style="margin:0 10px"><input type="checkbox" id="nvTypeSol"> solennité</label>
    <button class="btn" onclick="ajouterTypeFete()">Ajouter</button>
    <p class="hint">Le nouveau type apparaît aussitôt dans la liste des types (clic sur la colonne Fête du planning) ; régler ensuite son apparence ci-dessus.</p></div>`;
  return html;
}
function setFeteStyle(rang, prop, val){ state.feteStyles[rang][prop] = val; save(); render(); }
function setTypeSolennel(rang, v){ const t = feteType(rang); if (t) { t.solennel = v; save(); render(); } }
function ajouterTypeFete(){
  const label = $('#nvType').value.trim();
  if (!label) { alert('Donner un nom au type.'); return; }
  let key = normNom(label).replace(/ /g, '_') || 'type';
  if (feteType(key)) key += '_' + Date.now();
  state.feteTypes.push({ key, label, solennel: $('#nvTypeSol').checked });
  state.feteStyles[key] = Object.assign({}, defaultFeteStyles().memoire);
  save(); render();
}
function supprimerTypeFete(key){
  const nb = state.fetes.filter(f => f.rang === key).length;
  if (!confirm('Supprimer ce type ?' + (nb ? ' Les ' + nb + ' fêtes de ce type passeront en « Mémoire ».' : ''))) return;
  state.fetes.forEach(f => { if (f.rang === key) f.rang = 'memoire'; });
  state.feteTypes = state.feteTypes.filter(t => t.key !== key);
  delete state.feteStyles[key];
  save(); render();
}

/* ================= Onglet Vaisselle ================= */
function renderVaisselle(){
  const r = state.settings.vaisselleRef;
  let html = `<div class="toolbar">
    <label>Semaine du <input type="date" id="v_date" value="${state.ui.sunday}"></label>
    <label>équipe de service : <select id="v_eq">${[1,2,3].map(n => `<option value="${n}">${n}</option>`).join('')}</select></label>
    <button class="btn" onclick="setVaisselleRef()">Caler la rotation</button>
  </div>
  <p class="hint">Rotation automatique 1 → 2 → 3 → 1 chaque semaine (référence actuelle :
  équipe ${r.equipe} la semaine du ${frLong(sundayOf(r.sunday))}). Les ajustements ponctuels
  (retirer un frère une semaine, remplacer un absent certains jours…) se font dans l'onglet Planning,
  encadré « Vaisselle » sous les services de la semaine.</p>
  <div class="card"><h3>Prochaines semaines</h3><table class="grid" style="max-width:420px">`;
  for (let i=0;i<6;i++){
    const w = addDays(state.ui.sunday, i*7);
    const o = vsem(w);
    html += `<tr><td>${frWeekRange(w)}</td><td><b>équipe ${equipeVaisselle(w)}</b>${o.equipe?' <span class="rouge">(modifiée)</span>':''}</td></tr>`;
  }
  html += `</table></div><div class="threeCol">`;
  for (const n of [1,2,3]){
    const membres = state.moines.filter(m => m.equipe === n).sort((a,b) => a.nom.localeCompare(b.nom));
    html += `<div class="card"><h3>Équipe ${n} <span class="hint">(${membres.length})</span></h3>
      <ol style="margin:0;padding-left:20px">${membres.map(m => `<li>${esc(m.nom)}</li>`).join('')}</ol></div>`;
  }
  html += `</div>`;
  return html;
}
function setVaisselleRef(){
  const d = $('#v_date').value;
  if (!d) return;
  state.settings.vaisselleRef = { sunday: sundayOf(d), equipe: Number($('#v_eq').value) };
  save(); render();
}

/* ================= Onglet Statistiques ================= */
function renderStats(){
  const annees = [...new Set(state.affectations.map(a => Number(keyOf(a).slice(0,4))))].sort();
  if (!annees.length) annees.push(new Date().getFullYear());
  const an = state.ui.statsAnnee || annees[annees.length-1];
  const mois = state.ui.statsMois || 0;
  const svcs = servicesTries();
  const inPeriod = a => {
    const k = keyOf(a);
    return Number(k.slice(0,4)) === an && (mois === 0 || Number(k.slice(5,7)) === mois);
  };
  const counts = {};
  for (const a of state.affectations.filter(inPeriod)){
    if (!a.moineId) continue;
    counts[a.moineId] = counts[a.moineId] || {};
    counts[a.moineId][a.serviceId] = (counts[a.moineId][a.serviceId] || 0) + 1;
  }
  const rows = [...state.moines].map(m => {
    const c = counts[m.id] || {};
    const total = Object.values(c).reduce((x,y) => x+y, 0);
    return { m, c, total };
  }).filter(r => r.total > 0 || r.m.actif !== false)   // anciens membres : seulement s'ils ont rendu un service sur la période
    .sort((a,b) => b.total - a.total || a.m.nom.localeCompare(b.m.nom));

  // Colonnes regroupées : « Serviteur de table 1..4 » → une seule colonne « Serviteur de table »
  const groupes = [];
  for (const s of svcs){
    const nomG = groupeDe(s);
    let g = groupes.find(x => x.nom === nomG);
    if (!g){ g = { nom: nomG, ids: [] }; groupes.push(g); }
    g.ids.push(s.id);
  }

  let html = `<div class="toolbar">
    <label>Année <select onchange="state.ui.statsAnnee=Number(this.value);save();render()">
      ${annees.map(y => `<option ${y===an?'selected':''}>${y}</option>`).join('')}</select></label>
    <label>Mois <select onchange="state.ui.statsMois=Number(this.value);save();render()">
      <option value="0">Toute l'année</option>
      ${MOIS.map((n,i) => `<option value="${i+1}" ${mois===i+1?'selected':''}>${n}</option>`).join('')}</select></label>
  </div>
  <div class="card statsWrap"><h3>Services rendus par moine (${mois ? MOIS[mois-1] + ' ' : ''}${an})</h3>
  <table class="grid"><tr><th>Moine</th>`;
  groupes.forEach(g => html += `<th class="rot">${esc(g.nom)}</th>`);
  html += `<th>Total</th></tr>`;
  for (const r of rows){
    html += `<tr><td><b>${esc(r.m.nom)}</b></td>`;
    for (const g of groupes){
      const n = g.ids.reduce((x,id) => x + (r.c[id] || 0), 0);
      html += n ? `<td class="num">${n}</td>` : `<td class="zero">·</td>`;
    }
    html += `<td class="num"><b>${r.total}</b></td></tr>`;
  }
  html += `</table></div>`;
  html += renderHistorique(groupes);
  return html;
}

/* Historique : dernière fois que chaque moine a rendu chaque service ; filtre par service
   (« qui a fait l'épître, et quand ? ») et par moine ; accès aux anciennes feuilles. */
function renderHistorique(groupes){
  const fS = state.ui.histService || '';
  const today = todayISO();
  let html = `<div class="card statsWrap"><h3>Historique — dernière fois que chaque service a été rendu</h3>
  <div class="toolbar" style="margin-bottom:10px">
    <label>Service <select onchange="state.ui.histService=this.value;save();render()">
      <option value="">tous (dernière date par service)</option>
      ${groupes.map(g => `<option value="${esc(g.nom)}" ${fS===g.nom?'selected':''}>${esc(g.nom)}</option>`).join('')}</select></label>
    <input id="histMoine" placeholder="🔎 Moine…" value="${esc(state.ui.histMoine||'')}" style="width:180px"
      oninput="state.ui.histMoine=this.value;save();document.querySelector('#histTable').innerHTML=histTableHTML()">
  </div><div id="histTable">${histTableHTML(groupes)}</div></div>`;
  // Anciennes feuilles : toutes les quinzaines qui contiennent des affectations
  const starts = new Set();
  for (const a of state.affectations) starts.add(quinzaineDe(a.semaine));
  const passees = [...starts].filter(s => s < quinzaineDe(today)).sort().reverse();
  if (passees.length){
    const lib = s => s.slice(0,4) + ' — ' + frWeekRange(s).replace('Du ','') + ' → ' + frWeekRange(addDays(s,7)).replace(/^Du \d+( \S+)? au /,'');
    html += `<div class="card"><h3>Anciennes feuilles <span class="hint" style="font-weight:400">(${passees.length} quinzaines depuis ${passees[passees.length-1].slice(0,4)})</span></h3>
    <p class="hint">Choisir une quinzaine pour l'ouvrir dans l'onglet Planning (lecture, correction, réimpression).</p>
    <select id="selFeuille" style="max-width:420px">${passees.map(s => `<option value="${s}">${lib(s)}</option>`).join('')}</select>
    <button class="btn small secondary" onclick="ouvrirFeuille(document.querySelector('#selFeuille').value)">Ouvrir</button></div>`;
  }
  return html;
}
function ouvrirFeuille(s){ state.ui.tab = 'planning'; allerQuinzaine(quinzaineDe(s)); }
function histTableHTML(groupes){
  if (!groupes){
    groupes = [];
    for (const s of servicesTries()){
      const nomG = groupeDe(s);
      let g = groupes.find(x => x.nom === nomG);
      if (!g){ g = { nom: nomG, ids: [] }; groupes.push(g); }
      g.ids.push(s.id);
    }
  }
  const fS = state.ui.histService || '', fM = (state.ui.histMoine || '').toLowerCase();
  const jma = k => k.slice(8) + '/' + k.slice(5,7) + '/' + k.slice(2,4);
  const today = todayISO();
  const moines = [...state.moines].sort((a,b) => a.nom.localeCompare(b.nom)).filter(m => m.nom.toLowerCase().includes(fM))
    .filter(m => fS || state.ui.voirAnciens || m.actif !== false);   // anciens : seulement dans la liste par service
  if (fS){
    // Un service : toutes les fois où il a été rendu, du plus récent au plus ancien
    const g = groupes.find(x => x.nom === fS);
    const ids = g ? g.ids : [];
    const lignes = state.affectations
      .filter(a => ids.includes(a.serviceId) && a.moineId && moines.some(m => m.id === a.moineId))
      .map(a => ({ k: keyOf(a), a }))
      .sort((x,y) => x.k < y.k ? 1 : x.k > y.k ? -1 : 0);
    let html = `<table class="grid" style="max-width:640px"><tr><th>Date</th><th>Moine</th><th>Service</th></tr>`;
    for (const {k, a} of lignes){
      const s = serviceById(a.serviceId);
      html += `<tr class="${k > today ? 'hint' : ''}"><td>${a.date ? frLong(a.date) : 'semaine du ' + frShort(a.semaine)}${k > today ? ' <span class="badge eq">à venir</span>' : ''}</td>
        <td><b>${esc(monkById(a.moineId)?.nom || '?')}</b></td><td class="hint">${esc(s?.nom || '?')}</td></tr>`;
    }
    if (!lignes.length) html += `<tr><td colspan="3" class="hint">Aucune affectation.</td></tr>`;
    return html + `</table>`;
  }
  // Tous les services : dernière date (≤ aujourd'hui) par moine et par service
  let html = `<table class="grid"><tr><th>Moine</th>${groupes.map(g => `<th class="rot">${esc(g.nom)}</th>`).join('')}</tr>`;
  for (const m of moines){
    html += `<tr><td><b>${esc(m.nom)}</b></td>`;
    for (const g of groupes){
      let last = null;
      for (const a of state.affectations){
        if (a.moineId !== m.id || !g.ids.includes(a.serviceId)) continue;
        const k = keyOf(a);
        if (k <= today && (!last || k > last)) last = k;
      }
      html += last ? `<td class="num">${jma(last)}</td>` : `<td class="zero">·</td>`;
    }
    html += `</tr>`;
  }
  return html + `</table>`;
}

/* ================= Onglet Réglages ================= */
function renderReglages(){
  const pretres = state.moines.filter(m => m.statut === 'pretre').sort((a,b) => a.nom.localeCompare(b.nom));
  let html = `
  <div class="card"><h3>Père Abbé et Père Prieur</h3>
    <p class="hint">Le Père Abbé est célébrant principal les dimanches et les solennités ; s'il est absent, le Père Prieur le remplace
    (modifiable ensuite à la main, case par case).</p>
    <label>Père Abbé <select onchange="state.settings.abbeId=this.value||null;save();render()">
      <option value="">— aucun —</option>
      ${pretres.map(m => `<option value="${m.id}" ${state.settings.abbeId===m.id?'selected':''}>${esc(m.nom)}</option>`).join('')}
    </select></label>
    &nbsp; <label>Père Prieur <select onchange="state.settings.prieurId=this.value||null;save();render()">
      <option value="">— aucun —</option>
      ${pretres.map(m => `<option value="${m.id}" ${state.settings.prieurId===m.id?'selected':''}>${esc(m.nom)}</option>`).join('')}
    </select></label>
  </div>
  <div class="card"><h3>Couleur de la feuille</h3>
    <p class="hint">La feuille est affichée une quinzaine en rose, la suivante en bleu. Indiquer la couleur de la quinzaine
    actuellement affichée dans l'onglet Planning (${frWeekRange(state.ui.sunday)}) ; l'alternance en découle.</p>
    <select onchange="state.settings.quinzaine={sunday:state.ui.sunday,couleur:this.value};save();render()">
      ${['rose','bleu'].map(c => `<option value="${c}" ${couleurQuinzaine(state.ui.sunday)===c?'selected':''}>${c}</option>`).join('')}
    </select>
    <span class="feuille ${couleurQuinzaine(state.ui.sunday)}" style="margin-left:8px">Feuille ${couleurQuinzaine(state.ui.sunday)}</span>
  </div>
  <div class="card"><h3>Services</h3>
  <table class="grid"><tr><th>Service</th><th>Portée</th><th>Quand</th><th>Statuts autorisés</th><th>Francophone requis</th><th>Incompatible vaisselle</th><th>Manuel</th><th></th></tr>`;
  for (const s of servicesTries()){
    html += `<tr><td><b>${esc(s.nom)}</b></td>
      <td>${s.portee === 'jour' ? 'quotidien' : 'hebdomadaire'}</td>
      <td>${s.portee === 'jour' ? (QUAND_LABELS[s.quand] || 'tous les jours') : '—'}</td>
      <td>${s.statuts && s.statuts.length ? s.statuts.map(x => STATUTS[x]).join(', ') : 'tous'}</td>
      <td>${s.francophone ? 'oui' : '—'}</td>
      <td>${s.conflitDejeuner ? 'oui' : '—'}</td>
      <td>${s.manuel ? 'oui' : '—'}</td>
      <td><button class="btn small secondary" onclick="editService('${s.id}')">Éditer</button></td></tr>`;
  }
  html += `</table>
  <div style="margin-top:8px"><button class="btn secondary" onclick="editService(null)">+ Ajouter un service</button></div></div>
  <div class="card"><h3>Données</h3>
    <p class="hint">Les données sont enregistrées automatiquement dans ce navigateur.
    La sauvegarde automatique en dépose en plus une copie datée dans un dossier de l'ordinateur.</p>
    <p><b>Sauvegarde automatique :</b> <span id="sauvEtatLigne">${sauvEtatHTML()}</span></p>
    ${sauvDispo() ? `<div class="modalActions" style="margin-top:0">
      <button class="btn secondary" onclick="choisirDossierSauv()">${state.settings.sauvAuto && state.settings.sauvAuto.actif ? 'Changer de dossier…' : 'Choisir le dossier…'}</button>
      ${state.settings.sauvAuto && state.settings.sauvAuto.actif ? `<button class="btn ghost" onclick="desactiverSauvAuto()">Désactiver</button>` : ''}
    </div>` : ''}
    ${sauvDispo() ? `<p style="margin-top:14px"><b>Consultation d'un autre ordinateur :</b> ${
      state.settings.dossierMoine && state.settings.dossierMoine.actif
        ? `dossier partagé <b>${esc(state.settings.dossierMoine.dossier)}</b>.`
        : `<span class="hint">désigner le dossier OneDrive partagé où l'autre ordinateur dépose ses sauvegardes
           automatiques, pour recharger ici d'un clic son fichier le plus récent (remplace toutes les données
           de cet ordinateur, comme un import).</span>`
    }</p>
    <div class="modalActions" style="margin-top:0">
      ${state.settings.dossierMoine && state.settings.dossierMoine.actif
        ? `<button class="btn" onclick="rechargerDonneesMoine()">⟳ Recharger les données du moine</button>
           <button class="btn ghost" onclick="choisirDossierMoine()">changer de dossier…</button>
           <button class="btn ghost" onclick="retirerDossierMoine()">retirer</button>`
        : `<button class="btn secondary" onclick="choisirDossierMoine()">Désigner le dossier partagé…</button>`}
    </div>` : ''}
    <div class="modalActions">
      <button class="btn" onclick="exportJSON()">⬇ Exporter la sauvegarde</button>
      <label class="btn secondary" style="display:inline-block">⬆ Importer une sauvegarde
        <input type="file" accept=".json" style="display:none" onchange="importJSON(this)"></label>
      <button class="btn danger" onclick="resetAll()">Réinitialiser (données de démonstration)</button>
    </div>
    <p class="hint" style="margin-bottom:0">Version de l'application : ${APP_BUILD} · structure des données : v${state.version}</p>
  </div>`;
  return html;
}
function editService(id){
  const s = id ? serviceById(id) : { id:null, nom:'', portee:'semaine', quand:'tous', statuts:[], francophone:false, conflitDejeuner:false, manuel:false, optionnel:false, groupe:null, ordre: 30 };
  let html = `<h3>${id ? 'Service : ' + esc(s.nom) : 'Nouveau service'}</h3>
  <div style="display:flex;flex-direction:column;gap:10px">
    <label>Nom <input id="sv_nom" value="${esc(s.nom)}" style="width:280px"></label>
    <label>Portée <select id="sv_portee">
      <option value="jour" ${s.portee==='jour'?'selected':''}>quotidien</option>
      <option value="semaine" ${s.portee==='semaine'?'selected':''}>hebdomadaire</option></select></label>
    <label>Si quotidien : <select id="sv_quand">
      ${Object.entries(QUAND_LABELS).map(([k,v]) => `<option value="${k}" ${s.quand===k?'selected':''}>${v}</option>`).join('')}</select></label>
    <div>Statuts autorisés (aucun coché = tous) :
      ${Object.entries(STATUTS).map(([k,v]) =>
        `<label style="margin-right:10px"><input type="checkbox" id="sv_st_${k}" ${s.statuts.includes(k)?'checked':''}> ${v}</label>`).join('')}</div>
    <label><input type="checkbox" id="sv_fr" ${s.francophone?'checked':''}> Francophone requis</label>
    <label><input type="checkbox" id="sv_vs" ${s.conflitDejeuner?'checked':''}> Incompatible avec l'équipe vaisselle de la semaine</label>
    <label><input type="checkbox" id="sv_man" ${s.manuel?'checked':''}> Rempli uniquement à la main (jamais par le générateur, aucune proposition automatique)</label>
    <label><input type="checkbox" id="sv_opt" ${s.optionnel?'checked':''}> Facultatif (case « + », jamais rempli par le générateur — ex. 2e lecteur)</label>
    <label>Groupe <input id="sv_groupe" value="${esc(s.groupe||'')}" style="width:220px" placeholder="ex. Serviteur de table">
      <span class="hint">(services comptés ensemble : statistiques, dernière fois…)</span></label>
    <label>Ordre d'affichage <input type="number" step="0.5" id="sv_ordre" value="${s.ordre}" style="width:70px"></label>
  </div>
  <div class="modalActions">
    <button class="btn" onclick="saveService('${id||''}')">Enregistrer</button>
    ${id ? `<button class="btn danger" onclick="delService('${id}')">Supprimer</button>` : ''}
    <button class="btn secondary" onclick="closeModal()">Annuler</button>
  </div>`;
  openModal(html);
}
function saveService(id){
  const nom = $('#sv_nom').value.trim();
  if (!nom) { alert('Nom obligatoire.'); return; }
  const data = {
    nom, portee: $('#sv_portee').value, quand: $('#sv_quand').value,
    statuts: Object.keys(STATUTS).filter(k => $('#sv_st_' + k).checked),
    francophone: $('#sv_fr').checked, conflitDejeuner: $('#sv_vs').checked,
    manuel: $('#sv_man').checked, optionnel: $('#sv_opt').checked,
    groupe: $('#sv_groupe').value.trim() || null,
    ordre: Number($('#sv_ordre').value) || 30,
  };
  if (id){ Object.assign(serviceById(id), data); }
  else state.services.push(Object.assign({ id:'svc' + (state.seq.service++) + '_' + Math.floor(Math.random()*1e6) }, data));
  save(); closeModal();
}
function delService(id){
  const n = state.affectations.filter(a => a.serviceId === id).length;
  if (!confirm('Supprimer ce service ?' + (n ? '\n(' + n + ' affectations seront supprimées.)' : ''))) return;
  state.services = state.services.filter(s => s.id !== id);
  state.affectations = state.affectations.filter(a => a.serviceId !== id);
  save(); closeModal();
}
function exportJSON(){
  // La configuration de la sauvegarde automatique est propre à CETTE machine : on ne l'emporte pas dans le fichier
  const copie = JSON.parse(JSON.stringify(state));
  if (copie.settings){ delete copie.settings.sauvAuto; delete copie.settings.dossierMoine; }
  const blob = new Blob([JSON.stringify(copie, null, 2)], { type:'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'planning-moines-' + todayISO() + '.json';
  a.click();
}
function importJSON(input){
  const f = input.files[0];
  if (!f) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (!data.moines || !data.services) throw new Error('format inattendu');
      remplacerDonnees(data);
      bannerMsg = 'Sauvegarde importée.'; render();
    } catch(e){ alert('Fichier invalide : ' + e.message); }
  };
  reader.readAsText(f);
}
// Remplace toutes les données par celles d'un fichier, en conservant les réglages propres à CETTE
// machine (sauvegarde automatique, dossier de consultation) : le fichier vient d'un autre ordinateur
function remplacerDonnees(data){
  const sauvLocale = state && state.settings ? state.settings.sauvAuto : undefined;
  const consultLocale = state && state.settings ? state.settings.dossierMoine : undefined;
  state = data;
  if (!state.settings) state.settings = {};
  state.settings.sauvAuto = sauvLocale;
  state.settings.dossierMoine = consultLocale;
  migrate(); save();
}
function resetAll(){
  if (!confirm('Tout effacer et revenir aux données de démonstration ?')) return;
  state = seedState(); migrate(); save(); render();
}

/* ================= Feuille « OFFICIERS DE LA SEMAINE » (impression + Excel) =================
   Reproduit la mise en page du classeur OFFICIERS.xlsx de la communauté : grille A..K × 22 lignes,
   Book Antiqua 14 gras centré, en-têtes et jours en bleu sur fond rose ou bleu pâle selon la
   quinzaine, dimanches et solennités en rouge, bloc « Serviteurs de table » à droite, titre
   « OFFICIERS DE LA SEMAINE » en Calligrapher, officiers de la semaine et Lecture de la Règle en bas.
   Le même modèle de grille sert à l'impression (HTML) et à l'export Excel. */
/* Modèle v2 (classeur « tableau des officiers v2.xlsx », onglet « tableau bleu ») :
   13 colonnes A..M — bloc des jours A..H (15 lignes samedi → samedi, sans bandes de séparation),
   bloc « Serviteurs de table » J..M (numéros 1-5 + « 3e plat », « soupe » ×3 + « viande » en
   étiquettes verticales), titre Calligrapher en bas à gauche, officiers de la semaine + Chantre
   P.U. + Lecture de la Règle en bas. Impression : échelle 63 %, marges 1 cm, centré. */
const FEUILLE = {
  fonds: { rose:'FADBD3', bleu:'D9E2F3', jaune:'FFF2A8' },   // bleu : franchement bleu (l'ancien DAEEF3 tirait sur le turquoise)
  couleurs: { bleu:'0000FF', rouge:'FF0000', brun:'993300', noir:'000000' },
  largeurs: [16.55, 5, 26.89, 24.66, 24.66, 24.66, 24.66, 24.66, 1.55, 3.66, 21.89],  // A..K
  hauteurs: { 17:9.9, 19:42.75, 20:42.9, 21:9.9, 22:42.9 },                            // défaut 39 (points)
  echelle: 0.63,                                                                       // échelle d'impression du classeur (63 %)
};
// Largeur d'une colonne Excel en mm à l'impression (unité ≈ 7 px + 5 px de marge, 96 px/pouce)
const colMm = w => (w * 7 + 5) / 96 * 25.4 * FEUILLE.echelle;
// Contenu d'une case : nom(s) + « modifié depuis l'impression » ; plusieurs services → « X / Y »
function celluleFeuille(sids, semaine, date, start, sep){
  const parts = [], modif = [];
  for (const sid of sids){
    const a = findAssign(sid, semaine, date);
    if (!a) continue;
    const m = a.moineId && monkById(a.moineId);
    const nom = m ? m.nom : (a.nomLibre || '');
    if (!nom) continue;
    parts.push(nom);
    if (estModifie(a, start)) modif.push(nom);
  }
  return { txt: parts.join(sep || ' / '), modif: modif.length > 0 };
}
// Grille : liste de cellules { r, c, rs, cs, v, st } (r/c à partir de 1 ; A=1 … M=13)
function grilleFeuille(start){
  const w1 = start, w2 = addDays(start, 7);
  const couleur = couleurQuinzaine(start);
  const cells = [];
  const put = (r, c, v, st, rs, cs) => { cells.push({ r, c, rs: rs || 1, cs: cs || 1, v: v == null ? '' : String(v), st: st || {} }); };
  const bord = (l, r, t, b) => ({ l, r, t, b });
  const B = { fin:'thin', moy:'medium', gros:'thick', dbl:'double' };
  // — Bloc principal A..H, lignes 1 à 16 (samedi précédent → samedi, sans bandes de séparation) —
  const bMain = (r, c, satRow) => bord(
    c === 1 ? B.gros : c === 4 ? B.moy : B.fin,
    c === 8 ? B.gros : c === 3 ? B.moy : B.fin,
    r === 1 ? B.gros : r === 2 ? B.moy : B.fin,
    r === 16 ? B.gros : r === 1 ? B.moy : satRow ? B.dbl : B.fin);
  const jourSvc = ['celebrant','homelie','priere_univ','epitre','thuriferaire'];
  const entetes = ['Célébrant principal',"Homélie / chant de l'évangile",'Prière universelle','Epître','Thuriféraire'];
  put(1, 1, 'Date', { fond:true, color:'bleu', b: bMain(1,1) }, 1, 3);
  put(1, 2, '', { fond:true, b: bMain(1,2) }); put(1, 3, '', { fond:true, b: bMain(1,3) });
  entetes.forEach((h, i) => put(1, 4+i, h, { fond:true, color:'bleu', size: i === 1 ? 12 : 14, b: bMain(1, 4+i) }));
  for (let i = -1; i < 14; i++){
    const r = i + 3, date = addDays(start, i), d = parseISO(date), dim = d.getDay() === 0, sam = d.getDay() === 6;
    const w = i < 0 ? addDays(start,-7) : i < 7 ? w1 : w2;
    const f = feteAffichee(date), sol = isSolennite(date);
    const rouge = dim || sol;   // toute la ligne en rouge ET sur fond coloré
    const satRow = sam && r < 16;
    put(r, 1, dim ? 'DIMANCHE' : JOURS[d.getDay()], { fond:true, color: dim ? 'rouge' : 'bleu', size: dim ? 12 : 14, b: bMain(r,1,satRow) });
    put(r, 2, d.getDate(), { fond:true, color: rouge ? 'rouge' : 'bleu', b: bMain(r,2,satRow) });
    const fs = f ? (state.feteStyles[f.rang] || {}) : {};
    put(r, 3, f ? (fs.majuscule ? f.nom.toUpperCase() : f.nom) : '', { fond:true, color: rouge ? 'rouge' : 'noir', italic: !!fs.italique, size: 14, b: bMain(r,3,satRow) });
    jourSvc.forEach((sid, k) => {
      const c = celluleFeuille([sid], w, date, start);
      put(r, 4+k, c.txt, { fond: rouge, modif: c.modif, color: rouge ? 'rouge' : 'noir', b: bMain(r,4+k,satRow) });
    });
  }
  // — Bloc « Serviteurs de table » J..K, lignes 2 à 16 : 1-4, puis soupe (2) et viande dans la même colonne —
  put(2, 10, 'Serviteurs de table', { fond:true, color:'bleu', b: bord(B.gros, B.gros, B.gros, B.fin) }, 1, 2);
  [[w1, 3], [w2, 10]].forEach(([w, r0]) => {
    const finSem = r0 + 6;   // dernière ligne du bloc de la semaine
    ['st1','st2','st3','st4'].forEach((sid, k) => {
      const r = r0 + k, c = celluleFeuille([sid], w, null, start);
      put(r, 10, k+1, { fond:true, color:'bleu', bold:false, b: bord(B.gros, B.fin, r === r0 ? B.gros : B.fin, k === 3 ? B.moy : B.fin) });
      put(r, 11, c.txt, { modif: c.modif, b: bord(B.fin, B.gros, r === r0 ? B.gros : B.fin, k === 3 ? B.moy : B.fin) });
    });
    // « soupe » (étiquette verticale sur 2 lignes) puis « viande », sous les serviteurs
    const soupes = ['st_soupe','st_soupe2'].map(sid => celluleFeuille([sid], w, null, start));
    put(r0+4, 10, 'soupe', { fond:true, color:'bleu', bold:false, size:12, rot:true, b: bord(B.gros, B.fin, B.fin, B.fin) }, 2, 1);
    soupes.forEach((c, k) => put(r0+4+k, 11, c.txt, { modif: c.modif, b: bord(B.fin, B.gros, B.fin, B.fin) }));
    const vi = celluleFeuille(['st_viande'], w, null, start);
    put(finSem, 10, 'viande', { fond:true, color:'bleu', bold:false, size:11, rot:true, b: bord(B.gros, B.fin, B.fin, B.gros) });
    put(finSem, 11, vi.txt, { modif: vi.modif, b: bord(B.fin, B.gros, B.fin, B.gros) });
  });
  // — Bas : titre calligraphié, officiers de la semaine, chantre, Règle —
  put(18, 1, 'OFFICIERS', { font:'calli', size:36 }, 2, 3);
  put(20, 1, 'DE LA SEMAINE', { font:'calli', size:28 }, 1, 3);
  const bBas = (r, c) => bord(c === 4 ? B.gros : B.fin, c === 8 ? B.gros : c === 4 ? B.moy : B.fin, r === 18 ? B.gros : B.fin, r === 20 ? B.gros : B.fin);
  ['Semaine','Hebdomadier','Lecteur',"Serviteur d'église",'Lecteur de table'].forEach((h, i) => put(18, 4+i, h, { fond:true, color:'bleu', b: bBas(18,4+i) }));
  [[w1, 19], [w2, 20]].forEach(([w, r]) => {
    put(r, 4, frWeekRange(w), { color:'bleu', b: bBas(r,4) });
    [['hebdomadier'], ['lecteur','lecteur2'], ['serviteur_eglise'], ['lecteur_table']].forEach((sids, k) => {
      const c = celluleFeuille(sids, w, null, start);
      put(r, 5+k, c.txt, { modif: c.modif, b: bBas(r,5+k) });
    });
  });
  // Chantre P.U. : par mois → une seule case fusionnée si les deux semaines ont les mêmes chantres, sinon deux lignes
  put(18, 10, 'Chantre P.U', { fond:true, color:'bleu', b: bord(B.gros, B.gros, B.gros, B.fin) }, 1, 2);
  const ch1 = celluleFeuille(['chantre_pu','chantre_pu2'], w1, null, start);
  const ch2 = celluleFeuille(['chantre_pu','chantre_pu2'], w2, null, start);
  if (ch2.txt === ch1.txt || !ch2.txt){
    put(19, 10, ch1.txt, { modif: ch1.modif, size:12, b: bord(B.gros, B.gros, B.fin, B.gros) }, 1, 2);
  } else {
    put(19, 10, ch1.txt, { modif: ch1.modif, size:12, b: bord(B.gros, B.gros, B.fin, B.fin) }, 1, 2);
    put(20, 10, ch2.txt, { modif: ch2.modif, size:12, b: bord(B.gros, B.gros, B.fin, B.gros) }, 1, 2);
  }
  const lr = celluleFeuille(['lecture_regle'], w1, null, start), rr = celluleFeuille(['lecture_regle2'], w1, null, start);
  put(22, 4, 'Lecture de la Sainte Règle', { fond:true, color:'bleu', b: bord(B.gros, B.fin, B.gros, B.gros) }, 1, 4);
  put(22, 8, lr.txt + (rr.txt ? ' / ' + rr.txt : ''), { modif: lr.modif || rr.modif, b: bord(B.fin, B.gros, B.gros, B.gros) });
  return { start, couleur, cells, nbCols: 11, nbRows: 22 };
}
// Première impression / export = référence pour le surlignage jaune des modifications ultérieures
function marquerImpression(start){
  if (!state.impressions[start]) { state.impressions[start] = maintenant(); save(); }
}
function imprimer(){
  const start = state.ui.sunday;
  const G = grilleFeuille(start);
  const fond = FEUILLE.fonds[G.couleur];
  const bw = { thin:'0.5pt solid #000', medium:'1.5pt solid #000', thick:'2.25pt solid #000', double:'3pt double #000' };
  const k = FEUILLE.echelle;
  const totalMm = FEUILLE.largeurs.reduce((a,w) => a + colMm(w), 0);
  const grid = {};
  for (const c of G.cells) grid[c.r + ',' + c.c] = c;
  const occupe = new Set();
  let html = `<table class="of" style="width:${totalMm.toFixed(1)}mm"><colgroup>${FEUILLE.largeurs.map(w => `<col style="width:${colMm(w).toFixed(2)}mm">`).join('')}</colgroup>`;
  for (let r = 1; r <= G.nbRows; r++){
    const h = (FEUILLE.hauteurs[r] || 39) * k;   // même échelle que l'impression Excel (65 %)
    html += `<tr style="height:${h.toFixed(1)}pt">`;
    for (let c = 1; c <= G.nbCols; c++){
      if (occupe.has(r + ',' + c)) continue;
      const cell = grid[r + ',' + c];
      if (!cell) { html += `<td></td>`; continue; }
      for (let i = 0; i < cell.rs; i++) for (let j = 0; j < cell.cs; j++) if (i || j) occupe.add((r+i) + ',' + (c+j));
      const st = cell.st, css = [];
      if (st.modif) css.push('background:#' + FEUILLE.fonds.jaune); else if (st.fond) css.push('background:#' + fond);
      css.push('color:#' + FEUILLE.couleurs[st.color || 'noir']);
      css.push('font-size:' + ((st.size || 14) * k).toFixed(1) + 'pt');
      if (st.bold === false) css.push('font-weight:400');
      if (st.italic) css.push('font-style:italic');
      // titre : Calligrapher si installée, sinon la même substitution qu'Excel (serif droite, pas d'italique penchée)
      if (st.font === 'calli') css.push("font-family:Calligrapher,'Book Antiqua','Palatino Linotype','Times New Roman',serif");
      const b = st.b || {};
      for (const [k, prop] of [['l','border-left'],['r','border-right'],['t','border-top'],['b','border-bottom']]) if (b[k]) css.push(prop + ':' + bw[b[k]]);
      // étiquettes verticales (« soupe », « viande », « 3e plat ») : écrites de bas en haut
      const inner = st.rot ? `<div style="writing-mode:vertical-rl;transform:rotate(180deg);margin:0 auto">${esc(cell.v)}</div>` : esc(cell.v);
      html += `<td${cell.rs > 1 ? ' rowspan="' + cell.rs + '"' : ''}${cell.cs > 1 ? ' colspan="' + cell.cs + '"' : ''} style="${css.join(';')}">${inner}</td>`;
    }
    html += `</tr>`;
  }
  html += `</table>`;
  $('#printView').innerHTML = html;
  marquerImpression(start);
  window.print();
  render();
}

/* ================= Export Excel (.xlsx écrit à la main, sans bibliothèque) ================= */
function crc32(bytes){
  let crc = -1;
  for (let i=0;i<bytes.length;i++){ crc ^= bytes[i]; for (let k=0;k<8;k++) crc = (crc >>> 1) ^ (0xEDB88320 & -(crc & 1)); }
  return (crc ^ -1) >>> 0;
}
// Archive zip « stockée » (sans compression) — suffisant pour un .xlsx
function zipStore(files){
  const enc = new TextEncoder();
  const parts = [], central = [];
  let offset = 0;
  const u16 = n => [n & 255, (n >>> 8) & 255];
  const u32 = n => [n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255];
  const dt = new Date();
  const time = (dt.getHours() << 11) | (dt.getMinutes() << 5) | (dt.getSeconds() >> 1);
  const date = ((dt.getFullYear() - 1980) << 9) | ((dt.getMonth() + 1) << 5) | dt.getDate();
  for (const [name, content] of Object.entries(files)){
    const nb = enc.encode(name), db = enc.encode(content), crc = crc32(db);
    const head = new Uint8Array([...u32(0x04034b50), ...u16(20), ...u16(0x0800), ...u16(0), ...u16(time), ...u16(date),
      ...u32(crc), ...u32(db.length), ...u32(db.length), ...u16(nb.length), ...u16(0), ...nb]);
    parts.push(head, db);
    central.push(new Uint8Array([...u32(0x02014b50), ...u16(20), ...u16(20), ...u16(0x0800), ...u16(0), ...u16(time), ...u16(date),
      ...u32(crc), ...u32(db.length), ...u32(db.length), ...u16(nb.length), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(0), ...u32(offset), ...nb]));
    offset += head.length + db.length;
  }
  const cdSize = central.reduce((n,c) => n + c.length, 0);
  const end = new Uint8Array([...u32(0x06054b50), ...u16(0), ...u16(0), ...u16(central.length), ...u16(central.length), ...u32(cdSize), ...u32(offset), ...u16(0)]);
  return new Blob([...parts, ...central, end], { type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}
// Registre de styles : polices / remplissages / bordures / xf créés à la demande
function xlsxStyles(){
  // Index 0 = style « Normal » (Calibri 11, sans bordure) — Excel s'y réfère pour les hauteurs de ligne et largeurs de colonne
  const fonts = ['<font><sz val="11"/><color theme="1"/><name val="Calibri"/><family val="2"/><scheme val="minor"/></font>'];
  const fills = ['<fill><patternFill patternType="none"/></fill>', '<fill><patternFill patternType="gray125"/></fill>'];
  const borders = ['<border><left/><right/><top/><bottom/><diagonal/></border>'];
  const xfs = ['<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'];
  const idx = (arr, xml) => { let i = arr.indexOf(xml); if (i < 0) { arr.push(xml); i = arr.length - 1; } return i; };
  const fillIdx = {};
  return {
    xf(o){   // o = { font, size, bold, italic, color, fill (hex|null), b:{l,r,t,b}, wrap }
      const f = `<font>${o.bold === false ? '' : '<b/>'}${o.italic ? '<i/>' : ''}<sz val="${o.size || 14}"/><color rgb="FF${o.color || '000000'}"/><name val="${o.font || 'Book Antiqua'}"/></font>`;
      const fi = idx(fonts, f);
      let fl = 0;
      if (o.fill){ if (fillIdx[o.fill] === undefined) { fills.push(`<fill><patternFill patternType="solid"><fgColor rgb="FF${o.fill}"/><bgColor indexed="64"/></patternFill></fill>`); fillIdx[o.fill] = fills.length - 1; } fl = fillIdx[o.fill]; }
      const b = o.b || {};
      const side = (k, tag) => b[k] ? `<${tag} style="${b[k]}"><color rgb="FF000000"/></${tag}>` : `<${tag}/>`;
      const bx = `<border>${side('l','left')}${side('r','right')}${side('t','top')}${side('b','bottom')}<diagonal/></border>`;
      const bi = idx(borders, bx);
      const x = `<xf numFmtId="0" fontId="${fi}" fillId="${fl}" borderId="${bi}" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"${o.rot ? ' textRotation="90"' : ''} wrapText="1"/></xf>`;
      return idx(xfs, x);
    },
    xml(){
      return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">`
        + `<fonts count="${fonts.length}">${fonts.join('')}</fonts><fills count="${fills.length}">${fills.join('')}</fills><borders count="${borders.length}">${borders.join('')}</borders>`
        + `<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="${xfs.length}">${xfs.join('')}</cellXfs></styleSheet>`;
    },
  };
}
const colLettre = i => { let s = ''; i++; while (i > 0){ const r = (i-1) % 26; s = String.fromCharCode(65+r) + s; i = Math.floor((i-1)/26); } return s; };
function xlsxBlob(G, nomFeuille){
  const S = xlsxStyles();
  const fond = FEUILLE.fonds[G.couleur];
  const cellules = new Map(), merges = [];   // clé "r,c" → une seule cellule par coordonnée
  const styleDe = st => S.xf({ font: st.font === 'calli' ? 'Calligrapher' : 'Book Antiqua', size: st.size || 14, bold: st.bold, italic: st.italic, rot: st.rot,
      color: FEUILLE.couleurs[st.color || 'noir'], fill: st.modif ? FEUILLE.fonds.jaune : st.fond ? fond : null, b: st.b });
  for (const c of G.cells){
    cellules.set(c.r + ',' + c.c, { r: c.r, c: c.c, v: c.v, s: styleDe(c.st) });
    if (c.rs > 1 || c.cs > 1) merges.push(colLettre(c.c-1) + c.r + ':' + colLettre(c.c + c.cs - 2) + (c.r + c.rs - 1));
  }
  // cellules couvertes par une fusion et non définies explicitement : même style (bordures)
  for (const c of G.cells)
    for (let i = 0; i < c.rs; i++) for (let j = 0; j < c.cs; j++)
      if ((i || j) && !cellules.has((c.r+i) + ',' + (c.c+j))) cellules.set((c.r+i) + ',' + (c.c+j), { r: c.r+i, c: c.c+j, v: '', s: styleDe(c.st) });
  let sd = '';
  for (let r = 1; r <= G.nbRows; r++){
    const h = FEUILLE.hauteurs[r] || 39;
    const cs = [...cellules.values()].filter(x => x.r === r).sort((a,b) => a.c - b.c);
    sd += `<row r="${r}" ht="${h}" customHeight="1">` + cs.map(x => `<c r="${colLettre(x.c-1)}${r}" s="${x.s}" t="inlineStr"><is><t xml:space="preserve">${esc(x.v)}</t></is></c>`).join('') + `</row>`;
  }
  const cols = FEUILLE.largeurs.map((w,i) => `<col min="${i+1}" max="${i+1}" width="${w}" customWidth="1"/>`).join('');
  const sheet = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetPr><pageSetUpPr fitToPage="1"/></sheetPr><dimension ref="A1:K22"/><sheetViews><sheetView workbookViewId="0"/></sheetViews><sheetFormatPr baseColWidth="10" defaultColWidth="11.44140625" defaultRowHeight="18"/><cols>${cols}</cols><sheetData>${sd}</sheetData>${merges.length ? `<mergeCells count="${merges.length}">${merges.map(m => `<mergeCell ref="${m}"/>`).join('')}</mergeCells>` : ''}<printOptions horizontalCentered="1" verticalCentered="1"/><pageMargins left="0.3937" right="0.3937" top="0.3937" bottom="0.3937" header="0" footer="0"/><pageSetup paperSize="9" scale="63" orientation="landscape" fitToWidth="1" fitToHeight="1"/></worksheet>`;
  const files = {
    '[Content_Types].xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`,
    '_rels/.rels': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    'xl/workbook.xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${esc(nomFeuille)}" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    'xl/_rels/workbook.xml.rels': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
    'xl/styles.xml': S.xml(),
    'xl/worksheets/sheet1.xml': sheet,
  };
  return zipStore(files);
}
function exportXLSX(){
  const start = state.ui.sunday;
  const G = grilleFeuille(start);
  const blob = xlsxBlob(G, 'tableau ' + G.couleur);
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'Officiers-' + start + '.xlsx';
  a.click();
  marquerImpression(start);
  render();
}
/* ================= Données 2026 chargées d'office (modifiables ensuite) =================
   Fêtes : d'après l'Ordo OCSO 2025-2026 annoté par la communauté. Convention : solennités,
   fêtes, mémoires célébrées (« Ms mem » / « Messe de … ») et dimanches ; les féries et les
   simples annotations entre parenthèses ne figurent pas. Homélies : « Calendrier des homélies –
   2e semestre 2026 ». Un moine absent de la liste est mis en « invité » (nom libre). */
// v8 : corrections des fêtes 2026 déjà chargées (appliquées seulement si la fête n'a pas été modifiée à la main) :
// [date, ancien nom (null = ajout), nouveau nom, type]
const FETES_V8 = [
  ['2026-01-19','Pour l\'unité des chrétiens','Unité','memoire'], ['2026-01-22','Pour l\'unité des chrétiens','Unité','memoire'], ['2026-01-23','Pour l\'unité des chrétiens','Unité','memoire'],
  ['2026-01-20','St Sébastien','St Sébastien','memoire_fac'], ['2026-01-30','St Mutien-Marie de Malonne','St Mutien-Marie de Malonne','memoire_fac'],
  ['2026-04-22','Bse Marie-Gabrielle','Bse Maria-Gabriella','memoire'], ['2026-04-23','St Georges','St Georges et St Adalbert','memoire_fac'],
  ['2026-04-27','St Raphaël Arnáiz','St Raphaël Arnaiz Baron','memoire'], ['2026-04-28','St Louis-Marie Grignion de Montfort','St Louis-Marie Grignion de Montfort','memoire_fac'],
  ['2026-05-01','St Joseph, travailleur','St Joseph Ouvrier','memoire'], ['2026-05-12',null,'Rogations','memoire'], ['2026-05-13',null,'Notre-Dame de Fatima','memoire_fac'],
  ['2026-05-21','Sts martyrs du Mexique','Sts martyrs du Mexique','memoire_fac'], ['2026-06-02','Sts martyrs de Lyon','Sts martyrs de Lyon','memoire_fac'],
  ['2026-06-19','Notre-Dame de Moulins','Notre-Dame de Moulins','memoire_fac'], ['2026-07-29','Sts Marthe, Marie et Lazare','Les saints amis du Seigneur','memoire'],
  ['2026-07-30',null,'St Pierre Chrysologue','memoire_fac'], ['2026-08-05','Dédicace de Ste-Marie-Majeure','Notre-Dame des Neiges','memoire'],
  ['2026-08-07','St Sixte II et compagnons','Sts Sixte et ses compagnons','memoire_fac'], ['2026-10-09','St John Henry Newman','St John Henry Newman','memoire_fac'],
  ['2026-12-01','St Charles de Foucauld','St Charles de Foucauld','memoire_fac'], ['2026-12-04','Bx martyrs de Viaceli','Bx martyrs de Viaceli','memoire_fac'],
  ['2026-12-09','St Juan Diego','St Juan Diego','memoire_fac'], ['2026-12-10','Notre-Dame de Lorette','Notre-Dame de Lorette','memoire_fac'],
  ...['2026-01-29','2026-02-13','2026-05-28','2026-06-18','2026-07-13','2026-08-26','2026-09-11','2026-10-21'].map(d => [d,'Messe pour les défunts','Défunts','memoire']),
];
const FETES_2026 = [
  // Janvier
  ['2026-01-01','Ste Marie, Mère de Dieu','solennite'],
  ['2026-01-02','Sts Basile le Grand et Grégoire de Nazianze','memoire'],
  ['2026-01-03','Saint Nom de Jésus','memoire'],
  ['2026-01-04','Épiphanie du Seigneur','solennite'],
  ['2026-01-11','Baptême du Seigneur','fete'],
  ['2026-01-12','St Aelred','memoire'],
  ['2026-01-15','Sts Maur et Placide','memoire'],
  ['2026-01-17','St Antoine','memoire'],
  ['2026-01-18','2e dimanche du temps ordinaire','dimanche'],
  ['2026-01-19','Unité','memoire'],
  ['2026-01-20','St Sébastien','memoire_fac'],
  ['2026-01-21','Ste Agnès','memoire'],
  ['2026-01-22','Unité','memoire'],
  ['2026-01-23','Unité','memoire'],
  ['2026-01-24','St François de Sales','memoire'],
  ['2026-01-25','3e dimanche du temps ordinaire','dimanche'],
  ['2026-01-26','Sts Robert, Albéric et Étienne, abbés de Cîteaux','solennite'],
  ['2026-01-27','Sts Timothée et Tite','memoire'],
  ['2026-01-28','St Thomas d\'Aquin','memoire'],
  ['2026-01-29','Défunts','memoire'],
  ['2026-01-30','St Mutien-Marie de Malonne','memoire_fac'],
  ['2026-01-31','St Jean Bosco','memoire'],
  // Février
  ['2026-02-01','4e dimanche du temps ordinaire','dimanche'],
  ['2026-02-02','Présentation du Seigneur','fete'],
  ['2026-02-05','Ste Agathe','memoire'],
  ['2026-02-06','Sts Paul Miki et compagnons','memoire'],
  ['2026-02-07','Ste Marie (samedi)','memoire'],
  ['2026-02-08','5e dimanche du temps ordinaire','dimanche'],
  ['2026-02-10','Ste Scholastique','memoire'],
  ['2026-02-11','Notre-Dame de Lourdes','memoire'],
  ['2026-02-13','Défunts','memoire'],
  ['2026-02-14','Sts Cyrille et Méthode','fete'],
  ['2026-02-15','6e dimanche du temps ordinaire','dimanche'],
  ['2026-02-18','Mercredi des Cendres','fete'],
  ['2026-02-22','1er dimanche de Carême','dimanche'],
  // Mars
  ['2026-03-01','2e dimanche de Carême','dimanche'],
  ['2026-03-08','3e dimanche de Carême','dimanche'],
  ['2026-03-15','4e dimanche de Carême (Lætare)','dimanche'],
  ['2026-03-19','St Joseph','solennite'],
  ['2026-03-22','5e dimanche de Carême','dimanche'],
  ['2026-03-25','Annonciation du Seigneur','solennite'],
  ['2026-03-29','Dimanche des Rameaux','dimanche'],
  ['2026-03-30','Lundi Saint','memoire'],
  ['2026-03-31','Mardi Saint','memoire'],
  // Avril
  ['2026-04-01','Mercredi Saint','memoire'],
  ['2026-04-02','Jeudi Saint','fete'],
  ['2026-04-03','Vendredi Saint','fete'],
  ['2026-04-04','Samedi Saint','fete'],
  ['2026-04-05','Pâques','solennite'],
  ['2026-04-06','Lundi de Pâques','fete'],
  ['2026-04-07','Mardi de Pâques','fete'],
  ['2026-04-08','Mercredi de Pâques','fete'],
  ['2026-04-09','Jeudi de Pâques','fete'],
  ['2026-04-10','Vendredi de Pâques','fete'],
  ['2026-04-11','Samedi de Pâques','fete'],
  ['2026-04-12','2e dimanche de Pâques (Miséricorde)','dimanche'],
  ['2026-04-16','St Benoît-Joseph Labre','fete'],
  ['2026-04-19','3e dimanche de Pâques','dimanche'],
  ['2026-04-21','St Anselme','memoire'],
  ['2026-04-22','Bse Maria-Gabriella','memoire'],
  ['2026-04-23','St Georges et St Adalbert','memoire_fac'],
  ['2026-04-25','St Marc','fete'],
  ['2026-04-26','4e dimanche de Pâques','dimanche'],
  ['2026-04-27','St Raphaël Arnaiz Baron','memoire'],
  ['2026-04-28','St Louis-Marie Grignion de Montfort','memoire_fac'],
  ['2026-04-29','Ste Catherine de Sienne','fete'],
  // Mai
  ['2026-05-01','St Joseph Ouvrier','memoire'],
  ['2026-05-02','St Athanase','memoire'],
  ['2026-05-03','5e dimanche de Pâques','dimanche'],
  ['2026-05-08','Bx martyrs de l\'Atlas','memoire'],
  ['2026-05-09','Notre-Dame de Chine','memoire'],
  ['2026-05-10','6e dimanche de Pâques','dimanche'],
  ['2026-05-11','Sts abbés de Cluny','memoire'],
  ['2026-05-12','Rogations','memoire'],
  ['2026-05-13','Notre-Dame de Fatima','memoire_fac'],
  ['2026-05-14','Ascension du Seigneur','solennite'],
  ['2026-05-15','St Pacôme','memoire'],
  ['2026-05-16','St Jean Népomucène','memoire'],
  ['2026-05-17','7e dimanche de Pâques','dimanche'],
  ['2026-05-21','Sts martyrs du Mexique','memoire_fac'],
  ['2026-05-24','Pentecôte','solennite'],
  ['2026-05-25','Bienheureuse Vierge Marie, Mère de l\'Église','memoire'],
  ['2026-05-27','St Augustin de Cantorbéry','memoire'],
  ['2026-05-28','Défunts','memoire'],
  ['2026-05-30','Ste Marie (samedi)','memoire'],
  ['2026-05-31','Sainte Trinité','solennite'],
  // Juin
  ['2026-06-01','St Justin','memoire'],
  ['2026-06-02','Sts martyrs de Lyon','memoire_fac'],
  ['2026-06-03','Sts Charles Lwanga et compagnons','memoire'],
  ['2026-06-05','St Boniface','memoire'],
  ['2026-06-06','Ste Marie (samedi)','memoire'],
  ['2026-06-07','Saint-Sacrement (Fête-Dieu)','solennite'],
  ['2026-06-11','St Barnabé','memoire'],
  ['2026-06-12','Sacré-Cœur de Jésus','solennite'],
  ['2026-06-13','Cœur immaculé de Marie','memoire'],
  ['2026-06-14','11e dimanche du temps ordinaire','dimanche'],
  ['2026-06-16','Ste Lutgarde','memoire'],
  ['2026-06-17','Bx Marie-Joseph Cassant','memoire'],
  ['2026-06-18','Défunts','memoire'],
  ['2026-06-19','Notre-Dame de Moulins','memoire_fac'],
  ['2026-06-20','Ste Marie (samedi)','memoire'],
  ['2026-06-21','12e dimanche du temps ordinaire','dimanche'],
  ['2026-06-24','Nativité de St Jean-Baptiste','solennite'],
  ['2026-06-27','Ste Marie (samedi)','memoire'],
  ['2026-06-28','13e dimanche du temps ordinaire','dimanche'],
  ['2026-06-29','Sts Pierre et Paul','solennite'],
  // Juillet
  ['2026-07-03','St Thomas, apôtre','fete'],
  ['2026-07-04','Ste Marie (samedi)','memoire'],
  ['2026-07-05','14e dimanche du temps ordinaire','dimanche'],
  ['2026-07-08','Bx Eugène III','memoire'],
  ['2026-07-09','Sts martyrs de Chine','memoire'],
  ['2026-07-11','St Benoît','solennite'],
  ['2026-07-12','15e dimanche du temps ordinaire','dimanche'],
  ['2026-07-13','Défunts','memoire'],
  ['2026-07-15','St Bonaventure','memoire'],
  ['2026-07-16','Notre-Dame du Mont-Carmel','memoire'],
  ['2026-07-19','16e dimanche du temps ordinaire','dimanche'],
  ['2026-07-22','Ste Marie-Madeleine','fete'],
  ['2026-07-23','Ste Brigitte','fete'],
  ['2026-07-25','St Jacques','fete'],
  ['2026-07-26','17e dimanche du temps ordinaire','dimanche'],
  ['2026-07-29','Les saints amis du Seigneur','memoire'],
  ['2026-07-30','St Pierre Chrysologue','memoire_fac'],
  ['2026-07-31','St Ignace de Loyola','memoire'],
  // Août
  ['2026-08-01','St Alphonse de Liguori','memoire'],
  ['2026-08-02','18e dimanche du temps ordinaire','dimanche'],
  ['2026-08-04','St Jean-Marie Vianney','memoire'],
  ['2026-08-05','Notre-Dame des Neiges','memoire'],
  ['2026-08-06','Transfiguration du Seigneur','fete'],
  ['2026-08-07','Sts Sixte et ses compagnons','memoire_fac'],
  ['2026-08-08','St Dominique','memoire'],
  ['2026-08-09','19e dimanche du temps ordinaire','dimanche'],
  ['2026-08-10','St Laurent','fete'],
  ['2026-08-11','Ste Claire','memoire'],
  ['2026-08-12','Ste Jeanne de Chantal','memoire'],
  ['2026-08-14','St Maximilien Kolbe','memoire'],
  ['2026-08-15','Assomption','solennite'],
  ['2026-08-16','20e dimanche du temps ordinaire','dimanche'],
  ['2026-08-18','Bx Paul et Élie de Sept-Fons','memoire'],
  ['2026-08-19','Bx Guerric','memoire'],
  ['2026-08-20','St Bernard','solennite'],
  ['2026-08-21','St Pie X','memoire'],
  ['2026-08-22','B.V. Marie-Reine','memoire'],
  ['2026-08-23','21e dimanche du temps ordinaire','dimanche'],
  ['2026-08-24','St Barthélemy','fete'],
  ['2026-08-25','St Louis','memoire'],
  ['2026-08-26','Défunts','memoire'],
  ['2026-08-27','Ste Monique','memoire'],
  ['2026-08-28','St Augustin','memoire'],
  ['2026-08-29','Martyre de St Jean-Baptiste','memoire'],
  ['2026-08-30','22e dimanche du temps ordinaire','dimanche'],
  // Septembre
  ['2026-09-03','St Grégoire le Grand','memoire'],
  ['2026-09-05','Ste Marie (samedi)','memoire'],
  ['2026-09-06','23e dimanche du temps ordinaire','dimanche'],
  ['2026-09-08','Nativité de la Vierge Marie','fete'],
  ['2026-09-11','Défunts','memoire'],
  ['2026-09-12','Saint Nom de Marie','memoire'],
  ['2026-09-13','24e dimanche du temps ordinaire','dimanche'],
  ['2026-09-14','Croix glorieuse','fete'],
  ['2026-09-15','Notre-Dame des Douleurs','memoire'],
  ['2026-09-16','Sts Corneille et Cyprien','memoire'],
  ['2026-09-19','Notre-Dame de la Salette','memoire'],
  ['2026-09-20','25e dimanche du temps ordinaire','dimanche'],
  ['2026-09-21','St Matthieu','fete'],
  ['2026-09-23','St Pio de Pietrelcina','memoire'],
  ['2026-09-26','Ste Marie (samedi)','memoire'],
  ['2026-09-27','26e dimanche du temps ordinaire','dimanche'],
  ['2026-09-29','Sts Michel, Gabriel et Raphaël','fete'],
  ['2026-09-30','St Jérôme','memoire'],
  // Octobre
  ['2026-10-01','Ste Thérèse de l\'Enfant-Jésus','memoire'],
  ['2026-10-02','Sts Anges gardiens','memoire'],
  ['2026-10-03','Ste Marie (samedi)','memoire'],
  ['2026-10-04','27e dimanche du temps ordinaire','dimanche'],
  ['2026-10-06','St Bruno','memoire'],
  ['2026-10-07','Notre-Dame du Rosaire','memoire'],
  ['2026-10-09','St John Henry Newman','memoire_fac'],
  ['2026-10-10','Ste Marie (samedi)','memoire'],
  ['2026-10-11','28e dimanche du temps ordinaire','dimanche'],
  ['2026-10-14','St Ignace d\'Antioche','memoire'],
  ['2026-10-15','Ste Thérèse d\'Avila','memoire'],
  ['2026-10-16','Ste Marguerite-Marie Alacoque','memoire'],
  ['2026-10-17','Dédicace de l\'église de Sept-Fons','solennite'],
  ['2026-10-18','29e dimanche du temps ordinaire (missions)','dimanche'],
  ['2026-10-19','Sts martyrs du Canada','memoire'],
  ['2026-10-21','Défunts','memoire'],
  ['2026-10-22','St Jean-Paul II','memoire'],
  ['2026-10-24','Ste Marie (samedi)','memoire'],
  ['2026-10-25','30e dimanche du temps ordinaire','dimanche'],
  ['2026-10-28','Sts Simon et Jude','fete'],
  ['2026-10-31','Ste Marie (samedi)','memoire'],
  // Novembre
  ['2026-11-01','Toussaint','solennite'],
  ['2026-11-02','Commémoration des fidèles défunts','fete'],
  ['2026-11-04','St Charles Borromée','memoire'],
  ['2026-11-07','Ste Marie (samedi)','memoire'],
  ['2026-11-08','32e dimanche du temps ordinaire','dimanche'],
  ['2026-11-09','Dédicace de la basilique du Latran','fete'],
  ['2026-11-10','St Léon le Grand','memoire'],
  ['2026-11-11','St Martin','memoire'],
  ['2026-11-13','Tous les saints de l\'Ordre bénédictin','fete'],
  ['2026-11-14','Ste Marie (samedi)','memoire'],
  ['2026-11-15','33e dimanche du temps ordinaire','dimanche'],
  ['2026-11-16','Ste Gertrude','memoire'],
  ['2026-11-17','Commémoration des frères défunts','memoire'],
  ['2026-11-18','Dédicace des basiliques St-Pierre et St-Paul','memoire'],
  ['2026-11-21','Présentation de la Vierge Marie','memoire'],
  ['2026-11-22','Christ, Roi de l\'univers','solennite'],
  ['2026-11-24','Sts André Dung-Lac et compagnons','memoire'],
  ['2026-11-28','Ste Marie (samedi)','memoire'],
  ['2026-11-29','1er dimanche de l\'Avent','dimanche'],
  ['2026-11-30','St André','fete'],
  // Décembre
  ['2026-12-01','St Charles de Foucauld','memoire_fac'],
  ['2026-12-03','St François-Xavier','memoire'],
  ['2026-12-04','Bx martyrs de Viaceli','memoire_fac'],
  ['2026-12-06','2e dimanche de l\'Avent','dimanche'],
  ['2026-12-07','St Ambroise','memoire'],
  ['2026-12-08','Immaculée Conception','solennite'],
  ['2026-12-09','St Juan Diego','memoire_fac'],
  ['2026-12-10','Notre-Dame de Lorette','memoire_fac'],
  ['2026-12-12','Notre-Dame de Guadalupe','memoire'],
  ['2026-12-13','3e dimanche de l\'Avent (Gaudete)','dimanche'],
  ['2026-12-14','St Jean de la Croix','memoire'],
  ['2026-12-20','4e dimanche de l\'Avent','dimanche'],
  ['2026-12-25','Noël','solennite'],
  ['2026-12-26','St Étienne','fete'],
  ['2026-12-27','Sainte Famille','fete'],
  ['2026-12-28','Saints Innocents','fete'],
  ['2026-12-29','Octave de Noël','memoire'],
  ['2026-12-30','Octave de Noël','memoire'],
  ['2026-12-31','Octave de Noël','memoire'],
];
const HOMELIES_2026 = [
  ['2026-07-05','P. Louis-Marie'], ['2026-07-11','P. Timothée'], ['2026-07-12','Alexandre'],
  ['2026-07-19','P. Augustin'], ['2026-07-26','P. Raphaël'],
  ['2026-08-02','P. Sébastien'], ['2026-08-09','P. Joaquim'], ['2026-08-15','P. Vianney'],
  ['2026-08-16','P. Guillaume'], ['2026-08-20','Dom Petr'], ['2026-08-23','RPA'], ['2026-08-30','P. Xavier'],
  ['2026-09-06','P. Adam'], ['2026-09-13','P. Georges'], ['2026-09-20','F. Godefroid'], ['2026-09-27','Dom Bernardus'],
  ['2026-10-04','P. Joseph'], ['2026-10-11','P. Jean-Théophane'], ['2026-10-17','P. Antoine'],
  ['2026-10-18','P. Nathanaël'], ['2026-10-25','F. Dismas'],
  ['2026-11-01','P. Louis-Marie'], ['2026-11-08','P. Timothée'], ['2026-11-15','P. Augustin'],
  ['2026-11-22','P. Raphaël'], ['2026-11-29','P. Sébastien'],
  ['2026-12-06','P. Joaquim'], ['2026-12-08','P. Vianney'], ['2026-12-13','P. Guillaume'],
  ['2026-12-20','Dom Petr'], ['2026-12-25','RPA / P. Xavier'], ['2026-12-27','P. Adam'],
];
const normNom = s => String(s || '').toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').replace(/[^a-z0-9]+/g, ' ').trim();
function importerDonnees2026(){
  let nbF = 0, nbH = 0;
  const inconnus = [];
  for (const [date, nom, rang] of FETES_2026){
    if (feteOn(date)) continue;
    state.fetes.push({ id:'f'+(state.seq.fete++), date, nom, rang }); nbF++;
  }
  const abbe = state.settings.abbeId ? monkById(state.settings.abbeId) : null;
  for (const [date, nom] of HOMELIES_2026){
    if (findAssign('homelie', sundayOf(date), date)) continue;
    let m = null;
    if (nom === 'RPA') m = abbe || state.moines.find(x => normNom(x.nom) === normNom('R.P. Abbé')) || null;
    else m = state.moines.find(x => normNom(x.nom) === normNom(nom)) || null;
    if (!m) inconnus.push(nom);
    state.affectations.push({ id:'a'+(state.seq.affect++), serviceId:'homelie', semaine: sundayOf(date), date,
      moineId: m ? m.id : null, nomLibre: m ? null : nom.replace('RPA', 'R.P. Abbé'), verrouille:false });
    nbH++;
  }
  if (nbF || nbH){
    bannerMsg = `Chargement initial 2026 : ${nbF} fêtes et ${nbH} homélies ajoutées (modifiables comme les autres).`
      + (inconnus.length ? ` Homélies en « invité », nom non trouvé dans les fiches : <b>${[...new Set(inconnus)].map(esc).join(', ')}</b> — cliquer sur la case pour les rattacher à une fiche si besoin.` : '');
  }
}

/* ================= Liste de la communauté (« Liste des moines inscrits », 22/02/2026) =================
   [nom complet, naissance, entrée, profession temporaire, ordination, divers, stabilisé] — appliquée par la migration v9. */
const COMMUNAUTE_2026 = [
  ["Père Bruno Decros", "1943-10-22", "1962-07-31", "1964-08-30", "1977-05-29", "permission d’absence", true],
  ["Frère Francis Bohn", "1943-10-22", "1966-11-25", "1969-04-13", null, "", true],
  ["Père Nicolas Hennequin", "1948-08-31", "1969-09-29", "1971-09-08", "1979-06-03", "Latroun", true],
  ["Dom Patrick Olive", "1947-08-29", "1969-11-18", "1972-01-01", "1975-11-30", "Latroun", true],
  ["Frère Philippe Tézenas", "1942-07-29", "1971-09-20", "1973-11-13", null, "", true],
  ["Dom François de Place", "1944-12-26", "1974-09-14", "1977-01-01", "1993-07-02", "", true],
  ["Père Etienne Trouilloux", "1950-05-22", "1977-09-28", "1979-12-30", "1987-08-20", "", true],
  ["Frère Benoît-Joseph Branchu", "1948-04-14", "1981-08-06", "1984-01-01", null, "", true],
  ["Père Sébastien Kern", "1965-05-12", "1983-07-23", "1986-09-08", "1996-12-01", "sous-chantre", true],
  ["Frère Cyrille Eloot", "1959-02-15", "1983-10-30", "1986-08-15", null, "", true],
  ["Frère Guerric Moriceau", "1964-06-18", "1984-03-01", "1986-12-08", null, "", true],
  ["Frère Dominique Pasquet", "1951-10-27", "1984-10-05", "1987-06-29", null, "Latroun", true],
  ["Père Vincent de Paul Spagnol", "1923-10-12", "1986-10-04", "1989-07-11", "1950-06-03", "", true],
  ["Frère Matthieu d’Anselme", "1963-11-11", "1987-09-08", "1990-05-13", null, "", true],
  ["Père David Gratien", "1963-07-29", "1988-10-04", "1991-06-29", "1999-07-11", "Rome", true],
  ["Frère Laurent Seigneur", "1946-04-09", "1991-03-01", "1994-04-16", null, "oblat", true],
  ["Père Thomas Getti", "1965-12-04", "1991-03-07", "1993-08-22", "1999-08-15", "Abbé", true],
  ["Père Alexis Vergon", "1968-04-29", "1991-10-25", "1996-01-01", "2002-12-08", "supérieur d’Aiguebelle", true],
  ["Père Jérémie Coubat", "1973-05-21", "1992-09-14", "1995-05-01", "2002-06-29", "permission d’absence", true],
  ["Père Elie Molčanov", "1973-06-26", "1992-10-17", "1995-07-29", "2001-12-02", "Rép. Tchèque - Chine", true],
  ["Père Joaquim Vodier", "1972-07-06", "1994-01-02", "1997-02-11", "2004-05-30", "maître des novices", true],
  ["Père Timothée Burtat", "1975-10-06", "1996-01-10", "1999-05-01", "2005-11-27", "", true],
  ["Père Emmanuel Slaiher", "1964-06-04", "1997-10-23", "2000-08-06", "2006-12-03", "en transitus à Aiguebelle", true],
  ["Frère Rémi Groussat", "1978-11-07", "1998-09-18", "2001-09-14", null, "Latroun", true],
  ["Père Nathanaël Vanhaelemeesch", "1972-01-16", "1999-02-15", "2001-08-05", "2009-07-22", "", true],
  ["Père Jean de la Croix Pospíšil", "1976-03-03", "1999-05-01", "2002-05-01", "2008-10-17", "Toulon", true],
  ["Frère Christophe Dusseau", "1976-05-03", "2002-01-01", "2006-01-06", null, "", true],
  ["P. Jean-Baptiste Brousse de Gersigny", "1978-06-03", "2002-08-29", "2005-07-11", "2012-06-15", "Bádi", true],
  ["Frère Bernard Tine", "1979-05-17", "2002-09-25", "2005-09-29", null, "Bádi", true],
  ["Dom Petr Charolide", "1981-03-30", "2003-08-20", "2006-07-22", "2014-06-27", "", true],
  ["Père Antoine Toman", "1984-04-02", "2003-09-08", "2006-07-11", "2013-08-04", "chantre, maître des jns profs", true],
  ["Frère Jean-Simon Diouf", "1975-01-20", "2003-12-05", "2006-11-26", null, "en stage à Nice", true],
  ["Frère Tobie Mucha", "1985-02-09", "2004-04-27", "2008-02-11", null, "République tchèque", true],
  ["Père Joseph Abgrall", "1960-10-27", "2004-08-22", "2007-10-07", "1995-06-24", "", true],
  ["Père Louis-Marie Ravon", "1964-03-30", "2004-09-07", "2007-11-21", "1993-06-19", "Sous-Prieur", true],
  ["Père Guillaume Cavigioli", "1979-08-02", "2005-05-28", "2008-05-31", "2015-08-16", "", true],
  ["Père Pacôme Liu", "1986-10-23", "2006-02-09", "2009-02-11", "2016-05-16", "aumonier à la Rochette", true],
  ["Frère Jean-Gabriel Fenck", "1978-07-14", "2006-05-18", "2009-05-31", null, "", true],
  ["Frère Jean de Dieu Li", "1982-12-16", "2006-06-16", "2009-07-16", null, "", true],
  ["Frère Mutien Diebolt", "1981-05-31", "2006-06-30", "2009-07-11", null, "", true],
  ["Père Jean-Théophane Samat", "1982-11-30", "2006-09-08", "2009-09-08", "2019-03-25", "", true],
  ["Frère Louis Rous", "1981-09-26", "2006-11-11", "2009-11-11", null, "Bádi", true],
  ["Dom Charles-Lwanga Ndong", "1983-11-26", "2007-02-18", "2010-02-11", "2018-03-11", "supérieur à Bádi", true],
  ["Père Augustin Claire", "1985-03-02", "2007-12-02", "2010-12-12", "2017-06-29", "Prieur", true],
  ["Frère André Diouf", "1982-09-05", "2008-04-08", "2011-03-17", null, "Badi", true],
  ["Frère Jacques Lan", "1987-07-12", "2008-07-19", "2011-08-06", null, "", true],
  ["Frère Albéric Chetcuti", "1979-03-02", "2008-12-19", "2013-01-06", null, "Ganagobie", true],
  ["Père Adam Groussat", "1989-11-07", "2009-05-29", "2012-06-24", "2018-12-08", "Cellérier", true],
  ["Père Xavier Feng", "1989-03-05", "2009-06-23", "2012-08-15", "2022-05-29", "", true],
  ["Père Georges Ségal", "1989-12-26", "2010-01-02", "2012-12-26", "2022-02-22", "", true],
  ["Frère Yves Folgoas", "1985-11-03", "2010-01-02", "2013-01-01", null, "", true],
  ["Père Aloïs Delapalme", "1987-10-08", "2010-08-30", "2013-08-15", "2022-07-02", "Latroun", true],
  ["Frère Samuel Vauthrin", "1984-12-12", "2011-04-21", "2014-02-02", null, "exclaustration", true],
  ["Père Raphaël Pujos", "1989-06-08", "2011-08-19", "2014-08-15", "2024-05-09", "directeur du Moulin", true],
  ["Frère Romain Cesvet", "1987-06-02", "2011-09-30", "2016-01-03", null, "", true],
  ["Frère Damien Szentivanyi", "1984-04-24", "2012-07-16", "2015-07-05", null, "Barroux", true],
  ["Frère Adrien Targe", "1983-07-26", "2013-03-26", "2016-04-04", null, "", true],
  ["Père Vianney Zhao", "1993-09-18", "2013-05-10", "2016-05-13", "2024-04-21", "", true],
  ["Frère Noël Tam", "1981-10-28", "2013-10-03", "2016-12-12", null, "saint wandrille", true],
  ["Frère Jean-Bosco Hu", "1994-04-08", "2013-10-06", "2016-11-01", null, "sous-cellérier", true],
  ["Frère Godefroid Meaby de Monspey", "1993-07-02", "2014-07-11", "2017-07-11", null, "secrétaire", true],
  ["Frère Matthias Wang", "1996-06-09", "2014-08-13", "2017-12-08", null, "", true],
  ["Frère Dismas Vincens", "1991-02-20", "2014-09-08", "2017-08-20", null, "sous-maître des novices", true],
  ["Frère Maximilien Bednariche", "1989-09-26", "2014-10-14", "2018-09-15", null, "oblat", true],
  ["Frère Jean Vinieux", "1980-08-24", "2015-06-01", "2018-06-08", null, "", true],
  ["Frère Christian Dai", "1987-09-23", "2015-12-22", "2019-05-31", null, "", true],
  ["Frère Baudouin Fleury", "1993-05-08", "2016-01-22", "2019-03-17", null, "Bádi", true],
  ["Frère Athanase Badan", "1986-10-31", "2016-02-10", "2019-12-28", null, "Latroun", true],
  ["Frère Martin de Cacqueray", "1992-03-07", "2016-09-05", "2019-12-12", null, "Latroun", true],
  ["Frère Barnabé Huin", "1992-01-09", "2017-12-24", "2021-07-11", null, "", true],
  ["Frère Gérard Carvallo de Ochoa", "1973-07-28", "2019-08-28", "2024-07-22", null, "oblat, Badi", true],
  ["Frère Marc Tran", "1989-08-18", "2019-11-04", "2022-11-13", null, "", true],
  ["Frère Paul Lamiot", "1997-05-12", "2020-01-04", "2022-12-08", null, "", true],
  ["Frère Irénée Buisse", "1990-12-24", "2020-02-03", "2023-02-02", null, "", true],
  ["Frère Élisée Trouillet", "1994-07-18", "2020-12-29", "2023-12-17", null, "", true],
  ["Frère Gabriel Phan", "1991-11-10", "2021-12-22", "2025-08-20", null, "", true],
  ["Frère Foucauld Delbende", "1997-05-05", "2022-05-24", "2025-11-23", null, "", true],
  ["Frère Basile Clamagirand", "1996-01-22", "2022-10-20", "2026-02-11", null, "", true],
  ["Frère Luc Nguyen", "1997-01-04", "2023-06-20", null, null, "", true],
  ["F. Siméon Nguyen", "2002-02-14", "2024-03-15", null, null, "", true],
  ["F. Benoît Diande", "1986-07-31", "2024-10-27", null, null, "", true],
  ["Robert Pham", "1997-04-07", "2025-08-19", null, null, "", true],
  ["Roch Jia", "1994-01-11", "2025-09-04", null, null, "", true],
  ["Charles Gallagher", "1992-08-21", "2025-11-02", null, null, "", true],
  ["Josué Kong", "1993-12-28", "2026-01-05", null, null, "", true],
  ["F. Antoine Zgheib", "1972-02-13", "1997-02-10", "1997-04-14", null, "Latroun", false],
  ["F. Patrick Lin", "1989-09-12", "2018-03-01", "2021-09-14", null, "Consolation", false],
  ["F. Charles Gao", "1991-06-28", "2019-03-03", "2022-07-11", null, "Consolation", false],
  ["Dom Jacques-Emmanuel", "1936-12-24", "1981-08-06", null, "1971-01-16", "Rochefort", false]
];

// Affectations hors de Sept-Fons (Latroun, Bádi, Rome…) : membre de la communauté mais pas sur place → « de passage »
const HORS_SEPT_FONS = /latroun|b[aá]di|rome|toulon|ganagobie|barroux|aiguebelle|nice|tch[eè]que|consolation|rochefort|wandrille|exclaustration|permission|rochette|chine/i;
const TITRES_RE = /^(pere|p|dom|frere|f|fr)\s+/;
function importerCommunaute(){
  const res = { maj:0, crees:[], ambigus:[], nonTrouves:[], hors:[] };
  const cle = m => normNom(m.nom).replace(TITRES_RE, '').replace(/ (ii|iii|de r)$/, '');   // prénom de religion normalisé
  const estPretre = m => m.statut === 'pretre' || m.statut === 'diacre';
  const roles = { 'abbe':'R.P. Abbé', 'prieur':'P. Prieur', 'sous prieur':'P. Sous-Prieur', 'maitre des novices':'P. Maître' };
  const parNom = n => state.moines.find(m => normNom(m.nom) === normNom(n)) || null;
  // Chaque fiche ne peut recevoir qu'une ligne : la plus précise (prénom le plus long) gagne
  const attributions = new Map();   // moine.id → { ligne, longueur }
  for (const ligne of COMMUNAUTE_2026){
    const [nom] = ligne;
    const titre = nom.split(' ')[0];
    const pretre = ['Père','P.','Dom'].includes(titre);
    const frere = ['Frère','F.','Fr.'].includes(titre);
    const n = normNom(nom).replace(TITRES_RE, '');
    let cands = state.moines.filter(m => {
      const p = cle(m); if (!p || ROLES.includes(p)) return false;
      if (pretre && !estPretre(m)) return false;
      if (frere && m.statut !== 'frere') return false;
      if (!pretre && !frere && m.statut !== 'postulant') return false;
      return n === p || n.startsWith(p + ' ');
    });
    if (!cands.length) continue;
    const lmax = Math.max(...cands.map(m => cle(m).length));
    cands = cands.filter(m => cle(m).length === lmax);
    if (cands.length > 1) { res.ambigus.push(nom + ' ↔ ' + cands.map(m => m.nom).join(' / ')); continue; }
    const m = cands[0], prev = attributions.get(m.id);
    if (!prev || prev.longueur < lmax) attributions.set(m.id, { ligne, longueur: lmax });
  }
  const traitees = new Set();
  const appliquer = (m, ligne, creation) => {
    const [nom, naiss, entree, prof, ordi, divers] = ligne;
    traitees.add(nom);
    if (naiss) m.naissance = naiss;
    if (entree) m.entree = entree;
    if (prof) m.profession = prof;
    if (ordi) m.ordination = ordi;
    if (divers && HORS_SEPT_FONS.test(divers)){
      // À l'extérieur en février 2026 — sauf s'il figure sur le tableau des 3 derniers mois (revenu depuis)
      const recent = affsDe(m.id).some(a => keyOf(a) >= addDays(todayISO(), -90));
      if (recent) res.revenus = (res.revenus || []).concat(m.nom + ' (' + divers + ')');
      else { m.regime = 'externe'; m.actif = true; res.hors.push(m.nom + ' (' + divers + ')'); }
    }
    const note = 'Liste communauté 22/02/2026 : ' + nom + (divers ? ' — ' + divers : '');
    if (!(m.notes || '').includes('Liste communauté')) m.notes = ((m.notes || '') + '\n' + note).trim();
    if (!creation) res.maj++;
  };
  for (const [mid, { ligne }] of attributions) appliquer(monkById(mid), ligne, false);
  // Fiches « de fonction » (R.P. Abbé, P. Prieur, P. Sous-Prieur, P. Maître) : mêmes données que la personne
  for (const ligne of COMMUNAUTE_2026){
    const div = normNom(ligne[5] || '').replace(/ /g, ' ');
    for (const [k, nomRole] of Object.entries(roles)){
      if (div === k || div.startsWith(k)) { const r = parNom(nomRole); if (r) { const [, naiss, entree, prof, ordi] = ligne; if (naiss) r.naissance = naiss; if (entree) r.entree = entree; if (prof) r.profession = prof; if (ordi) r.ordination = ordi; res.maj++; } }
    }
  }
  // Lignes sans fiche : création (à l'extérieur → de passage ; sinon inactive, jamais vue dans le tableau)
  for (const ligne of COMMUNAUTE_2026){
    const [nom, , , , , divers] = ligne;
    if (traitees.has(nom) || res.ambigus.some(a => a.startsWith(nom + ' '))) continue;
    const titre = nom.split(' ')[0];
    const pretre = ['Père','P.','Dom'].includes(titre), frere = ['Frère','F.','Fr.'].includes(titre);
    const reste = nom.replace(/^(Père|P\.|Dom|Frère|F\.|Fr\.)\s+/, '');
    // Nom de religion court : « P. Bruno », « F. Francis », « Dom Patrick » ; postulants : prénom seul
    const prenom = reste.split(' ').slice(0, /^(Jean|Vincent|Marie|Charles)$/.test(reste.split(' ')[0]) && /^(de|du|-)/.test(reste.split(' ')[1] || '') ? 3 : 1).join(' ').replace(/,$/, '');
    const nomCourt = pretre ? (titre === 'Dom' ? 'Dom ' : 'P. ') + prenom : frere ? 'F. ' + prenom : prenom;
    if (parNom(nomCourt)) { res.nonTrouves.push(nom + ' (une fiche « ' + nomCourt + ' » existe déjà, non modifiée)'); continue; }
    const hors = !!(divers && HORS_SEPT_FONS.test(divers));
    const m = { id:'m'+(state.seq.moine++), nom: nomCourt, statut: pretre ? 'pretre' : frere ? 'frere' : 'postulant', francophone:true,
      regime: hors ? 'externe' : 'permanent', actif: hors, periodes:[], equipe:null, capacites:{}, notes: hors ? '' : 'Jamais vu dans le tableau des officiers (fiche inactive).',
      naissance:null, fete:null, entree:null, profession:null, ordination:null, patron:null };
    state.moines.push(m);
    appliquer(m, ligne, true);
    res.crees.push(nomCourt + (hors ? ' (de passage)' : ' (inactif)'));
  }
  return res;
}

/* ================= Archive 2019-2026 (fichier « tableau des officiers v2 », feuille archive) =================
   Chargée une fois (migration v6) depuis archive.js : historique de toutes les semaines, fiches créées
   pour les noms inconnus (inactives si plus vus depuis un an), et caractéristiques déduites des
   services réellement rendus. Rien n'écrase une affectation déjà présente. */
function importerArchive(){
  const cutoff = addDays(todayISO(), -365);
  const byNorm = {};
  state.moines.forEach(m => byNorm[normNom(m.nom)] = m);
  const dernierVu = {};
  for (const [sunday, cells] of ARCHIVE) for (const v of cells) if (v) { const n = normNom(v); if (!dernierVu[n] || sunday > dernierVu[n]) dernierVu[n] = sunday; }
  const nouveaux = [];
  const trouver = nom => {
    const n = normNom(nom);
    if (byNorm[n]) return byNorm[n];
    const statut = /^(p|dom|mgr|r p|pere|abbe)( |$)/.test(n) ? 'pretre' : /^(f|fr|frere)( |$)/.test(n) ? 'frere' : 'postulant';
    const m = { id:'m'+(state.seq.moine++), nom, statut, francophone:true, regime:'permanent', actif: dernierVu[n] >= cutoff,
      periodes:[], equipe:null, capacites:{}, naissance:null, fete:null, entree:null,
      notes:'Fiche créée depuis l\'archive du tableau des officiers (dernière apparition : ' + dernierVu[n] + ')' };
    state.moines.push(m); byNorm[n] = m; nouveaux.push(m);
    return m;
  };
  const existe = new Set(state.affectations.map(a => a.serviceId + '|' + a.semaine + '|' + (a.date || '')));
  const compte = {};
  let nb = 0;
  for (const [sunday, cells] of ARCHIVE){
    cells.forEach((v, i) => {
      if (!v) return;
      const col = ARCHIVE_COLS[i];
      let sid = col, date = null;
      if (col.startsWith('pu')) { sid = 'priere_univ'; date = addDays(sunday, Number(col[2])); }
      else if (col.startsWith('th')) { sid = 'thuriferaire'; date = addDays(sunday, Number(col[2])); }
      else if (col === 'epitre') { date = addDays(sunday, 1); }   // épître de la semaine : ligne du lundi
      if (!serviceById(sid)) return;
      const hote = normNom(v) === 'hote';
      const m = hote ? null : trouver(v);
      if (m) { compte[m.id] = compte[m.id] || {}; compte[m.id][sid] = (compte[m.id][sid] || 0) + 1; }
      const k = sid + '|' + sunday + '|' + (date || '');
      if (existe.has(k)) return;
      existe.add(k);
      state.affectations.push({ id:'a'+(state.seq.affect++), serviceId: sid, semaine: sunday, date,
        moineId: m ? m.id : null, nomLibre: m ? null : v, verrouille:false, archive:true });
      nb++;
    });
  }
  // Caractéristiques déduites : un moine vu au moins 10 fois → capacité cochée pour les services
  // qu'il a réellement rendus, décochée pour ceux du tableau qu'il n'a jamais rendus ; lecteur de table → francophone
  const cols = ['hebdomadier','lecteur','serviteur_eglise','lecteur_table','chantre_pu','priere_univ','epitre','thuriferaire','st1','st2','st3','st4','st_soupe','st_soupe2','st_viande'];
  let nbFiches = 0;
  if (!nb) return;   // rien de nouveau (archive déjà intégrée) : on ne touche pas aux fiches
  for (const m of state.moines){
    const c = compte[m.id]; if (!c) continue;
    if (Object.values(c).reduce((a,b) => a+b, 0) < 10) continue;
    const fait = sid => groupeIds(sid).some(id => c[id]);
    for (const sid of cols){
      const s = serviceById(sid); if (!s) continue;
      const anc = m.capacites[sid] || {};
      m.capacites[sid] = { ok: statutAllowed(m, s) && fait(sid), max: anc.max || null, par: anc.par || 'semaine' };
    }
    if (c.lecteur_table) m.francophone = true;
    nbFiches++;
  }
  const anciens = nouveaux.filter(m => m.actif === false).length;
  bannerMsg = (bannerMsg ? bannerMsg + '<br>' : '') + `Archive 2019-2026 chargée : ${nb} affectations, ${nouveaux.length} fiches créées`
    + (anciens ? ` (dont ${anciens} anciens membres, inactifs)` : '') + `, ${nbFiches} fiches complétées d'après les services rendus (statut, capacités, francophone). À relire dans l'onglet Moines.`;
}

/* ================= Démarrage ================= */
window.addEventListener('DOMContentLoaded', () => {
  load();
  $('#modalOverlay').addEventListener('click', e => { if (e.target.id === 'modalOverlay') closeModal(); });
  render();
  // Sauvegarde automatique : confirmation d'accès au dossier au premier clic de la session
  document.addEventListener('click', amorcerSauvAuto, { once: true, capture: true });
  // Proposer l'activation une fois par session tant qu'elle n'est pas en place (sauf refus définitif)
  if (sauvDispo() && !(state.settings.sauvAuto && (state.settings.sauvAuto.actif || state.settings.sauvAuto.refus)))
    proposerSauvAuto();
});
function proposerSauvAuto(){
  openModal(`<h3>💾 Sauvegarde automatique</h3>
  <p>L'application peut enregistrer toute seule une copie de toutes les données (fiches, feuilles, historique)
  dans un dossier de cet ordinateur, après chaque modification. Les 10 derniers jours sont conservés.</p>
  <p class="hint">Conseil : choisir un dossier situé dans OneDrive, Google Drive ou Dropbox — la copie part alors
  aussi sur le cloud et survit à une panne de l'ordinateur.</p>
  <div class="modalActions">
    <button class="btn" onclick="closeModal();choisirDossierSauv()">Choisir le dossier…</button>
    <button class="btn secondary" onclick="closeModal()">Plus tard</button>
    <button class="btn ghost" onclick="state.settings.sauvAuto={actif:false,dossier:null,refus:true};save();closeModal()">Ne plus proposer</button>
  </div>`);
}
