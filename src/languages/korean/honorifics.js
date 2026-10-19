/* Korean honorific (존댓말) and humble (겸양어) vocabulary: words that REPLACE the plain word instead of adding -(으)시-.
 * Used to annotate analyses ("드시다 = kính ngữ của 먹다") and by the grammar reference. Data only; no logic about
 * conjugation lives here (conjugation.js knows the few lexical honorific verbs that contract: 드세요, 계세요 ...). */
(function (root) {
  'use strict';
  const LF = root.LinguaFlow || (root.LinguaFlow = {});
  const K = LF.Korean || (LF.Korean = {});

  // type: hon = honorific (nâng người được nói tới)   hum = humble (hạ mình)
  // [honorific/humble form, plain form, type, plain meaning (vi)]
  const RAW = [
    ['드시다', '먹다', 'hon', 'ăn; uống'], ['잡수시다', '먹다', 'hon', 'ăn'], ['잡수다', '먹다', 'hon', 'ăn'],
    ['주무시다', '자다', 'hon', 'ngủ'], ['계시다', '있다', 'hon', 'ở; có mặt (người)'],
    ['편찮으시다', '아프다', 'hon', 'ốm; đau'], ['돌아가시다', '죽다', 'hon', 'mất; qua đời'],
    ['말씀하시다', '말하다', 'hon', 'nói'], ['말씀', '말', 'hon', 'lời nói'], ['진지', '밥', 'hon', 'cơm; bữa ăn'],
    ['연세', '나이', 'hon', 'tuổi'], ['성함', '이름', 'hon', 'tên'], ['댁', '집', 'hon', 'nhà'], ['생신', '생일', 'hon', 'sinh nhật'],
    ['약주', '술', 'hon', 'rượu'], ['분', '사람', 'hon', 'người'], ['따님', '딸', 'hon', 'con gái (của người khác)'],
    ['아드님', '아들', 'hon', 'con trai (của người khác)'], ['춘추', '나이', 'hon', 'tuổi (rất trang trọng)'],
    ['께서', '이/가', 'hon', 'trợ từ chủ ngữ'], ['께', '에게', 'hon', 'trợ từ “cho / đối với”'],
    ['드리다', '주다', 'hum', 'cho; đưa'], ['올리다', '주다', 'hum', 'dâng; gửi'], ['바치다', '주다', 'hum', 'dâng'],
    ['여쭈다', '묻다', 'hum', 'hỏi'], ['여쭙다', '묻다', 'hum', 'hỏi'], ['뵙다', '보다', 'hum', 'gặp'], ['뵈다', '보다', 'hum', 'gặp'],
    ['모시다', '데리다', 'hum', 'đưa / đón (người đáng kính)'], ['말씀드리다', '말하다', 'hum', 'nói (với người đáng kính)'],
    ['아뢰다', '말하다', 'hum', 'thưa; tâu'], ['찾아뵙다', '찾아가다', 'hum', 'đến thăm'], ['저', '나', 'hum', 'tôi'], ['저희', '우리', 'hum', 'chúng tôi'],
    ['소인', '나', 'hum', 'tiểu nhân (tôi, kiểu cổ)'], ['소생', '나', 'hum', 'tôi (kiểu cổ)'], ['소녀', '나', 'hum', 'thiếp / cháu (kiểu cổ)'],
    ['제', '내', 'hum', 'của tôi'], ['졸저', '내 책', 'hum', 'tác phẩm kém cỏi của tôi'], ['변변찮다', '변변하지 않다', 'hum', 'tầm thường'],
    ['사료', '', 'hum', ''],
  ].filter((r) => r[1]);

  const LEX = new Map();
  for (const [form, plain, type, meaning] of RAW) LEX.set(form, { form, plain, type, meaning });

  /** Note (vi) for a lemma / headword, or '' when it is not a lexical honorific / humble form. */
  function note(lemma) {
    const x = LEX.get(lemma);
    if (!x) return '';
    return (x.type === 'hon' ? 'kính ngữ của ' : 'khiêm nhường ngữ của ') + x.plain;
  }

  K.Honorifics = { LEX, note, RAW };
  if (typeof module !== 'undefined' && module.exports) module.exports = K.Honorifics;
})(typeof globalThis !== 'undefined' ? globalThis : this);
