import { useState } from 'react';
import { MEMORIES } from '../../config/memories';
import { deriveStats, isAdult, possessionPreview } from '../../core/character';
import { children, patriarch } from '../../core/meta/growth';
import { useGame } from '../../store/gameStore';
import { passiveInfo } from '../../config/passives';
import { ClassTag, PassiveTag, SkillTag, TraitTag, personalityName, pct } from '../common';

export function ExpeditionPage() {
  const { game, startRun, setTab } = useGame();
  const [team, setTeam] = useState<string[]>([]);
  const [diff, setDiff] = useState<1 | 2>(1);
  if (!game) return null;
  const pat = patriarch(game);
  const pst = deriveStats(pat, game.soul);
  const adults = children(game).filter(isAdult);
  const business = game.soul.equipped.filter((id) => MEMORIES[id]?.category === 'business');
  const toggle = (id: string) => setTeam(team.includes(id) ? team.filter((x) => x !== id) : team.length < 2 ? [...team, id] : team);
  const valid = team.filter((id) => adults.some((a) => a.id === id));

  return (
    <div className="col">
      <h2>地下城出征 · 旧城区地下血库遗址</h2>
      <div className="panel dim">
        共 4 层：1~3 层为普通遭遇，第 4 层为首领【审判官·格雷】。每层胜利后全员恢复 20% 生命，可继续或撤退（撤退保留全部战利品）。族长战败则血遁返回，战利品损失
        50%。出征消耗当月时间，返回后自动进行月度结算。
      </div>
      <div className="panel col">
        <h4>族长</h4>
        <div>
          👑 {pat.name} · HP {pst.hp} · ATK {pst.atk} · DEF {pst.def} · SPD {pst.spd} · MOV {pst.mov}
        </div>
        <div className="row">
          <ClassTag classId={pat.classId} />
          技能：
          <SkillTag id="basic" />
          {pst.skills.map((s) => (
            <SkillTag key={s} id={s} />
          ))}
          {game.soul.equipped
            .filter((id) => MEMORIES[id]?.kind === 'active')
            .map((id) => (
              <SkillTag key={id} id={MEMORIES[id].skill!} />
            ))}
          被动：
          {game.soul.equipped
            .filter((id) => MEMORIES[id]?.kind === 'passive')
            .map((id) => (
              <TraitTag key={id} id={id} />
            ))}
          <button className="small" onClick={() => setTab('memory')}>
            调整记忆装配
          </button>
        </div>
        {business.length > 0 && <div className="warn">当前装配了经营类记忆（{business.map((b) => MEMORIES[b].name).join('、')}），在战斗中无效。</div>}
      </div>
      <div className="panel col">
        <h4>选择 1~2 名随行子嗣（{valid.length}/2）</h4>
        {adults.length === 0 && <div className="warn">没有成年子嗣。</div>}
        <div className="grid3">
          {adults.map((c) => {
            const st = deriveStats(c, game.soul);
            const on = team.includes(c.id);
            return (
              <div key={c.id} className={`card ${on ? 'selected' : ''}`} style={{ cursor: 'pointer' }} onClick={() => toggle(c.id)}>
                <div className="row">
                  <b>{c.name}</b>
                  <span className="tag">{personalityName(c.genome)}</span>
                  <ClassTag classId={c.classId} />
                  <span className="grow" />
                  {on && <span className="gold">✓ 随行</span>}
                </div>
                <div className="dim" style={{ fontSize: 12 }}>
                  HP {st.hp} ATK {st.atk} DEF {st.def} ARM {st.arm} SPD {st.spd} MOV {st.mov} EVA {pct(st.eva)}
                </div>
                <div style={{ fontSize: 12 }}>
                  狂信 {c.devotion} · 疑心 <span className={c.suspicion >= 60 ? 'bad' : ''}>{c.suspicion}</span> · 应激 {c.stress} · 同步率{' '}
                  {possessionPreview(c).sync}%
                </div>
                <div>
                  <SkillTag id="basic" />
                  {st.skills.map((s) => (
                    <SkillTag key={s} id={s} />
                  ))}
                  {st.passives
                    .filter((p) => passiveInfo(p).source === 'job' || passiveInfo(p).locus === 'L4')
                    .map((p) => (
                      <PassiveTag key={p} id={p} />
                    ))}
                  {c.traits.map((t) => (
                    <TraitTag key={t} id={t} />
                  ))}
                  {c.shadows.map((t) => (
                    <TraitTag key={t} id={t} kind="shadow" />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <div className="row">
        <span>难度：</span>
        <button className={diff === 1 ? 'active' : ''} onClick={() => setDiff(1)}>
          I
        </button>
        <button className={diff === 2 ? 'active' : ''} disabled={game.tier !== 'B'} onClick={() => setDiff(2)}>
          II（敌人 ×1.4，掉落 ×1.6，需 B 级）
        </button>
        <span className="grow" />
        <button className="primary" disabled={valid.length === 0} onClick={() => startRun(valid, diff)}>
          出征 ▶
        </button>
      </div>
    </div>
  );
}
