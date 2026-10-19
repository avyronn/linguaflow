/* Korean particles (조사). Data + a parser for particle chains such as 에서는, 에게도, 사람들이, 선생님께서는.
 * Labels are Vietnamese (gloss language of the V1 dictionary). */
(function (root) {
  'use strict';
  const LF = root.LinguaFlow || (root.LinguaFlow = {});
  const K = LF.Korean || (LF.Korean = {});
  const H = () => K.Hangul;

  // kind: plural | case | aux (bổ trợ) | comp (comparative-like) | polite | voc | suffix (님, 씨, 네) | contr (spoken contraction of case+aux: 엔, 선, 겐 ...)
  // req : phonological requirement on the preceding syllable
  //       '*' any, 'c' needs final consonant, 'v' needs vowel ending, 'cl' final consonant but not ㄹ, 'vl' vowel or ㄹ
  // compose: how the particle merges into a Vietnamese summary: {pre} before the noun, {post} after, {paren} in brackets
  // [form, req, key, kind, label (vi), compose, note?]
  const RAW = [
    ['이', 'c', '이/가', 'case', 'trợ từ chủ ngữ', { paren: 'chủ ngữ' }, 'Đánh dấu chủ ngữ mới hoặc được nhấn mạnh; 이 sau phụ âm, 가 sau nguyên âm.'],
    ['가', 'v', '이/가', 'case', 'trợ từ chủ ngữ', { paren: 'chủ ngữ' }],
    ['께서', '*', '께서', 'case', 'trợ từ chủ ngữ (kính ngữ)', { paren: 'chủ ngữ, kính ngữ' }, 'Dạng kính ngữ của 이/가, dùng cho người đáng kính; thường đi cùng động từ có -(으)시-.'],
    ['은', 'c', '은/는', 'aux', 'trợ từ chủ đề (thì / là)', { paren: 'chủ đề' }, 'Nêu chủ đề hoặc đối chiếu (“còn … thì …”); 은 sau phụ âm, 는 sau nguyên âm.'],
    ['는', 'v', '은/는', 'aux', 'trợ từ chủ đề (thì / là)', { paren: 'chủ đề' }],
    ['을', 'c', '을/를', 'case', 'trợ từ tân ngữ', { paren: 'tân ngữ' }, 'Đánh dấu tân ngữ trực tiếp; 을 sau phụ âm, 를 sau nguyên âm.'],
    ['를', 'v', '을/를', 'case', 'trợ từ tân ngữ', { paren: 'tân ngữ' }],
    ['의', '*', '의', 'case', 'của (sở hữu)', { pre: 'của' }, 'Sở hữu / quan hệ giữa hai danh từ; trong khẩu ngữ thường lược bỏ, và phát âm là [에].'],
    ['에', '*', '에', 'case', 'ở / tại / vào lúc / đến', { pre: 'ở' }, 'Nơi chốn tĩnh hoặc đích đến, thời điểm, nguyên nhân, đơn vị (“mỗi”).'],
    ['에서부터', '*', '에서부터', 'case', 'bắt đầu từ (nơi chốn / mốc)', { pre: 'từ' }],
    ['에서', '*', '에서', 'case', 'ở / tại (nơi diễn ra hành động) / từ', { pre: 'ở' }, 'Nơi diễn ra hành động, hoặc điểm xuất phát (từ).'],
    ['에게서', '*', '에게서', 'case', 'từ (một người)', { pre: 'từ' }],
    ['한테서', '*', '한테서', 'case', 'từ (một người, thân mật)', { pre: 'từ' }],
    ['에게로', '*', '에게로', 'case', 'về phía (một người)', { pre: 'về phía' }],
    ['한테로', '*', '한테로', 'case', 'về phía (một người, thân mật)', { pre: 'về phía' }],
    ['에게', '*', '에게', 'case', 'cho / với (một người)', { pre: 'cho' }, 'Đối tượng nhận hành động (người/động vật); thân mật hơn: 한테.'],
    ['한테', '*', '한테', 'case', 'cho / với (một người, thân mật)', { pre: 'cho' }],
    ['께', '*', '께', 'case', 'cho (một người, kính ngữ)', { pre: 'cho' }],
    ['에다가', '*', '에다(가)', 'case', 'vào / lên (thêm vào, đặt lên)', { pre: 'vào' }],
    ['에다', '*', '에다(가)', 'case', 'vào / lên (thêm vào, đặt lên)', { pre: 'vào' }],
    ['보고', '*', '보고', 'case', 'với / nói với (thân mật)', { pre: 'nói với' }, 'Đối tượng của lời nói/hành động (như 한테), khẩu ngữ: “나보고 가래” (bảo tôi đi).'],
    ['더러', '*', '더러', 'case', 'với / nói với', { pre: 'nói với' }],
    ['으로부터', 'cl', '(으)로부터', 'case', 'từ (nguồn gốc)', { pre: 'từ' }],
    ['로부터', 'vl', '(으)로부터', 'case', 'từ (nguồn gốc)', { pre: 'từ' }],
    ['으로서', 'cl', '(으)로서', 'case', 'với tư cách là', { pre: 'với tư cách' }],
    ['로서', 'vl', '(으)로서', 'case', 'với tư cách là', { pre: 'với tư cách' }],
    ['으로써', 'cl', '(으)로써', 'case', 'bằng (phương tiện)', { pre: 'bằng' }],
    ['로써', 'vl', '(으)로써', 'case', 'bằng (phương tiện)', { pre: 'bằng' }],
    ['으로', 'cl', '(으)로', 'case', 'bằng / về phía / hướng đến / thành', { paren: 'bằng / hướng đến' }, 'Phương tiện, hướng, trạng thái chuyển thành, lý do; (으)로 sau phụ âm trừ ㄹ.'],
    ['로', 'vl', '(으)로', 'case', 'bằng / về phía / hướng đến / thành', { paren: 'bằng / hướng đến' }],
    ['과', 'c', '와/과', 'case', 'và / cùng với', { pre: 'cùng với' }, 'Liệt kê “và” hoặc “cùng với”; 과 sau phụ âm, 와 sau nguyên âm (văn viết, trang trọng).'],
    ['와', 'v', '와/과', 'case', 'và / cùng với', { pre: 'cùng với' }],
    ['이랑', 'c', '(이)랑', 'case', 'và / cùng với (thân mật)', { pre: 'cùng với' }],
    ['랑', 'v', '(이)랑', 'case', 'và / cùng với (thân mật)', { pre: 'cùng với' }],
    ['하고', '*', '하고', 'case', 'và / cùng với', { pre: 'cùng với' }],
    ['말고', '*', '말고', 'case', 'ngoài … ra / chứ không phải', { pre: 'ngoài' }],
    ['보다', '*', '보다', 'comp', 'hơn / so với', { pre: 'hơn' }, 'So sánh hơn: N1이/가 N2보다 + tính từ.'],
    ['처럼', '*', '처럼', 'comp', 'như', { pre: 'như' }],
    ['같이', '*', '같이', 'comp', 'như / cùng', { pre: 'như' }],
    ['만큼', '*', '만큼', 'comp', 'bằng / đến mức', { pre: 'bằng' }],
    ['대로', '*', '대로', 'comp', 'theo / như', { pre: 'theo' }],
    ['도', '*', '도', 'aux', 'cũng', { paren: 'cũng' }, 'Thêm vào / cũng; thay thế 이/가, 을/를 (không dùng cùng chúng).'],
    ['만', '*', '만', 'aux', 'chỉ', { pre: 'chỉ' }],
    ['까지', '*', '까지', 'aux', 'đến / cả', { pre: 'đến' }],
    ['부터', '*', '부터', 'aux', 'từ / bắt đầu từ', { pre: 'từ' }],
    ['마저', '*', '마저', 'aux', 'ngay cả', { pre: 'ngay cả' }],
    ['조차', '*', '조차', 'aux', 'ngay cả', { pre: 'ngay cả' }],
    ['마다', '*', '마다', 'aux', 'mỗi', { pre: 'mỗi' }],
    ['밖에', '*', '밖에', 'aux', 'ngoài … ra (đi với phủ định)', { pre: 'chỉ có' }],
    ['뿐', '*', '뿐', 'aux', 'chỉ', { pre: 'chỉ' }],
    ['쯤', '*', '쯤', 'aux', 'khoảng', { pre: 'khoảng' }],
    ['씩', '*', '씩', 'aux', 'mỗi / từng', { pre: 'mỗi' }],
    ['끼리', '*', '끼리', 'aux', 'cùng nhau / chỉ riêng giữa …', { pre: 'riêng giữa' }, 'Chỉ những người / vật cùng nhóm với nhau: 우리끼리 (riêng chúng ta), 친구끼리 (giữa bạn bè với nhau).'],
    ['깨나', '*', '깨나', 'aux', 'khá nhiều / ra trò', { pre: 'khá' }, 'Nhấn mạnh mức độ khá lớn: 힘깨나 쓰다 (khỏe ra trò).'],
    ['커녕', '*', '커녕', 'aux', 'đừng nói đến … (còn không …)', { pre: 'đừng nói đến' }, 'Thường: N은/는커녕 … (도) 안 …: “đừng nói là … ngay cả … cũng không”.'],
    ['치고', '*', '치고', 'aux', 'xét về … (nói chung, đối với loại …)', { pre: 'xét về' }],
    ['따라', '*', '따라', 'aux', 'riêng … (hôm nay / lúc đó) lại …', { pre: 'riêng' }],
    ['이든지', 'c', '(이)든(지)', 'aux', 'dù là … hay / bất cứ …', { paren: 'bất cứ' }],
    ['든지', 'v', '(이)든(지)', 'aux', 'dù là … hay / bất cứ …', { paren: 'bất cứ' }],
    ['이든', 'c', '(이)든(지)', 'aux', 'dù là … hay / bất cứ …', { paren: 'bất cứ' }],
    ['든', 'v', '(이)든(지)', 'aux', 'dù là … hay / bất cứ …', { paren: 'bất cứ' }],
    ['이나마', 'c', '(이)나마', 'aux', 'dù chỉ là … cũng', { paren: 'dù chỉ là' }],
    ['나마', 'v', '(이)나마', 'aux', 'dù chỉ là … cũng', { paren: 'dù chỉ là' }],
    ['이나', 'c', '(이)나', 'aux', 'hoặc / tận / những', { paren: 'hoặc / tận' }],
    ['나', 'v', '(이)나', 'aux', 'hoặc / tận / những', { paren: 'hoặc / tận' }],
    ['이라도', 'c', '(이)라도', 'aux', 'dù là / ít nhất cũng', { paren: 'dù là' }],
    ['라도', 'v', '(이)라도', 'aux', 'dù là / ít nhất cũng', { paren: 'dù là' }],
    ['이야말로', 'c', '(이)야말로', 'aux', 'chính là', { pre: 'chính' }],
    ['야말로', 'v', '(이)야말로', 'aux', 'chính là', { pre: 'chính' }],
    ['이란', 'c', '(이)란', 'aux', 'nói đến … thì (nêu chủ đề / định nghĩa)', { paren: 'nói đến … thì' }],
    ['란', 'v', '(이)란', 'aux', 'nói đến … thì (nêu chủ đề / định nghĩa)', { paren: 'nói đến … thì' }],
    ['서', '*', '서', 'aux', 'một mình / cùng nhau (nhấn mạnh số người) hoặc = 에서', { paren: 'rút gọn của 에서' }],
    ['이서', 'c', '이서', 'aux', 'chỉ riêng nhóm … người (cùng nhau, tự mình)', { post: '(người, cùng nhau)' }, 'Gắn sau số từ chỉ người: 둘이서 (hai người với nhau), 셋이서 (ba người); nhấn mạnh chủ thể là cả nhóm đó.'],
    ['들', '*', '들', 'plural', 'số nhiều (nhiều …)', { paren: 'số nhiều' }, 'Hậu tố số nhiều, thường lược bỏ khi đã rõ nghĩa.'],
    ['님', '*', '님', 'suffix', 'hậu tố kính trọng (ngài / ông / bà)', { post: '(kính ngữ)' }, 'Gắn sau chức danh hoặc tên để tỏ lòng kính trọng: 선생님, 사장님, 박사님.'],
    ['씨', '*', '씨', 'suffix', 'hậu tố gọi tên (anh / chị / ông / bà)', { post: '(gọi lịch sự)' }, 'Gắn sau tên hoặc họ tên để gọi lịch sự; không dùng với người trên.'],
    ['네', '*', '네', 'suffix', 'hậu tố “nhà / bọn / những người như …”', { post: '(nhà / bọn)' }],
    ['아', 'c', '아/야', 'voc', 'hô ngữ (gọi tên, thân mật)', { paren: 'gọi' }],
    ['야', 'v', '아/야', 'voc', 'hô ngữ (gọi tên, thân mật)', { paren: 'gọi' }],
    ['이시여', 'c', '(이)시여', 'voc', 'hô ngữ trang trọng (hỡi …)', { paren: 'hỡi' }],
    ['시여', 'v', '(이)시여', 'voc', 'hô ngữ trang trọng (hỡi …)', { paren: 'hỡi' }],
    ['요', '*', '요', 'polite', 'đuôi lịch sự -요', { paren: 'lịch sự' }],
    // spoken contractions of case + 는 (에는 -> 엔 ...)
    ['엔', '*', '에는', 'contr', 'ở / vào … thì (rút gọn của 에는)', { pre: 'ở', paren: 'chủ đề' }],
    ['에선', '*', '에서는', 'contr', 'ở / tại … thì (rút gọn của 에서는)', { pre: 'ở', paren: 'chủ đề' }],
    ['에겐', '*', '에게는', 'contr', 'đối với … thì (rút gọn của 에게는)', { pre: 'đối với', paren: 'chủ đề' }],
    ['한텐', '*', '한테는', 'contr', 'đối với … thì (rút gọn của 한테는)', { pre: 'đối với', paren: 'chủ đề' }],
    ['하곤', '*', '하고는', 'contr', 'với … thì (rút gọn của 하고는)', { pre: 'cùng với', paren: 'chủ đề' }],
    ['론', 'vl', '(으)로는', 'contr', 'bằng / về phía … thì (rút gọn của (으)로는)', { paren: 'chủ đề' }],
    ['으론', 'cl', '(으)로는', 'contr', 'bằng / về phía … thì (rút gọn của (으)로는)', { paren: 'chủ đề' }],
    ['로선', 'vl', '(으)로서는', 'contr', 'với tư cách … thì (rút gọn của (으)로서는)', { pre: 'với tư cách' }],
    ['으로선', 'cl', '(으)로서는', 'contr', 'với tư cách … thì (rút gọn của (으)로서는)', { pre: 'với tư cách' }],
    ['부턴', '*', '부터는', 'contr', 'từ … thì (rút gọn của 부터는)', { pre: 'từ', paren: 'chủ đề' }],
    ['보단', '*', '보다는', 'contr', 'hơn / so với … thì (rút gọn của 보다는)', { pre: 'hơn', paren: 'chủ đề' }],
    ['껜', '*', '께는', 'contr', 'đối với … thì (kính ngữ; rút gọn của 께는)', { pre: 'đối với', paren: 'chủ đề' }],
    ['넨', '*', '네는', 'contr', 'nhà / bọn … thì (rút gọn của 네는)', { post: '(nhà / bọn)', paren: 'chủ đề' }],
  ];

  const PARTICLES = RAW.map(([form, req, key, kind, label, compose, note]) => ({ form, req, key, kind, label, compose, note: note || '', type: 'particle' }));
  // frequent false positives on word endings: used only with a score penalty
  const LOW_PRIOR = new Set(['아/야', '(이)나', '야', '아', '서', '이서', '네', '(이)시여', '(이)든(지)', '(이)란', '(이)나마', '말고', '더러', '에다(가)']);

  function okReq(req, prev) {
    if (req === '*' || !prev) return true;
    const last = prev.slice(-1);
    const hg = H();
    if (!hg.isSyllable(last)) return true; // digits / latin: cannot decide
    const f = hg.jong(last);
    switch (req) {
      case 'c': return f !== '';
      case 'v': return f === '';
      case 'cl': return f !== '' && f !== 'ㄹ';
      case 'vl': return f === '' || f === 'ㄹ';
      default: return true;
    }
  }

  // Adjacency between consecutive particles in a chain.
  function canFollow(prev, next) {
    if (!prev) return true;
    if (next.kind === 'suffix' || next.kind === 'contr' || next.key === '서') return false; // 님 / 씨 / 네, 엔 / 에선 ... and 서 attach straight to the noun
    if (prev.kind === 'polite') return false;
    if (next.kind === 'polite') return true;
    if (next.kind === 'plural') return prev.kind === 'suffix';        // 선생님들
    if (prev.kind === 'contr') return false;
    if (prev.kind === 'suffix') return next.kind !== 'voc';           // 선생님이, 선생님께서, 사장님도 ...
    if (prev.kind === 'plural') return true;
    if (prev.kind === 'voc') return false;
    // 에서는, 에게도, 으로만 ... and 에서의, 으로의, 와의 ...
    if (prev.kind === 'case') return next.kind === 'aux' || (next.kind === 'case' && next.key === '의' && prev.key !== '의');
    if (prev.kind === 'aux') {
      if (prev.key === '은/는') return next.kind === 'aux' && next.key !== '은/는';
      // 만이, 까지가, 부터의 ...
      return next.kind === 'aux' || (next.kind === 'case' && ['이/가', '을/를', '의'].includes(next.key));
    }
    if (prev.kind === 'comp') return next.kind === 'aux' || (next.kind === 'case' && next.key === '의');
    return false;
  }

  /** All ways to read `tail` as a chain of particles attached to `stem` (max depth 3). */
  function parseChain(stem, tail, maxDepth) {
    const out = [];
    const limit = maxDepth || 3;
    (function dfs(pos, prevText, prevP, acc) {
      if (pos === tail.length) { if (acc.length) out.push(acc.slice()); return; }
      if (acc.length >= limit) return;
      for (const p of PARTICLES) {
        if (!tail.startsWith(p.form, pos)) continue;
        if (!okReq(p.req, prevText)) continue;
        if (!canFollow(prevP, p)) continue;
        acc.push(p);
        dfs(pos + p.form.length, p.form, p, acc);
        acc.pop();
      }
    })(0, stem, null, []);
    return out;
  }

  K.Particles = { PARTICLES, LOW_PRIOR, okReq, canFollow, parseChain };
  if (typeof module !== 'undefined' && module.exports) module.exports = K.Particles;
})(typeof globalThis !== 'undefined' ? globalThis : this);
