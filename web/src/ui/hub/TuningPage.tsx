import { useEffect, useReducer, useRef, useState } from 'react';
import {
  TUNING_FIELDS,
  TUNING_GROUPS,
  defaultValue,
  exportTuning,
  getOverrides,
  getValue,
  groupPaths,
  importTuning,
  isModified,
  matrixCellPath,
  resetAll,
  resetField,
  resetGroup,
  setValue,
  type TuningField,
  type TuningGroup,
} from '../../config/tuning';
import { useGame } from '../../store/gameStore';
import { download } from '../common';

const toDisplay = (f: TuningField, v: number) => (f.pct ? Number((v * 100).toFixed(4)) : v);
const fromDisplay = (f: TuningField, d: number) => (f.pct ? Number((d / 100).toFixed(6)) : d);

/** Keeps its own text so partial input like "-" or "0." is not rejected mid-typing. */
function NumInput({ field, onChange, width = 80 }: { field: TuningField; onChange: () => void; width?: number }) {
  const shown = toDisplay(field, getValue(field.path));
  const [text, setText] = useState(String(shown));
  useEffect(() => {
    setText((t) => (t.trim() !== '' && Number(t) === shown ? t : String(shown)));
  }, [shown]);
  const min = field.min === undefined ? undefined : toDisplay(field, field.min);
  const max = field.max === undefined ? undefined : toDisplay(field, field.max);
  return (
    <input
      type="number"
      value={text}
      step={field.step}
      min={min}
      max={max}
      className={isModified(field.path) ? 'tuned' : ''}
      style={{ width }}
      title={`${field.path}\n默认 ${toDisplay(field, defaultValue(field.path))}${field.pct ? '%' : ''}`}
      onChange={(e) => {
        setText(e.target.value);
        const d = Number(e.target.value);
        if (e.target.value.trim() === '' || !Number.isFinite(d)) return;
        if ((min !== undefined && d < min) || (max !== undefined && d > max)) return;
        setValue(field.path, fromDisplay(field, d));
        onChange();
      }}
      onBlur={() => setText(String(toDisplay(field, getValue(field.path))))}
    />
  );
}

function matches(f: TuningField, q: string, onlyModified: boolean): boolean {
  if (onlyModified && !isModified(f.path)) return false;
  if (!q) return true;
  return f.label.toLowerCase().includes(q) || f.path.toLowerCase().includes(q);
}

function ListGroup({ g, q, onlyModified, bump }: { g: Extract<TuningGroup, { kind: 'list' }>; q: string; onlyModified: boolean; bump: () => void }) {
  const rows = g.fields.filter((f) => matches(f, q, onlyModified));
  if (!rows.length) return null;
  return (
    <table className="tuning-list">
      <tbody>
        {rows.map((f) => {
          const mod = isModified(f.path);
          return (
            <tr key={f.path} className={mod ? 'tuned-row' : ''}>
              <td style={{ width: 220 }}>{f.label}</td>
              <td className="dim" style={{ fontSize: 11, width: 200 }}>
                {f.path.replace(/^BAL\./, '')}
              </td>
              <td style={{ width: 120 }}>
                <NumInput field={f} onChange={bump} />
                {f.pct && <span className="dim"> %</span>}
              </td>
              <td className="dim" style={{ fontSize: 12 }}>
                默认 {toDisplay(f, defaultValue(f.path))}
                {f.pct ? '%' : ''}
              </td>
              <td style={{ width: 40 }}>
                {mod && (
                  <button className="small" title="恢复默认" onClick={() => (resetField(f.path), bump())}>
                    ↺
                  </button>
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function MatrixGroup({ g, q, onlyModified, bump }: { g: Extract<TuningGroup, { kind: 'matrix' }>; q: string; onlyModified: boolean; bump: () => void }) {
  const visible = (row: string, col: string) => {
    const p = matrixCellPath(g.root, row, col);
    return p ? matches(TUNING_FIELDS[p], q, onlyModified) : false;
  };
  const rows = g.rows.filter((r) => g.cols.some((c) => visible(r.key, c.key)));
  if (!rows.length) return null;
  return (
    <table className="tuning-matrix">
      <thead>
        <tr>
          <th />
          {g.cols.map((c) => (
            <th key={c.key}>{c.label}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.key}>
            <th>{r.label}</th>
            {g.cols.map((c) => {
              const p = matrixCellPath(g.root, r.key, c.key);
              if (!p) return <td key={c.key} className="dim">—</td>;
              const f = TUNING_FIELDS[p];
              return (
                <td key={c.key} className={isModified(p) ? 'tuned-row' : ''} title={`默认 ${defaultValue(p)}`}>
                  <NumInput field={f} onChange={bump} width={64} />
                  {isModified(p) && (
                    <button className="small" title={`恢复默认 ${defaultValue(p)}`} onClick={() => (resetField(p), bump())}>
                      ↺
                    </button>
                  )}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function TuningPage() {
  const { toast } = useGame();
  const [, bump] = useReducer((x: number) => x + 1, 0);
  const [query, setQuery] = useState('');
  const [onlyModified, setOnlyModified] = useState(false);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const fileRef = useRef<HTMLInputElement>(null);
  const q = query.trim().toLowerCase();
  const total = Object.keys(getOverrides()).length;
  const filtering = !!q || onlyModified;

  const onImport = async (file: File) => {
    const res = importTuning(await file.text());
    if (res.ok) toast(`已导入 ${res.applied} 项${res.ignored ? `，忽略 ${res.ignored} 项未知或非法数值` : ''}`);
    else toast(res.msg, false);
    bump();
  };

  return (
    <div className="col">
      <h2>数值配置</h2>
      <div className="panel row">
        <input placeholder="搜索中文名或字段名" value={query} style={{ width: 220 }} onChange={(e) => setQuery(e.target.value)} />
        <label>
          <input type="checkbox" checked={onlyModified} onChange={(e) => setOnlyModified(e.target.checked)} /> 只看已修改
        </label>
        <span className={total ? 'warn' : 'dim'}>已修改 {total} 项</span>
        <span className="grow" />
        <button onClick={() => download(`ancestor-trust-tuning.json`, exportTuning())}>导出 JSON</button>
        <button onClick={() => fileRef.current?.click()}>导入 JSON</button>
        <input
          ref={fileRef}
          type="file"
          accept=".json,application/json"
          style={{ display: 'none' }}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void onImport(file);
            e.target.value = '';
          }}
        />
        <button
          disabled={!total}
          onClick={() => {
            if (!confirm(`恢复全部 ${total} 项为默认值？`)) return;
            resetAll();
            bump();
            toast('已全部恢复默认');
          }}
        >
          全部恢复默认
        </button>
      </div>
      <div className="dim" style={{ fontSize: 12 }}>
        改动立即生效并保存在本机，刷新后保留；进行中的战斗在下一次 AI 打分时使用新值。已经生成的角色、市场等不会回溯。
      </div>

      {TUNING_GROUPS.map((g) => {
        const paths = groupPaths(g.id);
        const modCount = paths.filter(isModified).length;
        const anyVisible = paths.some((p) => matches(TUNING_FIELDS[p], q, onlyModified));
        if (filtering && !anyVisible) return null;
        const open = filtering || !collapsed[g.id];
        return (
          <div key={g.id} className="panel col">
            <div className="row">
              <button className="small" onClick={() => setCollapsed({ ...collapsed, [g.id]: open })}>
                {open ? '▾' : '▸'}
              </button>
              <h4 style={{ margin: 0 }}>{g.name}</h4>
              {modCount > 0 && <span className="warn" style={{ fontSize: 12 }}>已修改 {modCount}</span>}
              <span className="grow" />
              {modCount > 0 && (
                <button className="small" onClick={() => (resetGroup(g.id), bump())}>
                  本组恢复默认
                </button>
              )}
            </div>
            {open && g.hint && <div className="dim" style={{ fontSize: 12 }}>{g.hint}</div>}
            {open && g.kind === 'list' && <ListGroup g={g} q={q} onlyModified={onlyModified} bump={bump} />}
            {open && g.kind === 'matrix' && <MatrixGroup g={g} q={q} onlyModified={onlyModified} bump={bump} />}
          </div>
        );
      })}
    </div>
  );
}
