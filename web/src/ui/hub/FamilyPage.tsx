import { useState } from 'react';
import { BAL, FACILITIES } from '../../config/balance';
import { EXP_NAMES, EXPERIENCE_TRAITS, MEMORIES } from '../../config/memories';
import { deriveStats, isAdult, lifeStage, monthsToAging, monthsToDeath, possessionPreview } from '../../core/character';
import { counsel, holdGala, tierUp, train, treat } from '../../core/meta/actions';
import type { Character, GameState } from '../../core/types';
import { useGame } from '../../store/gameStore';
import { GenomeTable, Meter, PhenoTags, SkillTag, TraitTag, TraumaTag, personalityName, pct } from '../common';

function ExpProgress({ c, g }: { c: Character; g: GameState }) {
  const rows = EXPERIENCE_TRAITS.filter((et) => !(et.childOnly && c.isPatriarch)).map((et) => {
    const n = c.experience[et.exp] ?? 0;
    const owned = c.isPatriarch ? g.soul.pool.includes(et.traitId) : c.traits.includes(et.traitId);
    const declined = c.declinedTraits.includes(et.traitId);
    return { et, n, owned, declined };
  });
  return (
    <div style={{ fontSize: 12 }}>
      {rows.map(({ et, n, owned, declined }) => (
        <span key={et.traitId} className="prob" title={MEMORIES[et.traitId].desc}>
          <span className={owned ? 'good' : declined ? 'dim' : ''}>
            {MEMORIES[et.traitId].name}
          </span>{' '}
          <span className="dim">
            {EXP_NAMES[et.exp]} {Math.min(n, et.threshold)}/{et.threshold}
            {owned ? ' ✓' : declined ? ' ✗' : ''}
          </span>
        </span>
      ))}
    </div>
  );
}

function MemberCard({ c, g }: { c: Character; g: GameState }) {
  const act = useGame((s) => s.act);
  const [open, setOpen] = useState(false);
  const st = deriveStats(c, g.soul);
  const pv = possessionPreview(c);
  const toAging = monthsToAging(c);
  const adult = isAdult(c);
  return (
    <div className={`card ${c.isPatriarch ? 'patriarch' : ''}`}>
      <div className="row">
        <h3>
          {c.isPatriarch ? '👑 ' : ''}
          {c.name}
        </h3>
        <span className="dim">
          第 {c.generation} 代 · {c.ageMonths} 月 · {lifeStage(c)}
          {toAging > 0 ? `（距衰老 ${toAging} 月）` : `（${monthsToDeath(c)} 月后衰亡）`}
        </span>
        <span className="grow" />
        {!c.isPatriarch && <span className="tag">{personalityName(c.genome)}</span>}
      </div>
      <div>
        <PhenoTags genome={c.genome} />
      </div>
      <div className="dim" style={{ fontSize: 12 }}>
        HP {st.hp} · ATK {st.atk} · DEF {st.def} · ARM {st.arm} · SPD {st.spd} · MOV {st.mov} · EVA {pct(st.eva)} · 记忆槽 {st.slots}
        {st.delayResist ? ' · 抗推迟' : ''}
        {c.isPatriarch ? ` · 激活槽 ${c.activeSlots} · 属性系数 ×${c.syncMul.toFixed(3)}` : ''}
      </div>
      <div className="row">
        天生技能：
        {st.skills.map((s) => (
          <SkillTag key={s} id={s} />
        ))}
        <span className="grow" />
        岗位：
        <span className={c.job ? 'gold' : 'dim'}>{c.job ? FACILITIES[c.job].name : adult ? '空闲' : '幼年'}</span>
      </div>
      {!c.isPatriarch && (
        <div className="col" style={{ gap: 3 }}>
          <Meter label="狂信" value={c.devotion} color="#c9a35a" />
          <Meter label="疑心" value={c.suspicion} color="#b3263b" marks={[40, 60, 80]} />
          <Meter label="应激" value={c.stress} color="#8a6fc9" />
          <div className="dim" style={{ fontSize: 12 }}>
            夺舍同步率 <span className={pv.sync >= 60 ? 'good' : pv.sync >= BAL.possessionMinSync ? 'warn' : 'bad'}>{pv.sync}%</span> → 激活槽{' '}
            {pv.active}/{pv.slots}，属性 ×{pv.syncMul.toFixed(3)}
          </div>
        </div>
      )}
      <div className="row" style={{ gap: 2 }}>
        {c.traumas.map((t, i) => (
          <TraumaTag key={i} id={t} />
        ))}
        {c.wear > 0 && <span className="tag trauma">磨损 ×{c.wear}</span>}
        {c.traits.map((t) => (
          <TraitTag key={t} id={t} />
        ))}
        {c.shadows.map((t) => (
          <TraitTag key={t} id={t} kind="shadow" />
        ))}
        {!c.isPatriarch && (
          <span className="dim" style={{ fontSize: 12 }}>
            特性 {c.traits.length}/{BAL.childTraitCap}
          </span>
        )}
      </div>
      <div className="row">
        {!c.isPatriarch && (
          <button className="small" disabled={!!c.monthFlags.trained} onClick={() => act((g2) => train(g2, c.id))}>
            企业文化培训（{BAL.trainCost}）
          </button>
        )}
        <button
          className="small"
          disabled={!!c.monthFlags.treated || (c.traumas.length === 0 && c.wear === 0)}
          onClick={() => act((g2) => treat(g2, c.id))}
        >
          疗养（{BAL.treatCost}）
        </button>
        {c.shadows.map((s) => (
          <button key={s} className="small" disabled={!!c.monthFlags.counseled} onClick={() => act((g2) => counsel(g2, c.id, s))}>
            疏导【{MEMORIES[s].name}】（{BAL.counselCost}）
          </button>
        ))}
        <span className="grow" />
        <button className="small" onClick={() => setOpen(!open)}>
          {open ? '收起' : '详情'}
        </button>
      </div>
      {open && (
        <div className="col">
          <GenomeTable genome={c.genome} />
          <div className="dim" style={{ fontSize: 12 }}>
            父母：{c.parents ? `${c.parents.family} × ${c.parents.partner}` : '——（初代真祖）'} · 孕育冷却 {c.breedCooldown} 月
          </div>
          <div>经历进度：</div>
          <ExpProgress c={c} g={g} />
        </div>
      )}
    </div>
  );
}

export function FamilyPage() {
  const { game, act } = useGame();
  if (!game) return null;
  const sorted = [...game.members].sort((a, b) => Number(b.isPatriarch) - Number(a.isPatriarch) || b.ageMonths - a.ageMonths);
  return (
    <div className="col">
      <div className="row">
        <h2 className="grow">家族成员（{game.members.length}）</h2>
        <button disabled={game.monthFlags.gala} onClick={() => act(holdGala)}>
          家族公益晚宴（{BAL.galaCost}，全族疑心 −10）
        </button>
        <button disabled={game.tier === 'B'} onClick={() => act(tierUp)} title={`需要牌照 + 现金 ${BAL.tierUpGold}，花费 ${BAL.tierUpCost}`}>
          {game.tier === 'B' ? '已是 B 级' : `申请晋升 B 级（需牌照，现金≥${BAL.tierUpGold}，花费 ${BAL.tierUpCost}）`}
        </button>
      </div>
      {game.pregnancies.length > 0 && (
        <div className="panel">
          孕育中：
          {game.pregnancies.map((p) => (
            <span key={p.id} className="tag">
              {p.familyName} × {p.partner.name}（{p.monthsLeft} 月后出生）
            </span>
          ))}
        </div>
      )}
      <div className="grid2">
        {sorted.map((c) => (
          <MemberCard key={c.id} c={c} g={game} />
        ))}
      </div>
    </div>
  );
}
