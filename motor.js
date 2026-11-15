// =============================================================
// Patlat Kaptan - oyun motoru. Sadece odayı açan (ev) çalıştırır.
// Teknelerin fiziği, osuruk itişi, kütük salıncakları, devrilme, düşme, kontrol noktaları ve bitiş burada.
// Oyuncular tekne üstündeki yerlerini (ya da yüzerken konumlarını) kendileri yollar.
// =============================================================

const Motor = (() => {
  const P = typeof Pist !== 'undefined' ? Pist : require('./pist.js');
  const DT = 0.05;
  const BR = 1.75;                 // tekne yarıçapı
  const R_TUT = BR + 0.45;         // oyuncular teknenin DIŞINDA, kenara tutunur (bu yarıçapta)
  const BR_DIS = 2.2;              // tutunanlarla birlikte teknenin dış yarıçapı (çarpışmalar)
  const FIS = 8;                   // bir osuruğun itme gücü (basılı tuttukça sürer)
  const SURUK = 0.55, SURUK2 = 0.06, DONUS_SURUK = 2.0;
  const GERI_SAYIM = 3.5;
  const DEVRIL_ORAN = 0.97, DEVRIL_SURE = 1.2, DEVRIK_KAL = 2.6;
  const KENAR0 = P.YARI - 0.9, KENAR_DUS = P.YARI + 0.9;   // bu aralıkta tekne kenarda sallanır, kurtarılabilir
  const KONI_BOY = 4.5, KONI_ACI = Math.cos(36 * Math.PI / 180);
  const YIYECEK = ['fasulye', 'biber', 'lahana', 'gazoz'];
  const ETKI = { biber: 1, lahana: 2, gazoz: 3 }, ETKI_SURE = { biber: 3.5, lahana: 6, gazoz: 4 };
  let o = null, cb = null, zaman = null;
  let rastgele = Math.random;
  const ekAcik = k => !o.ayar.ek || o.ayar.ek[k] !== false;     // bekleme odasında seçilen eklentiler

  function baslat(liste, ayar, geri, secenek = {}) {
    cb = geri;
    rastgele = secenek.rastgele || Math.random;
    const tekneSay = Math.max(...liste.map(p => p.tekne)) + 1;
    o = {
      t: 0, zt: 0, faz: 'geri', fazT: GERI_SAYIM, bitti: null, ayar: { ...ayar },
      tekneler: Array.from({ length: tekneSay }, (_, no) => {
        const b = P.baslangic(no);
        return { no, x: b.x, z: b.z, y: b.y, yaw: b.yaw, vx: 0, vz: 0, vy: 0, w: 0, i: P.endeks(no < 2 ? 17 : 10), cp: -1, kutukT: 0, hav: false, havY: 0, devrik: 0, devrilT: 0, gol: 0, fx: 0, fz: 0, tork: 0, egX: 0, egZ: 0, salla: 0, sallaV: 0, ex: 0, ez: 0, evx: 0, evz: 0, batma: 0, batmaV: 0, havT: 0, dusX: 0, dusZ: 0, havAci0: 0, kenarda: 0, kx: 0, kz: 0, etki: 0, etkiT: 0, komboT: 0, hepT: 0, sisT: 0, yemek: 0, kutukSay: 0, m: 1 };
      }),
      oyuncular: liste.map((p, no) => ({ id: p.id, ad: p.ad, no, tekne: p.tekne, d: 'gemi', lx: 0, lz: 0, x: 0, z: 0, y: 0, yaw: 0, bas: 0, fis: false, itT: 0, cikti: false, osurSure: 0, dusme: 0, ucurma: 0, emojiT: 0 })),
      yiyecekler: [], yemekId: 1, yemekBekle: [], ordekT: P.ORDEKLER.map(() => 0), balikT: 6, bekleyen: [],
      tikaclar: P.TIKACLAR.map(t => ({ s: t.s0, v: 0, yok: 0 })),
    };
    // Teknede herkese ayrı bir başlangıç yeri
    o.tekneler.forEach(b => {
      const ekip = o.oyuncular.filter(p => p.tekne === b.no);
      ekip.forEach((p, j) => { const a = b.yaw + Math.PI + (j - (ekip.length - 1) / 2) * 0.75; p.lx = Math.sin(a) * R_TUT; p.lz = Math.cos(a) * R_TUT; p.yaw = b.yaw; });
    });
    // Yiyecekleri nehre dağıt
    if (YIYECEK.some(ekAcik)) for (let k = 0; k < 10; k++) yiyecekKoy();
    cb.herkese({ tip: 'basla', oyuncular: o.oyuncular.map(p => ({ id: p.id, ad: p.ad, no: p.no, tekne: p.tekne, lx: p.lx, lz: p.lz })), tekneSay, ayar: o.ayar });
    cb.herkese({ tip: 'yy', liste: o.yiyecekler });
    if (!secenek.elle) {
      clearInterval(zaman);
      let son = Date.now(), birikim = 0;
      zaman = setInterval(() => {
        const simdi = Date.now(); birikim += Math.min(1, (simdi - son) / 1000); son = simdi;
        while (birikim >= DT && o && !o.bitti) { birikim -= DT; adim(); }
      }, DT * 1000);
    }
  }
  function durdur() { clearInterval(zaman); zaman = null; }

  const ekipBul = b => o.oyuncular.filter(p => !p.cikti && p.tekne === b.no && p.d === 'gemi');
  const dunya = (b, lx, lz) => { const c = Math.cos(b.yaw), s = Math.sin(b.yaw); return { x: b.x + lx * c + lz * s, z: b.z - lx * s + lz * c }; };
  // Tutunanın yeri teknenin dönüşünden bağımsız: lx, lz dünya yönünde ofset (arkadaysan arkada kalırsın)
  function oyuncuDunya(p) {
    if (p.d !== 'gemi') return { x: p.x, z: p.z, y: p.y };
    const b = o.tekneler[p.tekne];
    return { x: b.x + p.lx, z: b.z + p.lz, y: b.y };
  }

  function adim() {
    if (!o || o.bitti) return;
    o.t++;
    if (o.faz === 'geri') {
      o.fazT -= DT;
      if (o.fazT <= 0) { o.faz = 'yaris'; cb.herkese({ tip: 'faz', faz: 'yaris' }); }
      return yay();
    }
    o.zt += DT;
    o.tekneler.forEach(b => { b.fx = 0; b.fz = 0; b.tork = 0; });
    fiskirmalar();
    o.tekneler.forEach(tekneAdim);
    carpismalar();
    tikacAdim();
    yiyecekAdim();
    ordekAdim();
    balikAdim();
    for (let k = o.bekleyen.length - 1; k >= 0; k--) { const e = o.bekleyen[k]; if ((e.t -= DT) <= 0) { o.bekleyen.splice(k, 1); e.fn(); } }
    yay();
  }

  // ---------- Osuruk: basılı tuttukça tekne baktığın yöne itilir ----------
  function fiskirmalar() {
    o.oyuncular.forEach(p => { if (p.itT > 0) p.itT -= DT; });
    for (const p of o.oyuncular) {
      if (!p.fis || p.cikti || p.d !== 'gemi') continue;
      const b = o.tekneler[p.tekne];
      if (b.devrik > 0 || b.gol > 0) continue;
      p.osurSure += DT;
      // 🌶️ biber: turbo (ama yön kaçar)  🥤 gazoz: osuruk yerine geğirti, tekne geri gider
      const F = FIS * (b.etki === 1 ? 2.2 : 1) * (b.etki === 3 ? -0.9 : 1);
      // Oyuncu kenara tutunmuş, yüzü teknenin ortasına dönük: tekne oyuncunun KARŞI tarafına itilir
      const rx = p.lx, rz = p.lz, rl = Math.hypot(rx, rz) || 1;
      const fx = -rx / rl, fz = -rz / rl;
      b.fx += fx * F; b.fz += fz * F;
      b.tork += (Math.random() - 0.5) * 0.3;
      b.sallaV += (Math.random() - 0.5) * 0.25;
      if (b.etki === 1) { b.fx += (rastgele() - 0.5) * F * 1.4; b.fz += (rastgele() - 0.5) * F * 1.4; }
      // Gaz arkaya çıkar: arkadakileri ve arkadaki tekneleri iter
      const ox = b.x + rx, oz = b.z + rz;
      for (const q of o.oyuncular) {
        if (q === p || q.cikti || q.itT > 0) continue;
        const w = oyuncuDunya(q), dx = w.x - ox, dz = w.z - oz, d = Math.hypot(dx, dz);
        if (d > KONI_BOY || d < 0.05 || Math.abs(w.y - b.y) > 2) continue;
        if ((-dx * fx - dz * fz) / d < KONI_ACI) continue;
        q.itT = 0.6;
        if (q.tekne !== p.tekne) p.ucurma++;
        cb.kisiye(q.id, { tip: 'itildi', vx: -fx * 5, vz: -fz * 5, kim: p.ad });
        if (b.etki === 2) cb.kisiye(q.id, { tip: 'sis', kim: p.ad });
      }
      for (const ob of o.tekneler) {
        if (ob === b || ob.gol > 0 || Math.abs(ob.y - b.y) > 2) continue;
        const dx = ob.x - ox, dz = ob.z - oz, ileri = -(dx * fx + dz * fz);
        if (ileri < 0 || ileri > KONI_BOY + BR_DIS) continue;
        const yan = Math.abs(dx * fz - dz * fx);
        if (yan > BR_DIS + ileri * 0.6) continue;
        ob.fx -= fx * F * 0.55; ob.fz -= fz * F * 0.55;
        ob.tork += (Math.random() - 0.5) * F * 0.6;
        if (b.etki === 2 && ob.sisT <= 0) { ob.sisT = 1.5; o.oyuncular.forEach(q => { if (q.tekne === ob.no && !q.cikti) cb.kisiye(q.id, { tip: 'sis', kim: p.ad }); }); }
      }
    }
  }

  // ---------- Kütük salıncakları: çarpan tekneyi ve üstündekileri savurur ----------
  function kutukAdim(b) {
    if (b.kutukT > 0) { b.kutukT -= DT; return; }
    P.SALINCAKLAR.forEach((S, k) => {
      if (Math.abs(S.i - b.i) > 8 || Math.abs(S.y - b.y) > 2.5) return;
      const ku = P.kutuk(k, o.zt);
      if (ku.h > 1.1 || ku.h < -0.6) return;                       // kütük yukarıda
      const ox = b.x - S.x, oz = b.z - S.z;
      const a = ox * S.tx + oz * S.tz;
      if (Math.abs(a - ku.a) > BR + 0.4) return;
      const yon = Math.sign(ku.va) || 1;
      b.vx += S.tx * yon * 6 + S.nx * (Math.random() - 0.5) * 3; b.vz += S.tz * yon * 6 + S.nz * (Math.random() - 0.5) * 3;
      b.w += (Math.random() - 0.5) * 4; b.sallaV += 1.2; b.kutukT = 1.0; b.kutukSay++; b.evx += S.tx * yon * 4; b.evz += S.tz * yon * 4; b.batmaV -= 1;
      b.x += S.tx * yon * 0.4; b.z += S.tz * yon * 0.4;
      o.oyuncular.forEach(p => { if (p.tekne === b.no && p.d === 'gemi' && !p.cikti) cb.kisiye(p.id, { tip: 'itildi', vx: S.tx * yon * 7, vz: S.tz * yon * 7, kim: 'Kütük', kutuk: true }); });
      cb.herkese({ tip: 'kutuk', tekne: b.no, x: r2(b.x), z: r2(b.z), y: r2(b.y) });
    });
  }

  // ---------- Tekne fiziği ----------
  function tekneAdim(b) {
    if (o.bitti) return;
    if (b.gol > 0) {                                   // göle düştü: çarpar, sallanır, batar; sonra kontrol noktasından
      b.gol -= DT;
      yayAdim(b, -0.25 - (2.2 - b.gol) * 0.35);
      b.x += b.vx * DT; b.z += b.vz * DT; b.vx *= Math.exp(-2 * DT); b.vz *= Math.exp(-2 * DT);
      if (b.gol <= 0) {
        const k = P.kontrolYeri(b.cp, b.no);
        Object.assign(b, { x: k.x, z: k.z, y: k.y, yaw: k.yaw, i: k.i, vx: 0, vz: 0, vy: 0, w: 0, hav: false, devrik: 0, ex: 0, ez: 0, evx: 0, evz: 0, batma: 0, batmaV: 0 });
        cb.herkese({ tip: 'yeniden', tekne: b.no });
      }
      return;
    }
    const ekip = ekipBul(b), n = ekip.length;
    const m = 1.0 + 1.1 * n, I = 2.5 + 0.5 * n;
    b.m = m;
    if (b.etkiT > 0) { b.etkiT -= DT; if (b.etkiT <= 0) b.etki = 0; }
    if (b.komboT > 0) b.komboT -= DT;
    if (b.sisT > 0) b.sisT -= DT;
    // 💥 Kombo: takımın hepsi (en az 2 kişi) aynı anda osurursa SÜPER PATLAMA
    if (ekAcik('kombo') && n >= 2 && !b.hav && ekip.every(p => p.fis)) b.hepT += DT; else b.hepT = 0;
    if (b.hepT > 0.35 && b.komboT <= 0) {
      let ux = 0, uz = 0; ekip.forEach(p => { ux -= p.lx; uz -= p.lz; }); const ul = Math.hypot(ux, uz) || 1;
      b.vx += ux / ul * 7; b.vz += uz / ul * 7; b.batmaV = 5.5; b.komboT = 7; b.hepT = 0; b.sallaV += 1;
      cb.herkese({ tip: 'kombo', tekne: b.no, x: r2(b.x), z: r2(b.z), y: r2(b.y) });
    }
    if (b.devrik > 0) { b.devrik -= DT; if (b.devrik <= 0) cb.herkese({ tip: 'dogruldu', tekne: b.no }); }

    if (b.hav) {
      const y0 = b.y;
      b.havT += DT;
      b.vy -= 13 * DT;
      b.x += b.vx * DT; b.z += b.vz * DT; b.y += b.vy * DT;
      b.yaw += b.w * DT;
      // devrilme açısı: önce kenardan hızla devrilir, sonra burnu aşağı yan yatmış düşer
      const aci = b.havAci0 + (1.55 - b.havAci0) * (1 - Math.exp(-b.havT * 2.6));
      b.ex = b.dusX * aci; b.ez = b.dusZ * aci; b.evx = b.dusX * 2.6 * Math.exp(-b.havT * 2.6); b.evz = b.dusZ * 2.6 * Math.exp(-b.havT * 2.6);
      const j = P.inis(b.x, b.z, y0, b.y);
      if (j >= 0 && P.P[j].y < b.havY - 2) {
        b.hav = false; b.y = P.P[j].y; b.i = j; const sert = -b.vy; b.vy = 0;
        b.vx *= 0.5; b.vz *= 0.5;
        carpmaYay(b, sert);
        cb.herkese({ tip: 'indi', tekne: b.no, x: r2(b.x), z: r2(b.z), y: r2(b.y), sert: r2(sert) });
      } else if (b.y < P.GOL_Y) {
        const sert = -b.vy;
        b.hav = false; b.gol = 2.2; b.y = P.GOL_Y; b.vy = 0; b.vx *= 0.3; b.vz *= 0.3;
        carpmaYay(b, sert);
        cb.herkese({ tip: 'gol', tekne: b.no, x: r2(b.x), z: r2(b.z) });
      }
      return;
    }
    yayAdim(b, 0, b.kx, b.kz);

    // Kuvvetler: fışkırma + akıntı (aşağı) + sürtünme
    const p0 = P.P[b.i], ak = P.akinti(b.i);
    let ax = b.fx / m - p0.tx * ak, az = b.fz / m - p0.tz * ak;
    const v = Math.hypot(b.vx, b.vz);
    ax -= b.vx * (SURUK + SURUK2 * v); az -= b.vz * (SURUK + SURUK2 * v);
    b.w += (b.tork / I) * DT; b.w *= Math.exp(-DONUS_SURUK * DT);
    // Girdap: tekneyi döndürür ve içine çeker
    for (const g of P.GIRDAPLAR) {
      const dx = g.x - b.x, dz = g.z - b.z, d = Math.hypot(dx, dz);
      if (d > g.r + BR * 0.5 || Math.abs(g.y - b.y) > 2) continue;
      const k = 1 - d / (g.r + BR * 0.5);
      ax += (dx / (d || 1)) * 1.6 * k + (-dz / (d || 1)) * 4 * k; az += (dz / (d || 1)) * 1.6 * k + (dx / (d || 1)) * 4 * k;
      b.w += 3.2 * k * DT;
    }
    b.vx += ax * DT; b.vz += az * DT;
    b.x += b.vx * DT; b.z += b.vz * DT; b.yaw += b.w * DT;
    if (Math.hypot(b.vx, b.vz) > 0.8) { let d = Math.atan2(b.vx, b.vz) - b.yaw; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; b.yaw += d * Math.min(1, DT * 1.5); }

    const s = P.bul(b.x, b.z, b.y, b.i);
    if (!s) return;
    b.i = s.i; b.y = s.y;
    const q = P.P[s.i];
    // Pistin başı (iskele) ve sonu (zirve duvarı)
    // (arkaya tutunan karakter de iskeleye girmesin: tekne + tutunan + gövde payı)
    const yol = q.s + s.a, MIN_BAS = R_TUT + 0.6;
    if (yol < MIN_BAS) { const p0 = P.P[0], f = MIN_BAS - yol; b.x += p0.tx * f; b.z += p0.tz * f; const vt = b.vx * p0.tx + b.vz * p0.tz; if (vt < 0) { b.vx -= vt * p0.tx; b.vz -= vt * p0.tz; } }
    if (yol > P.L - MIN_BAS) { const pn = P.P[P.N - 1], f = yol - (P.L - MIN_BAS); b.x -= pn.tx * f; b.z -= pn.tz * f; const vt = b.vx * pn.tx + b.vz * pn.tz; if (vt > 0) { b.vx -= vt * pn.tx; b.vz -= vt * pn.tz; } }
    // Kenarlarda korkuluk yok. Taşmaya başlayan tekne önce kenarda sallanır: taşan tarafa yatar,
    // yerçekimi dışarı çeker. O taraftakiler osurursa geri itilir; çok taşarsa düşer.
    const asim = Math.abs(s.d) - KENAR0;
    if (asim > 0) {
      const yon = Math.sign(s.d), oran = Math.min(1, asim / (KENAR_DUS - KENAR0));
      b.vx += q.nx * yon * (0.6 + asim * 1.8) * DT; b.vz += q.nz * yon * (0.6 + asim * 1.8) * DT;
      b.kx = q.nx * yon * oran * 0.95; b.kz = q.nz * yon * oran * 0.95;
      if (!b.kenarda) { b.kenarda = 1; cb.herkese({ tip: 'kenarda', tekne: b.no, ic: yon < 0 }); }
    } else {
      b.kx = 0; b.kz = 0;
      if (b.kenarda && asim < -0.4) { b.kenarda = 0; cb.herkese({ tip: 'kurtuldu', tekne: b.no }); }
    }
    if (Math.abs(s.d) > KENAR_DUS) {
      const yon = Math.sign(s.d);
      b.hav = true; b.havY = b.y; b.vy = 0.6; b.havT = 0; b.dusX = q.nx * yon; b.dusZ = q.nz * yon;
      b.havAci0 = Math.min(1.2, Math.hypot(b.ex, b.ez)); b.kenarda = 0; b.kx = 0; b.kz = 0;
      const dis = (b.vx * q.nx + b.vz * q.nz) * yon; if (dis < 2.5) { b.vx += q.nx * yon * (2.5 - dis); b.vz += q.nz * yon * (2.5 - dis); }
      cb.herkese({ tip: 'dustu', tekne: b.no, ic: yon < 0 });
      return;
    }
    // Kayalar
    for (const k of P.KAYALAR) {
      if (Math.abs(k.y - b.y) > 2) continue;
      const dx = b.x - k.x, dz = b.z - k.z, d = Math.hypot(dx, dz), en = BR_DIS + k.r;
      if (d >= en || d < 0.001) continue;
      const nx = dx / d, nz = dz / d, vn = b.vx * nx + b.vz * nz;
      b.x += nx * (en - d); b.z += nz * (en - d);
      if (vn < 0) { b.vx -= 1.5 * vn * nx; b.vz -= 1.5 * vn * nz; b.w += (Math.random() - 0.5) * 3; if (vn < -1.5) { b.sallaV += 0.5; cb.herkese({ tip: 'carpti', tekne: b.no, x: r2(b.x), z: r2(b.z), sert: r2(-vn) }); } }
    }
    kutukAdim(b);
    // Kontrol noktası ve bitiş
    while (b.cp + 1 < P.KONTROL.length && b.i >= P.KONTROL[b.cp + 1] && b.i - P.KONTROL[b.cp + 1] < 25) {
      b.cp++; cb.herkese({ tip: 'kontrol', tekne: b.no, cp: b.cp });
    }
    if (b.i >= P.BITIS && b.cp >= P.KONTROL.length - 1) return bitir(b.no);

    // Eğilme: herkes bir tarafa toplanırsa tekne yatar, fazlası devrilir
    let sx = 0, sz = 0; ekip.forEach(p => { sx += p.lx; sz += p.lz; });
    b.egX = sx / (R_TUT * 4); b.egZ = sz / (R_TUT * 4);   // 4 kişi aynı yerde = 1
    b.sallaV += (-b.salla * 30) * DT; b.sallaV *= Math.exp(-3 * DT); b.salla += b.sallaV * DT * 10;
    const oran = Math.hypot(b.egX, b.egZ);
    if (b.devrik <= 0 && n > 0 && oran > DEVRIL_ORAN) {
      b.devrilT += DT;
      if (b.devrilT > DEVRIL_SURE) devril(b, 'Herkes bir tarafa toplandı');
    } else b.devrilT = Math.max(0, b.devrilT - DT);
  }
  // Suya çarpınca: gömülür, yaylanıp çıkar; yan yatmışsa sertçe düzelip sallanır
  function carpmaYay(b, sert) {
    b.batmaV = -Math.min(6, sert) * 0.75;
    b.evx = -b.ex * 4; b.evz = -b.ez * 4;
    b.sallaV += 0.8;
  }
  function yayAdim(b, hedefBatma, hx = 0, hz = 0) {
    b.evx += (-55 * (b.ex - hx) - 6 * b.evx) * DT; b.evz += (-55 * (b.ez - hz) - 6 * b.evz) * DT;
    b.ex += b.evx * DT; b.ez += b.evz * DT;
    b.batmaV += (-40 * (b.batma - hedefBatma) - 5 * b.batmaV) * DT; b.batma += b.batmaV * DT;
  }
  function itDuvar(b, q, fark, yon) {
    b.x += q.nx * fark; b.z += q.nz * fark;
    const vn = (b.vx * q.nx + b.vz * q.nz) * yon;
    if (vn < 0) { b.vx -= 1.4 * vn * q.nx * yon; b.vz -= 1.4 * vn * q.nz * yon; if (vn < -2) { b.w += (Math.random() - 0.5) * 2; cb.herkese({ tip: 'carpti', tekne: b.no, x: r2(b.x), z: r2(b.z), sert: r2(-vn) }); } }
  }
  function devril(b, neden) {
    b.devrik = DEVRIK_KAL; b.devrilT = 0; b.vx *= 0.3; b.vz *= 0.3;
    o.oyuncular.forEach(p => { if (p.tekne === b.no && p.d === 'gemi') p.fis = false; });
    cb.herkese({ tip: 'devrildi', tekne: b.no, neden });
  }

  // ---------- 🫘🌶️🥬🥤 Yiyecekler ----------
  function yiyecekKoy() {
    const turler = YIYECEK.filter(ekAcik); if (!turler.length) return;
    for (let deneme = 0; deneme < 20; deneme++) {
      const sx = 40 + rastgele() * (P.L - 80);
      if (P.TIKACLAR.some(t => sx > t.s0 - 8 && sx < t.s1 + 6)) continue;
      const i = P.endeks(sx), p = P.P[i], d = (rastgele() - 0.5) * 7;
      o.yiyecekler.push({ id: o.yemekId++, tur: turler[Math.floor(rastgele() * turler.length)], x: r2(p.x + p.nx * d), z: r2(p.z + p.nz * d), y: r2(p.y), i });
      return;
    }
  }
  function yiyecekAdim() {
    for (let k = o.yemekBekle.length - 1; k >= 0; k--) if ((o.yemekBekle[k] -= DT) <= 0) { o.yemekBekle.splice(k, 1); yiyecekKoy(); cb.herkese({ tip: 'yy', liste: o.yiyecekler }); }
    for (const b of o.tekneler) {
      if (b.hav || b.gol > 0) continue;
      const j = o.yiyecekler.findIndex(y => Math.abs(y.i - b.i) < 6 && Math.hypot(y.x - b.x, y.z - b.z) < BR_DIS + 0.4);
      if (j < 0) continue;
      const y = o.yiyecekler.splice(j, 1)[0]; b.yemek++;
      if (ETKI[y.tur]) { b.etki = ETKI[y.tur]; b.etkiT = ETKI_SURE[y.tur]; }
      o.yemekBekle.push(6);
      cb.herkese({ tip: 'yedi', tekne: b.no, tur: y.tur, id: y.id, sure: ETKI_SURE[y.tur] || 0 });
      cb.herkese({ tip: 'yy', liste: o.yiyecekler });
    }
  }
  // ---------- 🦆 Ördek sürüleri: çarpan tekneyi yavaşlatır, ördekler vak vak dağılır ----------
  function ordekAdim() {
    if (!ekAcik('ordek')) return;
    P.ORDEKLER.forEach((O, k) => {
      if (o.ordekT[k] > 0) { o.ordekT[k] -= DT; return; }
      const p = P.P[O.i], d = P.ordekD(k, o.zt), ox = p.x + p.nx * d, oz = p.z + p.nz * d;
      for (const b of o.tekneler) {
        if (b.hav || b.gol > 0 || Math.abs(b.y - p.y) > 2 || Math.hypot(b.x - ox, b.z - oz) > BR_DIS + 0.9) continue;
        b.vx *= 0.5; b.vz *= 0.5; b.sallaV += 0.4; o.ordekT[k] = 12;
        cb.herkese({ tip: 'vak', k, tekne: b.no, x: r2(ox), z: r2(oz), y: r2(p.y) });
        break;
      }
    });
  }
  // ---------- 🐟 Zıplayan balık: sudan fırlar, birinin suratına çarparsa kenarı bırakır ----------
  function balikAdim() {
    if (!ekAcik('balik')) return;
    if ((o.balikT -= DT) > 0) return;
    o.balikT = 5 + rastgele() * 5;
    const adaylar = o.oyuncular.filter(p => !p.cikti && p.d === 'gemi' && !o.tekneler[p.tekne].hav && o.tekneler[p.tekne].gol <= 0);
    if (!adaylar.length) return;
    const p = adaylar[Math.floor(rastgele() * adaylar.length)], b = o.tekneler[p.tekne];
    const vur = rastgele() < 0.6, lr = Math.hypot(p.lx, p.lz) || 1;
    const bx = b.x + p.lx / lr * (R_TUT + 3.5), bz = b.z + p.lz / lr * (R_TUT + 3.5);
    cb.herkese({ tip: 'balik', no: p.no, tekne: b.no, vur, x: r2(bx), z: r2(bz), y: r2(b.y) });
    if (vur) o.bekleyen.push({ t: 0.7, fn: () => { if (p.d === 'gemi' && !p.cikti) cb.kisiye(p.id, { tip: 'itildi', vx: -p.lx / lr * -4, vz: -p.lz / lr * -4, kim: 'Balık', balik: true }); } });
  }
  // ---------- 🍾 Dev tıkaç: nehri tıkar; hep beraber osurup yukarı itince fırlar gider ----------
  function tikacAdim() {
    if (!ekAcik('tikac')) return;
    P.TIKACLAR.forEach((T, k) => {
      const t = o.tikaclar[k];
      if (t.yok > 0) { t.yok -= DT; if (t.yok <= 0) { t.s = T.s0; t.v = 0; cb.herkese({ tip: 'tikac', k, olay: 'geri' }); } return; }
      // Tıkaç nehrin enine yatmış dev bir mantar: arkasındaki tekneler onu düz ileri iter
      const i = P.endeks(t.s), p = P.P[i], KAL = BR_DIS + T.kal;
      let itis = 0;
      for (const b of o.tekneler) {
        if (b.hav || b.gol > 0 || Math.abs(b.y - p.y) > 2) continue;
        const q = P.P[b.i], yolB = q.s + (b.x - q.x) * q.tx + (b.z - q.z) * q.tz;
        if (yolB <= t.s - KAL || yolB > t.s + T.kal) continue;
        const f = yolB - (t.s - KAL);
        b.x -= q.tx * f; b.z -= q.tz * f;
        const vt = b.vx * q.tx + b.vz * q.tz; if (vt > 0) { b.vx -= vt * q.tx; b.vz -= vt * q.tz; }
        itis += Math.max(0, b.fx * q.tx + b.fz * q.tz) / (b.m + 3);   // teknenin osuruk gücünün ileri payı
      }
      // itilmezse sürtünmeyle olduğu yerde kalır (geri kaymaz), itilen yol kaybolmaz
      t.v = Math.max(0, (t.v + (itis * 1.4 - 0.25) * DT) * Math.exp(-0.6 * DT));
      t.s += t.v * DT;
      if (t.s >= T.s1) { t.yok = 15; cb.herkese({ tip: 'tikac', k, olay: 'firladi', x: r2(p.x), z: r2(p.z), y: r2(p.y) }); }
    });
  }

  // Tekne-tekne çarpışması
  function carpismalar() {
    const T = o.tekneler;
    for (let a = 0; a < T.length; a++) for (let c = a + 1; c < T.length; c++) {
      const A = T[a], B = T[c];
      if (A.gol > 0 || B.gol > 0 || A.hav || B.hav || Math.abs(A.y - B.y) > 2) continue;
      const dx = B.x - A.x, dz = B.z - A.z, d = Math.hypot(dx, dz);
      if (d >= BR_DIS * 2 || d < 0.001) continue;
      const nx = dx / d, nz = dz / d, it = (BR_DIS * 2 - d) / 2;
      A.x -= nx * it; A.z -= nz * it; B.x += nx * it; B.z += nz * it;
      const vr = (B.vx - A.vx) * nx + (B.vz - A.vz) * nz;
      if (vr < 0) {
        const j = -vr * 0.8;
        A.vx -= nx * j; A.vz -= nz * j; B.vx += nx * j; B.vz += nz * j;
        A.w += (Math.random() - 0.5) * 2; B.w += (Math.random() - 0.5) * 2;
        if (vr < -1.2) { A.sallaV += 0.4; B.sallaV += 0.4; cb.herkese({ tip: 'carpti', tekne: -1, x: r2((A.x + B.x) / 2), z: r2((A.z + B.z) / 2), sert: r2(-vr) }); }
      }
    }
  }

  function bitir(kazanan) {
    if (o.bitti) return;
    const sira = [...o.tekneler].sort((a, b) => (b.no === kazanan) - (a.no === kazanan) || b.i - a.i).map(b => b.no);
    o.bitti = { kazanan, sira };
    yay();
    cb.herkese({ tip: 'bitti', kazanan, sira, unvanlar: unvanlar() });
    durdur();
  }

  // 🏆 Komik unvanlar
  function unvanlar() {
    const L = [], O = o.oyuncular, T = o.tekneler;
    const enCok = (dizi, f) => dizi.reduce((a, x) => (f(x) > f(a) ? x : a), dizi[0]);
    let p = enCok(O, x => x.osurSure); if (p && p.osurSure > 0) L.push({ e: '💨', baslik: 'Osuruk Kralı', ad: p.ad, deger: Math.round(p.osurSure) + ' sn osurdu' });
    p = enCok(O, x => x.dusme); if (p && p.dusme > 0) L.push({ e: '🌊', baslik: 'Su Faresi', ad: p.ad, deger: p.dusme + ' kez suya düştü' });
    p = enCok(O, x => x.ucurma); if (p && p.ucurma > 0) L.push({ e: '🎯', baslik: 'Keskin Nişancı Popo', ad: p.ad, deger: p.ucurma + ' rakip uçurdu' });
    let b = enCok(T, x => x.yemek); if (b && b.yemek > 0) L.push({ e: '🫘', baslik: 'Obur Tekne', tekne: b.no, deger: b.yemek + ' şey yedi' });
    b = enCok(T, x => x.kutukSay); if (b && b.kutukSay > 0) L.push({ e: '🪵', baslik: 'Kütük Mıknatısı', tekne: b.no, deger: b.kutukSay + ' kütük yedi' });
    if (O.length > 1) { p = O.reduce((a, x) => (x.osurSure < a.osurSure ? x : a), O[0]); L.push({ e: '😇', baslik: 'Utangaç Popo', ad: p.ad, deger: 'en az osuran' }); }
    return L;
  }
  const r2 = v => Math.round(v * 100) / 100;
  function yay() {
    const tk = [], op = [];
    o.tekneler.forEach(b => tk.push(r2(b.x), r2(b.z), r2(b.y), r2(b.yaw), r2(b.egX), r2(b.egZ), b.hav ? 1 : b.gol > 0 ? 2 : 0, b.i, b.cp, b.devrik > 0 ? 1 : 0, r2(b.salla), r2(b.ex), r2(b.ez), r2(b.batma), b.etki));
    o.oyuncular.forEach(p => {
      if (p.cikti) return;
      const su = p.d !== 'gemi';
      op.push(p.no, p.tekne, p.d === 'gemi' ? 0 : p.d === 'su' ? 1 : 2, r2(su ? p.x : p.lx), r2(su ? p.z : p.lz), r2(p.y), r2(p.yaw), p.fis ? 1 : 0, r2(p.bas));
    });
    cb.herkese({ tip: 'd', f: o.faz, ft: r2(o.fazT), zt: r2(o.zt), tk, o: op, tc: o.tikaclar.map(t => [r2(t.s), t.yok > 0 ? 1 : 0]), od: o.ordekT.map(t => (t > 0 ? 1 : 0)) });
  }

  // ---------- Oyunculardan gelenler ----------
  function girdi(id, m) {
    if (!o || o.bitti) return;
    const p = o.oyuncular.find(x => x.id === id);
    if (!p || p.cikti) return;
    if (m.tip === 'k') {
      const once = p.d;
      p.d = m.d === 'su' || m.d === 'ucus' ? m.d : 'gemi';
      if (once === 'gemi' && p.d !== 'gemi') p.dusme++;
      if (p.d === 'gemi') { p.lx = clamp(+m.lx || 0, -R_TUT - 0.3, R_TUT + 0.3); p.lz = clamp(+m.lz || 0, -R_TUT - 0.3, R_TUT + 0.3); }
      else { p.x = +m.x || 0; p.z = +m.z || 0; p.y = +m.y || 0; }
      p.yaw = +m.yaw || 0; p.bas = clamp(+m.bas || 0, 0, 1);
      if (m.f !== undefined) p.fis = !!m.f && o.faz === 'yaris' && p.d === 'gemi';
    } else if (m.tip === 'fis') {
      p.fis = !!m.on && o.faz === 'yaris' && p.d === 'gemi';
    } else if (m.tip === 'emoji') {
      const simdi = o.t * DT; if (simdi - p.emojiT < 0.8) return; p.emojiT = simdi;
      const e = Math.max(0, Math.min(3, m.e | 0));
      cb.herkese({ tip: 'emoji', no: p.no, e });
      return;
    }
    if (p.fis && o.tekneler[p.tekne].devrik > 0) p.fis = false;
  }
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  function cikis(id) {
    const p = o?.oyuncular.find(x => x.id === id);
    if (!p || p.cikti) return;
    p.cikti = true; p.fis = false;
    cb.herkese({ tip: 'cikti', no: p.no, ad: p.ad });
    if (!o.bitti && o.oyuncular.every(x => x.cikti)) durdur();
  }

  return { baslat, durdur, adim, girdi, cikis, DT, BR, R_TUT, BR_DIS, get durum() { return o; } };
})();
if (typeof module !== 'undefined') module.exports = Motor;
