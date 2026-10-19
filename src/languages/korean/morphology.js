/* Korean morphological analyzer.
 *
 * Strategy: propose candidate readings (stem + endings / noun + particles / noun + 이다 ...), then keep only those that
 * REGENERATE the exact surface with the forward conjugation engine (conjugation.js). A reading whose stem is in the
 * dictionary is "known"; anything else is explicitly marked as a guess with a lower confidence. The analyzer never
 * returns a made-up reading as certain: low confidence is reported as such.
 *
 * Reading types
 *   word        exact dictionary hit
 *   nominal     noun (+ particles), incl. spoken contractions 우린 = 우리 + 는, 뭘 = 뭐 + 를
 *   copula      noun + 이다, incl. spoken merges 뭔데 = 뭐 + 인데, 의삽니다 = 의사 + 입니다
 *   predicate   verb / adjective stem + pre-final markers + ending (+ trailing particles)
 *   compound    V-아/어 / -고 / -지 / -게 / -기 + auxiliary verb inside ONE word (먹어봐요, 가고싶어요, 먹지않아요)
 *   particle    particles standing alone (에서, 에게는 ...)
 *   segmented   several words written without spaces (할거야, 무슨일이야), only when nothing else explains the word
 *   misspelled  a common misspelling whose corrected form is analysed (할께요 -> 할게요)
 *   unknown
 *
 * Every Analysis also carries `grammar` (a language-neutral summary: role, particles, ending, tense ...) and `notes`
 * (explanations of the grammar elements found), which sentence-level analysis and the card build on.
 */
(function (root) {
  'use strict';
  const LF = root.LinguaFlow || (root.LinguaFlow = {});
  const K = LF.Korean || (LF.Korean = {});
  const H = K.Hangul, P = K.Particles, En = K.Endings, Cj = K.Conjugation;
  const Hon = K.Honorifics || { note: () => '', LEX: new Map() };

  const POS_LABEL = { v: 'động từ', adj: 'tính từ', n: 'danh từ', pron: 'đại từ', num: 'số từ', cnt: 'đơn vị đếm', adv: 'phó từ',
    det: 'định từ', int: 'thán từ', conj: 'liên từ', aux: 'trợ động từ', cop: 'từ “là”', nbound: 'danh từ phụ thuộc', phrase: 'cụm từ' };

  // Contracted pronoun + particle forms that are more often read this way than as the plain word: surface -> [base word, particle]
  const CONTRACTIONS = {
    제가: ['저', '가'], 내가: ['나', '가'], 네가: ['너', '가'], 난: ['나', '는'], 넌: ['너', '는'], 날: ['나', '를'], 널: ['너', '를'], 전: ['저', '는'],
    뭘: ['뭐', '를'], 걸: ['것', '을'], 건: ['것', '은'], 게: ['것', '이'], 이게: ['이것', '이'], 그게: ['그것', '이'], 저게: ['저것', '이'],
    이건: ['이것', '은'], 그건: ['그것', '은'], 저건: ['저것', '은'], 이걸: ['이것', '을'], 그걸: ['그것', '을'], 저걸: ['저것', '을'],
    여긴: ['여기', '는'], 거긴: ['거기', '는'], 저긴: ['저기', '는'], 누가: ['누구', '가'], 얜: ['얘', '는'], 걘: ['걔', '는'], 쟨: ['쟤', '는'],
    얠: ['얘', '를'], 걜: ['걔', '를'], 쟬: ['쟤', '를'], 뭐가: ['뭐', '가'], 어디서: ['어디', '에서'], 여기서: ['여기', '에서'], 거기서: ['거기', '에서'], 저기서: ['저기', '에서'],
    제게: ['저', '에게'], 내게: ['나', '에게'], 네게: ['너', '에게'], 제겐: ['저', '에게', '는'], 내겐: ['나', '에게', '는'], 네겐: ['너', '에게', '는'], 니가: ['너', '가'],
    걸로: ['것', '으로'], 걸론: ['것', '으로', '는'], 이걸로: ['이것', '으로'], 그걸로: ['그것', '으로'], 저걸로: ['저것', '으로'], 이걸론: ['이것', '으로', '는'], 그걸론: ['그것', '으로', '는'], 저걸론: ['저것', '으로', '는'],
    걸요: ['것', '을', '요'], 이걸요: ['이것', '을', '요'], 그걸요: ['그것', '을', '요'], 저걸요: ['저것', '을', '요'],
    뭘로: ['뭐', '으로'], 뭘론: ['뭐', '으로', '는'], 뭘루: ['뭐', '으로'],
    누가요: ['누구', '가', '요'], 제가요: ['저', '가', '요'], 내가요: ['나', '가', '요'],
    뭘로는: ['뭐', '으로', '는'], 뭘로도: ['뭐', '으로', '도'], 뭘로만: ['뭐', '으로', '만'],
  };

  // Auxiliary verbs used right after a connective ending INSIDE one word: 먹어봐요, 가고싶어요, 먹지않아요, 좋아해요 ...
  //   stem: auxiliary stem   conn: id(s) of the connective ending in front of it   headPos: restricts the head word's POS
  //   key / label / pat: grammar id, explanation (vi), and a pattern for the Vietnamese summary ({x} = head meaning)
  const AUX = [
    { stem: '주', conn: ['-아/어'], key: '-아/어 주다', label: '-아/어 주다: làm việc gì đó cho người khác', pat: '{x} giúp / {x} cho (ai đó)', lv: 2 },
    { stem: '드리', conn: ['-아/어'], key: '-아/어 드리다', label: '-아/어 드리다: làm giúp (khiêm nhường)', pat: '{x} giúp (khiêm nhường)', lv: 3 },
    { stem: '보', conn: ['-아/어'], key: '-아/어 보다', label: '-아/어 보다: thử làm', pat: 'thử {x}', lv: 2 },
    { stem: '버리', conn: ['-아/어'], key: '-아/어 버리다', label: '-아/어 버리다: làm xong hẳn / lỡ làm', pat: '{x} mất / {x} hết', lv: 3 },
    { stem: '놓', conn: ['-아/어'], key: '-아/어 놓다', label: '-아/어 놓다: làm sẵn, để trạng thái đó', pat: '{x} sẵn', lv: 3 },
    { stem: '두', conn: ['-아/어'], key: '-아/어 두다', label: '-아/어 두다: làm sẵn, để nguyên', pat: '{x} sẵn / để nguyên', lv: 3 },
    { stem: '가', conn: ['-아/어'], key: '-아/어 가다', label: '-아/어 가다: tiếp tục dần dần', pat: '{x} dần (tiếp tục)', lv: 4 },
    { stem: '오', conn: ['-아/어'], key: '-아/어 오다', label: '-아/어 오다: đã … đến giờ / … rồi quay lại', pat: '{x} (từ trước đến nay)', lv: 4 },
    { stem: '있', conn: ['-아/어'], key: '-아/어 있다', label: '-아/어 있다: đang ở trạng thái (đã … và vẫn còn)', pat: 'đang {x} (trạng thái)', lv: 3 },
    { stem: '보이', conn: ['-아/어'], key: '-아/어 보이다', label: '-아/어 보이다: trông có vẻ …', pat: 'trông {x}', lv: 3 },
    { stem: '만하', conn: ['-(으)ㄹ'], key: '-(으)ㄹ 만하다', label: '-(으)ㄹ 만하다: đáng để … / … cũng được', pat: 'đáng {x}', lv: 3 },
    { stem: '하', conn: ['-(으)ㄹ까'], key: '-(으)ㄹ까 하다', label: '-(으)ㄹ까 하다: đang tính / nghĩ xem có nên …', pat: 'đang tính {x}', lv: 3 },
    { stem: '싶', conn: ['-(으)ㄹ까'], key: '-(으)ㄹ까 싶다', label: '-(으)ㄹ까 싶다: đang tính / nghĩ xem có nên …', pat: 'đang tính {x}', lv: 3 },
    { stem: '계시', conn: ['-아/어'], key: '-아/어 계시다', label: '-아/어 계시다: đang ở trạng thái (kính ngữ)', pat: 'đang {x} (kính ngữ)', lv: 4 },
    { stem: '내', conn: ['-아/어'], key: '-아/어 내다', label: '-아/어 내다: làm cho bằng được / làm trọn', pat: '{x} cho bằng được', lv: 4 },
    { stem: '대', conn: ['-아/어'], key: '-아/어 대다', label: '-아/어 대다: cứ … hoài / … lia lịa', pat: 'cứ {x} hoài', lv: 5 },
    { stem: '치우', conn: ['-아/어'], key: '-아/어 치우다', label: '-아/어 치우다: làm một mạch cho xong', pat: '{x} cho xong', lv: 5 },
    { stem: '죽', conn: ['-아/어'], key: '-아/어 죽겠다', label: '-아/어 죽겠다: … chết đi được (nhấn mạnh mức độ)', pat: '{x} chết đi được', lv: 3 },
    { stem: '하', conn: ['-아/어'], key: '-아/어하다', label: '-아/어하다: biến tính từ thành động từ “cảm thấy / tỏ ra …”', pat: 'cảm thấy {x}', lv: 3, headPos: 'adj' },
    { stem: '지', conn: ['-아/어'], key: '-아/어지다', label: '-아/어지다: trở nên … / được …', pat: 'trở nên {x}', lv: 3 },
    { stem: '있', conn: ['-고'], key: '-고 있다', label: '-고 있다: đang làm', pat: 'đang {x}', lv: 1 },
    { stem: '계시', conn: ['-고'], key: '-고 계시다', label: '-고 계시다: đang làm (kính ngữ)', pat: 'đang {x} (kính ngữ)', lv: 3 },
    { stem: '싶', conn: ['-고'], key: '-고 싶다', label: '-고 싶다: muốn làm', pat: 'muốn {x}', lv: 1 },
    { stem: '말', conn: ['-고'], key: '-고 말다', label: '-고 말다: cuối cùng cũng … / lỡ …', pat: 'rốt cuộc đã {x}', lv: 5 },
    { stem: '나', conn: ['-고'], key: '-고 나다', label: '-고 나다: … xong rồi mới …', pat: '{x} xong', lv: 4 },
    { stem: '보', conn: ['-고'], key: '-고 보다', label: '-고 보다: … rồi mới thấy …', pat: '{x} rồi mới thấy', lv: 5 },
    { stem: '않', conn: ['-지'], key: '-지 않다', label: '-지 않다: không …', pat: 'không {x}', lv: 1 },
    { stem: '못하', conn: ['-지'], key: '-지 못하다', label: '-지 못하다: không thể …', pat: 'không thể {x}', lv: 2 },
    { stem: '말', conn: ['-지'], key: '-지 말다', label: '-지 말다: đừng …', pat: 'đừng {x}', lv: 2 },
    { stem: '되', conn: ['-게'], key: '-게 되다', label: '-게 되다: trở nên / rồi cũng … (sự việc diễn ra)', pat: 'trở nên {x} / rồi sẽ {x}', lv: 3 },
    { stem: '하', conn: ['-게'], key: '-게 하다', label: '-게 하다: làm cho / để cho …', pat: 'làm cho {x}', lv: 3 },
    { stem: '만들', conn: ['-게'], key: '-게 만들다', label: '-게 만들다: khiến cho …', pat: 'khiến cho {x}', lv: 4 },
    { stem: '하', conn: ['-아야/어야'], key: '-아/어야 하다', label: '-아/어야 하다: phải …', pat: 'phải {x}', lv: 2 },
    { stem: '되', conn: ['-아야/어야'], key: '-아/어야 되다', label: '-아/어야 되다: phải …', pat: 'phải {x}', lv: 2 },
    { stem: '되', conn: ['-아도/어도'], key: '-아/어도 되다', label: '-아/어도 되다: được phép … / … cũng được', pat: '{x} cũng được', lv: 2 },
    { stem: '괜찮', conn: ['-아도/어도'], key: '-아/어도 괜찮다', label: '-아/어도 괜찮다: … cũng không sao', pat: '{x} cũng không sao', lv: 3 },
    { stem: '시작하', conn: ['-기'], key: '-기 시작하다', label: '-기 시작하다: bắt đầu …', pat: 'bắt đầu {x}', lv: 3 },
    { stem: '싫', conn: ['-기'], key: '-기 싫다', label: '-기 싫다: không muốn …', pat: 'không muốn {x}', lv: 3 },
    { stem: '좋', conn: ['-기'], key: '-기 좋다', label: '-기 좋다: dễ / tốt để …', pat: 'dễ {x}', lv: 3 },
    { stem: '쉽', conn: ['-기'], key: '-기 쉽다', label: '-기 쉽다: dễ …', pat: 'dễ {x}', lv: 3 },
    { stem: '어렵', conn: ['-기'], key: '-기 어렵다', label: '-기 어렵다: khó …', pat: 'khó {x}', lv: 3 },
    { stem: '힘들', conn: ['-기'], key: '-기 힘들다', label: '-기 힘들다: khó / vất vả để …', pat: 'khó {x}', lv: 3 },
  ];
  const AUX_BY_STEM = new Map();
  for (const a of AUX) { if (!AUX_BY_STEM.has(a.stem)) AUX_BY_STEM.set(a.stem, []); AUX_BY_STEM.get(a.stem).push(a); }

  // Productive derivation of unknown predicate stems from a KNOWN noun (공부 + 하다, 사랑 + 스럽다 ...): the meaning is
  // composed, labelled as "suy ra" (derived) and given lower confidence — never presented as a dictionary entry.
  const DERIV = [
    { suf: '하', pos: 'any', v: (n) => 'làm / thực hiện “' + n + '”', adj: (n) => 'có tính / ở trạng thái “' + n + '”' },
    { suf: '되', pos: 'v', v: (n) => 'được / trở thành “' + n + '”' },
    { suf: '시키', pos: 'v', v: (n) => 'làm cho / khiến “' + n + '” xảy ra' },
    { suf: '스럽', pos: 'adj', adj: (n) => 'có vẻ / mang tính “' + n + '”' },
    { suf: '롭', pos: 'adj', adj: (n) => 'có tính “' + n + '”' },
    { suf: '답', pos: 'adj', adj: (n) => 'đúng kiểu / xứng đáng là “' + n + '”' },
  ];

  const DUAL_STEMS = new Set(['않', '맞', '낫']);
  const NUM_OK = new Set(['둘', '셋', '넷', '다섯', '여섯', '일곱', '여덟', '아홉', '열', '우리', '남매', '부부', '형제', '자매']);
  const LOW_EXEMPT = { 서: null, 이서: NUM_OK }; // low-prior particles that are fine after these stems (filled below)
  // particles that may follow an adnominal predicate form (… -는 대로, -(으)ㄴ 만큼, -(으)ㄹ 뿐)
  const ADN_PARTICLES = new Set(['대로', '만큼', '뿐', '밖에', '처럼', '같이', '보다']);
  const SINO_NUM = new Set(['일', '이', '삼', '사', '오', '육', '칠', '팔', '구', '십', '백', '천', '만', '억', '영', '공']);
  const AUX_CONNECTIVES_ALL = new Set(AUX.reduce((acc, a) => acc.concat(a.conn), []));
  const TRAIL_AUX = new Set(['는', '은', '도', '만', '야']);
  // A plain adverb (어서, 이리, 빨리, 다, 그만 ...) never takes a subject / object / "with" / dative marker: 어서와 = 어서 + 와(오다), 이리와, 저리가, 다하고 are not "adverb + particle".
  // Pronoun-like words that the dictionary lists as adverbs (서로를, 스스로가, 뭔가를, 어딘가에서) are exempt.
  const ADV_NO_CASE = new Set(['이/가', '을/를', '와/과', '하고', '(이)랑', '에게', '한테', '께', '께서', '보고', '더러', '에게서', '한테서', '에게로', '한테로', '말고']);
  const ADV_NOUNISH = new Set(['서로', '스스로', '뭔가', '무언가', '어딘가', '언젠가', '누군가', '어디선가', '어쩐지', '아무', '아무것', '아무개']);
  const SEO_OK = new Set(['여기', '거기', '저기', '어디', '이곳', '그곳', '저곳', '혼자', '우리', '둘이', '셋이']);
  LOW_EXEMPT['서'] = SEO_OK;
  // spaceless-run segmentation: nouns that may stand as a one-syllable second word (애 놈 때 곳 ...), and the one-syllable words
  // that may start a two-syllable run (안돼, 못가, 뭐해 ...)
  const EYO_MISSPELT = new Set(['거', '그거', '이거', '저거', '요거', '고거', '조거']);
  const SEG_NOUN_TAIL = new Set(['애', '놈', '년', '때', '곳', '분', '말', '일', '것', '거', '데', '수', '줄', '간', '째', '쯤', '경', '여', '전', '후', '반']);
  const SEG_LEFT2 = new Set(['안', '못', '뭐', '한', '두', '세', '좀', '더', '또', '잘', '왜', '다', '이', '그', '저', '내', '제', '나', '너', '막', '꼭',
    '네', '몇', '일', '삼', '사', '오', '육', '칠', '팔', '구', '십', '백', '천', '열']); // the last rows: numerals (네시, 십년, 삼일, 열개)
  const SEG_ADN_TAIL = new Set(['적', '게', '걸', '건', '지', '듯', '척', '뿐', '채', '양']); // bound nouns (and contractions) that follow an adnominal: 본적, 온게
  const NUM_SUFFIX = new Set(['째', '경', '여', '간', '쯤', '남짓', '가량']); // suffixes that follow a number + unit (3년째, 5시경, 30명 여)
  // plain nouns that count like units after a number (두 시간 ...)
  const NUM_UNIT_NOUNS = new Set(['시간', '달', '해', '날', '사람', '주', '주일', '년', '월', '일', '회', '판', '쪽', '학년', '학기',
    '하루', '이틀', '사흘', '나흘', '닷새', '엿새', '이레', '여드레', '아흐레', '열흘', '보름', '며칠']);
  const NUMERAL_DET = new Set(['한', '두', '세', '네', '몇', '스무', '첫', '여러', '수', '십', '백', '천']); // determiners that stand where a number would
  // Spellings shared by a rare dictionary word and a very common verb form (가요 = ca khúc / 가다 + -요, 보고 = báo cáo / 보다 + -고, 볼 = má / 보다 + -ㄹ):
  // the verb form is read first (and with full confidence); the word stays among the alternative readings of the card and of the sentence analyser.
  const VERB_FORM_FIRST = new Set(['가요', '보고', '가면', '본', '볼', '알', '온', '간']);
  const NUM_REL = new Set(['전', '후']); // 오분|전, 십년|후: the noun "before / after", not the contraction 저는
  // words that directly follow a number + unit, with or without a particle: 이년|전에, 삼일|후에, 삼일|동안, 십분|뒤에, 두시|쯤에
  const NUM_AFTER = new Set(['전', '후', '뒤', '동안', '간', '째', '쯤', '경', '안', '내', '사이', '정도', '이상', '이하', '미만', '만', '만에', '반']);
  const STRONG_COPULA = new Set(['입니다', '입니까', '이에요', '예요', '이세요', '이었어요', '였어요', '이었습니다', '였습니다', '이었다', '였다', '이라고', '라고', '이라는', '라는']);

  // ---- common misspellings and spoken contractions ------------------------------------------------------------------------
  // Each fix is {text, note, kind}: the analyzer analyses the corrected / expanded text and says so ("chính tả đúng …").
  const MISSPELL_WORDS = { 몇일: '며칠', 금새: '금세', 웬지: '왠지', 어떻해: '어떡해', 바램: '바람', 설겆이: '설거지', 역활: '역할', 오랫만: '오랜만', 오랫만에: '오랜만에', 오랫만이야: '오랜만이야',
    희안하다: '희한하다', 희안해: '희한해', 희안한: '희한한', 왠만하면: '웬만하면', 왠만해서: '웬만해서', 왠만한: '웬만한', 왠만큼: '웬만큼', 뵈요: '봬요', 뵈서: '봬서',
    어의없다: '어이없다', 어의없어: '어이없어', 아녜요: '아니에요', 아니예요: '아니에요', 아녜: '아니에', 어쨋든: '어쨌든', 어쨋거나: '어쨌거나',
    댓가: '대가', 댓가를: '대가를', 댓가로: '대가로', 댓가는: '대가는', 몇일간: '며칠간' };
  const SPOKEN_WORDS = { 말야: '말이야', 땜에: '때문에', 담에: '다음에', 그치: '그렇지', 그니까: '그러니까', 그니깐: '그러니깐', 그치만: '그렇지만', 암튼: '아무튼', 걍: '그냥', 넘: '너무', 젤: '제일', 쫌: '좀', 낼: '내일', 사랑스런: '사랑스러운', 시끄러: '시끄러워', 같애: '같아' };
  const NOTE_SPELL = 'chính tả đúng: ', NOTE_SPOKEN = 'khẩu ngữ / nói tắt của: ';
  function fixSpelling(w) {
    const out = [];
    // parts: the corrected text is several words written together (어딨어 -> 어디 + 있어): each is analysed on its own
    const add = (text, kind, parts) => {
      if (text === w || out.some((x) => x.text === text)) return;
      const shown = parts ? parts.join(' ') : text;
      out.push({ text, kind, shown, parts: parts || null, note: (kind === 'spoken' ? NOTE_SPOKEN : NOTE_SPELL) + shown });
    };
    if (MISSPELL_WORDS[w]) add(MISSPELL_WORDS[w], 'spelling');
    if (w.length > 2 && w.includes('같애')) add(w.replace('같애', '같아'), 'spoken'); // 같애요, 같애서 ... (spoken 같아)
    if (SPOKEN_WORDS[w]) add(SPOKEN_WORDS[w], 'spoken');
    // ㄹ-final syllable + 께 / 껄 / 꺼 : 할께요 -> 할게요, 갈껄 -> 갈걸, 갈꺼야 -> 갈거야 (the endings -ㄹ게, -ㄹ걸, -ㄹ 거 are never spelt with ㄲ)
    for (let i = 1; i < w.length; i++) {
      if (!H.isSyllable(w[i - 1]) || H.jong(w[i - 1]) !== 'ㄹ') continue;
      const head = w.slice(0, i), rest = w.slice(i);
      if (/^께(요?)$/.test(rest)) add(head + '게' + rest.slice(1), 'spelling');
      if (/^껄(요?)$/.test(rest)) add(head + '걸' + rest.slice(1), 'spelling');
      if (/^꺼(야|예요|에요|다|지|죠|라|고|니까|면|든|야지|라고|라서|야\?)?$/.test(rest) || rest === '꺼') add(head + '거' + rest.slice(1), 'spelling');
    }
    // 내꺼 / 니꺼 / 제꺼 / 우리꺼 (= 내 거 ...)
    { const m = /^(내|네|니|제|우리|그|이|저)꺼(.*)$/.exec(w); if (m) add(m[1] + '거' + m[2], 'spelling', [m[1], '거' + m[2]]); }
    // 거에요 -> 거예요 (vowel-final noun + 예요), 이예요 -> 이에요 (consonant-final noun + 이에요), 니예요 -> 니에요 (아니예요)
    { const m = /^(.*)에요$/.exec(w); if (m && m[1] && H.isSyllable(m[1].slice(-1)) && !H.hasBatchim(m[1]) && !/[이니]$/.test(m[1])) add(m[1] + '예요', 'spelling'); }
    { const m = /^(.*[가-힣])이예요$/.exec(w); if (m && H.hasBatchim(m[1])) add(m[1] + '이에요', 'spelling'); }
    { const m = /^(.*)니예요$/.exec(w); if (m) add(m[1] + '니에요', 'spelling'); }
    // 말예요 -> 말이에요 (예요 straight after a consonant-final noun: the 이 was dropped)
    { const m = /^(.*[가-힣])예요$/.exec(w); if (m && H.hasBatchim(m[1])) add(m[1] + '이에요', 'spelling'); }
    // 되요 -> 돼요, 되서 -> 돼서, 됬- -> 됐-
    if (/되요$/.test(w)) add(w.replace(/되요$/, '돼요'), 'spelling');
    if (/되서$/.test(w)) add(w.replace(/되서$/, '돼서'), 'spelling');
    if (w.includes('됬')) add(w.replace(/됬/g, '됐'), 'spelling');
    // 돼죠 -> 되죠 (돼 = 되어 stands only before 요 / 서 / 도 / 야 ...; before 죠 / 네 / 겠 / 잖 / 고 / 면 ... the stem is 되; 돼지 "pig" is a real word and is left alone)
    { const m = /^(.*?)돼(죠|네|겠|잖|고|는|면|니|며|려|자)(.*)$/.exec(w); if (m) add(m[1] + '되' + m[2] + m[3], 'spelling'); }
    // 어딨어 = 어디 있어, 여깄어요 = 여기 있어요 (spoken contractions)
    if (/^어딨/.test(w)) add('어디있' + w.slice(2), 'spoken', ['어디', '있' + w.slice(2)]);
    { const m = /^(여|거|저)깄(.*)$/.exec(w); if (m) add(m[1] + '기있' + m[2], 'spoken', [m[1] + '기', '있' + m[2]]); }
    // 뭐랬어 = 뭐라고 했어, 하랬어 = 하라고 했어, 간댔어 = 간다고 했어 (reported speech squeezed into one word)
    { const m = /^(.+?)랬(.*)$/.exec(w); if (m) add(m[1] + '라고했' + m[2], 'spoken', [m[1] + '라고', '했' + m[2]]); }
    { const m = /^(.+?)댔(.*)$/.exec(w); if (m) add(m[1] + '다고했' + m[2], 'spoken', [m[1] + '다고', '했' + m[2]]); }
    // 할려고 -> 하려고, 그럴려면 -> 그러려면 (a stray ㄹ in front of -려-)
    { const m = /^(.*?)([가-힣])려(고|면|니|는|다가|구|거든|고요)(.*)$/.exec(w); if (m && H.isSyllable(m[2]) && H.jong(m[2]) === 'ㄹ') add(m[1] + H.withoutJong(m[2]) + '려' + m[3] + m[4], 'spelling'); }
    // 아니였어 -> 아니었어, 학생이였어 -> 학생이었어, 되였다 -> 되었다
    if (/아니였/.test(w)) add(w.replace(/아니였/g, '아니었'), 'spelling');
    { const m = /^(.*[가-힣])이였(.*)$/.exec(w); if (m && H.hasBatchim(m[1])) add(m[1] + '이었' + m[2], 'spelling'); }
    if (/되였/.test(w)) add(w.replace(/되였/g, '되었'), 'spelling');
    // 알어 / 맞어 / 좋어요 : colloquial 어 after a ㅏ / ㅗ vowel (standard: 아)
    { const m = /^(.*[가-힣])어(요|서|도|야|라|서요)?$/.exec(w); if (m) { const v = H.vowel(m[1]); if (v === 'ㅏ' || v === 'ㅗ') add(m[1] + '아' + (m[2] || ''), 'spoken'); } }
    return out;
  }

  const clampN = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
  const nfd = (s) => s.normalize('NFD');
  const FINAL_COMPAT = { 'ᆨ': 'ㄱ', 'ᆫ': 'ㄴ', 'ᆮ': 'ㄷ', 'ᆯ': 'ㄹ', 'ᆷ': 'ㅁ', 'ᆸ': 'ㅂ', 'ᆺ': 'ㅅ', 'ᆻ': 'ㅆ', 'ᆼ': 'ㅇ' };
  const toCompat = (s) => s.normalize('NFC').replace(/[ᆨ-ᇂ]/g, (c) => FINAL_COMPAT[c] || c);
  const maxScore = (c) => c.reduce((m, x) => Math.max(m, x.score), 0);

  function firstMeaning(entry) { return entry && entry.meanings && entry.meanings.length ? entry.meanings[0] : ''; }
  // First meaning without a trailing "(note)": used when composing summaries so we never print "(…) (…)".
  function coreMeaning(entry) {
    const m = firstMeaning(entry);
    const c = m.replace(/\s*\([^)]*\)\s*$/, '').trim();
    return c || m;
  }
  // One concise gloss per morpheme line (the card lists every dictionary meaning separately).
  function shortGloss(entry) { return firstMeaning(entry); }
  function tenseWords(combo) {
    const c = combo.filter((x) => x !== 'H').join('');
    return { '': [], P: ['đã'], F: ['sẽ'], PF: ['chắc là đã'], PP: ['đã từng'], PPF: ['chắc là đã từng'], R: ['phải'] }[c] || [];
  }
  function tenseCode(combo) {
    const c = combo.filter((x) => x !== 'H').join('');
    return { '': 'present', P: 'past', F: 'future', PF: 'past-guess', PP: 'past-perfect', PPF: 'past-guess', R: 'must' }[c] || 'present';
  }
  function say(core, o) {
    const words = [];
    if (o.pre) words.push(o.pre);
    for (const t of o.tense || []) if (t !== o.pre) words.push(t);
    words.push(core);
    if (o.post) words.push(o.post);
    const parens = (o.parens || []).filter(Boolean);
    return words.join(' ') + (parens.length ? ' (' + parens.join(', ') + ')' : '');
  }
  function composeNominal(core, chain) {
    let out = core;
    const parens = [];
    for (const p of chain) {
      if (p.compose.pre) out = p.compose.pre + ' ' + out;
      if (p.compose.post) out = out + ' ' + p.compose.post;
      if (p.compose.paren) parens.push(p.compose.paren);
    }
    return out + (parens.length ? ' (' + parens.join(', ') + ')' : '');
  }
  const specView = (spec, pos) => {
    const bp = spec.byPos && spec.byPos[pos];
    return bp ? { label: bp.label || spec.label, compose: Object.assign({}, spec.compose, bp.compose || {}) } : { label: spec.label, compose: spec.compose };
  };
  const endingInfo = (spec) => ({ id: spec.id, kind: spec.kind, lvl: spec.lvl || null, sent: spec.sent || null, rel: spec.rel || null, label: spec.label, lv: spec.lv || null });
  const particleInfo = (p) => ({ form: p.form, key: p.key, kind: p.kind, label: p.label });

  const TYPE_CONF = { word: 0.97, contraction: 0.9, nominal: 0.92, predicate: 0.92, copula: 0.86, compound: 0.76, synth: 0.62, derivedNominal: 0.7,
    particle: 0.7, copulaOnly: 0.68, segmented: 0.6, misspelled: 0.8, unknownPredicate: 0.5, unknownNominal: 0.45, unknownCopula: 0.5, unknown: 0.3 };

  class KoreanMorphology {
    constructor(dictionary) {
      this.dict = dictionary;
      this._cache = new Map();
      this._lightCache = new Map();
      this._readCache = new Map();
      this._auxStems = null;
      this._specIndex = null;
    }

    // ---- public ---------------------------------------------------------------------------------------
    analyze(surface) {
      const w = String(surface == null ? '' : surface).normalize('NFC').trim();
      if (!w) return this._unknown('');
      if (this._cache.has(w)) return this._cache.get(w);
      const result = this._analyze(w);
      if (this._cache.size > 3000) { this._cache.clear(); this._lightCache.clear(); this._readCache.clear(); }
      this._cache.set(w, result);
      return result;
    }
    candidates(surface) { return this._collect(String(surface).normalize('NFC').trim()); }

    // ---- candidate collection ---------------------------------------------------------------------------
    _collect(w, opts) {
      const o = opts || {};
      const c = [];
      this._exact(w, c);
      this._contraction(w, c);
      this._nominalContracted(w, c);
      this._nominal(w, c, o);
      this._copula(w, c, o);
      this._predicate(w, c, o);
      if (maxScore(c) < 78) this._compound(w, c);
      if (!o.light) {
        if (!o.noMisspell && maxScore(c) < 66) this._misspelled(w, c);
        if (maxScore(c) < 60) { this._copulaOnly(w, c); this._particleOnly(w, c); }
        if (maxScore(c) < 60 && !c.some((x) => x.type === 'misspelled' && x.base.type === 'segmented')) this._segment(w, c);
        if (maxScore(c) < 60) this._unknownCandidates(w, c);
      }
      c.sort((a, b) => b.score - a.score);
      return c;
    }
    _rankBonus(lemma) {
      const prov = this.dict.manager.getProviders(this.dict.language)[0];
      const r = prov && prov.rank ? prov.rank(lemma) : Infinity;
      return r === Infinity ? 0 : Math.max(0, 8 * (1 - Math.log(r + 1) / Math.log(2500)));
    }
    _exact(w, out) {
      const e = this.dict.get(w);
      if (!e) { // 삼십오, 열두, 스물세 ...: a number written as one word, computed rather than listed
        const num = w.length >= 2 && K.Numerals ? K.Numerals.parse(w) : null;
        // 만이 / 백이 / 천이 read as "10,002" would be absurd: the particle reading (만 + 이) is far more likely, so the number only stays as a rival
        if (num) out.push({ type: 'word', lemma: w, entry: K.Numerals.entry(w, num), known: true, score: /[천백만억조]이$/.test(w) ? 66 : 82, conf: TYPE_CONF.word, numeral: num });
        return;
      }
      out.push({ type: 'word', lemma: w, entry: e, known: true, score: 90 + this._rankBonus(w) - (VERB_FORM_FIRST.has(w) ? 16 : 0), conf: TYPE_CONF.word });
    }
    /** A noun usable in front of particles / 이다. null = not a noun (predicate, determiner ...), {known:false} = not in the dictionary. */
    _noun(str) {
      const e = this.dict.get(str);
      if (e) return this.dict.isNominal(e) ? { entry: this.dict.asNominal(e), known: true } : null;
      // 삼십오를 / 열두가 / 스물세는: a number written as one word is a known noun (computed by K.Numerals, not listed)
      if (str.length >= 2 && K.Numerals) { const num = K.Numerals.parse(str); if (num) return { entry: K.Numerals.entry(str, num), known: true, numeral: num }; }
      if (str.length >= 3 && str.endsWith('적')) { // N + 적: "mang tính N" (개인적, 일시적 ...), composed from a known noun
        const b = this.dict.get(str.slice(0, -1));
        if (b && this.dict.isNominal(b) && b.pos !== 'nbound') {
          return { entry: { word: str, pos: 'n', meanings: ['mang tính “' + coreMeaning(b) + '”'], synthesized: true }, known: true, derived: '적', base: b };
        }
      }
      return { entry: null, known: false };
    }
    _contraction(w, out) {
      const t = CONTRACTIONS[w];
      if (!t) return;
      const base = this.dict.get(t[0]) || this.dict.get(t[0].replace(' ', ''));
      const chain = t.slice(1).map((f) => P.PARTICLES.find((p) => p.form === f)).filter(Boolean);
      if (!base || chain.length !== t.length - 1) return;
      out.push({ type: 'nominal', stemText: w, lemma: t[0], entry: this.dict.isNominal(base) ? this.dict.asNominal(base) : base, known: true, chain, contracted: t.slice(), score: 100, conf: TYPE_CONF.contraction });
    }
    // 우린 = 우리 + 는, 우릴 = 우리 + 를, 이젠 = 이제 + 는 : a vowel-final noun + 는 / 를 written as a final ㄴ / ㄹ on the noun
    _nominalContracted(w, out) {
      const n = w.length, lastCh = w[n - 1];
      if (n < 2 || !H.isSyllable(lastCh)) return;
      const f = H.jong(lastCh);
      if (f !== 'ㄴ' && f !== 'ㄹ') return;
      const base = w.slice(0, -1) + H.withoutJong(lastCh), form = f === 'ㄴ' ? '는' : '를';
      const ni = this._noun(base);
      if (!ni || !ni.known || ni.derived) return;
      const particle = P.PARTICLES.find((p) => p.form === form);
      out.push({ type: 'nominal', stemText: base, lemma: base, entry: ni.entry, known: true, chain: [particle], contracted: [base, form],
        score: 79 + this._rankBonus(base) - (ni.entry.pos === 'nbound' ? 3 : 0), conf: TYPE_CONF.contraction - 0.04 });
    }
    // is there a known noun longer than `stem` that is still a prefix of `w` (날씨가: 날 + 씨 + 가 vs 날씨 + 가)?
    _hasLongerNoun(w, stem) {
      for (let k = stem.length + 1; k < w.length; k++) { const ni = this._noun(w.slice(0, k)); if (ni && ni.known && !ni.derived) return true; }
      return false;
    }
    // 안에 / 못을 / 진짜가: an adverb that is also a noun is shown with its noun sense once a case particle follows it
    _nounView(e, chain) {
      if (!e || e.pos !== 'adv' || !chain.length || chain[0].kind !== 'case') return e;
      for (const pos of ['n', 'pron', 'num', 'cnt', 'nbound']) { const v = this.dict.asAlt(e, pos); if (v) return v; }
      return e;
    }
    _nominal(w, out, o) {
      for (let k = 1; k < w.length; k++) {
        const stem = w.slice(0, k), tail = w.slice(k);
        const ni = this._noun(stem);
        if (!ni) continue;
        const known = ni.known, e = ni.entry;
        if (!known && (o && o.light || stem.length < 2 || !H.hasHangul(stem))) continue;
        for (const chain of P.parseChain(stem, tail)) {
          if (EYO_MISSPELT.has(stem) && chain.length === 2 && chain[0].form === '에' && chain[1].form === '요') continue; // 거에요 = 거예요
          if (known && e.pos === 'adv' && !ADV_NOUNISH.has(stem) && !(e.altSenses || []).some((x) => x.pos === 'n' || x.pos === 'pron' || x.pos === 'num' || x.pos === 'cnt' || x.pos === 'nbound')
            && (chain[0].kind === 'suffix' || chain[0].kind === 'voc' || (ADV_NO_CASE.has(chain[0].key) && !(chain[0].key === '이/가' && chain.length === 2 && chain[1].kind === 'polite')))) continue; // (정말이요? = 정말 + 이 + 요 stays)
          const low = chain.some((p, i) => P.LOW_PRIOR.has(p.key) && !(i === 0 && LOW_EXEMPT[p.key] && LOW_EXEMPT[p.key].has(stem)));
          if (known) {
            const numPenalty = e.pos === 'num' && SINO_NUM.has(stem) ? 9 : 0;
            const derived = !!ni.derived;
            out.push({ type: 'nominal', stemText: stem, lemma: stem, entry: this._nounView(e, chain), known: true, chain, tail, derived: ni.derived || null,
              score: (derived ? 72 : 80 + this._rankBonus(stem)) - 2 * (chain.length - 1) - (low ? 12 : 0) - numPenalty - (chain[0].kind === 'suffix' && stem.length < w.length - 1 && this._hasLongerNoun(w, stem) ? 4 : 0)
                - (stem.length === 1 && chain.some((p) => p.kind === 'polite') ? 6 : 0) // 해요 = 하다 + -요, hardly 해 + 요
                - (stem === '해' && chain[0].form.startsWith('보') ? 14 : 0), // 해보고 / 해보다 = 하다 + 보다 (try), hardly 해 (year) + 보고 / 보다
              conf: (derived ? TYPE_CONF.derivedNominal : TYPE_CONF.nominal) - 0.02 * (chain.length - 1) - (low ? 0.15 : 0) });
          } else if (!low && chain[0].kind !== 'polite' && chain[0].kind !== 'plural') {
            out.push({ type: 'nominal', stemText: stem, lemma: stem, entry: null, known: false, chain, tail, score: 35 - chain.length, conf: TYPE_CONF.unknownNominal });
          }
        }
      }
    }
    _copula(w, out, o) {
      const rows = En.COPULA;
      const bound = En.BOUND_COPULA[w];
      if (bound) {
        const e = this.dict.get(bound.noun);
        const row = rows.find((r) => r.c === bound.tail);
        if (e && row) out.push({ type: 'copula', stemText: bound.noun, lemma: bound.noun, entry: this.dict.isNominal(e) ? this.dict.asNominal(e) : e, known: true, copula: row, tail: bound.tail, bound: true,
          score: 84 + this._rankBonus(bound.noun) * 0, conf: TYPE_CONF.copula });
      }
      for (let k = 1; k < w.length; k++) {
        const noun = w.slice(0, k), tail = w.slice(k);
        // 사람들이죠 / 친구들이에요 / 아이들입니다: noun + plural 들 + 이다 (들 ends in ㄹ, so the forms that follow a final consonant are used)
        if (noun.length >= 2 && noun.endsWith('들')) {
          const base = noun.slice(0, -1), nb = this._noun(base);
          if (nb && nb.known && !nb.derived && nb.entry.pos !== 'nbound') {
            for (const f of rows) if (f.c === tail) out.push({ type: 'copula', stemText: base, lemma: base, entry: nb.entry, known: true, copula: f, tail, plural: true, score: 74 + this._rankBonus(base), conf: TYPE_CONF.copula - 0.02 });
          }
        }
        const ni = this._noun(noun);
        if (!ni) continue;
        const batchim = H.hasBatchim(noun);
        for (const f of rows) {
          const ok = f.c === tail || (!batchim && f.v === tail);
          if (!ok) continue;
          const shortV = !batchim && f.v === tail && f.c !== tail && tail.length <= 2; // 가고 = 가 + 이고 ? rarely — keep it below real verbs
          if (ni.known) out.push({ type: 'copula', stemText: noun, lemma: noun, entry: ni.entry, known: true, copula: f, tail, derived: ni.derived || null,
            score: (ni.derived ? 68 : 76 + this._rankBonus(noun)) - (shortV ? 6 : 0)
              - (f.c === '일' && ni.entry && ni.entry.pos === 'num' ? 22 : 0), // 삼일 = 삼 (3) + 일 (day): the adnominal "sẽ là" after a number is practically never meant
            conf: ni.derived ? TYPE_CONF.derivedNominal : TYPE_CONF.copula });
          else if (!(o && o.light) && H.hasHangul(noun) && STRONG_COPULA.has(tail)) out.push({ type: 'copula', stemText: noun, lemma: noun, entry: null, known: false, copula: f, tail, score: 42, conf: TYPE_CONF.unknownCopula });
        }
      }
      // merged spoken forms: a vowel-final noun + 이다 written with a final ㄴ / ㄹ / ㅂ on the noun (뭔데, 뭘까요, 의삽니다)
      for (let k = 1; k < w.length; k++) {
        const syl = w[k - 1];
        if (!H.isSyllable(syl)) continue;
        const f = H.jong(syl), lead = f === 'ㄴ' ? '인' : f === 'ㄹ' ? '일' : f === 'ㅂ' ? '입' : null;
        if (!lead) continue;
        const noun = w.slice(0, k - 1) + H.withoutJong(syl), tail = lead + w.slice(k);
        const ni = this._noun(noun);
        if (!ni || !ni.known || ni.derived) continue;
        const row = rows.find((r) => r.c === tail && r.c.length >= 2);
        if (!row) continue;
        out.push({ type: 'copula', stemText: noun, lemma: noun, entry: ni.entry, known: true, copula: row, tail, merged: true, score: 71 + this._rankBonus(noun), conf: TYPE_CONF.copula - 0.06 });
      }
    }
    // 입니다 / 이에요 / 예요 written on their own (a space after the noun)
    _copulaOnly(w, out) {
      if (w.length < 2) return;
      for (const f of En.COPULA) {
        if (!(f.c === w && /^[이입일]/.test(w) && w.length >= 3) && !(f.v === w && f.v !== f.c && /^[예였]/.test(w))) continue;
        out.push({ type: 'copula', stemText: '', lemma: '이다', entry: this.dict.get('이다') || null, known: true, copula: f, tail: w, standalone: true, score: 58, conf: TYPE_CONF.copulaOnly });
        return;
      }
    }
    // 에서 / 에게는 / 까지 ... on their own
    _particleOnly(w, out) {
      if (w.length > 8) return;
      for (const chain of P.parseChain('', w, 3)) {
        if (chain[0].kind === 'suffix' || chain[0].kind === 'plural' || chain[0].kind === 'voc' || chain[0].kind === 'polite') continue;
        if (chain.some((p) => P.LOW_PRIOR.has(p.key))) continue;
        out.push({ type: 'particle', lemma: w, entry: null, known: true, chain, score: 56, conf: TYPE_CONF.particle });
        return;
      }
    }

    // ---- predicates ------------------------------------------------------------------------------------
    _stemInfoFromEntry(lemma, entry) {
      const stem = lemma.slice(0, -1);
      const pos = entry.pos === 'adj' || entry.pos === 'cop' || lemma === '싶다' ? 'adj' : 'v';
      const irr = entry.irregular === 'reg' ? null : (entry.irregular || Cj.defaultIrr(stem, pos));
      const info = { text: stem, irr, pos };
      if (DUAL_STEMS.has(stem) && entry.pos !== 'adj') info.dual = true; // behaves like a verb AND like an adjective (않다, 맞다 ...)
      return info;
    }
    _knownStems(w) {
      const out = [];
      for (const b of this.dict.stemsFor(w)) {
        if (b.lemma === '이다') continue;
        let s = b._s;
        if (!s) {
          const info = this._stemInfoFromEntry(b.lemma, b.entry);
          // every conjugated form keeps the stem's leading syllables (only the last one — or the last two for 르-irregulars — can change)
          s = b._s = { info, lemma: b.lemma, entry: b.entry, known: true, pref: info.irr === '르' ? b.stem.slice(0, -2) : b.stem.slice(0, -1) };
        }
        if (w.startsWith(s.pref)) out.push(s);
      }
      return out;
    }
    _unknownStems(w) {
      const texts = new Set();
      const syl = Array.from(w).filter(H.isSyllable);
      for (let k = 1; k <= syl.length && texts.size < 60; k++) {
        const last = syl[k - 1], p = H.parts(last), head = syl.slice(0, k - 1).join('');
        texts.add(head + last);
        if (p.f) {
          texts.add(head + H.withoutJong(last));
          if (['ㅂ', 'ㄴ', 'ㄹ', 'ㅁ', 'ㅆ'].includes(p.f)) texts.add(head + H.withJong(last, 'ㄹ'));
          if (p.f === 'ㄹ') texts.add(head + H.withJong(last, 'ㄷ'));
        }
        for (const base of new Set([last, H.withoutJong(last)])) {
          const q = H.parts(base);
          if (!q || q.f) continue;
          const alt = { ㅘ: 'ㅗ', ㅝ: 'ㅜ', ㅙ: 'ㅚ', ㅕ: 'ㅣ', ㅓ: 'ㅡ', ㅏ: 'ㅡ' }[q.v];
          if (alt) texts.add(head + H.build(q.c, alt, ''));
          if (q.v === 'ㅐ' && q.c === 'ㅎ') texts.add(head + '하');
          if (q.v === 'ㅐ' || q.v === 'ㅒ' || q.v === 'ㅖ') for (const v of { ㅐ: ['ㅓ', 'ㅏ'], ㅒ: ['ㅑ'], ㅖ: ['ㅕ'] }[q.v]) texts.add(head + H.build(q.c, v, 'ㅎ'));
          texts.add(head + H.withJong(base, 'ㅅ')); // ㅅ-irregular 지어 -> 짓
          if (k >= 2 && q.c === 'ㅇ' && (q.v === 'ㅝ' || q.v === 'ㅘ' || q.v === 'ㅜ')) { // ㅂ-irregular 추워 -> 춥
            const prev = syl[k - 2];
            if (!H.jong(prev)) texts.add(syl.slice(0, k - 2).join('') + H.withJong(prev, 'ㅂ'));
          }
          if (k >= 2 && q.c === 'ㄹ' && (q.v === 'ㅏ' || q.v === 'ㅓ') && H.jong(syl[k - 2]) === 'ㄹ') // 르-irregular 몰라 -> 모르
            texts.add(syl.slice(0, k - 2).join('') + H.withoutJong(syl[k - 2]) + '르');
        }
      }
      const out = [];
      for (const t of texts) {
        if (!t || this.dict.has(t + '다')) continue; // known stems are handled by the dictionary route
        // a stem never ends in ㅆ except 있 / 없... (맛있, 재미있): "채용했" is 채용하 + past, not a stem of its own
        if (H.jong(t.slice(-1)) === 'ㅆ' && !/있$/.test(t)) continue;
        if (t.length > 1 && t.endsWith('해')) continue; // likewise "채용해" is 채용하 + -여 (no stem ends in 해)
        let derivation = null;
        for (const d of DERIV) {
          if (t.length <= d.suf.length || !t.endsWith(d.suf)) continue;
          const noun = t.slice(0, -d.suf.length), ne = this.dict.get(noun);
          if (ne && ne.pos === 'n') { derivation = { d, noun: coreMeaning(ne) }; break; } // plain nouns only (not 안 / 뭐: those are words of their own)
        }
        for (const irr of Cj.candidateIrrs(t)) for (const pos of ['v', 'adj']) {
          let entry = null;
          if (derivation) {
            const d = derivation.d;
            if (d.pos !== 'any' && d.pos !== pos) continue;
            entry = { pos, meanings: [(pos === 'adj' ? d.adj || d.v : d.v)(derivation.noun)], synthesized: true };
          }
          out.push({ info: { text: t, irr, pos }, lemma: t + '다', entry, known: false, synthesized: !!entry });
        }
      }
      return out;
    }
    _comboFilter(w) {
      const hasSS = Array.from(w).some((ch) => H.isSyllable(ch) && H.jong(ch) === 'ㅆ');
      const hasHon = /[시셔셨세십신실심]/.test(w), hasF = w.includes('겠'), hasR = w.includes('야겠');
      return En.COMBOS.filter((c) => {
        if (c.includes('P') && !hasSS) return false;
        if (c.includes('F') && !hasF) return false;
        if (c.includes('R') && !hasR) return false;
        if (c.includes('H') && !hasHon) return false;
        return true;
      });
    }
    // endings whose invariant tail is a suffix of w (cheap index: by last character of the tail)
    _specsFor(w) {
      if (!this._specIndex) {
        const empty = [], byLast = new Map();
        const put = (k, e) => { if (!byLast.has(k)) byLast.set(k, []); byLast.get(k).push(e); };
        for (const e of En.ENDINGS) {
          if (!e.tail) empty.push(e);
          else put(e.tail.slice(-1), e);
          if (e.tailAsp && e.tailAsp.slice(-1) !== (e.tail || '').slice(-1)) put(e.tailAsp.slice(-1), e);
        }
        this._specIndex = { empty, byLast };
      }
      const out = this._specIndex.empty.slice();
      for (const e of this._specIndex.byLast.get(w.slice(-1)) || []) if ((e.tail && w.endsWith(e.tail)) || (e.tailAsp && w.endsWith(e.tailAsp))) out.push(e);
      return out;
    }
    /** Core matcher: which (stem, chain, ending) regenerate w exactly? */
    _match(w, stems, opts) {
      const o = opts || {};
      const specs = this._specsFor(w).filter((e) => !o.specIds || o.specIds.has(e.id));
      const out = [];
      if (!specs.length || !stems.length) return out;
      const combos = this._comboFilter(w);
      for (const s of stems) {
        if (s.pref && !w.startsWith(s.pref)) continue;
        for (const combo of combos) {
          const infos = Cj.chainInfos(s.info, combo);
          if (!infos.length) continue;
          for (const spec of specs) {
            if (o.needStrong && !(spec.strong || combo.length)) continue;
            if (!Cj.specAllowed(s.info, combo, spec)) continue;
            for (let ii = 0; ii < infos.length; ii++) {
              const si = Cj.attachFinal(infos[ii], spec).indexOf(w);
              if (si >= 0) { out.push({ stem: s, combo, spec, chainText: infos[ii].text, variant: ii + si }); break; }
            }
          }
        }
      }
      return out;
    }
    _predicate(w, out, o) {
      const known = this._match(w, this._knownStems(w));
      for (const m of known) out.push(this._predCandidate(m, w, true));
      if (!(o && o.light) && (!known.length || known.every((m) => m.stem.entry && m.stem.entry.rank > 2500))) {
        const guess = this._match(w, this._unknownStems(w), { needStrong: true });
        const seen = new Set();
        for (const m of guess) {
          const key = m.stem.lemma + '|' + m.spec.id + '|' + m.combo.join('');
          if (seen.has(key)) continue;
          seen.add(key);
          out.push(this._predCandidate(m, w, false));
          if (seen.size > 12) break;
        }
      }
      this._predicateTrailing(w, out);
    }
    _predCandidate(m, w, known) {
      const irrGuess = !known && m.stem.info.irr ? 0.08 : 0;
      const synth = m.stem.synthesized;
      // 가지마 is almost always 가지 + 마 ("don't go", the compound 가다 + -지 + 말다), not 가지다 + the rare promise ending -(으)마
      const rarePromise = known && m.spec.id === '-(으)마' && /지$/.test(m.stem.info.text) ? 10 : 0;
      const score = known ? 80 + this._rankBonus(m.stem.lemma) - 0.4 * m.combo.length - (m.spec.strong || m.combo.length ? 0 : 1) - (m.variant > 0 ? 3 : 0) - (m.combo.includes('H') ? 3 : 0) - rarePromise
        : (synth ? 62 : 40) - (irrGuess ? 5 : 0);
      return { type: 'predicate', lemma: m.stem.lemma, stemText: m.stem.info.text, entry: m.stem.entry, known: known || !!synth, synthesized: !!synth,
        info: m.stem.info, combo: m.combo, spec: m.spec, chainText: m.chainText, score,
        conf: known ? TYPE_CONF.predicate : (synth ? TYPE_CONF.synth : TYPE_CONF.unknownPredicate - irrGuess) };
    }
    // 먹기를, 가지는, 먹고도, 삶이, 가길 ... : a predicate form followed by particles
    _predicateTrailing(w, out) {
      const n = w.length;
      // a connective head (-고 / -지 / -게 / -아/어) followed by particles is a rarer reading than a known noun spelled the same
      // (가게는 = the shop + 는, 가지는 = the eggplant + 는): it must not win merely because the verb is frequent
      const push = (ms, headStr, chain, note, nominalised) => {
        for (const m of ms) {
          const c = this._predCandidate(m, headStr, true);
          c.trailing = chain; c.headSurface = headStr; c.trailingNote = note || '';
          c.score -= nominalised ? 3 : 7; c.conf -= 0.04;
          out.push(c);
        }
      };
      // contracted 가길 / 가긴 = 가기를 / 가기는
      const lastCh = w[n - 1];
      if ((lastCh === '길' || lastCh === '긴') && n >= 2) {
        const headStr = w.slice(0, -1) + '기', pf = P.PARTICLES.find((p) => p.form === (lastCh === '길' ? '를' : '는'));
        push(this._match(headStr, this._knownStems(headStr), { specIds: new Set(['-기']) }), headStr, [pf], 'rút gọn: 기' + pf.form + ' → ' + lastCh, true);
      }
      for (let t = 1; t <= 6 && t < n - 1; t++) {
        const headStr = w.slice(0, n - t), tail = w.slice(n - t);
        const chains = P.parseChain(headStr, tail, 3).filter((ch) => ch.every((p) => p.kind !== 'polite' && p.kind !== 'plural' && p.kind !== 'suffix'));
        if (!chains.length) continue;
        const nomOK = headStr.endsWith('기') || H.jong(headStr) === 'ㅁ';
        const ids = headStr.endsWith('기') ? new Set(['-기']) : H.jong(headStr) === 'ㅁ' ? new Set(['-(으)ㅁ']) : new Set(['-고', '-지', '-게', '-아/어']);
        const ms = this._match(headStr, this._knownStems(headStr), { specIds: ids });
        if (!ms.length) continue;
        const okChain = (specId, ch) => nomOK || ch.every((p) => (p.kind === 'aux' && TRAIL_AUX.has(p.form)) || (specId === '-지' && p.kind === 'case' && (p.key === '이/가' || p.key === '을/를')));
        for (const ch of chains) {
          const chain = nomOK ? ch : ch.map((p) => (p.form === '는' || p.form === '은' ? Object.assign({}, p, { compose: { paren: 'nhấn mạnh' }, label: 'trợ từ nhấn mạnh / đối chiếu' }) : p));
          push(ms.filter((m) => okChain(m.spec.id, ch)), headStr, chain, '', nomOK);
        }
      }
    }
    _auxStemList() {
      if (this._auxStems) return this._auxStems;
      const list = [];
      for (const stemText of AUX_BY_STEM.keys()) {
        const e = this.dict.get(stemText + '다');
        if (e) list.push({ info: this._stemInfoFromEntry(stemText + '다', e), lemma: stemText + '다', entry: e, known: true, pref: '' });
      }
      return (this._auxStems = list);
    }
    // 먹어봐요, 가고싶어요, 먹지않아요, 좋아해요 : head (stem + connective) + auxiliary verb (+ endings) in a single word
    _compound(w, out) {
      const auxStems = this._auxStemList();
      if (!auxStems.length || w.length < 2) return;
      for (let k = 1; k <= w.length - 1; k++) {
        const headStr = w.slice(0, k), tailStr = w.slice(k);
        const tails = this._match(tailStr, auxStems);
        if (!tails.length) continue;
        const headCache = new Map();
        const headsFor = (conn) => {
          const key = conn.join('|');
          if (!headCache.has(key)) headCache.set(key, this._match(headStr, this._knownStems(headStr), { specIds: new Set(conn) }));
          return headCache.get(key);
        };
        for (const t of tails) {
          for (const row of AUX_BY_STEM.get(t.stem.info.text) || []) {
            for (const h of headsFor(row.conn)) {
              if (h.combo.some((x) => x === 'R')) continue;
              if (row.headPos && h.stem.info.pos !== row.headPos) continue;
              if (row.conn[0] === '-아/어' && h.spec.id !== '-아/어') continue;
              out.push({ type: 'compound', head: this._predCandidate(h, headStr, true), tail: this._predCandidate(t, tailStr, true), headStr, tailStr, aux: row,
                lemma: h.stem.lemma, entry: h.stem.entry, known: true, score: 72 - 0.2 * k - (h.stem.lemma === t.stem.lemma ? 3 : 0) - (t.spec.id === '-(으)마' ? 8 : 0), conf: TYPE_CONF.compound });
            }
          }
        }
      }
    }
    // common misspellings / spoken contractions: analyse the corrected (expanded) form
    _misspelled(w, out) {
      for (const fixed of fixSpelling(w)) {
        let base;
        if (fixed.parts) {
          const best = this._segFixed(fixed.parts);
          if (best) base = Object.assign(this._segmented(best), { score: 56 });
        } else {
          base = this._collect(fixed.text, { noMisspell: true }).find((x) => x.known && x.type !== 'unknown' && x.score >= (fixed.kind === 'spoken' ? 50 : 56));
        }
        if (!base) continue;
        out.push({ type: 'misspelled', base, misspelled: fixed, lemma: base.lemma, entry: base.entry, known: true, score: Math.min(base.score - (base.type === 'segmented' ? 2 : 4), 76), conf: Math.min(base.conf, TYPE_CONF.misspelled) });
        return;
      }
    }

    // ---- words written without spaces -------------------------------------------------------------------
    // Best effort, used only when nothing else explains the word: every piece must itself be a KNOWN word / form (analysed in
    // "light" mode) and neighbouring pieces must make grammatical sense. The result is flagged `segmented`, never above medium
    // confidence, and short pieces are only accepted in the roles where a single syllable is a real word (안, 뭐, 할, 해 ...).
    _lightAll(str) {
      if (this._lightCache.has(str)) return this._lightCache.get(str);
      const out = [], seen = new Set();
      const push = (x) => {
        const cls = this._segClass(x), key = cls.L + '>' + cls.R + '|' + x.lemma;
        if (seen.has(key)) return;
        seen.add(key);
        out.push({ cand: x, cls, score: x.score });
      };
      const add = (x) => {
        if (!x.known || x.type === 'unknown' || x.type === 'segmented' || x.score < 64) return;
        push(x);
        // homograph noun + bound noun (적 = enemy / "experience"): offer the bound-noun reading too, the neighbours decide
        const nb = (x.type === 'word' || x.type === 'nominal' || x.type === 'copula') && x.entry ? this.dict.asNbound(x.entry) : null;
        if (nb) push(Object.assign({}, x, { entry: nb, score: x.score - 1 }));
        // homograph numeral (이 = this / two, 일 = work / one): 이주전 = 이(2) + 주 + 전
        const nu = x.type === 'word' && x.entry ? this.dict.asNum(x.entry) : null;
        if (nu) push(Object.assign({}, x, { entry: nu, score: x.score - 1 }));
        // 네 = yes / four, 한 = one: the determiner reading of a numeral
        const nd = x.type === 'word' && x.entry && NUMERAL_DET.has(x.lemma) ? this.dict.asAlt(x.entry, 'det') : null;
        if (nd) push(Object.assign({}, x, { entry: nd, score: x.score - 1 }));
      };
      const lead = [];
      for (const fixed of fixSpelling(str)) { // 거에요 -> 거예요 and similar slips inside a spaceless run (a real misspelling outranks the literal reading)
        if (fixed.kind !== 'spelling' || fixed.parts) continue;
        const base = this._collect(fixed.text, { light: true }).find((x) => x.known && x.type !== 'unknown' && x.type !== 'segmented' && x.score >= 64);
        if (base) { lead.push({ type: 'misspelled', base, misspelled: fixed, lemma: base.lemma, entry: base.entry, known: true, score: base.score + 2, conf: Math.min(base.conf, TYPE_CONF.misspelled) }); break; }
      }
      for (const x of lead) add(x);
      for (const x of this._collect(str, { light: true })) { add(x); if (out.length >= 3) break; }
      if (!out.length) { // spoken contractions (땜에 -> 때문에) are tried last
        for (const fixed of fixSpelling(str)) {
          if (fixed.parts) continue;
          const base = this._collect(fixed.text, { light: true }).find((x) => x.known && x.type !== 'unknown' && x.type !== 'segmented' && x.score >= 64);
          if (base) { add({ type: 'misspelled', base, misspelled: fixed, lemma: base.lemma, entry: base.entry, known: true, score: base.score - 4, conf: Math.min(base.conf, TYPE_CONF.misspelled) }); break; }
        }
      }
      if (!out.length && ADN_PARTICLES.has(str)) { // 할 밖에, 먹은 처럼 ...: a particle standing on its own after an adnominal form
        const chain = P.parseChain('', str, 1)[0];
        if (chain) add({ type: 'particle', lemma: str, entry: null, known: true, chain, score: 64, conf: TYPE_CONF.particle });
      }
      this._lightCache.set(str, out);
      return out;
    }
    // L = what the piece is when it FOLLOWS another piece, R = what it allows to come next. P = carries a particle / ending already.
    _segClass(c) {
      const kindOf = (spec) => (spec.kind === 'adnominal' ? 'adn' : spec.kind === 'final' ? 'fin' : spec.kind === 'nominalizer' ? 'noun' : 'conn');
      const pos = c.entry ? c.entry.pos : '';
      const nounL = pos === 'nbound' || pos === 'cnt' ? 'nbound' : pos === 'pron' ? 'pron' : 'noun';
      switch (c.type) {
        case 'misspelled': return this._segClass(c.base);
        case 'predicate': return { L: 'pred', R: c.trailing ? 'noun' : kindOf(c.spec), P: !!c.trailing };
        case 'compound': return { L: 'pred', R: kindOf(c.tail.spec) };
        case 'copula': return { L: c.standalone ? 'cop' : nounL, R: c.copula.adn ? 'adn' : c.copula.nom ? 'noun' : c.copula.rel ? 'conn' : 'fin', P: true };
        case 'particle': return { L: 'ptcl', R: 'noun', P: true };
        case 'nominal': { const last = c.chain[c.chain.length - 1]; return { L: nounL, R: last && last.kind === 'polite' ? 'fin' : 'noun', P: true, G: !!last && last.key === '의' }; }
        default: break;
      }
      if (this.dict.isPredicate(c.entry)) return { L: 'pred', R: 'fin' };
      switch (pos) {
        case 'det': return { L: 'det', R: 'det' };
        case 'adv': return { L: 'adv', R: 'adv' };
        case 'int': case 'conj': return { L: 'free', R: 'free' };
        case 'nbound': case 'cnt': return { L: 'nbound', R: c.lemma === '여' ? 'num' : 'noun' }; // 삼십|여|명: 여 ("more than") sits between the number and the counter
        case 'pron': return { L: 'pron', R: 'noun' };
        case 'num': return { L: 'num', R: 'num' };
        default: return { L: 'noun', R: 'noun' };
      }
    }
    // bonus (>= 0) when piece B may follow piece A, null when they cannot stand next to each other
    _segPair(A, B) {
      const a = A.cls, b = B.cls;
      if (a.R === 'free') return 0;
      switch (a.R) {
        case 'det': return b.L === 'nbound' ? (NUMERAL_DET.has(A.text) ? 8 : 3) : b.L === 'noun' || b.L === 'pron' ? 3 : null; // 한|개: the numeral beats 하다 + -ㄴ
        case 'adn':
          // 지 (the time since …) only follows -(으)ㄴ: 잘지내요 is 잘 + 지내요, not 자다-ㄹ + 지 + 내요 (-ㄹ지 / -는지 are endings of their own)
          if (b.L === 'nbound' && B.text === '지' && !(A.cand && A.cand.spec && A.cand.spec.id === '-(으)ㄴ')) return null;
          return b.L === 'nbound' ? 6 : b.L === 'ptcl' ? 4 : b.L === 'noun' || b.L === 'pron' ? 2 : null;
        case 'noun':
          if (b.L === 'pred') return a.P || A.text.length >= 2 || a.L === 'pron' || a.L === 'nbound' ? 1 : null; // 할 수 없다: a bound noun may drop its particle
          if (b.L === 'noun' || b.L === 'pron') {
            if (!(a.P || (A.text.length >= 2 && B.text.length >= 2) || SEG_NOUN_TAIL.has(B.text) || ((NUM_UNIT_NOUNS.has(A.text) || a.L === 'nbound') && NUM_AFTER.has(B.cand.lemma)))) return null;
            return b.L === 'noun' && NUM_REL.has(B.text) && B.cand.type === 'word' ? 3 : 0;
          }
          if (b.L === 'adv') return a.P || A.text.length >= 2 ? 0 : null;
          if (b.L === 'nbound') return a.G || ((NUM_SUFFIX.has(B.text) || NUM_AFTER.has(B.cand.lemma)) && (a.L === 'nbound' || NUM_UNIT_NOUNS.has(A.text))) ? 0 : null; // 나의 것 — a bound noun needs a modifier; 삼|년|째, 오|시|경
          return null;
        case 'num': return b.L === 'nbound' ? 6 : b.L === 'noun' && (NUM_UNIT_NOUNS.has(B.text) || NUM_UNIT_NOUNS.has(B.cand.lemma)) ? 4 : null; // 열두|시, 삼십|분, 일곱|명 (a number is never split into two numbers: 삼십오 is parsed as a whole)
        case 'adv': return b.L === 'pred' ? 3 : b.L === 'adv' ? 0 : null;
        case 'conn': return b.L === 'pred' ? 1 : b.L === 'adv' ? 0 : null;
        default: return null; // 'fin': a sentence-final form cannot be followed by more words
      }
    }
    // a one-syllable piece is only credible in the roles where one syllable really is a word
    _segShortOK(piece, first, last, prev) {
      const c = piece.cls;
      if (c.L === 'pred' && '는은을를의'.includes(piece.text)) return false; // a lone 는 / 은 / 을 / 를 / 의 is the particle, not the adnominal of 늘다 / 놀다 ...
      if (c.L === 'num') return !last || (!!prev && prev.cls.L === 'num'); // 십|년, 열|개: a numeral is credible in front of a unit
      if (prev && (prev.cls.L === 'num' || (prev.cls.L === 'det' && NUMERAL_DET.has(prev.text))) && (c.L === 'nbound' || NUM_UNIT_NOUNS.has(piece.text))) return true; // ... and a unit right after a number
      if (first && !last) return c.L === 'det' || c.L === 'adv' || c.L === 'pron' || c.R === 'adn' || (c.L === 'nbound' && SEG_NOUN_TAIL.has(piece.text)); // (할 수있는 → 수있는: the word before it was typed with a space)
      // (a one-syllable adnominal at the very end after a number is the counter, not a verb: 스물세|살 = 23 years old, not 스물|세|살다-ㄹ)
      if (last && !first) return c.L === 'nbound' || (c.L === 'pred' && !(c.R === 'adn' && !!prev && (prev.cls.L === 'num' || prev.cls.L === 'det'))) || c.R === 'fin' || c.R === 'conn' || c.L === 'adv' || SEG_NOUN_TAIL.has(piece.text);
      return c.L === 'adv' || c.L === 'det' || c.R === 'adn' || (c.L === 'nbound' && !!prev && prev.cls.R === 'adn'); // middle: 안 | 할 | 거야 | 할 수 없다
    }
    // plausibility score of a sequence of pieces (null = not acceptable)
    _segScore(pieces) {
      let score = 50 - 4 * (pieces.length - 2); // every extra piece is another chance for a coincidence: 이리와 = 이리 + 와, not 이 + 리 + 와
      for (let i = 0; i < pieces.length; i++) {
        const p = pieces[i];
        if (p.text.length === 1 && !this._segShortOK(p, i === 0, i === pieces.length - 1, i ? pieces[i - 1] : null)) return null;
        score += 0.7 * Math.min(3, p.text.length) + Math.max(0, Math.min(3, (p.score - 64) * 0.1));
        if (i) { const b = this._segPair(pieces[i - 1], p); if (b == null) return null; score += b; }
      }
      return score;
    }
    // best reading of a KNOWN split (the words of a corrected spoken form: 어디 | 있어)
    _segFixed(texts) {
      const lists = texts.map((t) => this._lightAll(t));
      if (lists.some((l) => !l.length)) return null;
      let best = null;
      const rec = (i, acc) => {
        if (i === lists.length) { const score = this._segScore(acc); if (score != null && (!best || score > best.score)) best = { pieces: acc.slice(), score }; return; }
        for (const c of lists[i]) { acc.push({ text: texts[i], cand: c.cand, cls: c.cls, score: c.score }); rec(i + 1, acc); acc.pop(); }
      };
      rec(0, []);
      return best;
    }
    _segmented(best) {
      const parts = best.pieces.map((p) => ({ text: p.text, cand: p.cand, score: p.score }));
      return { type: 'segmented', parts, lemma: parts[0].cand.lemma, entry: parts[0].cand.entry, known: true, score: Math.min(58, best.score), conf: TYPE_CONF.segmented };
    }
    _segment(w, out) {
      const n = w.length;
      if (n < 2 || n > 16 || !H.hasHangul(w)) return;
      if (n === 2 && !SEG_LEFT2.has(w[0])) { // two syllables: only a few openers, or an adnominal (…ㄹ / …ㄴ) + a bound noun: 할수, 된거, 할때
        const f = H.isSyllable(w[0]) ? H.jong(w[0]) : '';
        if (!((f === 'ㄹ' || f === 'ㄴ') && (SEG_NOUN_TAIL.has(w[1]) || SEG_ADN_TAIL.has(w[1])))) return;
      }
      let best = null;
      // a tie goes to the reading with fewer pieces (every extra piece is one more chance for a coincidence)
      const consider = (pieces) => { const score = this._segScore(pieces); if (score != null && (!best || score > best.score + 0.05 || (score > best.score - 0.05 && pieces.length < best.pieces.length))) best = { pieces, score }; };
      const mk = (c, text) => ({ text, cand: c.cand, cls: c.cls, score: c.score });
      for (let k = 1; k < n; k++) {
        const As = this._lightAll(w.slice(0, k));
        if (!As.length) continue;
        const rest = w.slice(k), Bs = this._lightAll(rest);
        for (const A of As) for (const B of Bs) consider([mk(A, w.slice(0, k)), mk(B, rest)]);
        if (rest.length >= 2) { // three words (삼|년|째: even one syllable each)
          for (let j = 1; j < rest.length; j++) {
            const B2s = this._lightAll(rest.slice(0, j));
            if (!B2s.length) continue;
            const C2s = this._lightAll(rest.slice(j));
            for (const A of As) for (const B2 of B2s) for (const C2 of C2s) consider([mk(A, w.slice(0, k)), mk(B2, rest.slice(0, j)), mk(C2, rest.slice(j))]);
          }
        }
      }
      if (best) out.push(this._segmented(best));
    }

    _unknownCandidates(w, out) {
      out.push({ type: 'unknown', lemma: w, entry: null, known: false, score: 20, conf: TYPE_CONF.unknown });
    }
    _unknown(w) {
      return this._toAnalysis({ type: 'unknown', lemma: w, entry: null, known: false, score: 0, conf: TYPE_CONF.unknown }, w, []);
    }

    // ---- candidate -> Analysis -----------------------------------------------------------------------------
    _analyze(w) {
      const cands = this._collect(w);
      if (!cands.length) return this._unknown(w);
      const uniq = this._uniqueCandidates(cands);
      const best = uniq[0];
      const analysis = this._toAnalysis(best, w, uniq.slice(1));
      if (best.type === 'word' && best.entry && best.entry.pos === 'phrase') {
        const parse = uniq.find((c) => c.type !== 'word' && c.known);
        if (parse) {
          const sub = this._toAnalysis(parse, w, []);
          analysis.display[0].kind = 'lemma';
          analysis.display[0].note = 'cụm cố định — phân tích ngữ pháp bên dưới';
          analysis.display = analysis.display.concat(sub.display);
          analysis.features.push('phrase');
          analysis.notes = analysis.notes.concat(sub.notes);
        }
      }
      // a lexicalised verb (내놓다) next to its own head + auxiliary reading (내- + 놓다) is not a real ambiguity
      const lexicalised = (c) => c.type === 'compound' && best.type === 'predicate' && best.stemText === c.head.stemText + c.tail.stemText;
      const rival = uniq.find((c) => c.known && !lexicalised(c) && best.score - c.score < (c.type !== best.type ? 9 : 3) && (c.lemma !== best.lemma || c.type !== best.type));
      // a contracted reading (건 = 것 + 은) next to a real dictionary word of the same spelling is always a genuine ambiguity
      const wordRival = best.type === 'nominal' && best.contracted && uniq.some((c) => c.type === 'word' && c.known);
      if ((rival && best.type !== 'word' && best.type !== 'compound' && best.type !== 'segmented') || wordRival) { analysis.confidence = Math.min(analysis.confidence, 0.74); analysis.warnings.push('ambiguous'); }
      analysis.confidenceLabel = analysis.confidence >= 0.8 ? 'high' : analysis.confidence >= 0.55 ? 'medium' : 'low';
      return analysis;
    }
    _candSig(c) {
      return [c.type, c.lemma, c.spec && c.spec.id, c.chain && c.chain.map((p) => p.form).join('+'), c.copula && c.copula.c, c.combo && c.combo.join(''), c.aux && c.aux.key,
        c.parts && c.parts.map((p) => p.text).join('+')].join('|');
    }
    _uniqueCandidates(cands) {
      const uniq = [], seen = new Set();
      for (const c of cands) { const s = this._candSig(c); if (!seen.has(s)) { seen.add(s); uniq.push(c); } }
      return uniq;
    }
    /** The best reading plus up to `max - 1` other dictionary-backed readings of the same spelling, each as a full Analysis.
     *  The sentence analyser uses them to pick the reading that fits the context (간 = 가다 + -(으)ㄴ before 적이 있다, not the noun 간).
     *  Guesses (stems that are not in the dictionary) are never offered as alternatives. */
    readings(surface, max) {
      const w = String(surface == null ? '' : surface).normalize('NFC').trim();
      if (!w) return [];
      const key = w + '|' + (max || 4);
      if (this._readCache.has(key)) return this._readCache.get(key);
      const best = this.analyze(w);
      const out = [best];
      const limit = (max || 4) - 1;
      if (limit > 0 && best.known) {
        const uniq = this._uniqueCandidates(this._collect(w));
        const bestSig = uniq.length ? this._candSig(uniq[0]) : '';
        for (const c of uniq) {
          if (out.length > limit) break;
          if (this._candSig(c) === bestSig || !c.known || c.type === 'unknown' || c.type === 'misspelled' || c.score < 60) continue;
          out.push(this._toAnalysis(c, w, []));
        }
      }
      if (this._readCache.size > 3000) this._readCache.clear();
      this._readCache.set(key, out);
      return out;
    }
    _gloss(entry, known) { return known && entry ? shortGloss(entry) : ''; }
    _nounNote(c) {
      if (c.derived) return 'suy ra từ danh từ + -' + c.derived;
      if (!c.known) return 'có thể là tên riêng / từ mượn';
      return Hon.note(c.lemma);
    }
    _toAnalysis(c, w, others) {
      if (c.type === 'misspelled') {
        const a = this._toAnalysis(c.base, c.misspelled.text, []);
        const spoken = c.misspelled.kind === 'spoken';
        a.surface = w;
        a.display.unshift({ text: w, gloss: c.misspelled.shown || c.misspelled.text, kind: 'note', note: spoken ? c.misspelled.note : 'viết sai chính tả — ' + c.misspelled.note });
        a.type = 'misspelled'; a.warnings.push(spoken ? 'spoken-form' : 'misspelling'); a.features.push(spoken ? 'spoken-form' : 'misspelling');
        a.confidence = clampN(c.conf, 0, 1); a.confidenceLabel = a.confidence >= 0.8 ? 'high' : a.confidence >= 0.55 ? 'medium' : 'low';
        return a;
      }
      const a = { surface: w, type: c.type, lemma: c.lemma, pos: c.entry ? c.entry.pos : null, known: !!c.known, entry: c.entry || null,
        confidence: clampN(c.conf, 0, 1), confidenceLabel: 'low', score: c.score, display: [], summary: '', warnings: [], alternatives: [],
        features: [], stemHint: null, notes: [], grammar: null };
      const line = (text, gloss, kind, note) => a.display.push({ text, gloss, kind, note: note || undefined });
      const NOT_FOUND = '(chưa có trong từ điển cục bộ)';
      const grammar = { role: c.type, pos: a.pos, lemma: c.lemma, particles: [], ending: null, prefinal: [], tense: null, honorific: false, copula: false, aux: null, contracted: !!c.contracted, parts: null };
      a.grammar = grammar;

      if (c.type === 'word') {
        const isPred = this.dict.isPredicate(c.entry) && w.endsWith('다');
        a.summary = coreMeaning(c.entry);
        line(w, shortGloss(c.entry), isPred ? 'lemma' : 'stem', isPred ? ('dạng từ điển' + (Hon.note(w) ? ' · ' + Hon.note(w) : '')) : Hon.note(w));
        a.features.push(isPred ? 'dictionary-form' : 'base');
        if (Hon.note(w)) { a.notes.push({ kind: 'honorific', id: w, text: Hon.note(w) }); grammar.honorific = true; }
      } else if (c.type === 'nominal') {
        const g = c.known ? shortGloss(c.entry) : NOT_FOUND;
        if (c.contracted) line(w, c.contracted[0] + ' + ' + c.contracted.slice(1).map((f) => '-' + f).join(' + '), 'note', 'dạng rút gọn');
        line(c.contracted ? c.contracted[0] : c.stemText, g, 'stem', this._nounNote(c));
        this._particleLines(a, c.chain, line);
        a.summary = c.known ? composeNominal(coreMeaning(c.entry), c.chain) : '';
        a.features.push('noun+particle');
        if (c.contracted) a.features.push('contracted');
        a.stemHint = c.stemText;
        grammar.particles = c.chain.map(particleInfo);
      } else if (c.type === 'particle') {
        line(w, 'trợ từ đứng riêng', 'note', 'thường dính vào danh từ đứng trước');
        this._particleLines(a, c.chain, line);
        a.features.push('particle');
        grammar.particles = c.chain.map(particleInfo);
        a.lemma = w;
      } else if (c.type === 'copula') {
        this._copulaLines(a, c, w, line, NOT_FOUND);
        grammar.copula = true; grammar.ending = { id: '이다 ' + c.copula.c, kind: c.copula.adn ? 'adnominal' : c.copula.nom ? 'nominalizer' : c.copula.rel ? 'connective' : 'final', lvl: c.copula.lvl || null, sent: c.copula.sent || null, rel: c.copula.rel || null, label: c.copula.label, lv: null };
        a.notes.push({ kind: 'copula', id: '이다', text: 'danh từ + 이다 = “là”: ' + c.copula.label });
      } else if (c.type === 'predicate') {
        this._predicateLines(a, c, line, NOT_FOUND);
      } else if (c.type === 'compound') {
        this._compoundLines(a, c, line);
      } else if (c.type === 'segmented') {
        const subs = c.parts.map((p) => this._toAnalysis(p.cand, p.text, []));
        line(subs.map((s) => s.surface).join(' + '), '', 'note', 'viết liền không dấu cách — đã tự tách thành từng từ');
        subs.forEach((s) => { for (const l of s.display) a.display.push(l); a.notes = a.notes.concat(s.notes); a.features.push(...s.features.filter((f) => !a.features.includes(f))); });
        a.summary = subs.map((s) => s.summary).filter(Boolean).join(' + ');
        a.features.push('segmented');
        a.warnings.push('segmented');
        grammar.parts = subs.map((s) => s.grammar);
        a.parts = subs;
        const lastSub = subs[subs.length - 1];
        grammar.ending = lastSub.grammar.ending; grammar.tense = lastSub.grammar.tense; grammar.honorific = subs.some((s) => s.grammar.honorific);
        a.lemma = subs[0].lemma; a.entry = subs[0].entry; a.pos = subs[0].pos;
      } else {
        line(w, NOT_FOUND, 'stem');
        a.warnings.push('not-in-dictionary');
      }
      a.posLabel = POS_LABEL[a.pos] || '';
      grammar.pos = a.pos;
      if (!c.known && c.type !== 'unknown') a.warnings.push('stem-not-in-dictionary');
      if (a.confidence < 0.55) a.warnings.push('low-confidence');
      a.confidenceLabel = a.confidence >= 0.8 ? 'high' : a.confidence >= 0.55 ? 'medium' : 'low';
      const seenAlt = new Set([c.type + '|' + c.lemma]);
      a.alternatives = [];
      for (const o of others) {
        const key = o.type + '|' + o.lemma;
        if (seenAlt.has(key) || (c.known && !o.known)) continue; // never offer guesses next to a dictionary-backed reading
        seenAlt.add(key);
        a.alternatives.push(this._lite(o, w));
        if (a.alternatives.length >= 3) break;
      }
      return a;
    }
    _lite(o, w) {
      const a = this._toAnalysis(o, w, []);
      return { lemma: a.lemma, type: a.type, summary: a.summary, display: a.display, confidence: a.confidence, known: a.known, pos: a.pos };
    }
    _particleLines(a, chain, line) {
      for (const p of chain) {
        line('-' + p.form, p.label, 'particle');
        if (p.note) a.notes.push({ kind: 'particle', id: p.key, text: p.label, note: p.note });
        else a.notes.push({ kind: 'particle', id: p.key, text: p.label });
      }
    }
    _copulaLines(a, c, w, line, NOT_FOUND) {
      const f = c.copula, cm = f.compose || {};
      if (c.standalone) {
        line(w, f.label, 'copula', 'dạng của 이다 = là (đứng riêng)');
        a.summary = '';
        a.features.push('copula-only');
        a.lemma = '이다'; a.pos = 'cop';
        return;
      }
      const g = c.known ? shortGloss(c.entry) : NOT_FOUND;
      if (c.bound) {
        line(w, c.stemText + ' + -' + c.tail, 'note', 'dạng rút gọn');
        line(c.stemText, g, 'stem', '거 = 것 (khẩu ngữ)');
        line('-' + c.tail, f.label, 'copula', '이다 = là');
      } else if (c.merged) {
        const rem = toCompat(nfd(w).slice(nfd(c.stemText).length));
        line(c.stemText, g, 'stem', this._nounNote(c));
        line('-' + rem, f.label, 'copula', '이다 (-' + c.tail + ') rút gọn thành -' + rem);
      } else {
        line(c.stemText, g, 'stem', this._nounNote(c));
        if (c.plural) { const pl = P.PARTICLES.find((p) => p.form === '들'); line('-들', pl ? pl.label : 'hậu tố số nhiều', 'particle', pl && pl.note ? pl.note : undefined); }
        line('-' + c.tail, f.label, 'copula', '이다 = là');
      }
      a.summary = c.known ? say(coreMeaning(c.entry), { pre: cm.pre, post: cm.post, parens: [cm.style, cm.paren, c.plural ? 'số nhiều' : null] }) : '';
      a.features.push('noun+copula');
      if (c.merged || c.bound) a.features.push('contracted');
      a.stemHint = c.stemText;
    }
    _predicateLines(a, c, line, NOT_FOUND) {
      const pos = c.info.pos;
      const view = specView(c.spec, pos);
      const g = c.known ? shortGloss(c.entry) : NOT_FOUND;
      const first = c.known ? coreMeaning(c.entry) : '';
      const lemmaNote = c.synthesized ? 'suy ra từ danh từ + gốc phái sinh' : (c.known ? Hon.note(c.lemma) : 'đoán từ gốc');
      line(c.lemma, g, 'lemma', lemmaNote);
      const tw = tenseWords(c.combo);
      if (c.combo.length) {
        const grp = say(first, { tense: tw, parens: [c.combo.includes('H') ? 'kính ngữ' : ''] });
        line(c.chainText + '-', c.known ? grp : '', 'stem', c.combo.map((x) => En.PREFINAL[x].id + ' = ' + En.PREFINAL[x].label).join('; '));
        for (const x of c.combo) a.notes.push({ kind: 'prefinal', id: En.PREFINAL[x].id, text: En.PREFINAL[x].label });
      }
      this._endingLines(a, c, line, c.headSurface || a.surface);
      if (c.trailing) {
        c.trailing.forEach((p, i) => { line('-' + p.form, p.label, 'particle', i === 0 ? c.trailingNote : undefined); a.notes.push({ kind: 'particle', id: p.key, text: p.label, note: p.note || undefined }); });
      }
      let summary = say(first, { pre: view.compose.pre, tense: tw, post: view.compose.post, parens: [view.compose.style, c.combo.includes('H') ? 'kính ngữ' : '', view.compose.paren] });
      if (c.trailing) summary = composeNominal(summary.replace(/\s*\(.*\)$/, ''), c.trailing);
      a.summary = c.known ? summary : '';
      a.features.push(c.info.pos === 'adj' ? 'adjective-conjugation' : 'verb-conjugation');
      if (c.info.irr) a.features.push('irregular-' + c.info.irr);
      for (const code of c.combo) a.features.push('prefinal-' + code);
      a.features.push('ending:' + c.spec.id);
      a.stemHint = c.stemText;
      a.pos = c.entry ? c.entry.pos : (c.info.pos === 'adj' ? 'adj' : 'v');
      a.notes.push({ kind: 'ending', id: c.spec.id, text: view.label, note: c.spec.note || undefined, ex: c.spec.ex || undefined, lv: c.spec.lv || undefined });
      if (Hon.note(c.lemma)) a.notes.push({ kind: 'honorific', id: c.lemma, text: Hon.note(c.lemma) });
      const gr = a.grammar;
      gr.ending = endingInfo(c.spec); gr.prefinal = c.combo.slice(); gr.tense = tenseCode(c.combo);
      const hl = Hon.LEX.get(c.lemma);
      gr.honorific = c.combo.includes('H') || Cj.HON_LEX.has(c.stemText) || !!(hl && hl.type === 'hon');
      gr.particles = (c.trailing || []).map(particleInfo);
    }
    _compoundLines(a, c, line) {
      const h = c.head, t = c.tail, row = c.aux;
      const hg = h.known ? coreMeaning(h.entry) : '';
      line(h.lemma, this._gloss(h.entry, h.known), 'lemma', Hon.note(h.lemma));
      line(c.headStr + '-', 'nối với ' + t.lemma + ' (' + row.conn.join(' / ') + ')', 'stem');
      line(t.lemma, shortGloss(t.entry), 'lemma', row.label);
      this._endingLines(a, t, line, c.tailStr);
      const core = row.pat.replace(/\{x\}/g, hg || h.lemma);
      const v = specView(t.spec, 'v');
      a.summary = say(core, { pre: v.compose.pre, tense: tenseWords(t.combo), post: v.compose.post, parens: [v.compose.style, t.combo.includes('H') ? 'kính ngữ' : ''] });
      a.features.push('V-aux');
      a.lemma = h.lemma; a.entry = h.entry; a.pos = h.entry ? h.entry.pos : null;
      a.stemHint = h.stemText;
      a.notes.push({ kind: 'aux', id: row.key, text: row.label, lv: row.lv });
      a.notes.push({ kind: 'ending', id: t.spec.id, text: specView(t.spec, 'v').label, note: t.spec.note || undefined, ex: t.spec.ex || undefined, lv: t.spec.lv || undefined });
      const gr = a.grammar;
      gr.aux = { key: row.key, label: row.label };
      gr.ending = endingInfo(t.spec); gr.prefinal = t.combo.slice(); gr.tense = tenseCode(t.combo);
      gr.honorific = t.combo.includes('H') || h.combo.includes('H');
      gr.headEnding = endingInfo(h.spec);
      gr.headLemma = h.lemma;
      gr.auxLemma = t.lemma;
    }
    // Adds the final-ending line. `surface` is the string produced by chain + ending (jamo-level remainder is shown,
    // e.g. 갑니다 -> -ㅂ니다, 먹었습니다 -> -습니다); contracted forms fall back to the canonical ending id.
    _endingLines(a, c, line, surface) {
      const spec = c.spec;
      const view = specView(spec, c.info ? c.info.pos : 'v');
      const chainText = c.chainText;
      let rem = null;
      if (chainText && surface !== chainText && nfd(surface).startsWith(nfd(chainText))) rem = toCompat(nfd(surface).slice(nfd(chainText).length));
      const text = rem && rem.length ? '-' + rem : spec.id;
      const note = rem && rem.length ? (text !== spec.id ? spec.id : '') : 'dạng rút gọn khi nối với gốc từ';
      line(text, view.label, 'ending', note);
    }
  }

  K.Morphology = { KoreanMorphology, shortGloss, firstMeaning, coreMeaning, POS_LABEL, CONTRACTIONS, AUX, DERIV, fixSpelling, tenseWords };
  if (typeof module !== 'undefined' && module.exports) module.exports = K.Morphology;
})(typeof globalThis !== 'undefined' ? globalThis : this);
