// =============================================================
// Çalkala Kaptan - oyun motoru. Sadece odayı açan (ev) çalıştırır.
// Teknelerin fiziği, köpük itişi, devrilme, düşme, kontrol noktaları ve bitiş burada.
// Oyuncular tekne üstündeki yerlerini (ya da yüzerken konumlarını) kendileri yollar.
// =============================================================

const Motor = (() => {
  const P = typeof Pist !== 'undefined' ? Pist : require('./pist.js');
  const DT = 0.05;
  const BR = 1.75;                 // tekne yarıçapı
  const FIS = 9;                   // bir şişenin itme gücü
  const SURUK = 0.55, SURUK2 = 0.06, DONUS_SURUK = 2.0;
  const GERI_SAYIM = 3.5;
  const DEVRIL_ORAN = 0.62, DEVRIL_SURE = 1.2, DEVRIK_KAL = 2.6;
  const KONI_BOY = 4.5, KONI_ACI = Math.cos(36 * Math.PI / 180);
  let o = null, cb = null, zaman = null;

  function baslat(liste, ayar, geri, secenek = {}) {
    cb = geri;
    const tekneSay = Math.max(...liste.map(p => p.tekne)) + 1;
    o = {
      t: 0, faz: 'geri', fazT: GERI_SAYIM, bitti: null, ayar: { ...ayar },
      tekneler: Array.from({ length: tekneSay }, (_, no) => {
        const b = P.baslangic(no);
        return { no, x: b.x, z: b.z, y: b.y, yaw: b.yaw, vx: 0, vz: 0, vy: 0, w: 0, i: P.endeks(no < 2 ? 16 : 9), cp: -1, hav: false, havY: 0, devrik: 0, devrilT: 0, gol: 0, fx: 0, fz: 0, tork: 0, egX: 0, egZ: 0, salla: 0, sallaV: 0 };
      }),
      oyuncular: liste.map((p, no) => ({ id: p.id, ad: p.ad, no, tekne: p.tekne, d: 'gemi', lx: 0, lz: 0, x: 0, z: 0, y: 0, yaw: 0, bas: 0, fis: null, itT: 0, cikti: false })),
    };
    // Teknede herkese ayrı bir başlangıç yeri
    o.tekneler.forEach(b => {
      const ekip = o.oyuncular.filter(p => p.tekne === b.no);
      ekip.forEach((p, j) => { const a = (j / Math.max(1, ekip.length)) * Math.PI * 2; const r = ekip.length > 1 ? 0.8 : 0; p.lx = Math.sin(a) * r; p.lz = -Math.cos(a) * r; p.yaw = b.yaw; });
    });
    cb.herkese({ tip: 'basla', oyuncular: o.oyuncular.map(p => ({ id: p.id, ad: p.ad, no: p.no, tekne: p.tekne, lx: p.lx, lz: p.lz })), tekneSay, ayar: o.ayar });
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
  function oyuncuDunya(p) {
    if (p.d !== 'gemi') return { x: p.x, z: p.z, y: p.y };
    const b = o.tekneler[p.tekne], w = dunya(b, p.lx, p.lz);
    return { x: w.x, z: w.z, y: b.y };
  }

  function adim() {
    if (!o || o.bitti) return;
    o.t++;
    if (o.faz === 'geri') {
      o.fazT -= DT;
      if (o.fazT <= 0) { o.faz = 'yaris'; cb.herkese({ tip: 'faz', faz: 'yaris' }); }
      return yay();
    }
    o.tekneler.forEach(b => { b.fx = 0; b.fz = 0; b.tork = 0; });
    fiskirmalar();
    o.tekneler.forEach(tekneAdim);
    carpismalar();
    yay();
  }

  // ---------- Köpük fışkırtma ----------
  function fiskirmalar() {
    o.oyuncular.forEach(p => { if (p.itT > 0) p.itT -= DT; });
    for (const p of o.oyuncular) {
      if (!p.fis || p.cikti) continue;
      p.fis.kalan -= DT;
      if (p.fis.kalan <= 0 || p.d !== 'gemi') { p.fis = null; continue; }
      const b = o.tekneler[p.tekne];
      if (b.devrik > 0 || b.gol > 0) continue;
      const g = p.fis.guc, F = FIS * (0.55 + 0.45 * g);
      const fx = Math.sin(p.yaw), fz = Math.cos(p.yaw);
      // Tekne ileri itilir; merkezde değilsen döner de
      const c = Math.cos(b.yaw), s = Math.sin(b.yaw);
      const rx = p.lx * c + p.lz * s, rz = -p.lx * s + p.lz * c;
      b.fx += fx * F; b.fz += fz * F;
      b.tork += (rz * fx - rx * fz) * F;
      b.sallaV += (Math.random() - 0.5) * 0.4 * g;
      // Köpük arkaya fışkırır: arkadaki oyuncuları ve tekneleri iter
      const ox = b.x + rx, oz = b.z + rz;
      for (const q of o.oyuncular) {
        if (q === p || q.cikti || q.itT > 0) continue;
        const w = oyuncuDunya(q), dx = w.x - ox, dz = w.z - oz, d = Math.hypot(dx, dz);
        if (d > KONI_BOY || d < 0.05 || Math.abs(w.y - b.y) > 2) continue;
        if ((-dx * fx - dz * fz) / d < KONI_ACI) continue;
        const kuvvet = 4 + 4 * g;
        q.itT = 0.5;
        cb.kisiye(q.id, { tip: 'itildi', vx: -fx * kuvvet, vz: -fz * kuvvet, kim: p.ad });
      }
      for (const ob of o.tekneler) {
        if (ob === b || ob.gol > 0 || Math.abs(ob.y - b.y) > 2) continue;
        const dx = ob.x - ox, dz = ob.z - oz, ileri = -(dx * fx + dz * fz);
        if (ileri < 0 || ileri > KONI_BOY + BR) continue;
        const yan = Math.abs(dx * fz - dz * fx);
        if (yan > BR + ileri * 0.6) continue;
        ob.fx -= fx * F * 0.55; ob.fz -= fz * F * 0.55;
        ob.tork += (Math.random() - 0.5) * F * 0.8;
      }
    }
  }

  // ---------- Tekne fiziği ----------
  function tekneAdim(b) {
    if (o.bitti) return;
    if (b.gol > 0) {                                   // göle düştü: kontrol noktasından yeniden
      b.gol -= DT;
      if (b.gol <= 0) {
        const k = P.kontrolYeri(b.cp, b.no);
        Object.assign(b, { x: k.x, z: k.z, y: k.y, yaw: k.yaw, i: k.i, vx: 0, vz: 0, vy: 0, w: 0, hav: false, devrik: 0 });
        cb.herkese({ tip: 'yeniden', tekne: b.no });
      }
      return;
    }
    const ekip = ekipBul(b), n = ekip.length;
    const m = 1.0 + 1.1 * n, I = 2.5 + 0.5 * n;
    if (b.devrik > 0) { b.devrik -= DT; if (b.devrik <= 0) cb.herkese({ tip: 'dogruldu', tekne: b.no }); }

    if (b.hav) {
      const y0 = b.y;
      b.vy -= 13 * DT;
      b.x += b.vx * DT; b.z += b.vz * DT; b.y += b.vy * DT;
      b.yaw += b.w * DT;
      const j = P.inis(b.x, b.z, y0, b.y);
      if (j >= 0 && P.P[j].y < b.havY - 2) {
        b.hav = false; b.y = P.P[j].y; b.i = j; const sert = -b.vy; b.vy = 0;
        b.vx *= 0.5; b.vz *= 0.5;
        cb.herkese({ tip: 'indi', tekne: b.no, x: r2(b.x), z: r2(b.z), y: r2(b.y), sert: r2(sert) });
      } else if (b.y < P.GOL_Y) {
        b.hav = false; b.gol = 2.2; b.y = P.GOL_Y;
        cb.herkese({ tip: 'gol', tekne: b.no, x: r2(b.x), z: r2(b.z) });
      }
      return;
    }

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

    const s = P.bul(b.x, b.z, b.y, b.i);
    if (!s) return;
    b.i = s.i; b.y = s.y;
    const q = P.P[s.i];
    // Pistin başı (iskele) ve sonu (zirve duvarı)
    if (s.i === 0 && s.a < BR - 0.6) { const f = BR - 0.6 - s.a; b.x += q.tx * f; b.z += q.tz * f; const vt = b.vx * q.tx + b.vz * q.tz; if (vt < 0) { b.vx -= vt * q.tx; b.vz -= vt * q.tz; } }
    if (s.i === P.N - 1 && s.a > -BR) { const f = -BR - s.a; b.x += q.tx * f; b.z += q.tz * f; const vt = b.vx * q.tx + b.vz * q.tz; if (vt > 0) { b.vx -= vt * q.tx; b.vz -= vt * q.tz; } }
    // İç duvar (dağ)
    if (s.d < -(P.YARI - BR)) itDuvar(b, q, -(P.YARI - BR) - s.d, 1);
    // Dış kenar: korkuluk varsa duvar, yoksa düşer
    if (s.d > P.YARI - BR) {
      if (P.korkuluk[s.i]) itDuvar(b, q, (P.YARI - BR) - s.d, -1);
      else if (s.d > P.YARI - 0.35) {
        b.hav = true; b.havY = b.y; b.vy = 1.2;
        const dis = b.vx * q.nx + b.vz * q.nz; if (dis < 2.5) { b.vx += q.nx * (2.5 - dis); b.vz += q.nz * (2.5 - dis); }
        cb.herkese({ tip: 'dustu', tekne: b.no });
        return;
      }
    }
    // Kayalar
    for (const k of P.KAYALAR) {
      if (Math.abs(k.y - b.y) > 2) continue;
      const dx = b.x - k.x, dz = b.z - k.z, d = Math.hypot(dx, dz), en = BR + k.r;
      if (d >= en || d < 0.001) continue;
      const nx = dx / d, nz = dz / d, vn = b.vx * nx + b.vz * nz;
      b.x += nx * (en - d); b.z += nz * (en - d);
      if (vn < 0) { b.vx -= 1.5 * vn * nx; b.vz -= 1.5 * vn * nz; b.w += (Math.random() - 0.5) * 3; if (vn < -1.5) { b.sallaV += 0.5; cb.herkese({ tip: 'carpti', tekne: b.no, x: r2(b.x), z: r2(b.z), sert: r2(-vn) }); } }
    }
    // Kontrol noktası ve bitiş
    while (b.cp + 1 < P.KONTROL.length && b.i >= P.KONTROL[b.cp + 1] && b.i - P.KONTROL[b.cp + 1] < 25) {
      b.cp++; cb.herkese({ tip: 'kontrol', tekne: b.no, cp: b.cp });
    }
    if (b.i >= P.BITIS && b.cp >= P.KONTROL.length - 1) return bitir(b.no);

    // Eğilme: herkes bir tarafa toplanırsa tekne yatar, fazlası devrilir
    let sx = 0, sz = 0; ekip.forEach(p => { sx += p.lx; sz += p.lz; });
    const bolen = 2.5 + n;
    b.egX = sx / bolen; b.egZ = sz / bolen;
    b.sallaV += (-b.salla * 30) * DT; b.sallaV *= Math.exp(-3 * DT); b.salla += b.sallaV * DT * 10;
    const oran = Math.hypot(b.egX, b.egZ) + Math.abs(b.salla) * 0.5;
    if (b.devrik <= 0 && n > 0 && oran > DEVRIL_ORAN) {
      b.devrilT += DT;
      if (b.devrilT > DEVRIL_SURE) devril(b, 'Herkes bir tarafa toplandı');
    } else b.devrilT = Math.max(0, b.devrilT - DT);
  }
  function itDuvar(b, q, fark, yon) {
    b.x += q.nx * fark; b.z += q.nz * fark;
    const vn = (b.vx * q.nx + b.vz * q.nz) * yon;
    if (vn < 0) { b.vx -= 1.4 * vn * q.nx * yon; b.vz -= 1.4 * vn * q.nz * yon; if (vn < -2) { b.w += (Math.random() - 0.5) * 2; cb.herkese({ tip: 'carpti', tekne: b.no, x: r2(b.x), z: r2(b.z), sert: r2(-vn) }); } }
  }
  function devril(b, neden) {
    b.devrik = DEVRIK_KAL; b.devrilT = 0; b.vx *= 0.3; b.vz *= 0.3;
    o.oyuncular.forEach(p => { if (p.tekne === b.no && p.d === 'gemi') p.fis = null; });
    cb.herkese({ tip: 'devrildi', tekne: b.no, neden });
  }

  // Tekne-tekne çarpışması
  function carpismalar() {
    const T = o.tekneler;
    for (let a = 0; a < T.length; a++) for (let c = a + 1; c < T.length; c++) {
      const A = T[a], B = T[c];
      if (A.gol > 0 || B.gol > 0 || A.hav || B.hav || Math.abs(A.y - B.y) > 2) continue;
      const dx = B.x - A.x, dz = B.z - A.z, d = Math.hypot(dx, dz);
      if (d >= BR * 2 || d < 0.001) continue;
      const nx = dx / d, nz = dz / d, it = (BR * 2 - d) / 2;
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
    cb.herkese({ tip: 'bitti', kazanan, sira });
    durdur();
  }

  const r2 = v => Math.round(v * 100) / 100;
  function yay() {
    const tk = [], op = [];
    o.tekneler.forEach(b => tk.push(r2(b.x), r2(b.z), r2(b.y), r2(b.yaw), r2(b.egX), r2(b.egZ), b.hav ? 1 : b.gol > 0 ? 2 : 0, b.i, b.cp, b.devrik > 0 ? 1 : 0, r2(b.salla)));
    o.oyuncular.forEach(p => {
      if (p.cikti) return;
      const su = p.d !== 'gemi';
      op.push(p.no, p.tekne, p.d === 'gemi' ? 0 : p.d === 'su' ? 1 : 2, r2(su ? p.x : p.lx), r2(su ? p.z : p.lz), r2(p.y), r2(p.yaw), p.fis ? r2(p.fis.guc) : 0, r2(p.bas));
    });
    cb.herkese({ tip: 'd', f: o.faz, ft: r2(o.fazT), tk, o: op });
  }

  // ---------- Oyunculardan gelenler ----------
  function girdi(id, m) {
    if (!o || o.bitti) return;
    const p = o.oyuncular.find(x => x.id === id);
    if (!p || p.cikti) return;
    if (m.tip === 'k') {
      p.d = m.d === 'su' || m.d === 'ucus' ? m.d : 'gemi';
      if (p.d === 'gemi') { p.lx = clamp(+m.lx || 0, -BR, BR); p.lz = clamp(+m.lz || 0, -BR, BR); }
      else { p.x = +m.x || 0; p.z = +m.z || 0; p.y = +m.y || 0; }
      p.yaw = +m.yaw || 0; p.bas = clamp(+m.bas || 0, 0, 1.2);
    } else if (m.tip === 'fis') {
      if (o.faz !== 'yaris' || p.d !== 'gemi') return;
      const b = o.tekneler[p.tekne]; if (b.devrik > 0) return;
      const g = clamp(+m.guc || 0, 0.1, 1);
      p.fis = { kalan: 0.3 + g * 1.1, guc: g };
      cb.herkese({ tip: 'fis', no: p.no, guc: r2(g) });
    } else if (m.tip === 'patla') {
      p.fis = null;
      cb.herkese({ tip: 'patladi', no: p.no, ad: p.ad });
    }
  }
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  function cikis(id) {
    const p = o?.oyuncular.find(x => x.id === id);
    if (!p || p.cikti) return;
    p.cikti = true; p.fis = null;
    cb.herkese({ tip: 'cikti', no: p.no, ad: p.ad });
    if (!o.bitti && o.oyuncular.every(x => x.cikti)) durdur();
  }

  return { baslat, durdur, adim, girdi, cikis, DT, BR, get durum() { return o; } };
})();
if (typeof module !== 'undefined') module.exports = Motor;
