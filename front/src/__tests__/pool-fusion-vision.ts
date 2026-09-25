import assert from 'node:assert';
import { auditCarVisuals, auditSingleCarImage } from '../lib/vision-auditor';
import type { CarResult } from '../types';

async function testPoolFusionLogic() {
  console.log('Testing Pool Fusion & Deduplication logic...');

  const rawAgentCars = [
    { title: 'SEAT León 1.9 TDI', price: 2750, url: 'https://www.coches.net/seat-leon-1', source: 'coches_net' },
    { title: 'SEAT Ibiza 1.9 TDI', price: 1490, url: 'https://www.coches.net/seat-ibiza-1', source: 'coches_net' },
    { title: 'Ford Focus 1.8 TDCI', price: 2200, url: 'https://www.milanuncios.com/ford-focus-1.htm', source: 'milanuncios' },
  ];

  const rawScrapeCars = [
    // Duplicate of León from different query param
    { title: 'SEAT León 1.9 TDI', price: 2750, url: 'https://www.coches.net/seat-leon-1?tracking=123', source: 'coches.net' },
    // Distinct cars from AutoScout24 and Wallapop
    { title: 'Volkswagen Golf 1.9 TDI', price: 2800, url: 'https://www.autoscout24.es/anuncios/vw-golf-1', source: 'autoscout24' },
    { title: 'Renault Megane 1.5 dCi', price: 1900, url: 'https://es.wallapop.com/item/renault-megane-1', source: 'wallapop' },
    { title: 'Skoda Fabia 1.9 SDI', price: 1600, url: 'https://www.autoscout24.es/anuncios/skoda-fabia-1', source: 'autoscout24' },
  ];

  const allRawCars = [...rawAgentCars, ...rawScrapeCars];
  const seenKeys = new Set<string>();
  const dedupedCars: Record<string, unknown>[] = [];

  for (const car of allRawCars) {
    const rawUrl = String(car.url || '').trim().toLowerCase();
    const rawTitle = String(car.title || '').trim().toLowerCase().replace(/\s+/g, ' ');
    const price = Number(car.price) || 0;

    let key = '';
    if (rawUrl && rawUrl.startsWith('http')) {
      try {
        const parsedUrl = new URL(rawUrl);
        key = parsedUrl.origin + parsedUrl.pathname;
      } catch {
        key = rawUrl;
      }
    }
    if (!key) {
      key = `${rawTitle}_${price}`;
    }

    if (!seenKeys.has(key)) {
      seenKeys.add(key);
      dedupedCars.push(car);
    }
  }

  // Deduplication check: León should appear once
  assert.strictEqual(dedupedCars.length, 6, `Expected 6 deduped cars, got ${dedupedCars.length}`);

  // Group by source and balance
  const bySource: Record<string, Record<string, unknown>[]> = {};
  for (const c of dedupedCars) {
    const src = String(c.source || 'other').toLowerCase().replace('_', '.');
    if (!bySource[src]) bySource[src] = [];
    bySource[src].push(c);
  }

  assert.strictEqual(Object.keys(bySource).length, 4, `Expected 4 distinct sources, got ${Object.keys(bySource).length}`);

  const balancedPool: Record<string, unknown>[] = [];
  const maxSourceLen = Math.max(...Object.values(bySource).map((arr) => arr.length), 0);
  for (let i = 0; i < maxSourceLen; i++) {
    for (const src of Object.keys(bySource)) {
      if (i < bySource[src].length) {
        balancedPool.push(bySource[src][i]);
      }
    }
  }

  assert.strictEqual(balancedPool.length, 6);
  // First 4 items in balanced pool should each be from a different source
  const firstFourSources = new Set(balancedPool.slice(0, 4).map((c) => String(c.source).replace('_', '.')));
  assert.strictEqual(firstFourSources.size, 4, 'Top 4 items should represent 4 distinct platforms');
  console.log('✓ Pool Fusion & Deduplication verified successfully!');
}

async function testVideoFallbackLogic() {
  console.log('Testing Video / Multi-Image Fallback in Vision Auditor...');

  // Video URL should be rejected upfront by auditSingleCarImage
  const videoResult = await auditSingleCarImage(
    'https://example.com/cars/video_preview.mp4',
    'SEAT Ibiza Video Test'
  );
  assert.strictEqual(videoResult, null, 'Video URL should be rejected immediately without making network calls');

  // Car with video as image_url, but real image in images gallery
  const carWithVideo: CarResult = {
    title: 'SEAT Ibiza 1.9 TDI RockRoll Sport',
    price: 2999,
    year: 2009,
    km: 180000,
    fuel: 'Diésel',
    source: 'coches.net',
    url: 'https://www.coches.net/seat-ibiza-1',
    image_url: 'https://example.com/video_player.mp4',
    // 2nd image is an invalid or dummy http image, won't crash
    images: [
      'https://example.com/video_player.mp4',
      'https://a.ccdn.es/cnet/vehicles/20812387/real_car_photo.jpg'
    ],
    score: 87,
  };

  // Run auditCarVisuals: it should gracefully handle candidate images without throwing
  const audited = await auditCarVisuals([carWithVideo], {
    targetCount: 1,
    userQuery: 'SEAT Ibiza blanco negro o rojo'
  });

  assert.strictEqual(audited.length, 1);
  assert.strictEqual(audited[0].title, carWithVideo.title);
  console.log('✓ Video / Multi-image fallback gracefully processed without crashes!');
}

async function runAll() {
  await testPoolFusionLogic();
  await testVideoFallbackLogic();
  console.log('All tests passed successfully!');
}

runAll().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
