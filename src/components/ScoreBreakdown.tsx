import type { ScoreBreakdownRow } from '../domain/scoring';

/** 配点表（系統 / 得点 / 満点）。合否判定や正解の内容は含めない */
export function ScoreBreakdown({ rows }: { rows: ScoreBreakdownRow[] }) {
  const earned = rows.reduce((sum, r) => sum + r.earned, 0);
  const max = rows.reduce((sum, r) => sum + r.max, 0);
  return (
    <table className="score-breakdown">
      <caption>配点の内訳</caption>
      <thead>
        <tr>
          <th scope="col">系統</th>
          <th scope="col">得点</th>
          <th scope="col">満点</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.track} data-track={r.track}>
            <th scope="row">{r.label}</th>
            <td>{r.earned}</td>
            <td>{r.max}</td>
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr>
          <th scope="row">合計</th>
          <td>{earned}</td>
          <td>{max}</td>
        </tr>
      </tfoot>
    </table>
  );
}
