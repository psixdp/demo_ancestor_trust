import { useState } from 'react';
import { LOCUS_NAMES, allelesOf } from '../../config/alleles';
import { BAL } from '../../config/balance';
import { EXP_NAMES, MEMORY_LIST } from '../../config/memories';
import { makeGenome } from '../../core/genetics';
import { advanceMonth } from '../../core/meta/month';
import { nextId } from '../../core/meta/growth';
import { LOCI, type Character, type ExpKey, type Genome, type LocusId, type TraumaId } from '../../core/types';
import { useGame } from '../../store/gameStore';

function GenomeEditor({ genome, onChange }: { genome: Genome; onChange: (l: LocusId, i: 0 | 1, id: string, dormant: boolean) => void }) {
  return (
    <table className="genome">
      <tbody>
        {LOCI.map((l) => (
          <tr key={l}>
            <td className="dim">{LOCUS_NAMES[l]}</td>
            {([0, 1] as const).map((i) => (
              <td key={i}>
                <select value={genome[l][i].id} onChange={(e) => onChange(l, i, e.target.value, genome[l][i].dormant)}>
                  {allelesOf(l).map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
                <label style={{ fontSize: 11 }}>
                  <input type="checkbox" checked={genome[l][i].dormant} onChange={(e) => onChange(l, i, genome[l][i].id, e.target.checked)} />
                  休眠
                </label>
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

const DEFAULT_SPEC = {
  L1: ['wide', 'wide'],
  L2: ['balanced', 'balanced'],
  L3: ['normalSpeed', 'normalSpeed'],
  L4: ['fang', 'fang'],
  L5: ['zealot', 'zealot'],
  L6: ['normalLife', 'normalLife'],
} as Record<LocusId, [string, string]>;

export function DebugPage() {
  const { game, edit, debug, setDebug, aiDelay, setAiDelay, toast } = useGame();
  const [charId, setCharId] = useState('');
  const [months, setMonths] = useState(1);
  const [spawnGenome, setSpawnGenome] = useState<Genome>(() => makeGenome(DEFAULT_SPEC));
  const [balText, setBalText] = useState(() => JSON.stringify(BAL, null, 1));
  if (!game) return null;
  const c = game.members.find((m) => m.id === charId);

  const editChar = (fn: (c: Character) => void) =>
    edit((g) => {
      const m = g.members.find((x) => x.id === charId);
      if (m) fn(m);
    });

  return (
    <div className="col">
      <h2>调试面板</h2>
      <div className="panel col">
        <h4>AI 观察</h4>
        <div className="row">
          <label>
            <input type="checkbox" checked={debug.aiPanel} onChange={(e) => setDebug({ aiPanel: e.target.checked })} /> AI 打分面板
          </label>
          <label>
            <input type="checkbox" checked={debug.heatmap} onChange={(e) => setDebug({ heatmap: e.target.checked })} /> 格子热力图
          </label>
          <label>
            <input type="checkbox" checked={debug.stepMode} onChange={(e) => setDebug({ stepMode: e.target.checked })} /> 单步模式
          </label>
          <span>AI 行动间隔</span>
          <input type="number" value={aiDelay} style={{ width: 70 }} onChange={(e) => setAiDelay(Number(e.target.value))} /> ms
        </div>
      </div>
      <div className="panel col">
        <h4>资源与时间</h4>
        <div className="row">
          <button onClick={() => edit((g) => void (g.gold += 1000))}>金币 +1000</button>
          <button onClick={() => edit((g) => void (g.mutagen += 5))}>原液 +5</button>
          <button onClick={() => edit((g) => void (g.soul.soulXP += 100))}>历练点 +100</button>
          <button onClick={() => edit((g) => void (g.soul.pool = [...new Set([...g.soul.pool, ...MEMORY_LIST.filter((m) => m.category !== 'psyche').map((m) => m.id)])]))}>
            解锁全部记忆
          </button>
          <button onClick={() => edit((g) => void ((g.license = true), (g.tier = 'B')))}>直接晋升 B 级</button>
          <span className="grow" />
          <input type="number" min={1} value={months} style={{ width: 60 }} onChange={(e) => setMonths(Number(e.target.value))} />
          <button
            onClick={() =>
              edit((g) => {
                for (let i = 0; i < months && !g.gameOver; i++) {
                  advanceMonth(g);
                  g.pendingEvent = null;
                }
              })
            }
          >
            跳过 N 个月（忽略事件）
          </button>
        </div>
      </div>

      <div className="panel col">
        <h4>角色编辑</h4>
        <select value={charId} onChange={(e) => setCharId(e.target.value)}>
          <option value="">选择成员</option>
          {game.members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
        {c && (
          <>
            <div className="row">
              {(['devotion', 'suspicion', 'stress', 'ageMonths'] as const).map((k) => (
                <label key={k}>
                  {{ devotion: '狂信', suspicion: '疑心', stress: '应激', ageMonths: '年龄' }[k]}{' '}
                  <input type="number" value={c[k]} style={{ width: 60 }} onChange={(e) => editChar((m) => void (m[k] = Number(e.target.value)))} />
                </label>
              ))}
            </div>
            <GenomeEditor genome={c.genome} onChange={(l, i, id, d) => editChar((m) => void (m.genome[l][i] = { id, dormant: d }))} />
            <div className="row">
              创伤：
              {(['bone', 'nerve', 'organ', 'blood'] as TraumaId[]).map((t) => (
                <button key={t} className="small" onClick={() => editChar((m) => void (m.traumas.length < 3 && m.traumas.push(t)))}>
                  +{t}
                </button>
              ))}
              <button className="small" onClick={() => editChar((m) => void ((m.traumas = []), (m.wear = 0)))}>
                清空
              </button>
            </div>
            <div className="row">
              特性：
              <select
                value=""
                onChange={(e) => {
                  const id = e.target.value;
                  const def = MEMORY_LIST.find((x) => x.id === id);
                  if (!def) return;
                  editChar((m) => {
                    if (def.source === 'shadow') m.shadows = [...new Set([...m.shadows, id])];
                    else if (!m.traits.includes(id) && m.traits.length < BAL.childTraitCap) m.traits.push(id);
                  });
                }}
              >
                <option value="">添加特性/阴影…</option>
                {MEMORY_LIST.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
              {[...c.traits, ...c.shadows].map((t) => (
                <button key={t} className="small" onClick={() => editChar((m) => void ((m.traits = m.traits.filter((x) => x !== t)), (m.shadows = m.shadows.filter((x) => x !== t))))}>
                  {MEMORY_LIST.find((x) => x.id === t)?.name} ✕
                </button>
              ))}
            </div>
            <div className="row">
              {(Object.keys(EXP_NAMES) as ExpKey[]).map((k) => (
                <label key={k} style={{ fontSize: 12 }}>
                  {EXP_NAMES[k]}{' '}
                  <input
                    type="number"
                    value={c.experience[k] ?? 0}
                    style={{ width: 50 }}
                    onChange={(e) => editChar((m) => void (m.experience[k] = Number(e.target.value)))}
                  />
                </label>
              ))}
            </div>
          </>
        )}
      </div>

      <div className="panel col">
        <h4>按指定基因型生成成年子嗣</h4>
        <GenomeEditor
          genome={spawnGenome}
          onChange={(l, i, id, d) => {
            const g2 = structuredClone(spawnGenome);
            g2[l][i] = { id, dormant: d };
            setSpawnGenome(g2);
          }}
        />
        <button
          onClick={() =>
            edit((g) => {
              g.members.push({
                id: nextId(g, 'c'),
                name: `测试体${g.nextId}`,
                generation: 9,
                ageMonths: BAL.adultAge,
                genome: structuredClone(spawnGenome),
                traumas: [],
                wear: 0,
                parents: { family: '调试', partner: '调试' },
                job: null,
                classId: null,
                breedCooldown: 0,
                devotion: 60,
                suspicion: 10,
                stress: 0,
                experience: {},
                traits: [],
                shadows: [],
                declinedTraits: [],
                isPatriarch: false,
                syncMul: 1,
                activeSlots: 0,
                monthFlags: {},
              });
            })
          }
        >
          生成
        </button>
      </div>

      <div className="panel col">
        <h4>数值配置（BAL，运行时修改）</h4>
        <textarea rows={12} value={balText} onChange={(e) => setBalText(e.target.value)} style={{ fontFamily: 'monospace', fontSize: 12 }} />
        <div className="row">
          <button
            onClick={() => {
              try {
                Object.assign(BAL, JSON.parse(balText));
                toast('配置已应用');
              } catch {
                toast('JSON 格式错误', false);
              }
            }}
          >
            应用
          </button>
          <button onClick={() => setBalText(JSON.stringify(BAL, null, 1))}>重新读取</button>
        </div>
      </div>
    </div>
  );
}
