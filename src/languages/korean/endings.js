/* Korean verb/adjective endings (어미) as data. The conjugation engine (conjugation.js) knows how each
 * `mode` attaches to a stem; morphology.js verifies candidate analyses by regenerating the surface.
 *
 * mode:  c  plain, consonant-initial ending      (고, 지만, 네요 ...)
 *        u  (으)-class ending                     (면, 니까, ㄴ, ㄹ, 세요 ...)
 *        a  아/어-class ending (vowel harmony)    (요, 서, 도 ... text = what follows 아/어)
 *        f  two explicit forms v|c                (ㅂ니다|습니다, ㄴ다|는다)
 * opts:  strong    - evidence strong enough to accept an unknown stem
 *        bare      - when the chain has no tense marker, only valid for this POS ('v' | 'adj')
 *        needsBare - invalid when a tense marker (았/었/겠) is present
 *        yo        - also generate a "+요" polite variant
 */
(function (root) {
  'use strict';
  const LF = root.LinguaFlow || (root.LinguaFlow = {});
  const K = LF.Korean || (LF.Korean = {});

  const E = (id, mode, text, kind, label, compose, opts) =>
    Object.assign({ id, mode, text, kind, label, compose: compose || {}, type: 'ending' }, opts || {});

  const BASE = [
    // ---- sentence-final -----------------------------------------------------------------------------
    E('-아/어', 'a', '', 'final', 'đuôi câu thân mật (nói với bạn bè / người nhỏ tuổi) hoặc dạng nối', { style: 'thân mật' }),
    E('-아요/어요', 'a', '요', 'final', 'đuôi câu lịch sự, thân mật', { style: 'lịch sự' }, { strong: true }),
    E('-ㅂ니다/습니다', 'f', 'ㅂ니다|습니다', 'final', 'đuôi câu lịch sự, trang trọng', { style: 'lịch sự, trang trọng' }, { strong: true }),
    E('-ㅂ니까/습니까', 'f', 'ㅂ니까|습니까', 'final', 'đuôi câu hỏi lịch sự, trang trọng', { style: 'câu hỏi, trang trọng' }, { strong: true }),
    E('-다', 'c', '다', 'final', 'đuôi câu trần thuật (dạng từ điển / văn viết)', { style: 'văn viết' }),
    E('-ㄴ다/는다', 'f', 'ㄴ다|는다', 'final', 'đuôi câu trần thuật hiện tại (văn viết / thân mật)', { style: 'văn viết' }, { bare: 'v' }),
    E('-지요', 'c', '지요', 'final', 'đuôi câu “nhỉ / đúng không / dĩ nhiên” (lịch sự)', { style: 'lịch sự' }, { strong: true }),
    E('-죠', 'c', '죠', 'final', 'đuôi câu “nhỉ / đúng không / dĩ nhiên” (lịch sự, rút gọn của -지요)', { style: 'lịch sự' }, { strong: true }),
    E('-지', 'c', '지', 'final', 'đuôi câu “nhỉ / chứ” (thân mật)', { style: 'thân mật' }),
    E('-(으)세요', 'u', '세요', 'final', 'đuôi câu lịch sự, kính ngữ (đề nghị / hỏi / nói)', { style: 'kính ngữ, lịch sự' }, { strong: true }),
    E('-(으)십시오', 'u', '십시오', 'final', 'mệnh lệnh / đề nghị trang trọng, kính ngữ', { style: 'trang trọng, kính ngữ' }, { strong: true }),
    E('-(으)ㅂ시다', 'u', 'ㅂ시다', 'final', 'đề nghị “chúng ta hãy…” (trang trọng)', { style: 'đề nghị' }, { strong: true }),
    E('-자', 'c', '자', 'final', 'đề nghị “hãy cùng … nào” (thân mật)', { style: 'đề nghị, thân mật' }),
    E('-아라/어라', 'a', '라', 'final', 'mệnh lệnh thân mật', { style: 'mệnh lệnh' }),
    E('-(으)ㄹ까요', 'u', 'ㄹ까요', 'final', 'hỏi ý / phỏng đoán “…nhé? / liệu … không?”', { style: 'lịch sự, đề nghị' }, { strong: true }),
    E('-(으)ㄹ까', 'u', 'ㄹ까', 'final', 'hỏi ý / tự hỏi “…nhé? / liệu … không?”', { style: 'thân mật' }),
    E('-(으)ㄹ게요', 'u', 'ㄹ게요', 'final', 'hứa / quyết định “tôi sẽ …”', { pre: 'sẽ', style: 'lịch sự' }, { strong: true }),
    E('-(으)ㄹ게', 'u', 'ㄹ게', 'final', 'hứa / quyết định “tôi sẽ …”', { pre: 'sẽ', style: 'thân mật' }),
    E('-(으)ㄹ래요', 'u', 'ㄹ래요', 'final', 'ý định / hỏi ý “muốn … / … nhé?”', { pre: 'muốn', style: 'lịch sự' }, { strong: true }),
    E('-(으)ㄹ래', 'u', 'ㄹ래', 'final', 'ý định / hỏi ý “muốn … / … nhé?”', { pre: 'muốn', style: 'thân mật' }),
    E('-(으)ㄹ걸요', 'u', 'ㄹ걸요', 'final', 'phỏng đoán “chắc là … đấy”', { pre: 'chắc là', style: 'lịch sự' }),
    E('-(으)ㄹ걸', 'u', 'ㄹ걸', 'final', 'phỏng đoán “chắc là … đấy” / tiếc nuối', { pre: 'chắc là', style: 'thân mật' }),
    E('-네요', 'c', '네요', 'final', 'nhận ra điều mới “ra là … nhỉ” (lịch sự)', { style: 'lịch sự' }, { strong: true }),
    E('-네', 'c', '네', 'final', 'nhận ra điều mới “ra là … nhỉ” (thân mật)', { style: 'thân mật' }),
    E('-군요', 'c', '군요', 'final', 'thốt lên khi nhận ra “thì ra … (lịch sự)”', { style: 'lịch sự' }, { strong: true }),
    E('-군', 'c', '군', 'final', 'thốt lên khi nhận ra “thì ra …”', { style: 'thân mật' }),
    E('-는군요', 'c', '는군요', 'final', 'thốt lên khi nhận ra “thì ra … (lịch sự)”', { style: 'lịch sự' }, { strong: true, bare: 'v' }),
    E('-는구나', 'c', '는구나', 'final', 'thốt lên khi nhận ra “thì ra …”', { style: 'thân mật' }, { bare: 'v' }),
    E('-구나', 'c', '구나', 'final', 'thốt lên khi nhận ra “thì ra …”', { style: 'thân mật' }),
    E('-거든요', 'c', '거든요', 'final', 'giải thích “vì … mà”', { style: 'lịch sự' }, { strong: true }),
    E('-거든', 'c', '거든', 'final', 'giải thích “vì … mà” / điều kiện', { style: 'thân mật' }),
    E('-잖아요', 'c', '잖아요', 'final', 'nhắc điều đã biết “… mà / … đấy”', { style: 'lịch sự' }, { strong: true }),
    E('-잖아', 'c', '잖아', 'final', 'nhắc điều đã biết “… mà / … đấy”', { style: 'thân mật' }),
    E('-는데요', 'c', '는데요', 'final', '“… đấy / … mà” (dẫn dắt, mềm mỏng)', { style: 'lịch sự' }, { bare: 'v' }),
    E('-(으)ㄴ데요', 'u', 'ㄴ데요', 'final', '“… đấy / … mà” (dẫn dắt, mềm mỏng)', { style: 'lịch sự' }, { bare: 'adj', needsBare: true }),
    E('-나요', 'c', '나요', 'final', 'hỏi nhẹ nhàng “… không ạ?”', { style: 'câu hỏi, lịch sự' }),
    E('-(으)ㄴ가요', 'u', 'ㄴ가요', 'final', 'hỏi nhẹ nhàng “… không ạ?”', { style: 'câu hỏi, lịch sự' }, { bare: 'adj', needsBare: true }),
    E('-니', 'c', '니', 'final', 'câu hỏi thân mật “… à?”', { style: 'câu hỏi, thân mật' }),
    E('-냐', 'c', '냐', 'final', 'câu hỏi thân mật “… à?”', { style: 'câu hỏi, thân mật' }),
    E('-더라', 'c', '더라', 'final', 'hồi tưởng “(tôi thấy) hóa ra …”', { style: 'thân mật' }),
    E('-더라고요', 'c', '더라고요', 'final', 'hồi tưởng “(tôi thấy) hóa ra …”', { style: 'lịch sự' }, { strong: true }),
    E('-던데', 'c', '던데', 'connective', 'hồi tưởng + nối câu “… mà (tôi thấy)”', { post: '(hồi tưởng)' }, { yo: true }),
    E('-더니', 'c', '더니', 'connective', '“… rồi thì” (đã thấy / đã trải qua)', { post: 'rồi thì' }),
    E('-다고', 'c', '다고', 'connective', 'trích dẫn gián tiếp “nói rằng …”', { post: '(trích dẫn)' }, { yo: true }),
    E('-ㄴ다고/는다고', 'f', 'ㄴ다고|는다고', 'connective', 'trích dẫn gián tiếp “nói rằng …”', { post: '(trích dẫn)' }, { yo: true, bare: 'v' }),
    E('-냐고', 'c', '냐고', 'connective', 'trích dẫn câu hỏi “hỏi rằng …”', { post: '(trích dẫn)' }, { yo: true }),
    E('-자고', 'c', '자고', 'connective', 'trích dẫn đề nghị “rủ rằng …”', { post: '(trích dẫn)' }, { yo: true }),
    E('-(으)라고', 'u', '라고', 'connective', 'trích dẫn mệnh lệnh “bảo rằng hãy …”', { post: '(trích dẫn)' }, { yo: true }),
    E('-(으)ㄹ지', 'u', 'ㄹ지', 'connective', '“liệu … hay không”', { post: '(liệu)' }, { yo: true }),
    E('-는지', 'c', '는지', 'connective', '“liệu … hay không”', { post: '(liệu)' }, { bare: 'v', yo: true }),
    E('-(으)ㄴ지', 'u', 'ㄴ지', 'connective', '“liệu … hay không” / “kể từ khi”', { post: '(liệu)' }, { yo: true }),
    // ---- connective ---------------------------------------------------------------------------------
    E('-고', 'c', '고', 'connective', 'và / rồi (nối hành động, liệt kê)', { post: 'và' }, { yo: true }),
    E('-아서/어서', 'a', '서', 'connective', 'nên / rồi thì (nguyên nhân, trình tự)', { post: 'nên' }, { strong: true, yo: true }),
    E('-(으)니까', 'u', '니까', 'connective', 'vì … (nên)', { pre: 'vì' }, { strong: true, yo: true }),
    E('-(으)면', 'u', '면', 'connective', 'nếu / khi', { pre: 'nếu' }, { strong: true, yo: true }),
    E('-(으)려고', 'u', '려고', 'connective', 'định / để (mục đích)', { pre: 'định' }, { strong: true, yo: true }),
    E('-(으)러', 'u', '러', 'connective', 'để (đi / đến để làm gì)', { pre: 'để' }, { yo: true }),
    E('-는데', 'c', '는데', 'connective', 'nhưng / và (dẫn dắt, nói bối cảnh)', { post: 'nhưng / và' }, { bare: 'v', yo: true }),
    E('-(으)ㄴ데', 'u', 'ㄴ데', 'connective', 'nhưng / và (dẫn dắt, nói bối cảnh)', { post: 'nhưng / và' }, { bare: 'adj', needsBare: true, yo: true }),
    E('-지만', 'c', '지만', 'connective', 'nhưng', { post: 'nhưng' }, { strong: true, yo: true }),
    E('-거나', 'c', '거나', 'connective', 'hoặc', { post: 'hoặc' }),
    E('-다가', 'c', '다가', 'connective', 'đang … thì (chuyển sang hành động khác)', { post: 'đang … thì' }),
    E('-자마자', 'c', '자마자', 'connective', 'vừa … là', { post: 'vừa … là' }),
    E('-도록', 'c', '도록', 'connective', 'để / cho đến khi', { pre: 'để' }),
    E('-게', 'c', '게', 'connective', 'một cách … / để …', { post: '(trạng từ)' }, { yo: true }),
    E('-아도/어도', 'a', '도', 'connective', 'dù … cũng', { pre: 'dù' }, { yo: true }),
    E('-아야/어야', 'a', '야', 'connective', 'phải … mới', { pre: 'phải' }, { yo: true }),
    E('-(으)면서', 'u', '면서', 'connective', 'vừa … vừa', { post: '(vừa … vừa)' }),
    E('-(으)ㄹ수록', 'u', 'ㄹ수록', 'connective', 'càng … càng', { pre: 'càng' }),
    E('-느라고', 'c', '느라고', 'connective', 'vì mải …', { pre: 'vì mải' }),
    E('-든지', 'c', '든지', 'connective', 'hoặc / dù … hay …', { post: 'hoặc' }),
    // ---- nominalizer / adnominal --------------------------------------------------------------------
    E('-기', 'c', '기', 'nominalizer', 'danh từ hóa: “việc …”', { pre: 'việc' }),
    E('-(으)ㅁ', 'u', 'ㅁ', 'nominalizer', 'danh từ hóa: “việc …”', { pre: 'việc' }),
    E('-(으)ㄴ', 'u', 'ㄴ', 'adnominal', 'định ngữ (bổ nghĩa cho danh từ đứng sau)', { paren: 'định ngữ' }, { needsBare: true,
      byPos: { v: { label: 'định ngữ quá khứ (… đã …)', compose: { pre: 'đã', paren: 'định ngữ' } }, adj: {} } }),
    E('-는', 'c', '는', 'adnominal', 'định ngữ hiện tại (… đang …)', { paren: 'định ngữ' }, { bare: 'v' }),
    E('-(으)ㄹ', 'u', 'ㄹ', 'adnominal', 'định ngữ tương lai / dự đoán (… sẽ …)', { pre: 'sẽ', paren: 'định ngữ' }),
    E('-던', 'c', '던', 'adnominal', 'định ngữ hồi tưởng (… đã từng …)', { pre: 'đã từng', paren: 'định ngữ' }),
  ];

  // Auto-generate "+요" (polite) variants.
  const ENDINGS = [];
  for (const e of BASE) {
    ENDINGS.push(e);
    if (e.yo) {
      const cm = Object.assign({}, e.compose, { style: 'lịch sự' });
      ENDINGS.push(Object.assign({}, e, { id: e.id + '요', text: e.mode === 'f' ? e.text.split('|').map((t) => t + '요').join('|') : e.text + '요',
        kind: 'final', label: e.label + ' + -요 (lịch sự)', compose: cm, yo: false, strong: e.strong || false }));
    }
  }

  // Tail = the invariant part of the surface (never changed by contraction / merging); used as a cheap pre-filter.
  const isBareJamo = (c) => !!c && c.charCodeAt(0) >= 0x3131 && c.charCodeAt(0) <= 0x314E;
  for (const e of ENDINGS) {
    const t = e.mode === 'f' ? e.text.split('|')[0] : e.text;
    e.tail = isBareJamo(t[0]) ? t.slice(1) : t;
  }

  // Pre-final endings (선어말어미)
  const PREFINAL = {
    H: { id: '-(으)시-', label: 'kính ngữ (người được tôn kính là chủ thể)', compose: { paren: 'kính ngữ' } },
    P: { id: '-았/었-', label: 'quá khứ (đã)', compose: { pre: 'đã' } },
    F: { id: '-겠-', label: 'tương lai / phỏng đoán / ý chí (sẽ, chắc là)', compose: { pre: 'sẽ' } },
  };
  // Allowed pre-final chains, in order: honorific < past (< past again) < future
  const COMBOS = [[], ['H'], ['P'], ['H', 'P'], ['F'], ['H', 'F'], ['P', 'F'], ['H', 'P', 'F'], ['P', 'P'], ['H', 'P', 'P'], ['P', 'P', 'F']];

  // 이다 (copula). c = form after a noun with final consonant, v = form after a vowel-final noun.
  const C = (c, v, label, compose) => ({ c, v, label, compose: compose || {}, type: 'copula' });
  const COPULA = [
    C('입니다', '입니다', 'là (lịch sự, trang trọng)', { pre: 'là', style: 'lịch sự, trang trọng' }),
    C('입니까', '입니까', 'là … à? (câu hỏi trang trọng)', { pre: 'là', style: 'câu hỏi, trang trọng' }),
    C('이에요', '예요', 'là (lịch sự, thân mật)', { pre: 'là', style: 'lịch sự' }),
    C('이세요', '세요', 'là (kính ngữ, lịch sự)', { pre: 'là', style: 'kính ngữ, lịch sự' }),
    C('이야', '야', 'là (thân mật)', { pre: 'là', style: 'thân mật' }),
    C('이었어요', '였어요', 'đã là (lịch sự, thân mật)', { pre: 'đã là', style: 'lịch sự' }),
    C('이었습니다', '였습니다', 'đã là (trang trọng)', { pre: 'đã là', style: 'trang trọng' }),
    C('이었어', '였어', 'đã là (thân mật)', { pre: 'đã là', style: 'thân mật' }),
    C('이었다', '였다', 'đã là (văn viết)', { pre: 'đã là', style: 'văn viết' }),
    C('이었던', '였던', 'đã từng là (định ngữ)', { pre: 'đã từng là', paren: 'định ngữ' }),
    C('이다', '다', 'là (dạng từ điển / văn viết)', { pre: 'là', style: 'văn viết' }),
    C('이고', '고', 'là … và', { pre: 'là', post: 'và' }),
    C('이지만', '지만', 'là … nhưng', { pre: 'là', post: 'nhưng' }),
    C('이지', '지', 'là … chứ / nhỉ', { pre: 'là', style: 'thân mật' }),
    C('이죠', '죠', 'là … nhỉ (lịch sự)', { pre: 'là', style: 'lịch sự' }),
    C('이네요', '네요', 'ra là … nhỉ', { pre: 'ra là', style: 'lịch sự' }),
    C('이군요', '군요', 'thì ra là …', { pre: 'thì ra là', style: 'lịch sự' }),
    C('이잖아요', '잖아요', 'là … mà', { pre: 'là', style: 'lịch sự' }),
    C('이거든요', '거든요', 'vì là … mà', { pre: 'vì là', style: 'lịch sự' }),
    C('이라서', '라서', 'vì là …', { pre: 'vì là' }),
    C('이라고', '라고', 'gọi là / nói rằng là …', { pre: 'gọi là' }),
    C('이라는', '라는', 'được gọi là … / cái gọi là', { pre: 'được gọi là' }),
    C('이라면', '라면', 'nếu là …', { pre: 'nếu là' }),
    C('이니까', '니까', 'vì là …', { pre: 'vì là' }),
    C('이면', '면', 'nếu là …', { pre: 'nếu là' }),
    C('인', '인', 'là (định ngữ)', { pre: 'là', paren: 'định ngữ' }),
    C('일', '일', 'sẽ là / có lẽ là (định ngữ)', { pre: 'sẽ là', paren: 'định ngữ' }),
    C('일까요', '일까요', 'liệu có phải là …?', { pre: 'liệu là', style: 'lịch sự' }),
  ];

  K.Endings = { ENDINGS, PREFINAL, COMBOS, COPULA };
  if (typeof module !== 'undefined' && module.exports) module.exports = K.Endings;
})(typeof globalThis !== 'undefined' ? globalThis : this);
