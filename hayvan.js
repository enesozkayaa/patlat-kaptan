// =============================================================
// Çalkala Kaptan - denizci hayvanlar (penguen, kedi, ördek, kurbağa)
// Hepsinin başında denizci şapkası, boynunda takım renginde fular,
// sırtında dev bir gazoz şişesi var (köpük şişenin ağzından ARKAYA fışkırır).
// =============================================================

const Hayvan = (() => {
  const TURLER = ['penguen', 'kedi', 'ordek', 'kurbaga'];
  const AD = { penguen: 'Penguen', kedi: 'Kedi', ordek: 'Ördek', kurbaga: 'Kurbağa' };
  const mat = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.65, ...o });
  const kure = (r, m, sx = 1, sy = 1, sz = 1) => { const g = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), m); g.scale.set(sx, sy, sz); g.castShadow = true; return g; };
  const RENK = {
    penguen: { govde: 0x22252e, karin: 0xf4f4f0, gaga: 0xff9a2a },
    kedi: { govde: 0xf09a3a, karin: 0xfff0dc, gaga: 0xff8aa0 },
    ordek: { govde: 0xffd83a, karin: 0xfff4b0, gaga: 0xff8a1a },
    kurbaga: { govde: 0x5ac04a, karin: 0xd8f0a0, gaga: 0xd04a5a },
  };
  const beyaz = mat(0xffffff), siyah = mat(0x111111), cam = mat(0x2fae5a, { roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.85 });
  const kapakMat = mat(0xe03a2a, { metalness: 0.4, roughness: 0.4 }), etiket = mat(0xffe14a);

  function goz(x, y, z, r = 0.07) {
    const g = new THREE.Group();
    const ak = kure(r, beyaz); g.add(ak);
    const bebek = kure(r * 0.55, siyah); bebek.position.z = r * 0.6; g.add(bebek);
    g.position.set(x, y, z); return g;
  }

  // Dev gazoz şişesi: sırtta, ağzı aşağı-arkaya bakar
  function sise() {
    const g = new THREE.Group();
    const govde = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.55, 14), cam); govde.castShadow = true; g.add(govde);
    const omuz = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.17, 0.18, 14), cam); omuz.position.y = -0.36; g.add(omuz);
    const boyun = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.14, 12), cam); boyun.position.y = -0.52; g.add(boyun);
    const kapak = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.06, 12), kapakMat); kapak.position.y = -0.6; g.add(kapak);
    const et = new THREE.Mesh(new THREE.CylinderGeometry(0.175, 0.175, 0.2, 14, 1, true), etiket); g.add(et);
    const kayis = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.025, 6, 16), mat(0x6a3a1a)); kayis.rotation.x = Math.PI / 2; kayis.position.y = 0.1; g.add(kayis);
    g.userData.kapak = kapak;
    return g;
  }

  function yap(tur, takimRenk) {
    const R = RENK[tur] || RENK.penguen;
    const kok = new THREE.Group();          // dünyadaki yer
    const beden = new THREE.Group();        // sallanan/eğilen kısım
    kok.add(beden);
    const gm = mat(R.govde), km = mat(R.karin), gaga = mat(R.gaga);

    // Gövde
    const govde = kure(0.36, gm, 1, 1.15, 0.95); govde.position.y = 0.45; beden.add(govde);
    const karin = kure(0.3, km, 0.95, 1.05, 0.6); karin.position.set(0, 0.42, 0.17); beden.add(karin);
    // Baş
    const bas = new THREE.Group(); bas.position.y = 0.95; beden.add(bas);
    const kafa = kure(0.27, gm, 1, 0.95, 0.95); bas.add(kafa);
    // Kollar
    const kollar = [-1, 1].map(s => { const k = kure(0.09, gm, 0.8, 2, 0.8); k.position.set(0.36 * s, 0.5, 0.02); k.rotation.z = -0.4 * s; beden.add(k); return k; });
    // Ayaklar
    const ayakM = tur === 'penguen' || tur === 'ordek' ? gaga : gm;
    const ayaklar = [-1, 1].map(s => { const a = kure(0.1, ayakM, 1.1, 0.45, 1.5); a.position.set(0.15 * s, 0.05, 0.06); beden.add(a); return a; });

    if (tur === 'penguen') {
      bas.add(goz(-0.1, 0.05, 0.21)); bas.add(goz(0.1, 0.05, 0.21));
      const g = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.2, 10), gaga); g.rotation.x = Math.PI / 2; g.position.set(0, -0.04, 0.3); bas.add(g);
      const yuz = kure(0.2, km, 1, 0.8, 0.5); yuz.position.set(0, -0.02, 0.13); bas.add(yuz);
    } else if (tur === 'kedi') {
      bas.add(goz(-0.1, 0.04, 0.22, 0.065)); bas.add(goz(0.1, 0.04, 0.22, 0.065));
      [-1, 1].forEach(s => { const k = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.18, 4), gm); k.position.set(0.15 * s, 0.24, 0); k.rotation.z = -0.3 * s; bas.add(k); });
      const burun = kure(0.035, gaga); burun.position.set(0, -0.04, 0.26); bas.add(burun);
      const agiz = kure(0.11, km, 1.2, 0.7, 0.6); agiz.position.set(0, -0.09, 0.19); bas.add(agiz);
      const kuyruk = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.045, 6, 12, Math.PI * 1.2), gm); kuyruk.position.set(0, 0.35, -0.35); kuyruk.rotation.y = Math.PI / 2; beden.add(kuyruk);
    } else if (tur === 'ordek') {
      bas.add(goz(-0.1, 0.06, 0.2)); bas.add(goz(0.1, 0.06, 0.2));
      const g = kure(0.12, gaga, 1.2, 0.35, 1.3); g.position.set(0, -0.06, 0.27); bas.add(g);
      const kuyruk = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.25, 8), gm); kuyruk.position.set(0, 0.35, -0.38); kuyruk.rotation.x = -1.1; beden.add(kuyruk);
    } else {   // kurbağa
      [-1, 1].forEach(s => { const t = kure(0.11, gm); t.position.set(0.13 * s, 0.2, 0.08); bas.add(t); const go = goz(0.13 * s, 0.24, 0.15, 0.08); bas.add(go); });
      const agiz = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.018, 6, 16, Math.PI), gaga); agiz.rotation.z = Math.PI; agiz.position.set(0, -0.04, 0.24); bas.add(agiz);
      kafa.scale.set(1.15, 0.8, 0.95);
    }
    // Denizci şapkası
    const sapka = new THREE.Group(); sapka.position.y = tur === 'kurbaga' ? 0.28 : 0.22; bas.add(sapka);
    const sp = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.22, 0.13, 16), beyaz); sp.castShadow = true; sapka.add(sp);
    const bant = new THREE.Mesh(new THREE.CylinderGeometry(0.222, 0.222, 0.04, 16), mat(0x1f3a8a)); bant.position.y = -0.04; sapka.add(bant);
    const kenar = new THREE.Mesh(new THREE.TorusGeometry(0.21, 0.035, 6, 18), beyaz); kenar.rotation.x = Math.PI / 2; kenar.position.y = -0.06; sapka.add(kenar);
    sapka.rotation.z = 0.15;
    // Takım renginde fular
    const fular = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.06, 6, 16), mat(takimRenk)); fular.rotation.x = Math.PI / 2; fular.position.y = 0.76; beden.add(fular);
    const ucu = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.18, 4), mat(takimRenk)); ucu.position.set(0, 0.68, 0.22); ucu.rotation.x = Math.PI; beden.add(ucu);
    // Sırttaki şişe: ağzı aşağı ve arkaya
    const s = sise(); s.position.set(0, 0.62, -0.36); s.rotation.x = -0.75; beden.add(s);

    kok.userData = { beden, bas, kollar, ayaklar, sise: s, tur, faz: Math.random() * 10 };
    return kok;
  }

  // Şişenin ağzının dünyadaki yeri ve fışkırma yönü
  const _v = typeof THREE !== 'undefined' ? new THREE.Vector3() : null;
  function agiz(h) {
    const k = h.userData.sise.userData.kapak;
    k.getWorldPosition(_v);
    return _v;
  }

  // Animasyon: yuruyor (0..1), calkala (0..1 basınç), yuzuyor, fiskiriyor
  function canlandir(h, dt, d) {
    const u = h.userData; u.faz += dt * (d.yuzuyor ? 6 : 10) * (0.3 + d.yuruyor);
    const b = u.beden;
    b.position.y = d.yuzuyor ? -0.45 : Math.abs(Math.sin(u.faz)) * 0.08 * d.yuruyor;
    b.rotation.x = d.yuzuyor ? 0.9 : (d.fiskiriyor ? 0.25 : 0);
    b.rotation.z = Math.sin(u.faz) * 0.08 * d.yuruyor;
    u.ayaklar.forEach((a, j) => { a.position.z = 0.06 + Math.sin(u.faz + j * Math.PI) * 0.1 * d.yuruyor; });
    if (d.yuzuyor) u.kollar.forEach((k, j) => { k.rotation.x = Math.sin(u.faz * 1.3 + j * Math.PI) * 1.4; });
    else if (d.calkala > 0) u.kollar.forEach((k, j) => { k.rotation.x = -1.2 + Math.sin(u.faz * 4 + j) * 0.4; });
    else u.kollar.forEach(k => { k.rotation.x *= 0.85; });
    // Çalkalarken şişe titrer, basınç arttıkça şişer
    const s = u.sise, c = d.calkala || 0;
    const tit = c > 0 ? Math.sin(performance.now() / (c > 0.85 ? 18 : 35)) * (0.08 + c * 0.15) : 0;
    s.rotation.z = tit; s.rotation.x = -0.75 + tit * 0.5;
    const sis = 1 + Math.max(0, c - 0.6) * 0.5; s.scale.set(sis, 1 + Math.max(0, c - 0.6) * 0.2, sis);
    s.visible = !d.sisesiz;
  }

  return { TURLER, AD, yap, canlandir, agiz };
})();
