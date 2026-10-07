'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadAll } = require('../helpers/load.js');
const LF = loadAll();

const DAY = 86400000;
function make(startAt) {
  let clock = startAt || 1_700_000_000_000;
  const area = new LF.MemoryStorageArea();
  const vm = new LF.VocabularyManager({ storage: new LF.VocabularyStorage(area), now: () => clock });
  return { area, vm, advance: (ms) => { clock += ms; }, now: () => clock };
}
const ko = (lemma, extra) => Object.assign({ language: 'ko', word: lemma, lemma, meaning: 'nghĩa', sentence: '오늘 어디에 있었어요?', translation: 'Hôm nay bạn đã ở đâu?' }, extra);

test('add(): stores every field of the data model, due immediately', async () => {
  const { vm, now } = make();
  const { item, created } = await vm.add(ko('어디', { word: '어디에', meaning: 'đâu' }));
  assert.equal(created, true);
  assert.equal(item.id, 'ko:어디');
  for (const k of ['id', 'language', 'word', 'lemma', 'meaning', 'sentence', 'translation', 'createdAt', 'known', 'reviewCount', 'lastReviewed', 'nextReview', 'interval', 'ease']) assert.ok(k in item, 'missing ' + k);
  assert.deepEqual({ language: item.language, word: item.word, lemma: item.lemma, known: item.known, reviewCount: item.reviewCount, interval: item.interval, ease: item.ease, createdAt: item.createdAt, nextReview: item.nextReview },
    { language: 'ko', word: '어디에', lemma: '어디', known: false, reviewCount: 0, interval: 0, ease: 2.5, createdAt: now(), nextReview: now() });
});
test('add(): the same lemma is not duplicated; new forms and contexts are merged', async () => {
  const { vm } = make();
  await vm.add(ko('먹다', { word: '먹었어요', sentence: '밥 먹었어요.' }));
  const { item, created } = await vm.add(ko('먹다', { word: '먹어요', sentence: '지금 먹어요.' }));
  assert.equal(created, false);
  assert.deepEqual(item.forms, ['먹었어요', '먹어요']);
  assert.equal(item.contexts.length, 2);
  assert.equal((await vm.list({ language: 'ko' })).length, 1);
});
test('language is always stored: Korean and Japanese entries with the same text never collide', async () => {
  const { vm } = make();
  await vm.add({ language: 'ko', word: '시간', lemma: '시간', meaning: 'thời gian' });
  await vm.add({ language: 'ja', word: '時間', lemma: '時間', meaning: 'thời gian' });
  await vm.add({ language: 'ja', word: '시간', lemma: '시간', meaning: 'x' });
  assert.equal((await vm.list({ language: 'ko' })).length, 1);
  assert.equal((await vm.list({ language: 'ja' })).length, 2);
  assert.equal((await vm.list()).length, 3);
});
test('known words leave the review queue; saving a known word again restarts learning', async () => {
  const { vm } = make();
  const { item } = await vm.add(ko('사람'));
  assert.equal((await vm.getDue('ko')).length, 1);
  await vm.setKnown(item.id, true);
  assert.equal((await vm.getDue('ko')).length, 0);
  assert.equal((await vm.stats('ko')).known, 1);
  const again = await vm.add(ko('사람'));
  assert.equal(again.item.known, false);
  assert.equal((await vm.getDue('ko')).length, 1);
  const known = await vm.add(ko('집', { known: true }));
  assert.equal(known.item.known, true); // "I already know it" can be saved directly
});
test('review(): applies the scheduler and persists it', async () => {
  const { vm, advance, now } = make();
  const { item } = await vm.add(ko('가다'));
  let it = await vm.review(item.id, 'good');
  assert.deepEqual({ rc: it.reviewCount, iv: it.interval, next: it.nextReview, last: it.lastReviewed }, { rc: 1, iv: 1, next: now() + DAY, last: now() });
  assert.equal((await vm.getDue('ko')).length, 0);
  advance(DAY + 1000);
  assert.equal((await vm.getDue('ko')).length, 1);
  it = await vm.review(item.id, 'again');
  assert.equal(it.interval, 0); assert.ok(it.ease < 2.5);
  await assert.rejects(() => vm.review('ko:nope', 'good'), /Unknown vocabulary item/);
});
test('list(): filters by language, known flag, query; newest first; stats', async () => {
  const { vm, advance } = make();
  await vm.add(ko('하나', { meaning: 'một' })); advance(10);
  await vm.add(ko('둘', { meaning: 'hai' })); advance(10);
  const c = await vm.add(ko('셋', { meaning: 'ba' }));
  await vm.setKnown(c.item.id, true);
  assert.deepEqual((await vm.list({ language: 'ko' })).map((i) => i.lemma), ['셋', '둘', '하나']);
  assert.deepEqual((await vm.list({ language: 'ko', known: true })).map((i) => i.lemma), ['셋']);
  assert.deepEqual((await vm.list({ query: 'hai' })).map((i) => i.lemma), ['둘']);
  assert.deepEqual(await vm.stats('ko'), { total: 3, known: 1, learning: 2, due: 2, new: 2 });
});
test('remove(), update(), change events', async () => {
  const { vm } = make();
  const events = [];
  vm.on('change', (e) => events.push(e.type));
  const { item } = await vm.add(ko('물'));
  await vm.update(item.id, { meaning: 'nước', language: 'xx' }); // language/id are immutable
  assert.equal((await vm.get(item.id)).language, 'ko');
  await vm.remove(item.id);
  assert.equal(await vm.get(item.id), null);
  assert.deepEqual(events, ['add', 'update', 'remove']);
});
test('two contexts (popup + content script) saving different words at the same moment both persist', async () => {
  const { area } = make();
  const a = new LF.VocabularyManager({ storage: new LF.VocabularyStorage(area) });
  const b = new LF.VocabularyManager({ storage: new LF.VocabularyStorage(area) });
  await Promise.all([a.add(ko('가')), b.add(ko('나')), a.add(ko('다')), b.add(ko('라'))]);
  assert.equal((await a.list({ language: 'ko' })).length, 4);
});
test('export / import: JSON round-trip, CSV quoting, validation, no overwrite by default', async () => {
  const src = make();
  await src.vm.add(ko('어디', { meaning: 'đâu, ở đâu', sentence: 'Câu "có dấu ngoặc",\nxuống dòng' }));
  await src.vm.add({ language: 'ja', word: '時間', lemma: '時間', meaning: 'giờ' });
  const json = await src.vm.exportJSON('ko');
  const parsed = JSON.parse(json);
  assert.equal(parsed.app, 'LinguaFlow'); assert.equal(parsed.items.length, 1);
  const csv = await src.vm.exportCSV('ko');
  assert.match(csv.split('\n')[0], /^language,word,lemma,meaning/);
  assert.match(csv, /"đâu, ở đâu"/); assert.match(csv, /"Câu ""có dấu ngoặc"",\nxuống dòng"/);

  const dst = make();
  assert.deepEqual(await dst.vm.importJSON(json), { added: 1, skipped: 0, invalid: 0 });
  assert.deepEqual(await dst.vm.importJSON(json), { added: 0, skipped: 1, invalid: 0 });
  assert.deepEqual(await dst.vm.importJSON(json, { overwrite: true }), { added: 1, skipped: 0, invalid: 0 });
  assert.deepEqual(await dst.vm.importJSON({ items: [{ nope: 1 }, { language: 'ko' }, null] }), { added: 0, skipped: 0, invalid: 3 });
  await assert.rejects(() => dst.vm.importJSON('not json'), /valid JSON/);
  await assert.rejects(() => dst.vm.importJSON('{"a":1}'), /items/);
  const it = (await dst.vm.list({ language: 'ko' }))[0];
  assert.equal(it.ease, 2.5); assert.equal(it.lemma, '어디');
});
test('add() validates its input', async () => {
  const { vm } = make();
  await assert.rejects(() => vm.add({ lemma: 'x' }), /language/);
  await assert.rejects(() => vm.add(null), /language/);
});
test('storage: one key per item, ignores foreign keys, clear(language) is selective', async () => {
  const { area, vm } = make();
  await area.set({ unrelated: 1, 'lf:v1:settings': { a: 1 } });
  await vm.add(ko('가')); await vm.add({ language: 'ja', word: 'あ', lemma: 'あ' });
  assert.deepEqual(Object.keys(area.data).sort(), ['lf:v1:settings', 'lf:v1:vocab:ja:あ', 'lf:v1:vocab:ko:가', 'unrelated']);
  assert.equal(await vm.clear('ko'), 1);
  assert.deepEqual((await vm.list()).map((i) => i.language), ['ja']);
  assert.equal(area.data.unrelated, 1);
});
