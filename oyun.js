// =============================================================
// Patlat Kaptan - oyuncunun tarafı: ekranlar, bekleme odası, girdi,
// osuruk (basılı tut), tekne üstünde yürüme, yüzme, kamera, HUD.
// Tekne fiziği evde (motor.js); kendi yerini oyuncu hesaplar ve eve yollar.
// =============================================================

const Oyun = (() => {
  const $ = id => document.getElementById(id);
  const P = Pist, BR = Motor.BR, R_TUT = Motor.R_TUT, ARA = 0.8 / Motor.R_TUT;   // ARA: tutunanlar arası en az açı
  const kanvas = $('sahne');
  Sahne.kur(kanvas);
  const dokun = matchMedia('(pointer: coarse)').matches;
  if (dokun) document.body.classList.add('dokun');

  const YURU = 3.2, YUZ = 2.6, GAZ_BIT = 0.28, GAZ_DOL = 0.22;
  let mod = null, benimId = null;
  let lobi = { tekne: {}, ayar: { kisi: 4 } };
  let oyun = null, ben = null;
  const tuslar = new Set();
  let fareBasili = false, btnBasili = false;
  let kamYaw = 0, kamPitch = 0.32;
  const kacis = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const renkAd = t => Sahne.TEKNE_AD[oyun?.renkler?.[t] ?? t];
  const renkEmoji = t => Sahne.TEKNE_EMOJI[oyun?.renkler?.[t] ?? t];
  const renkHex = t => '#' + Sahne.TEKNE_RENK[oyun?.renkler?.[t] ?? t].toString(16).padStart(6, '0');

  // ---------- Giriş ----------
  try { $('adim').value = localStorage.getItem('pk.ad') || localStorage.getItem('ck.ad') || ''; } catch (e) { }
  function adAl() {
    const ad = $('adim').value.trim().slice(0, 14);
    if (!ad) { $('girisDurum').textContent = 'Önce adını yaz.'; $('adim').focus(); return null; }
    try { localStorage.setItem('pk.ad', ad); } catch (e) { }
    Ses.baslat();
    return ad;
  }
  $('odaKurBtn').onclick = () => { const ad = adAl(); if (!ad) return; mod = 'ev'; $('girisDurum').textContent = 'Oda açılıyor…'; Ag.odaAc(ad); };
  $('katilBtn').onclick = () => {
    const ad = adAl(); if (!ad) return;
    const kod = $('odaKoduGir').value.trim().toUpperCase();
    if (kod.length < 5) { $('girisDurum').textContent = 'Oda kodunu yaz (5 harf).'; return; }
    mod = 'misafir'; $('girisDurum').textContent = 'Bağlanılıyor…'; Ag.katil(kod, ad);
  };
  $('odaKoduGir').addEventListener('keydown', e => { if (e.key === 'Enter') $('katilBtn').click(); });
  $('tekBtn').onclick = () => {
    const ad = adAl(); if (!ad) return;
    mod = 'tek'; benimId = 'ben';
    lobi = { tekne: { ben: 0 }, ayar: { kisi: 1 } };
    ekranGoster('lobi'); lobiCiz();
  };
  function ekranGoster(ad) {
    ['giris', 'lobi', 'sonuc'].forEach(e => $(e).classList.toggle('gizli', e !== ad));
    $('hud').classList.toggle('gizli', ad !== 'hud');
  }

  // ---------- Ağ olayları ----------
  Ag.kabulKurali(n => (oyun && !oyun.bitti ? 'Yarış başladı; bitince tekrar dene.' : n >= 8 ? 'Oda dolu (en fazla 8 kişi).' : true));
  Ag.duyulacaklariBelirle(() => {
    if (!oyun || !oyun.benim) return new Set(Ag.oyuncular.map(o => o.id));
    return new Set(oyun.oyuncular.filter(p => p.tekne === oyun.benim.tekne).map(p => p.id));
  });
  Ag.on('oda', ({ kod }) => { benimId = Ag.benimId; $('lobiKod').textContent = kod; ekranGoster('lobi'); if (mod === 'ev') lobiDuzenle(); lobiCiz(); });
  Ag.on('hata', m => { $('girisDurum').textContent = m; $('lobiDurum').textContent = m; });
  Ag.on('oyuncular', () => { if (mod === 'ev') lobiDuzenle(); else lobiCiz(); });
  Ag.on('mesaj', m => mesaj(m));
  Ag.on('evMesaj', (m, id) => {
    if (m.tip === 'tekneSec') { if ((!oyun || oyun.bitti) && m.t >= 0 && m.t < 4 && say(m.t) < lobi.ayar.kisi) { lobi.tekne[id] = m.t; lobiYay(); } return; }
    if (oyun && !oyun.bitti) Motor.girdi(id, m);
  });
  Ag.on('koptu', o => { if (mod === 'ev' && oyun && !oyun.bitti) Motor.cikis(o.id); });
  Ag.on('evKoptu', () => { menuyeDon('Oda sahibiyle bağlantı koptu.'); });

  // ---------- Bekleme odası ----------
  const oyuncuListesi = () => (mod === 'tek' ? [{ id: 'ben', ad: $('adim').value.trim() || 'Ben' }] : Ag.oyuncular);
  const yonetici = () => mod === 'tek' || mod === 'ev';
  const say = t => Object.values(lobi.tekne).filter(x => x === t).length;
  function lobiDuzenle() {
    const L = Ag.oyuncular, ids = new Set(L.map(o => o.id)), k = lobi.ayar.kisi;
    Object.keys(lobi.tekne).forEach(id => { if (!ids.has(id)) delete lobi.tekne[id]; });
    const aktif = Math.min(4, Math.max(2, Math.ceil(L.length / k)));
    // Kapasiteyi aşanlar ya da kullanılmayan teknedekiler yeniden yerleşir
    [0, 1, 2, 3].forEach(t => { const ic = L.filter(o => lobi.tekne[o.id] === t); ic.slice(k).forEach(o => delete lobi.tekne[o.id]); });
    L.forEach(o => {
      if (lobi.tekne[o.id] !== undefined) return;
      let en = -1;
      for (let t = 0; t < 4; t++) { if (say(t) >= k) continue; if (t >= aktif && en >= 0) break; if (en < 0 || say(t) < say(en)) en = t; }
      lobi.tekne[o.id] = Math.max(0, en);
    });
    lobiYay();
  }
  function lobiYay() {
    if (mod === 'ev') Ag.yayinla({ tip: 'lobi', tekne: lobi.tekne, ayar: lobi.ayar });
    else lobiCiz();
  }
  function lobiCiz() {
    const L = oyuncuListesi(), k = lobi.ayar.kisi;
    const goster = mod === 'tek' ? 1 : 4;
    $('tekneler').innerHTML = [0, 1, 2, 3].slice(0, goster).map(t => {
      const ic = L.filter(p => (lobi.tekne[p.id] ?? 0) === t);
      const r = '#' + Sahne.TEKNE_RENK[t].toString(16).padStart(6, '0');
      const bos = Array.from({ length: Math.max(0, k - ic.length) }, () => '<li class="bos">boş yer</li>').join('');
      const benBurada = (lobi.tekne[benimId] ?? -1) === t;
      const btn = mod === 'tek' || benBurada || ic.length >= k ? '' : `<button data-t="${t}">Bu tekneye geç</button>`;
      return `<div class="tekne" style="--r:${r}"><h3>${Sahne.TEKNE_EMOJI[t]} ${Sahne.TEKNE_AD[t]} tekne</h3><ul>${ic.map(p => `<li>${p.id === benimId ? '⭐ ' : ''}${kacis(p.ad)}${p.ses ? ' 🎤' : ''}</li>`).join('')}${bos}</ul>${btn}</div>`;
    }).join('');
    $('tekneler').querySelectorAll('button[data-t]').forEach(b => { b.onclick = () => tekneSec(+b.dataset.t); });
    $('ayKisi').value = String(k);
    $('ayKisi').disabled = !yonetici() || mod === 'tek';
    const dolu = new Set(L.map(p => lobi.tekne[p.id] ?? 0)).size;
    $('ayarOzet').textContent = mod === 'tek' ? 'Tek başına deneme: zirveye tırmanmayı dene.' : `${L.length} kişi · ${dolu} tekne yarışacak`;
    $('baslaBtn').classList.toggle('gizli', !yonetici());
    $('lobiMikBtn').classList.toggle('gizli', mod === 'tek');
    document.querySelector('.kodKutu').classList.toggle('gizli', mod === 'tek');
    $('lobiDurum').textContent = yonetici() ? (mod === 'tek' ? '' : 'Arkadaşların oda koduyla katılabilir. En az iki tekne dolu olmalı.') : 'Oda sahibi yarışı başlatacak…';
  }
  function tekneSec(t) {
    if (mod === 'ev') { if (say(t) < lobi.ayar.kisi) { lobi.tekne[benimId] = t; lobiYay(); } }
    else if (mod === 'misafir') Ag.eveGonder({ tip: 'tekneSec', t });
  }
  $('ayKisi').addEventListener('change', () => { if (mod !== 'ev') return; lobi.ayar.kisi = +$('ayKisi').value; lobi.tekne = {}; lobiDuzenle(); });
  $('kodKopyalaBtn').onclick = () => { navigator.clipboard?.writeText(Ag.kod).then(() => { $('lobiDurum').textContent = 'Kod kopyalandı.'; }).catch(() => {}); };
  $('lobiCikBtn').onclick = () => menuyeDon('');
  $('lobiMikBtn').onclick = mikDegistir;
  $('baslaBtn').onclick = baslat;
  function baslat() {
    if (!yonetici()) return;
    const L = oyuncuListesi();
    const kullanilan = [...new Set(L.map(p => lobi.tekne[p.id] ?? 0))].sort();
    if (mod !== 'tek' && kullanilan.length < 2) { $('lobiDurum').textContent = 'En az iki teknede oyuncu olmalı. Biri başka tekneye geçsin ya da “Teknede kaç kişi”yi azalt.'; return; }
    const liste = L.map(p => ({ id: p.id, ad: p.ad, tekne: kullanilan.indexOf(lobi.tekne[p.id] ?? 0) }));
    const geri = mod === 'tek'
      ? { herkese: m => mesaj(m), kisiye: (id, m) => mesaj(m) }
      : { herkese: m => Ag.yayinla(m), kisiye: (id, m) => (id === Ag.benimId ? mesaj(m) : Ag.gonderId(id, m)) };
    Motor.baslat(liste, { ...lobi.ayar, renkler: kullanilan }, geri);
  }
  function menuyeDon(neden) {
    Motor.durdur();
    if (mod !== 'tek') Ag.kapat();
    oyunTemizle();
    mod = null;
    ekranGoster('giris');
    $('girisDurum').textContent = neden || '';
    if (document.pointerLockElement) document.exitPointerLock();
  }
  $('lobiyeBtn').onclick = () => {
    if (mod === 'ev') Ag.yayinla({ tip: 'lobiyeDon' });
    else if (mod === 'tek') { oyunTemizle(); ekranGoster('lobi'); lobiCiz(); }
    else { oyunTemizle(); ekranGoster('lobi'); lobiCiz(); }
  };
  $('tekrarBtn').onclick = () => { if (yonetici()) baslat(); };
  $('cikBtn').onclick = () => { if (confirm('Yarıştan çıkılsın mı?')) menuyeDon(''); };
  $('sesBtn').onclick = () => { const a = Ses.degistir(); $('sesBtn').textContent = a ? '🔊' : '🔇'; };
  $('sesBtn').textContent = Ses.acik ? '🔊' : '🔇';
  $('mikBtn').onclick = mikDegistir;
  async function mikDegistir() {
    if (mod === 'tek') return;
    if (Ag.sesAcik) Ag.sesKapat(); else if (!(await Ag.sesAc())) { akis('🎤 Mikrofona izin verilmedi.', 'kotu'); $('lobiDurum').textContent = 'Mikrofona izin verilmedi.'; }
    mikCiz();
  }
  function mikCiz() {
    const a = Ag.sesAcik;
    $('lobiMikBtn').textContent = a ? '🎤 Mikrofon açık' : '🎤 Mikrofon kapalı';
    $('mikBtn').classList.toggle('acik', a); $('mikBtn').classList.toggle('kapali', !a);
    $('mikBtn').classList.toggle('gizli', mod === 'tek');
  }

  // ---------- Oyun kurulumu ----------
  function oyunKur(m) {
    oyunTemizle();
    const benim = m.oyuncular.find(p => p.id === benimId);
    oyun = { oyuncular: m.oyuncular, renkler: m.ayar.renkler || [0, 1, 2, 3], tekneSay: m.tekneSay, benim, tampon: [], tekneObj: [], hayvanlar: new Map(), faz: 'geri', bitti: false, sonSayi: -1, gecilen: -1 };
    for (let t = 0; t < m.tekneSay; t++) oyun.tekneObj.push(Sahne.tekneYap(oyun.renkler[t]));
    m.oyuncular.forEach(p => {
      const h = Hayvan.yap(Hayvan.TURLER[p.no % 4], Sahne.TEKNE_RENK[oyun.renkler[p.tekne]]);
      if (p.id !== benimId) h.add(isimEtiketi(p.ad, renkHex(p.tekne)));
      Sahne.scene.add(h);
      oyun.hayvanlar.set(p.no, { h, x: 0, y: 0, z: 0, onceX: 0, onceZ: 0, hiz: 0, sesAcik: false });
    });
    const b = P.baslangic(benim ? benim.tekne : 0);
    ben = { d: 'gemi', lx: benim?.lx || 0, lz: benim?.lz || 0, yaw: b.yaw, gaz: 1, bos: false, osuruyor: false, basiliOnce: false, x: b.x, z: b.z, y: b.y, vx: 0, vz: 0, vy: 0, kayX: 0, kayZ: 0, suT: 0, golT: 0, ipucu: -1, inisSinir: 0, sonYolla: 0, sonTik: 0, sonYuz: 0 };
    kamYaw = b.yaw; kamPitch = 0.32;
    P.KONTROL.forEach((_, c) => Sahne.kontrolBoya(c, false));
    ilerlemeKur();
    $('tekneRozet').textContent = benim ? `${renkEmoji(benim.tekne)} ${renkAd(benim.tekne)} tekne` : '';
    $('tekneRozet').style.color = benim ? renkHex(benim.tekne) : '';
    $('ekipYazi').textContent = benim ? m.oyuncular.filter(p => p.tekne === benim.tekne).map(p => `${Hayvan.AD[Hayvan.TURLER[p.no % 4]]}: ${p.ad}`).join(' · ') : '';
    $('akis').innerHTML = '';
    ekranGoster('hud'); mikCiz(); Ag.sesGuncelle();
    $('ipucu').classList.toggle('serbest', !document.pointerLockElement);
  }
  function oyunTemizle() {
    if (oyun) {
      oyun.tekneObj.forEach(g => Sahne.scene.remove(g));
      oyun.hayvanlar.forEach(v => Sahne.scene.remove(v.h));
      Ses.osurukHepsiBitir();
    }
    oyun = null; ben = null;
  }
  function isimEtiketi(ad, renk) {
    const c = document.createElement('canvas'); c.width = 256; c.height = 64;
    const x = c.getContext('2d');
    x.font = '900 34px Nunito, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.lineWidth = 7; x.strokeStyle = '#000a'; x.strokeText(ad, 128, 32); x.fillStyle = renk; x.fillText(ad, 128, 32);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true }));
    s.scale.set(1.8, 0.45, 1); s.position.y = 1.75; s.renderOrder = 5;
    return s;
  }
  function ilerlemeKur() {
    const k = $('ilerleme');
    k.innerHTML = P.KONTROL.map(i => `<div class="kontrolCizgi" style="left:${(P.P[i].s / P.L * 100).toFixed(1)}%"></div>`).join('')
      + Array.from({ length: oyun.tekneSay }, (_, t) => `<div class="tekneNokta${oyun.benim && oyun.benim.tekne === t ? ' ben' : ''}" id="nokta${t}" style="background:${renkHex(t)}"></div>`).join('');
  }

  // ---------- Mesajlar ----------
  function mesaj(m) {
    switch (m.tip) {
      case 'lobi': lobi = { tekne: m.tekne, ayar: m.ayar }; if (!oyun || oyun.bitti) lobiCiz(); break;
      case 'lobiyeDon': oyunTemizle(); ekranGoster('lobi'); lobiCiz(); break;
      case 'basla': oyunKur(m); break;
      case 'd': if (oyun) { oyun.tampon.push({ t: performance.now(), f: m.f, ft: m.ft, zt: m.zt, tk: m.tk, o: m.o }); if (oyun.tampon.length > 40) oyun.tampon.shift(); oyun.faz = m.f; geriSayim(m); } break;
      case 'faz': if (oyun && m.faz === 'yaris') { buyukYazi('PATLAT! 💨', 'Basılı tut, osur, zirveye tırman!', 1600); Ses.basla(); } break;
      case 'itildi': if (oyun && ben) itildi(m); break;
      case 'kutuk': if (oyun) { Sahne.sicrama(m.x, m.y, m.z, 1.2); Ses.carpma(yakinlik(m.x, m.y, m.z)); if (benimTekne(m.tekne)) buyukYazi('KÜTÜK! 🪵', 'Zamanlamayı tuttur: kütük yukarıdayken geç', 1500); else akis(`🪵 ${renkEmoji(m.tekne)} ${renkAd(m.tekne)} tekneye kütük çarptı!`, 'iyi'); } break;
      case 'dustu': if (oyun) { if (benimTekne(m.tekne)) { buyukYazi('AAAAA! 😱', m.ic ? 'İçeri, göle düşüyorsunuz!' : 'Aşağıdaki nehre düşüyorsunuz', 1500); Ses.dusus(); } else akis(`${renkEmoji(m.tekne)} ${renkAd(m.tekne)} tekne kenardan düştü!`, 'iyi'); } break;
      case 'indi': if (oyun) { Sahne.sicrama(m.x, m.y, m.z, 2); Ses.sicrama(yakinlik(m.x, m.y, m.z)); } break;
      case 'gol': if (oyun) { Sahne.sicrama(m.x, P.GOL_Y, m.z, 2); if (benimTekne(m.tekne)) { buyukYazi('GÖLE DÜŞTÜNÜZ! 💦', 'Son kontrol noktasına dönülüyor', 2000); Ses.sicrama(1); } else akis(`${renkEmoji(m.tekne)} ${renkAd(m.tekne)} tekne göle düştü!`, 'iyi'); } break;
      case 'yeniden': if (oyun && benimTekne(m.tekne) && ben && ben.d !== 'gemi') teknedeBin(true); break;
      case 'devrildi': if (oyun) devrildi(m); break;
      case 'dogruldu': if (oyun && benimTekne(m.tekne) && ben && ben.d !== 'gemi') akis('🛶 Tekne doğruldu, yüzüp yanına git!', 'iyi'); break;
      case 'carpti': if (oyun) { Sahne.sicrama(m.x, (anlikTekne(m.tekne)?.y ?? ben?.y ?? 0), m.z, 0.6); Ses.carpma(Math.min(1, m.sert / 5) * yakinlik(m.x, ben?.y ?? 0, m.z)); } break;
      case 'kontrol': if (oyun) kontrolGecti(m); break;
      case 'cikti': if (oyun) { akis(`🚪 ${kacis(m.ad)} yarıştan çıktı`); const v = oyun.hayvanlar.get(m.no); if (v) { Sahne.scene.remove(v.h); oyun.hayvanlar.delete(m.no); } } break;
      case 'bitti': if (oyun) bitti(m); break;
    }
  }
  const benimTekne = t => oyun?.benim && oyun.benim.tekne === t;
  function anlikTekne(t) { const a = oyun?.son; return a && t >= 0 ? a.tk[t] : null; }
  function yakinlik(x, y, z) {
    if (!ben) return 0.5;
    const w = benDunya(); const d = Math.hypot(x - w.x, (y - w.y) * 0.5, z - w.z);
    return Math.max(0, Math.min(1, 1.2 - d / 30));
  }
  function geriSayim(m) {
    if (m.f !== 'geri') return;
    const n = Math.ceil(m.ft);
    if (n !== oyun.sonSayi && n > 0 && n <= 3) { oyun.sonSayi = n; buyukYazi(String(n), n === 3 ? 'Hazır ol, gaz dolu! 💨' : '', 900); Ses.tik(); }
  }
  function kontrolGecti(m) {
    if (benimTekne(m.tekne)) {
      Sahne.kontrolBoya(m.cp, true); Ses.kontrol();
      buyukYazi(`KONTROL ${m.cp + 1} / ${P.KONTROL.length} ✔`, m.cp === P.KONTROL.length - 1 ? 'Son düzlük, zirveye!' : 'Düşersen buradan devam edersin', 1600);
    } else akis(`${renkEmoji(m.tekne)} ${renkAd(m.tekne)} tekne kontrol ${m.cp + 1}'i geçti`);
  }
  function devrildi(m) {
    if (!benimTekne(m.tekne)) { akis(`🙃 ${renkEmoji(m.tekne)} ${renkAd(m.tekne)} tekne devrildi! (${m.neden})`, 'iyi'); return; }
    Ses.devril();
    buyukYazi('DEVRİLDİNİZ! 🙃', 'Herkes bir tarafa toplanmasın', 1800);
    osurmayiBirak();
    if (ben.d === 'gemi') {
      const w = benDunya(), b = anlikTekne(oyun.benim.tekne) || { x: w.x, z: w.z };
      let dx = w.x - b.x, dz = w.z - b.z; const d = Math.hypot(dx, dz) || 1; dx /= d; dz /= d;
      suyaDus(w.x + dx * 0.8, w.z + dz * 0.8, w.y, dx * 3, dz * 3, 3);
    }
  }
  function itildi(m) {
    akis(m.kutuk ? '🪵 Kütük çarptı!' : `💨 ${kacis(m.kim)} arkandan osurdu, uçtun!`, 'kotu');
    if (ben.d === 'gemi') {
      if (Math.hypot(m.vx, m.vz) >= 3) { suyaDus(ben.x, ben.z, ben.y + 0.3, m.vx, m.vz, 2.5); Ses.sicrama(0.6); }
    } else { ben.vx += m.vx; ben.vz += m.vz; }
  }
  function bitti(m) {
    oyun.bitti = true;
    const benim = oyun.benim && m.kazanan === oyun.benim.tekne;
    if (document.pointerLockElement) document.exitPointerLock();
    (benim ? Ses.kazandi : Ses.kaybetti)();
    buyukYazi(benim ? 'ZİRVEDESİNİZ! 🏆' : `${renkAd(m.kazanan).toLocaleUpperCase('tr')} KAZANDI`, '', 2500);
    setTimeout(() => {
      if (!oyun) return;
      $('sonucBaslik').textContent = benim ? 'KAZANDINIZ! 🏆' : `${renkAd(m.kazanan).toLocaleUpperCase('tr')} TEKNE KAZANDI`;
      $('sonucSira').innerHTML = m.sira.map(t => `<li style="color:${renkHex(t)}">${renkEmoji(t)} ${renkAd(t)} tekne <small style="color:#10243a">(${oyun.oyuncular.filter(p => p.tekne === t).map(p => kacis(p.ad)).join(', ')})</small></li>`).join('');
      $('tekrarBtn').classList.toggle('gizli', !yonetici()); $('lobiyeBtn').classList.toggle('gizli', mod === 'misafir');
      $('sonucBekle').classList.toggle('gizli', yonetici());
      ekranGoster('sonuc');
    }, 2600);
  }

  // ---------- Akış ve büyük yazı ----------
  function akis(html, sinif = '') {
    const d = document.createElement('div'); d.className = sinif; d.innerHTML = html;
    $('akis').prepend(d);
    while ($('akis').children.length > 5) $('akis').lastChild.remove();
    setTimeout(() => { d.style.opacity = '0'; setTimeout(() => d.remove(), 600); }, 4500);
  }
  let yaziZaman = null;
  function buyukYazi(ust, alt = '', sure = 1500) {
    $('buyukYazi').innerHTML = `${kacis(ust)}${alt ? `<small>${kacis(alt)}</small>` : ''}`;
    $('buyukYazi').classList.add('goster');
    clearTimeout(yaziZaman); yaziZaman = setTimeout(() => $('buyukYazi').classList.remove('goster'), sure);
  }

  // ---------- Girdi ----------
  addEventListener('keydown', e => {
    if (!oyun || e.target.tagName === 'INPUT') return;
    if (e.code === 'Space') e.preventDefault();
    tuslar.add(e.code);
    if (e.code === 'KeyK' && !e.repeat) mikDegistir();
  });
  addEventListener('keyup', e => tuslar.delete(e.code));
  addEventListener('blur', () => { tuslar.clear(); fareBasili = false; btnBasili = false; });
  kanvas.addEventListener('click', () => { if (oyun && !dokun && !document.pointerLockElement && !oyun.bitti) { try { const s = kanvas.requestPointerLock?.(); s?.catch?.(() => {}); } catch (e) { } } });
  document.addEventListener('pointerlockchange', () => { $('ipucu').classList.toggle('serbest', document.pointerLockElement !== kanvas); if (!document.pointerLockElement) fareBasili = false; });
  document.addEventListener('mousemove', e => {
    if (!oyun || document.pointerLockElement !== kanvas) return;
    kamYaw -= e.movementX * 0.0025; kamPitch = Math.max(-0.15, Math.min(1.15, kamPitch + e.movementY * 0.0022));
  });
  document.addEventListener('mousedown', e => { if (oyun && e.button === 0 && document.pointerLockElement === kanvas) fareBasili = true; });
  document.addEventListener('mouseup', e => { if (e.button === 0) fareBasili = false; });
  // Dokunmatik: sol yarı yürüme, sağ yarı bakış, OSUR düğmesi
  const joy = { id: null, cx: 0, cy: 0, x: 0, y: 0 }, bakis = { id: null, x: 0, y: 0 };
  kanvas.addEventListener('touchstart', e => {
    if (!oyun) return; e.preventDefault();
    for (const t of e.changedTouches) {
      if (t.clientX < innerWidth * 0.45 && joy.id === null) {
        Object.assign(joy, { id: t.identifier, cx: t.clientX, cy: t.clientY, x: 0, y: 0 });
        const j = $('joystick'); j.style.display = 'block'; j.style.left = (t.clientX - 60) + 'px'; j.style.top = (t.clientY - 60) + 'px';
      } else if (bakis.id === null) Object.assign(bakis, { id: t.identifier, x: t.clientX, y: t.clientY });
    }
  }, { passive: false });
  kanvas.addEventListener('touchmove', e => {
    if (!oyun) return; e.preventDefault();
    for (const t of e.changedTouches) {
      if (t.identifier === joy.id) {
        let dx = t.clientX - joy.cx, dy = t.clientY - joy.cy; const d = Math.hypot(dx, dy), m = 50;
        if (d > m) { dx *= m / d; dy *= m / d; }
        joy.x = dx / m; joy.y = dy / m;
        $('joyTopuz').style.transform = `translate(${dx}px, ${dy}px)`;
      } else if (t.identifier === bakis.id) {
        kamYaw -= (t.clientX - bakis.x) * 0.006; kamPitch = Math.max(-0.15, Math.min(1.15, kamPitch + (t.clientY - bakis.y) * 0.005));
        bakis.x = t.clientX; bakis.y = t.clientY;
      }
    }
  }, { passive: false });
  const dokunmaBitti = e => {
    for (const t of e.changedTouches) {
      if (t.identifier === joy.id) { joy.id = null; joy.x = joy.y = 0; $('joystick').style.display = 'none'; $('joyTopuz').style.transform = ''; }
      if (t.identifier === bakis.id) bakis.id = null;
    }
  };
  kanvas.addEventListener('touchend', dokunmaBitti); kanvas.addEventListener('touchcancel', dokunmaBitti);
  const cb = $('osurBtn');
  cb.addEventListener('touchstart', e => { e.preventDefault(); btnBasili = true; cb.classList.add('basili'); }, { passive: false });
  const btnBirak = e => { e.preventDefault(); btnBasili = false; cb.classList.remove('basili'); };
  cb.addEventListener('touchend', btnBirak); cb.addEventListener('touchcancel', btnBirak);
  cb.addEventListener('mousedown', () => { btnBasili = true; cb.classList.add('basili'); });
  cb.addEventListener('mouseup', () => { btnBasili = false; cb.classList.remove('basili'); });

  // ---------- Anlık durum (100 ms geriden, yumuşak) ----------
  const lerp = (a, b, k) => a + (b - a) * k;
  const acisal = (a, b, k) => { let d = b - a; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return a + d * k; };
  function anlik() {
    const T = oyun.tampon; if (!T.length) return null;
    const rt = performance.now() - 110;
    let a = T[0], b = T[T.length - 1];
    for (let i = T.length - 1; i > 0; i--) { if (T[i - 1].t <= rt) { a = T[i - 1]; b = T[i]; break; } }
    const k = b.t > a.t ? Math.max(0, Math.min(1, (rt - a.t) / (b.t - a.t))) : 1;
    const tk = [];
    for (let t = 0; t < oyun.tekneSay; t++) {
      const j = t * 14, A = a.tk, B = b.tk;
      const atla = Math.hypot(B[j] - A[j], B[j + 1] - A[j + 1]) > 8;   // yeniden doğma: atla
      const kk = atla ? 1 : k;
      tk.push({ x: lerp(A[j], B[j], kk), z: lerp(A[j + 1], B[j + 1], kk), y: lerp(A[j + 2], B[j + 2], kk), yaw: acisal(A[j + 3], B[j + 3], kk), egX: lerp(A[j + 4], B[j + 4], kk), egZ: lerp(A[j + 5], B[j + 5], kk), hav: B[j + 6], i: B[j + 7], cp: B[j + 8], devrik: B[j + 9], salla: lerp(A[j + 10], B[j + 10], kk), ex: lerp(A[j + 11], B[j + 11], kk), ez: lerp(A[j + 12], B[j + 12], kk), batma: lerp(A[j + 13], B[j + 13], kk) });
    }
    const op = new Map(), oa = new Map();
    for (let j = 0; j < a.o.length; j += 9) oa.set(a.o[j], j);
    for (let j = 0; j < b.o.length; j += 9) {
      const no = b.o[j], B = b.o, ja = oa.get(no), A = ja !== undefined && a.o[ja + 2] === B[j + 2] ? a.o : null, i0 = A ? ja : j, A2 = A || B;
      op.set(no, { tekne: B[j + 1], d: B[j + 2], a: lerp(A2[i0 + 3], B[j + 3], k), b: lerp(A2[i0 + 4], B[j + 4], k), y: lerp(A2[i0 + 5], B[j + 5], k), yaw: acisal(A2[i0 + 6], B[j + 6], k), fis: B[j + 7], bas: B[j + 8] });
    }
    return { tk, op, f: b.f, zt: lerp(a.zt ?? 0, b.zt ?? 0, k) };
  }
  const yerel2dunya = (b, lx, lz) => { const c = Math.cos(b.yaw), s = Math.sin(b.yaw); return { x: b.x + lx * c + lz * s, z: b.z - lx * s + lz * c }; };
  const dunya2yerel = (b, x, z) => { const wx = x - b.x, wz = z - b.z, c = Math.cos(b.yaw), s = Math.sin(b.yaw); return { lx: wx * c - wz * s, lz: wx * s + wz * c }; };
  const guverte = (b, lx, lz) => b.y + 0.25 - (lx * b.egX + lz * b.egZ) * 0.07;
  // Kenara tutunan: suyun içinde, başı dışarıda. Tekne yan yatınca tutunduğu kenarla birlikte iner/kalkar
  const tutunmaY = (b, lx = 0, lz = 0) => b.y + b.batma - 0.32 - Math.max(-1.6, Math.min(1.6, (lx * Math.sin(b.ex) + lz * Math.sin(b.ez))));
  function benDunya() {
    if (!ben) return { x: 0, y: 0, z: 0 };
    if (ben.d !== 'gemi') return { x: ben.x, y: ben.y, z: ben.z };
    const b = anlikTekne(oyun.benim.tekne); if (!b) return { x: ben.x, y: ben.y, z: ben.z };
    return { x: b.x + ben.lx, y: tutunmaY(b, ben.lx, ben.lz), z: b.z + ben.lz };
  }

  // ---------- Suya düşme, yüzme, binme ----------
  function suyaDus(x, z, y, vx, vz, vy, sinir = null) {
    osurmayiBirak();
    Object.assign(ben, { d: 'ucus', x, z, y: y + 0.3, vx, vz, vy, suT: 0, golT: 0 });
    ben.inisSinir = sinir ?? y + 0.6;
  }
  function teknedeBin(kurtarma) {
    const b = anlikTekne(oyun.benim.tekne);
    ben.d = 'gemi'; ben.kayX = ben.kayZ = 0; ben.suT = 0; ben.golT = 0;
    let ang = Math.PI;
    if (b && !kurtarma) ang = Math.atan2(ben.x - b.x, ben.z - b.z);
    else if (b) ang = b.yaw + Math.PI;
    ang = bosYer(ang);
    ben.lx = Math.sin(ang) * R_TUT; ben.lz = Math.cos(ang) * R_TUT;
    if (kurtarma) akis('🪝 Takımın seni tekneye çekti', 'iyi');
    Ses.sicrama(0.3); konumYolla(true);
  }
  // Kenarda en yakın boş yer (takım arkadaşlarının içine girmesin)
  const aciFark = (a, b) => { let d = a - b; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; };
  function arkadasAcilari() {
    const L = [], a = oyun?.son; if (!a || !oyun.benim) return L;
    a.op.forEach((o, no) => { if (no !== oyun.benim.no && o.tekne === oyun.benim.tekne && o.d === 0) L.push(Math.atan2(o.a, o.b)); });
    return L;
  }
  function bosYer(ang) {
    const L = arkadasAcilari();
    for (let k = 0; k < 24; k++) {
      const aday = ang + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * ARA * 0.5;
      if (L.every(x => Math.abs(aciFark(x, aday)) >= ARA)) return aday;
    }
    return ang;
  }
  function suAdim(dt, mx, mz) {
    const b = anlikTekne(oyun.benim.tekne);
    if (ben.d === 'ucus') {
      const y0 = ben.y;
      ben.vy -= 13 * dt; ben.x += ben.vx * dt; ben.z += ben.vz * dt; ben.y += ben.vy * dt;
      // Kendi teknesinin üstüne düştüyse binsin
      if (b && ben.vy < 0 && b.devrik === 0 && Math.hypot(ben.x - b.x, ben.z - b.z) < R_TUT + 0.3 && ben.y <= b.y + 0.3 && ben.y > b.y - 0.5) return teknedeBin(false);
      const j = P.inis(ben.x, ben.z, y0, ben.y);
      if (j >= 0 && P.P[j].y <= ben.inisSinir) { ben.d = 'su'; ben.y = P.P[j].y; ben.ipucu = j; ben.vy = 0; Sahne.sicrama(ben.x, ben.y, ben.z, 1); Ses.sicrama(0.8); return; }
      if (ben.y < P.GOL_Y) { ben.d = 'su'; ben.y = P.GOL_Y; ben.golT = 0.01; ben.ipucu = -1; Sahne.sicrama(ben.x, ben.y, ben.z, 1.2); Ses.sicrama(1); }
      return;
    }
    // Yüzme
    ben.suT += dt;
    if (ben.golT > 0) {                          // gölde: biraz çırpın, sonra takım çeker
      ben.golT += dt; ben.x += mx * YUZ * dt; ben.z += mz * YUZ * dt;
      if (ben.golT > 2.5) teknedeBin(true);
      return;
    }
    const s = P.bul(ben.x, ben.z, ben.y, ben.ipucu);
    if (!s) { ben.golT = 0.01; return; }
    ben.ipucu = s.i; const q = P.P[s.i];
    const ak = 0.5 + P.akinti(s.i) * 0.5;
    ben.vx *= Math.exp(-2.5 * dt); ben.vz *= Math.exp(-2.5 * dt);
    ben.x += (mx * YUZ - q.tx * ak + ben.vx) * dt; ben.z += (mz * YUZ - q.tz * ak + ben.vz) * dt;
    ben.y = s.y - 0.05;
    const s2 = P.bul(ben.x, ben.z, ben.y, ben.ipucu) || s, q2 = P.P[s2.i];
    if (s2.i === 0 && s2.a < 0) { ben.x -= q2.tx * s2.a; ben.z -= q2.tz * s2.a; }
    if (s2.i === P.N - 1 && s2.a > 0) { ben.x -= q2.tx * s2.a; ben.z -= q2.tz * s2.a; }
    if (Math.abs(s2.d) > P.YARI + 0.1) { const yon = Math.sign(s2.d); suyaDus(ben.x, ben.z, ben.y, q2.nx * 2 * yon + ben.vx, q2.nz * 2 * yon + ben.vz, 0.5, ben.y - 2); Ses.dusus(); return; }
    if (performance.now() - ben.sonYuz > 600 && (mx || mz)) { ben.sonYuz = performance.now(); Ses.yuz(); }
    // Teknesine yaklaştıysa biner
    if (b && ben.suT > 1.2 && b.devrik === 0 && b.hav === 0 && Math.hypot(ben.x - b.x, ben.z - b.z) < R_TUT + 0.5 && Math.abs(ben.y - b.y) < 1.2) return teknedeBin(false);
    // Çok uzakta ya da uzun süredir sudaysa takım çeker
    if (b && b.hav === 0 && (ben.suT > 15 || Math.hypot(ben.x - b.x, ben.z - b.z) > 28 || Math.abs(ben.y - b.y) > 4)) teknedeBin(true);
  }

  // ---------- Osuruk: basılı tuttukça osurur, bırakınca biter. Gaz azalır, bırakınca dolar ----------
  function osurmayiBirak() {
    if (!ben || !ben.osuruyor) return;
    ben.osuruyor = false;
    Ag.eveGonderVeya({ tip: 'fis', on: false });
    Ses.osurukBitir('ben');
  }
  function osurAdim(dt) {
    const basili = tuslar.has('Space') || fareBasili || btnBasili;
    const b = anlikTekne(oyun.benim.tekne);
    const olur = ben.d === 'gemi' && !oyun.bitti && oyun.faz === 'yaris' && !(b && b.devrik);
    if (basili && olur && !ben.bos && ben.gaz > 0) {
      if (!ben.osuruyor) { ben.osuruyor = true; Ag.eveGonderVeya({ tip: 'fis', on: true }); Ses.osurukBasla('ben', 1); }
      ben.gaz -= dt * GAZ_BIT;
      if (ben.gaz <= 0) { ben.gaz = 0; ben.bos = true; osurmayiBirak(); Ses.pirt(); }
    } else {
      osurmayiBirak();
      ben.gaz = Math.min(1, ben.gaz + dt * GAZ_DOL);
      if (ben.bos && ben.gaz >= 0.25) ben.bos = false;
      if (basili && olur && ben.bos && !ben.basiliOnce) Ses.pirt();
    }
    ben.basiliOnce = basili;
  }

  // ---------- Her kare ----------
  let sonZaman = performance.now(), sonKonumYolla = 0;
  function konumYolla(hemen) {
    const simdi = performance.now();
    if (!hemen && simdi - sonKonumYolla < 66) return;
    sonKonumYolla = simdi;
    const m = ben.d === 'gemi'
      ? { tip: 'k', d: 'gemi', lx: r2(ben.lx), lz: r2(ben.lz), yaw: r2(ben.yaw), bas: r2(ben.gaz), f: ben.osuruyor ? 1 : 0 }
      : { tip: 'k', d: ben.d, x: r2(ben.x), z: r2(ben.z), y: r2(ben.y), yaw: r2(ben.yaw), bas: r2(ben.gaz), f: 0 };
    Ag.eveGonderVeya(m);
  }
  const r2 = v => Math.round(v * 100) / 100;
  Ag.eveGonderVeya = m => { if (mod === 'tek') Motor.girdi(benimId, m); else Ag.eveGonder(m); };

  function oyunKare(dt) {
    const a = anlik(); if (!a) return;
    oyun.son = a;
    const benim = oyun.benim;
    // Girdi yönü (kameraya göre)
    let ix = 0, iz = 0;
    if (tuslar.has('KeyW') || tuslar.has('ArrowUp')) iz += 1;
    if (tuslar.has('KeyS') || tuslar.has('ArrowDown')) iz -= 1;
    if (tuslar.has('KeyA') || tuslar.has('ArrowLeft')) ix -= 1;
    if (tuslar.has('KeyD') || tuslar.has('ArrowRight')) ix += 1;
    if (joy.id !== null) { ix += joy.x; iz -= joy.y; }
    const il = Math.hypot(ix, iz); if (il > 1) { ix /= il; iz /= il; }
    if (oyun.bitti) ix = iz = 0;
    const fx = Math.sin(kamYaw), fz = Math.cos(kamYaw);
    const mx = fx * iz - fz * ix, mz = fz * iz + fx * ix;
    if (ben && benim) {
      if (ben.d === 'gemi') {
        const b = a.tk[benim.tekne];
        const lmx = mx, lmz = mz;                         // tutunma yeri dünya yönünde
        const ang = Math.atan2(ben.lx, ben.lz);
        // Kenar boyunca kay: basılan yönün kenar teğetindeki payı kadar
        const v = (lmx * Math.cos(ang) - lmz * Math.sin(ang)) * YURU;
        let yeni = ang + v * dt / R_TUT;
        arkadasAcilari().forEach(x => { const once = Math.abs(aciFark(x, ang)), sonra = Math.abs(aciFark(x, yeni)); if (sonra < ARA && sonra < once) yeni = ang; });
        ben.lx = Math.sin(yeni) * R_TUT; ben.lz = Math.cos(yeni) * R_TUT;
        ben.x = b.x + ben.lx; ben.z = b.z + ben.lz; ben.y = tutunmaY(b, ben.lx, ben.lz);
        ben.yaw = Math.atan2(b.x - ben.x, b.z - ben.z);   // yüzü teknenin ortasına
      } else { ben.yaw = kamYaw; suAdim(dt, mx, mz); }
      osurAdim(dt);
      konumYolla(false);
    }
    // Tekneler
    oyun.tekneObj.forEach((g, t) => {
      const b = a.tk[t]; const u = g.userData;
      const dalga = b.hav === 1 ? 0 : Math.sin(performance.now() / 700 + t * 2) * 0.04;          // suda hafif inip kalkma
      g.position.set(b.x, b.y + b.batma + dalga, b.z); g.rotation.y = b.yaw;
      // eğim dünya yönünde geliyor (ağırlık + düşüş/çarpma yatması): teknenin kendi eksenine çevir
      const ec = Math.cos(b.yaw), es = Math.sin(b.yaw);
      const wX = b.egX * 0.2 + Math.sin(b.ex), wZ = b.egZ * 0.2 + Math.sin(b.ez);
      const eX = wX * ec - wZ * es, eZ = wX * es + wZ * ec;
      const buyuk = Math.hypot(b.ex, b.ez) > 0.15;
      const hedefZ = b.devrik ? Math.PI : -(buyuk ? Math.asin(Math.max(-1, Math.min(1, eX))) : eX) + b.salla * 0.18;
      const hedefX = buyuk ? Math.asin(Math.max(-1, Math.min(1, eZ))) : eZ;
      const hiz = Math.min(1, dt * (buyuk || b.hav ? 18 : 6));
      u.ic.rotation.z += (hedefZ - u.ic.rotation.z) * hiz; u.ic.rotation.x += (hedefX - u.ic.rotation.x) * hiz;
      u.ic.position.y = b.devrik ? 0.3 : 0;
      u.bayrak.rotation.y = Math.sin(performance.now() / 300 + t) * 0.3;
    });
    // Hayvanlar
    oyun.hayvanlar.forEach((v, no) => {
      const o = a.op.get(no); if (!o) return;
      let x, y, z, yaw, d, fis, bas;
      const benMi = benim && no === benim.no && ben;
      if (benMi) { x = ben.x; y = ben.y; z = ben.z; yaw = ben.yaw; d = ben.d === 'gemi' ? 0 : 1; fis = ben.osuruyor ? 1 : 0; bas = ben.gaz; }
      else {
        d = o.d; yaw = o.yaw; fis = o.fis; bas = o.bas;
        if (d === 0) { const b = a.tk[o.tekne]; x = b.x + o.a; z = b.z + o.b; y = tutunmaY(b, o.a, o.b); yaw = Math.atan2(b.x - x, b.z - z); }
        else { x = o.a; z = o.b; y = o.y; }
      }
      const hiz = Math.hypot(x - v.x, z - v.z) / Math.max(dt, 0.001);
      v.hiz += (Math.min(1, hiz / 3) - v.hiz) * Math.min(1, dt * 8);
      v.x = x; v.y = y; v.z = z;
      v.h.position.set(x, y, z); v.h.rotation.y = yaw;
      const os = fis > 0 && d === 0;
      Hayvan.canlandir(v.h, dt, { yuruyor: d === 0 ? v.hiz : 0.5, yuzuyor: d !== 0, tutunuyor: d === 0, osuruyor: os });
      if (os) { const p = Hayvan.kic(v.h); Sahne.osuruk(p.x, Math.max(p.y, y + 0.36), p.z, -Math.sin(yaw), -Math.cos(yaw)); }
      // Başkalarının osuruk sesi
      if (!benMi && os !== v.sesAcik) { v.sesAcik = os; if (os) Ses.osurukBasla('o' + no, yakinlik(x, y, z)); else Ses.osurukBitir('o' + no); }
    });
    Sahne.salincakGuncelle(a.zt);
    hudCiz(a);
    kamera(dt);
  }

  function kamera(dt) {
    const w = benDunya(), cam = Sahne.camera;
    const hx = w.x, hy = w.y + 1.3, hz = w.z;
    let uz = 7;
    const cp = Math.cos(kamPitch), sp = Math.sin(kamPitch), fx = Math.sin(kamYaw), fz = Math.cos(kamYaw);
    let cx, cy, cz;
    cx = hx - fx * cp * uz; cy = hy + sp * uz; cz = hz - fz * cp * uz;
    cam.position.set(cx, Math.max(cy, P.GOL_Y + 0.5), cz);
    cam.lookAt(hx, hy, hz);
  }

  function hudCiz(a) {
    const benim = oyun.benim;
    // Sıralama: zirveye yakınlığa göre
    const sira = a.tk.map((b, t) => ({ t, i: b.i })).sort((x, y) => y.i - x.i);
    if (benim) {
      const yer = sira.findIndex(s => s.t === benim.tekne) + 1;
      $('siraYazi').textContent = `${yer}. / ${oyun.tekneSay}`;
      $('kontrolYazi').textContent = `Kontrol ${a.tk[benim.tekne].cp + 1} / ${P.KONTROL.length}`;
    }
    a.tk.forEach((b, t) => { const n = $('nokta' + t); if (n) n.style.left = (P.P[Math.min(P.N - 1, b.i)].s / P.L * 100).toFixed(1) + '%'; });
    if (ben) {
      const bk = $('basinc');
      $('basincDolu').style.width = (Math.min(1, ben.gaz) * 100).toFixed(0) + '%';
      bk.classList.toggle('calkaliyor', ben.osuruyor);
      bk.classList.toggle('tehlike', ben.bos);
      bk.style.opacity = ben.d === 'gemi' ? '1' : '0.4';
    }
  }

  function menuKamera(t) {
    const cam = Sahne.camera, a = t / 9000;
    cam.position.set(Math.sin(a) * 105, 40, Math.cos(a) * 105);
    cam.lookAt(0, 10, 0);
  }
  function dongu(t) {
    const dt = Math.min(0.1, (t - sonZaman) / 1000); sonZaman = t;
    let hedef = null;
    if (oyun && oyun.tampon.length) { oyunKare(dt); hedef = benDunya(); }
    else menuKamera(t);
    Sahne.ciz(dt, hedef || { x: 0, y: 10, z: 0 });
    requestAnimationFrame(dongu);
  }
  requestAnimationFrame(dongu);

  // Yerelde test için
  if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') window.ckTest = { get oyun() { return oyun; }, get ben() { return ben; }, Motor, mesaj, set yaw(v) { kamYaw = v; } };
})();
