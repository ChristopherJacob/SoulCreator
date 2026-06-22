import { SoulScore } from '../lib/scoring';

interface Props {
  result: SoulScore;
}

function tier(score: number): string {
  if (score >= 80) return 'great';
  if (score >= 60) return 'ok';
  return 'weak';
}

export function ScorePanel({ result }: Props) {
  return (
    <div className={`score-panel tier-${tier(result.score)}`}>
      <div className="score-gauge">
        <span className="score-number">{result.score}</span>
        <span className="score-max">/100</span>
      </div>
      <ul className="score-rows">
        {result.categories.map((c) => (
          <li key={c.key} className="score-row">
            <div className="score-row-head">
              <span className="score-row-label">{c.label}</span>
              <span className="score-row-value">{c.score}/{c.max}</span>
            </div>
            <div className="score-bar">
              <div className="score-bar-fill" style={{ width: `${(c.score / c.max) * 100}%` }} />
            </div>
            {c.score < c.max && <p className="score-tip">{c.tip}</p>}
          </li>
        ))}
      </ul>
    </div>
  );
}
