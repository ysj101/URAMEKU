import { CASES, findCase } from './cases';
import { ARTICLE_LENGTH, LINK_SIZE } from '../domain/types';

/**
 * 設計上の整合チェック（MVP-014）。
 * MVP-006 のスキーマ検証は「不正データの拒否」が目的だが、こちらは
 * 「ゲームとして解けるか」を 5 件の実データに対して確認する。
 */
describe('事件データの設計整合', () => {
  for (const c of CASES) {
    describe(c.id, () => {
      const docIds = new Set(c.documents.map((d) => d.id));
      const costOf = (id: string) => c.documents.find((d) => d.id === id)?.cost ?? Infinity;

      it('必要証拠は実在する資料で、重複がない', () => {
        expect(new Set(c.required_evidence).size).toBe(c.required_evidence.length);
        for (const id of c.required_evidence) expect(docIds.has(id), id).toBe(true);
      });

      it('必要証拠の合計コストが予算以内', () => {
        const total = c.required_evidence.reduce((s, id) => s + costOf(id), 0);
        expect(total).toBeLessThanOrEqual(c.budget);
      });

      it('外れ資料を 1 件開いても必要証拠に到達できる（予算に 1 以上の余裕）', () => {
        const need = new Set([...c.required_evidence, ...c.required_link]);
        const total = [...need].reduce((s, id) => s + costOf(id), 0);
        expect(c.budget - total).toBeGreaterThanOrEqual(1);
      });

      it('照合の 2 枚は異なる実在資料', () => {
        expect(c.required_link.length).toBe(LINK_SIZE);
        expect(new Set(c.required_link).size).toBe(LINK_SIZE);
        for (const id of c.required_link) expect(docIds.has(id), id).toBe(true);
      });

      it('正解断片 3 つは headline_fragments に存在し、重複がない', () => {
        const fragIds = new Set(c.headline_fragments.map((f) => f.id));
        expect(c.correct_fragments.length).toBe(ARTICLE_LENGTH);
        expect(new Set(c.correct_fragments).size).toBe(ARTICLE_LENGTH);
        for (const id of c.correct_fragments) expect(fragIds.has(id), id).toBe(true);
      });

      it('数値検証メモは 2 問で、ID が重複しない', () => {
        expect(c.analysis_tasks.length).toBe(2);
        expect(new Set(c.analysis_tasks.map((t) => t.id)).size).toBe(2);
      });
    });
  }

  describe('case-01 固有（設計レビューで決めた方針）', () => {
    const c = findCase('case-01')!;
    const content = (id: string) => c.documents.find((d) => d.id === id)!.content;

    it('資料本文に検証メモの計算式や答えをそのまま書かない', () => {
      for (const id of c.required_evidence) {
        expect(content(id)).not.toMatch(/[÷=]/);
        expect(content(id)).not.toMatch(/90\s*%|45\s*%/);
      }
    });

    it('100・50・45 はそれぞれ 1 資料だけが一次数値として持つ', () => {
      expect(content('trial')).toContain('100人');
      expect(content('paid')).toContain('50人');
      expect(content('retained')).toContain('45人');
      expect(content('paid')).not.toContain('100人');
      expect(content('retained')).not.toContain('50人');
      expect(content('retained')).not.toContain('100人');
    });

    it('タイトルの「55人」= 登録者 100 − 翌月継続 45', () => {
      const all = c.analysis_tasks.find((t) => t.id === 'all')!;
      expect(c.title).toContain(String(100 - all.expected));
    });
  });
});
