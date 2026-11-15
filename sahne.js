// =============================================================
// Patlat Kaptan - 3D sahne: havada duran sarmal su kanalı, sütunlar, kayalar,
// girdaplar, kontrol noktası kemerleri, tekneler ve köpük efektleri.
// =============================================================

const Sahne = (() => {
  const P = Pist;
  let renderer, scene, camera, gunes, suMat, golMat;
  const kontrolKemerleri = [];
  const girdaplar = [];
  const TEKNE_RENK = [0xe8483a, 0x3a7ae8, 0x3ab85a, 0xf0c030];
  const TEKNE_AD = ['Kırmızı', 'Mavi', 'Yeşil', 'Sarı'];
  const TEKNE_EMOJI = ['🔴', '🔵', '🟢', '🟡'];

  function kur(kanvas) {
    renderer = new THREE.WebGLRenderer({ canvas: kanvas, antialias: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x8fd0ff);
    scene.fog = new THREE.Fog(0x8fd0ff, 90, 260);
    camera = new THREE.PerspectiveCamera(62, 1, 0.1, 600);
    camera.position.set(0, 30, 90);
    scene.add(new THREE.HemisphereLight(0xcfeaff, 0x5a8a3a, 0.9));
    gunes = new THREE.DirectionalLight(0xfff2d8, 1.6);
    gunes.position.set(30, 60, 20);
    gunes.castShadow = true;
    gunes.shadow.mapSize.set(1024, 1024);
    Object.assign(gunes.shadow.camera, { left: -25, right: 25, top: 25, bottom: -25, near: 1, far: 140 });
    scene.add(gunes, gunes.target);
    gokyuzu(); kanal(); nehir(); engeller(); salincaklar(); kemerler(); gol(); bulutlar();
    boyut(); addEventListener('resize', boyut);
  }
  function boyut() {
    const w = innerWidth, h = innerHeight;
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
  }

  function gokyuzu() {
    const g = new THREE.SphereGeometry(400, 24, 12), r = [], ust = new THREE.Color(0x4aa0ff), alt = new THREE.Color(0xd8f0ff), c = new THREE.Color();
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) { c.copy(alt).lerp(ust, Math.max(0, pos.getY(i) / 400)); r.push(c.r, c.g, c.b); }
    g.setAttribute('color', new THREE.Float32BufferAttribute(r, 3));
    scene.add(new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false })));
  }

  // ---------- Su dokusu (akan çizgiler) ----------
  function suDokusu() {
    const c = document.createElement('canvas'); c.width = 64; c.height = 256;
    const x = c.getContext('2d');
    x.fillStyle = '#fff'; x.fillRect(0, 0, 64, 256);
    for (let i = 0; i < 40; i++) {
      x.fillStyle = `rgba(150,200,235,${0.25 + Math.random() * 0.35})`;
      const px = Math.random() * 64, py = Math.random() * 256, h = 20 + Math.random() * 50;
      x.fillRect(px, py, 2 + Math.random() * 3, h); x.fillRect(px, py - 256, 2, h);
    }
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }

  // ---------- Nehir yüzeyi ----------
  function nehir() {
    const v = [], uv = [], renk = [], idx = [];
    const mavi = new THREE.Color(0x2f9fe0), kopuk = new THREE.Color(0xe8f8ff), c = new THREE.Color();
    P.P.forEach((p, i) => {
      [-1, 1].forEach(s => {
        v.push(p.x + p.nx * P.YARI * s, p.y, p.z + p.nz * P.YARI * s);
        uv.push(s < 0 ? 0 : 1, p.s / 7);
        c.copy(mavi).lerp(kopuk, Math.min(0.75, Math.max(0, p.egim) * 5)); renk.push(c.r, c.g, c.b);
      });
      if (i < P.N - 1) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }   // yüzü yukarı baksın
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(renk, 3));
    g.setIndex(idx); g.computeVertexNormals();
    suMat = new THREE.MeshStandardMaterial({ map: suDokusu(), vertexColors: true, roughness: 0.2, metalness: 0.05, transparent: true, opacity: 0.92 });
    const m = new THREE.Mesh(g, suMat); m.receiveShadow = true; scene.add(m);
  }

  // ---------- Kanal: havada duran taş su yolu + onu taşıyan sütunlar (dağ ve korkuluk yok) ----------
  function kanal() {
    const v = [], renk = [], idx = [];
    const tas = new THREE.Color(0xb8aa94), koyu = new THREE.Color(0x8a7c68), kenar = new THREE.Color(0xd8ccb4), c = new THREE.Color();
    // kesit: [dışarı mesafe, yükseklik farkı, renk] — üst kenar şeridi, yan, alt, yan, üst kenar
    const Y = P.YARI, K0 = 0.28;
    const kesit = [[-Y + 0.02, 0.04, kenar], [-Y - K0, 0.04, kenar], [-Y - K0, -0.9, koyu], [Y + K0, -0.9, koyu], [Y + K0, 0.04, kenar], [Y - 0.02, 0.04, kenar]];
    const KS = kesit.length;
    P.P.forEach((p, i) => {
      kesit.forEach(([d, h, r], j) => {
        v.push(p.x + p.nx * d, p.y + h, p.z + p.nz * d);
        c.copy(r).offsetHSL(0, 0, ((i * 7 + j * 3) % 5) * 0.012 - 0.024); renk.push(c.r, c.g, c.b);
      });
      if (i < P.N - 1) { const a = i * KS, b = (i + 1) * KS; for (let j = 0; j < KS - 1; j++) idx.push(a + j, b + j, a + j + 1, a + j + 1, b + j, b + j + 1); }
    });
    // uç kapakları
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(renk, 3));
    g.setIndex(idx); g.computeVertexNormals();
    const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, side: THREE.DoubleSide, flatShading: true }));
    m.receiveShadow = true; m.castShadow = true; scene.add(m);
    // Sütunlar: kanalı göle kadar taşır (aradaki katlara değmez, katlar 11 m aralıklı)
    const sm = new THREE.MeshStandardMaterial({ color: 0xa89a84, roughness: 0.95, flatShading: true });
    const sutunlar = [];
    for (let i = 6; i < P.N; i += 15) sutunlar.push(P.P[i]);
    const im = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.32, 0.5, 1, 8), sm, sutunlar.length);
    const ba = new THREE.InstancedMesh(new THREE.BoxGeometry(0.7, 0.3, P.YARI * 1.2), sm, sutunlar.length);
    const mt = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), e = new THREE.Euler();
    sutunlar.forEach((p, k) => {
      const ust = p.y - 0.9, boy = ust - P.GOL_Y;
      mt.compose(new THREE.Vector3(p.x, P.GOL_Y + boy / 2, p.z), q.identity(), sc.set(1, boy, 1)); im.setMatrixAt(k, mt);
      e.set(0, Math.atan2(p.tx, p.tz) + Math.PI / 2, 0); q.setFromEuler(e);
      mt.compose(new THREE.Vector3(p.x, ust - 0.15, p.z), q, sc.set(1, 1, 1)); ba.setMatrixAt(k, mt);
    });
    im.castShadow = ba.castShadow = true; im.receiveShadow = true;
    scene.add(im, ba);
    // Zirvede yuvarlak bir taş platform
    const son = P.P[P.N - 1];
    const plat = new THREE.Mesh(new THREE.CylinderGeometry(7, 6, 1.2, 20), new THREE.MeshStandardMaterial({ color: 0xc8bca4, roughness: 0.9, flatShading: true }));
    plat.position.set(son.x + son.tx * 5, son.y - 0.55, son.z + son.tz * 5); plat.receiveShadow = true; scene.add(plat);
    const ps = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.6, son.y - P.GOL_Y, 10), sm);
    ps.position.set(plat.position.x, (son.y + P.GOL_Y) / 2 - 0.6, plat.position.z); scene.add(ps);
    // Ortada, gölün içinde dev bir fasulye konservesi heykeli :)
    const sise = new THREE.Group();
    const teneke = new THREE.MeshStandardMaterial({ color: 0xc8ccd4, metalness: 0.7, roughness: 0.3 });
    const gv = new THREE.Mesh(new THREE.CylinderGeometry(5, 5, 14, 28), teneke); gv.position.y = 7; sise.add(gv);
    [0.4, 13.6].forEach(y => { const h = new THREE.Mesh(new THREE.TorusGeometry(5, 0.35, 8, 28), teneke); h.rotation.x = Math.PI / 2; h.position.y = y; sise.add(h); });
    const et = new THREE.Mesh(new THREE.CylinderGeometry(5.05, 5.05, 8, 28, 1, true), new THREE.MeshStandardMaterial({ map: yaziDokusu('FASULYE', '#e86a1a'), side: THREE.DoubleSide })); et.position.y = 7; sise.add(et);
    const kapak = new THREE.Mesh(new THREE.CylinderGeometry(5, 5, 0.3, 28), teneke); kapak.position.set(3.5, 15.5, 0); kapak.rotation.z = 0.6; sise.add(kapak);
    for (let k = 0; k < 9; k++) { const f = new THREE.Mesh(new THREE.SphereGeometry(0.9, 8, 6), new THREE.MeshStandardMaterial({ color: 0xc8501a })); const a = k * 0.7; f.position.set(Math.sin(a) * (1 + k * 0.35), 14.2 + (k % 3) * 0.5, Math.cos(a) * (1 + k * 0.35)); f.scale.set(1, 0.7, 1.4); sise.add(f); }
    sise.position.y = P.GOL_Y; scene.add(sise);
  }

  function engeller() {
    const km = new THREE.MeshStandardMaterial({ color: 0x8a8278, roughness: 1, flatShading: true });
    P.KAYALAR.forEach((k, j) => {
      const m = new THREE.Mesh(new THREE.DodecahedronGeometry(k.r * 1.05, 0), km);
      m.position.set(k.x, k.y + 0.15, k.z); m.rotation.set(j, j * 2, 0); m.scale.y = 0.8; m.castShadow = true; scene.add(m);
    });
    // Girdap: dönen sarmal disk
    const c = document.createElement('canvas'); c.width = c.height = 256;
    const x = c.getContext('2d');
    x.translate(128, 128);
    for (let k = 0; k < 4; k++) {
      x.rotate(Math.PI / 2); x.beginPath();
      for (let a = 0; a < 7; a += 0.1) { const r = 6 + a * 17; x.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
      x.strokeStyle = 'rgba(255,255,255,0.8)'; x.lineWidth = 9; x.stroke();
    }
    const t = new THREE.CanvasTexture(c);
    P.GIRDAPLAR.forEach(g => {
      const m = new THREE.Mesh(new THREE.CircleGeometry(g.r, 32), new THREE.MeshBasicMaterial({ map: t, transparent: true, opacity: 0.8, depthWrite: false }));
      m.rotation.x = -Math.PI / 2; m.position.set(g.x, g.y + 0.05, g.z); scene.add(m); girdaplar.push(m);
      const ic = new THREE.Mesh(new THREE.CircleGeometry(g.r * 0.35, 24), new THREE.MeshBasicMaterial({ color: 0x0a4a7a, transparent: true, opacity: 0.6, depthWrite: false }));
      ic.rotation.x = -Math.PI / 2; ic.position.set(g.x, g.y + 0.04, g.z); scene.add(ic);
    });
  }

  // 360° dönen kütük salıncakları: iki direk, enine dingil, iki kol ve ucunda kütük
  const salincakObj = [];
  function salincaklar() {
    const tahta = new THREE.MeshStandardMaterial({ color: 0x8a5a2a, roughness: 0.9 });
    const kabuk = new THREE.MeshStandardMaterial({ color: 0x6a4020, roughness: 1, flatShading: true });
    const demir = new THREE.MeshStandardMaterial({ color: 0x555a60, metalness: 0.6, roughness: 0.4 });
    P.SALINCAKLAR.forEach(S => {
      const g = new THREE.Group();
      g.position.set(S.x, S.y, S.z); g.rotation.y = Math.atan2(S.tx, S.tz);   // yerel z = ileri, yerel x = enine
      const yari = P.YARI + 0.15;
      [-1, 1].forEach(s => {
        const d = new THREE.Mesh(new THREE.BoxGeometry(0.35, S.dy + 0.4, 0.35), tahta); d.position.set(s * yari, (S.dy + 0.4) / 2, 0); d.castShadow = true; g.add(d);
        const ay = new THREE.Mesh(new THREE.BoxGeometry(0.25, S.dy * 0.9, 0.25), tahta); ay.position.set(s * yari, S.dy * 0.45, -0.9); ay.rotation.x = -0.2; g.add(ay);
        const ay2 = ay.clone(); ay2.position.z = 0.9; ay2.rotation.x = 0.2; g.add(ay2);
      });
      const dingil = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, yari * 2 + 0.5, 10), demir); dingil.rotation.z = Math.PI / 2; dingil.position.y = S.dy; g.add(dingil);
      const don = new THREE.Group(); don.position.y = S.dy; g.add(don);
      const kolX = P.YARI - 0.6;
      [-1, 1].forEach(s => { const k = new THREE.Mesh(new THREE.BoxGeometry(0.18, S.kol, 0.18), demir); k.position.set(s * kolX, -S.kol / 2, 0); don.add(k); });
      const kutuk = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, kolX * 2 + 0.6, 12), kabuk); kutuk.rotation.z = Math.PI / 2; kutuk.position.y = -S.kol; kutuk.castShadow = true; don.add(kutuk);
      [-1, 1].forEach(s => { const u = new THREE.Mesh(new THREE.CircleGeometry(0.42, 12), new THREE.MeshStandardMaterial({ color: 0xd8b07a })); u.position.set(s * (kolX + 0.31), -S.kol, 0); u.rotation.y = s * Math.PI / 2; don.add(u); });
      scene.add(g); salincakObj.push(don);
    });
  }
  function salincakGuncelle(zt) {
    P.SALINCAKLAR.forEach((S, k) => { const d = salincakObj[k]; if (d) d.rotation.x = -(S.faz + S.w * zt); });
  }

  function yaziDokusu(yazi, arka, on = '#fff') {
    const c = document.createElement('canvas'); c.width = 256; c.height = 64;
    const x = c.getContext('2d');
    if (arka === 'dama') { for (let i = 0; i < 16; i++) for (let j = 0; j < 4; j++) { x.fillStyle = (i + j) % 2 ? '#111' : '#fff'; x.fillRect(i * 16, j * 16, 16, 16); } }
    else { x.fillStyle = arka; x.fillRect(0, 0, 256, 64); }
    x.font = '900 40px Nunito, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.lineWidth = 6; x.strokeStyle = '#0008'; x.strokeText(yazi, 128, 34); x.fillStyle = on; x.fillText(yazi, 128, 34);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  }
  function kemer(i, yazi, arka) {
    const p = P.P[i], g = new THREE.Group();
    const dm = new THREE.MeshStandardMaterial({ color: 0xffffff });
    [-1, 1].forEach(s => { const d = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 4.6, 8), dm); d.position.set(s * (P.YARI + 0.14), 2.3, 0); d.castShadow = true; g.add(d); });
    const bayrakMat = new THREE.MeshStandardMaterial({ map: yaziDokusu(yazi, arka), side: THREE.DoubleSide });
    const b = new THREE.Mesh(new THREE.PlaneGeometry(P.YARI * 2 + 0.6, 1.3), bayrakMat); b.position.y = 4.1; g.add(b);
    g.position.set(p.x, p.y, p.z); g.rotation.y = Math.atan2(p.tx, p.tz);
    scene.add(g);
    return { g, b, bayrakMat };
  }
  function kemerler() {
    P.KONTROL.forEach((i, c) => kontrolKemerleri.push(kemer(i, `KONTROL ${c + 1}`, '#5a6a7a')));
    kemer(P.BITIS, '🏁 ZİRVE 🏁', 'dama');
    // Zirvede büyük bayrak
    const p = P.P[P.N - 1];
    const direk = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 7, 8), new THREE.MeshStandardMaterial({ color: 0xdddddd }));
    direk.position.set(p.x + p.tx * 5, p.y + 3.5, p.z + p.tz * 5); scene.add(direk);
    const bz = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.6), new THREE.MeshStandardMaterial({ map: yaziDokusu('💨', '#6a9a1a'), side: THREE.DoubleSide }));
    bz.position.set(direk.position.x + 1.3, p.y + 6.1, direk.position.z); scene.add(bz);
    // Başlangıç iskelesi
    const s = P.P[0];
    const iskele = new THREE.Mesh(new THREE.BoxGeometry(P.YARI * 2 + 2, 0.9, 3), new THREE.MeshStandardMaterial({ color: 0x9a6a3a }));
    iskele.position.set(s.x - s.tx * 1.6, s.y - 0.1, s.z - s.tz * 1.6); iskele.rotation.y = Math.atan2(s.tx, s.tz); scene.add(iskele);
    const isu = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.7, s.y - P.GOL_Y, 8), new THREE.MeshStandardMaterial({ color: 0x6a4a2a })); isu.position.set(iskele.position.x, (s.y + P.GOL_Y) / 2 - 0.5, iskele.position.z); scene.add(isu);
    const son = P.P[P.N - 1];
    const sur = new THREE.Mesh(new THREE.BoxGeometry(P.YARI * 2 + 0.6, 0.6, 0.5), new THREE.MeshStandardMaterial({ color: 0x8a7a64 }));
    sur.position.set(son.x + son.tx * 0.3, son.y + 0.1, son.z + son.tz * 0.3); sur.rotation.y = Math.atan2(son.tx, son.tz); scene.add(sur);
  }
  function kontrolBoya(c, gecildi) {
    const k = kontrolKemerleri[c]; if (!k) return;
    k.bayrakMat.map = yaziDokusu(gecildi ? `✔ KONTROL ${c + 1}` : `KONTROL ${c + 1}`, gecildi ? '#2a9a4a' : '#5a6a7a');
    k.bayrakMat.needsUpdate = true;
  }

  function gol() {
    golMat = new THREE.MeshStandardMaterial({ color: 0x2a8ad0, roughness: 0.25, transparent: true, opacity: 0.95 });
    const g = new THREE.Mesh(new THREE.CircleGeometry(380, 48), golMat);
    g.rotation.x = -Math.PI / 2; g.position.y = P.GOL_Y; g.receiveShadow = true; scene.add(g);
    // Uzakta adacıklar
    const am = new THREE.MeshStandardMaterial({ color: 0x5aa04a, flatShading: true });
    for (let k = 0; k < 14; k++) {
      const a = k / 14 * Math.PI * 2 + 0.3, r = 120 + (k % 4) * 30;
      const m = new THREE.Mesh(new THREE.ConeGeometry(10 + (k % 3) * 6, 14 + (k % 5) * 5, 7), am);
      m.position.set(Math.sin(a) * r, P.GOL_Y + 4, Math.cos(a) * r); scene.add(m);
    }
  }
  function bulutlar() {
    const bm = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, transparent: true, opacity: 0.92 });
    for (let k = 0; k < 12; k++) {
      const g = new THREE.Group(), a = k * 0.53, r = 80 + (k % 4) * 35;
      for (let j = 0; j < 4; j++) { const m = new THREE.Mesh(new THREE.SphereGeometry(4 + (j % 2) * 2, 10, 8), bm); m.position.set(j * 4.5 - 7, (j % 2) * 1.5, 0); g.add(m); }
      g.position.set(Math.sin(a) * r, 45 + (k % 3) * 9, Math.cos(a) * r); g.rotation.y = a; scene.add(g);
    }
  }

  // ---------- Tekne ----------
  function tekneYap(no) {
    const g = new THREE.Group(), ic = new THREE.Group(); g.add(ic);
    const R = Motor.BR;
    const tahta = new THREE.MeshStandardMaterial({ color: 0xb07a40, roughness: 0.85 });
    const renk = new THREE.MeshStandardMaterial({ color: TEKNE_RENK[no] });
    const yan = new THREE.Mesh(new THREE.CylinderGeometry(R, R * 0.8, 1.0, 24, 1, true), tahta); yan.position.y = 0.1; yan.castShadow = true; ic.add(yan);
    const yanIc = new THREE.Mesh(new THREE.CylinderGeometry(R - 0.06, R * 0.8 - 0.06, 1.0, 24, 1, true), new THREE.MeshStandardMaterial({ color: 0x8a5a2a, side: THREE.BackSide })); yanIc.position.y = 0.1; ic.add(yanIc);
    const taban = new THREE.Mesh(new THREE.CircleGeometry(R - 0.1, 24), new THREE.MeshStandardMaterial({ color: 0xc89058 })); taban.rotation.x = -Math.PI / 2; taban.position.y = 0.24; taban.receiveShadow = true; taban.castShadow = true; ic.add(taban);
    const kenar = new THREE.Mesh(new THREE.TorusGeometry(R, 0.12, 8, 28), renk); kenar.rotation.x = Math.PI / 2; kenar.position.y = 0.6; kenar.castShadow = true; ic.add(kenar);
    // Tahta çizgileri
    for (let k = 0; k < 12; k++) { const c = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.72, 0.02), new THREE.MeshStandardMaterial({ color: 0x7a4a1a })); const a = k / 12 * Math.PI * 2; c.position.set(Math.sin(a) * (R * 0.91), 0.1, Math.cos(a) * (R * 0.91)); c.rotation.y = a; ic.add(c); }
    // Arkada küçük bayrak
    const direk = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.3, 6), new THREE.MeshStandardMaterial({ color: 0xeeeeee })); direk.position.set(0, 1.2, R - 0.08); ic.add(direk);
    const bayrak = new THREE.Mesh(new THREE.PlaneGeometry(0.45, 0.3), new THREE.MeshStandardMaterial({ color: TEKNE_RENK[no], side: THREE.DoubleSide })); bayrak.position.set(0.24, 1.7, R - 0.08); ic.add(bayrak);
    // Önde gözler (tekne yüzü :)
    [-1, 1].forEach(s => { const gz = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), new THREE.MeshStandardMaterial({ color: 0xffffff })); gz.position.set(0.35 * s, 0.32, R * 0.98); gz.scale.z = 0.4; ic.add(gz); const b = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), new THREE.MeshStandardMaterial({ color: 0x111111 })); b.position.set(0.35 * s, 0.32, R * 0.98 + 0.06); ic.add(b); });
    g.userData = { ic, bayrak };
    scene.add(g);
    return g;
  }

  // ---------- Efektler: köpük, sıçrama, patlama ----------
  const HAVUZ = 600;
  const kopukGeo = new THREE.SphereGeometry(1, 6, 5);
  let kopukMesh = null; const kopukler = [];
  const parcalar = [];
  function kopukHazirla() {
    kopukMesh = new THREE.InstancedMesh(kopukGeo, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6, transparent: true, opacity: 0.9 }), HAVUZ);
    kopukMesh.frustumCulled = false; kopukMesh.count = 0; scene.add(kopukMesh);
  }
  function kopukAt(x, y, z, vx, vy, vz, boy = 0.18, omur = 0.9, suruk = 1.5, buyu = 1.5, zemin = -1e9) {
    if (!kopukMesh) kopukHazirla();
    if (kopukler.length >= HAVUZ) kopukler.shift();
    kopukler.push({ x, y, z, vx, vy, vz, boy, t: 0, omur, suruk, buyu, zemin });
  }
  // Osuruk bulutu: yeşilimsi, yavaş, şişerek dağılır. (dx,dz) gazın gittiği yön
  const HAVUZ_GAZ = 400; let gazMesh = null; const gazlar = [];
  function osuruk(x, y, z, dx, dz) {
    if (!gazMesh) { gazMesh = new THREE.InstancedMesh(kopukGeo, new THREE.MeshStandardMaterial({ color: 0xa8c84a, roughness: 1, transparent: true, opacity: 0.45, depthWrite: false }), HAVUZ_GAZ); gazMesh.frustumCulled = false; gazMesh.count = 0; scene.add(gazMesh); }
    for (let k = 0; k < 2; k++) {
      if (gazlar.length >= HAVUZ_GAZ) gazlar.shift();
      const h = 2.2 + Math.random() * 1.8;
      gazlar.push({ x: x + (Math.random() - 0.5) * 0.15, y, z: z + (Math.random() - 0.5) * 0.15, vx: dx * h + (Math.random() - 0.5) * 1.2, vy: 0.1 + Math.random() * 0.6, vz: dz * h + (Math.random() - 0.5) * 1.2, boy: 0.1 + Math.random() * 0.08, t: 0, omur: 0.6 + Math.random() * 0.4 });
    }
  }
  function gazAdim(dt) {
    if (!gazMesh) return;
    let n = 0;
    for (let k = gazlar.length - 1; k >= 0; k--) {
      const f = gazlar[k]; f.t += dt;
      if (f.t > f.omur) { gazlar.splice(k, 1); continue; }
      f.vx *= 1 - dt * 2.2; f.vz *= 1 - dt * 2.2; f.vy += dt * 0.3;
      f.x += f.vx * dt; f.y += f.vy * dt; f.z += f.vz * dt;
      const b = f.boy * (1 + f.t * 2) * (1 - Math.pow(f.t / f.omur, 4));
      _m.compose(_p.set(f.x, f.y, f.z), _q, _s.set(b, b, b)); gazMesh.setMatrixAt(n++, _m);
    }
    gazMesh.count = n; gazMesh.instanceMatrix.needsUpdate = true;
  }
  function fiskir(x, y, z, dx, dz, guc) {
    const n = 3 + Math.round(guc * 5);
    for (let k = 0; k < n; k++) {
      const h = 4 + guc * 5 + Math.random() * 2, yay = 0.9 + guc * 0.8, b = Math.random() * 0.3;
      kopukAt(x + dx * b, y, z + dz * b, dx * h + (Math.random() - 0.5) * yay, -1 - Math.random() * 2.5, dz * h + (Math.random() - 0.5) * yay, 0.06 + Math.random() * 0.08 + guc * 0.05, 1.0 + Math.random() * 0.6, 0.6, 2.2, y - 0.55);
    }
  }
  function sicrama(x, y, z, buyuk = 1) {
    for (let k = 0; k < 14 * buyuk; k++) { const a = Math.random() * Math.PI * 2, h = 1.5 + Math.random() * 3 * buyuk; kopukAt(x, y + 0.1, z, Math.cos(a) * h, 3 + Math.random() * 4 * buyuk, Math.sin(a) * h, 0.08 + Math.random() * 0.1, 0.9, 1.5, 1.2); }
    halka(x, y + 0.05, z, buyuk);
  }
  function patlama(x, y, z) {
    for (let k = 0; k < 34; k++) { const a = Math.random() * Math.PI * 2, h = 2 + Math.random() * 5; kopukAt(x, y, z, Math.cos(a) * h, 2 + Math.random() * 6, Math.sin(a) * h, 0.07 + Math.random() * 0.1, 1.1, 1.2, 1.2); }
    const cm = new THREE.MeshStandardMaterial({ color: 0x2fae5a, transparent: true, opacity: 0.85 });
    for (let k = 0; k < 10; k++) {
      const m = new THREE.Mesh(new THREE.TetrahedronGeometry(0.08 + Math.random() * 0.08), cm); m.position.set(x, y, z); scene.add(m);
      const a = Math.random() * Math.PI * 2, h = 3 + Math.random() * 3;
      parcalar.push({ m, vx: Math.cos(a) * h, vy: 3 + Math.random() * 4, vz: Math.sin(a) * h, t: 0 });
    }
  }
  function halka(x, y, z, buyuk = 1) {
    const m = new THREE.Mesh(new THREE.RingGeometry(0.6, 0.9, 24), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8, depthWrite: false }));
    m.rotation.x = -Math.PI / 2; m.position.set(x, y, z); scene.add(m);
    parcalar.push({ m, halka: true, t: 0, buyuk });
  }
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _p = new THREE.Vector3();
  function efektAdim(dt) {
    if (kopukMesh) {
      let n = 0;
      for (let k = kopukler.length - 1; k >= 0; k--) {
        const f = kopukler[k]; f.t += dt;
        if (f.t > f.omur) { kopukler.splice(k, 1); continue; }
        f.vy -= 9 * dt; f.vx *= 1 - dt * f.suruk; f.vz *= 1 - dt * f.suruk;
        f.x += f.vx * dt; f.y += f.vy * dt; f.z += f.vz * dt;
        if (f.y < f.zemin) { f.y = f.zemin; f.vy = 0; f.vx *= 0.9; f.vz *= 0.9; f.suruk = 2.5; }
        const b = f.boy * (1 + f.t * f.buyu) * (1 - Math.pow(f.t / f.omur, 3));
        _m.compose(_p.set(f.x, f.y, f.z), _q, _s.set(b, b, b)); kopukMesh.setMatrixAt(n++, _m);
      }
      kopukMesh.count = n; kopukMesh.instanceMatrix.needsUpdate = true;
    }
    for (let k = parcalar.length - 1; k >= 0; k--) {
      const e = parcalar[k]; e.t += dt;
      if (e.halka) { const s = 1 + e.t * 5 * e.buyuk; e.m.scale.set(s, s, s); e.m.material.opacity = Math.max(0, 0.8 - e.t * 1.2); if (e.t > 0.7) { scene.remove(e.m); parcalar.splice(k, 1); } continue; }
      e.vy -= 12 * dt; e.m.position.x += e.vx * dt; e.m.position.y += e.vy * dt; e.m.position.z += e.vz * dt; e.m.rotation.x += dt * 8;
      if (e.t > 1.5) { scene.remove(e.m); parcalar.splice(k, 1); }
    }
  }

  let zaman = 0;
  function ciz(dt, hedef) {
    zaman += dt;
    if (suMat) suMat.map.offset.y = zaman * 0.35;
    girdaplar.forEach(g => { g.rotation.z = zaman * 2.5; });
    if (hedef) { gunes.position.set(hedef.x + 25, hedef.y + 45, hedef.z + 15); gunes.target.position.set(hedef.x, hedef.y, hedef.z); }
    efektAdim(dt); gazAdim(dt);
    renderer.render(scene, camera);
  }

  return {
    kur, ciz, tekneYap, kontrolBoya, fiskir, osuruk, sicrama, patlama, halka, kopukAt, salincakGuncelle,
    TEKNE_RENK, TEKNE_AD, TEKNE_EMOJI,
    get scene() { return scene; }, get camera() { return camera; },
  };
})();
