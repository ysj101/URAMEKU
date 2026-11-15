import { migrate, toSaveDataV5 } from './migrations';
import { createProgress } from '../domain/game';

const mapping = [
  ['case-01', 'case-03'],
  ['case-02', 'case-04'],
  ['case-03', 'case-05'],
  ['case-04', 'case-06'],
  ['case-05', 'case-07'],
  ['case-06', 'case-01'],
  ['case-07', 'case-02'],
] as const;

describe('画面番号へのID移行', () => {
  it('衝突する7件の記録を題材ごとに移し、選択中の資料・履歴・完了状態を保持する', () => {
    const progress = Object.fromEntries(
      mapping.map(([id]) => [
        id,
        {
          ...createProgress(),
          opened: [id + '-document'],
        },
      ]),
    );
    const raw = {
      version: 4,
      gameVersion: 2,
      active: 'case-06',
      progress,
      finished: { 'case-01': true, 'case-06': true },
      caseRevisions: Object.fromEntries(mapping.map(([id], i) => [id, i + 1])),
      legacyProgress: progress,
      legacyFinished: { 'case-02': true },
      archivedProgress: { 'case-06@2': progress['case-06'], 'unknown@1': progress['case-01'] },
      session: { stage: 'article', lastDocumentId: 'responses' },
      revision: 12,
    };
    const snapshot = structuredClone(raw);
    const result = migrate(raw, 'case-01');
    expect(raw).toEqual(snapshot);
    expect(result.data.active).toBe('case-01');
    expect(result.data.session).toEqual(raw.session);
    expect(result.data.revision).toBe(12);
    expect(result.data.finished).toEqual({ 'case-03': true, 'case-01': true });
    expect(result.data.legacyFinished).toEqual({ 'case-04': true });
    for (const [oldId, newId] of mapping) {
      expect(result.data.progress[newId]).toEqual(progress[oldId]);
      expect(result.data.legacyProgress?.[newId]).toEqual(progress[oldId]);
      expect(result.data.caseRevisions?.[newId]).toBe(raw.caseRevisions[oldId]);
    }
    expect(result.data.archivedProgress).toEqual({
      'case-01@2': progress['case-06'],
      'unknown@1': progress['case-01'],
    });
    const saved = toSaveDataV5(result.data);
    expect(saved.version).toBe(5);
    expect(migrate(saved, 'case-01').data).toEqual(result.data);
  });

  it('移行元に選択中IDがなければ、新しいIDの既定値をそのまま使う', () => {
    expect(migrate({ version: 4 }, 'case-01').data.active).toBe('case-01');
  });
});
