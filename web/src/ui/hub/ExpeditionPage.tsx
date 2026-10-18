import { useState } from 'react';
import { MEMORIES } from '../../config/memories';
import { deriveStats, isAdult, possessionPreview } from '../../core/character';
import { BAL } from '../../config/balance';
import { canBuyBloodBags } from '../../core/meta/expedition';
import { children, patriarch } from '../../core/meta/growth';
import { useGame } from '../../store/gameStore';
import { passiveInfo } from '../../config/passives';
import { ClassTag, PassiveTag, SkillTag, TraitTag, personalityName, pct } from '../common';

export function ExpeditionPage() {
  const { game, startRun, setTab } = useGame();
  const [team, setTeam] = useState<string[]>([]);
  const [diff, setDiff] = useState<1 | 2>(1);
  const [bags, setBags] = useState(0);
  if (!game) return null;
  const bagsOpen = canBuyBloodBags(game);
  const bagCount = bagsOpen ? Math.min(bags, BAL.bloodBagMax, Math.floor(game.gold / BAL.bloodBagPrice)) : 0;
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
        共 4 层，每层是若干相连的房间：击破守卫房才能下楼，第 4 层是首领【审判官·格雷】的审判庭。支路敌群守着宝箱、可以绕开；血库残罐可休整一次；撞上巡逻队会被伏击。下楼时全员恢复{' '}
        {Math.round(BAL.floorHeal * 100)}% 生命，不在战斗中可随时撤退（保留全部战利品）。族长战败则血遁返回，战利品损失 50%。出征消耗当月时间，返回后自动进行月度结算。
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
      <div className="panel row">
        <span>血袋（每袋 {BAL.bloodBagPrice} 金，探索中对单人使用，回复 {Math.round(BAL.bloodBagHeal * 100)}% 生命）：</span>
        {bagsOpen ? (
          Array.from({ length: BAL.bloodBagMax + 1 }, (_, n) => (
            <button key={n} className={bagCount === n ? 'active' : ''} disabled={n * BAL.bloodBagPrice > game.gold} onClick={() => setBags(n)}>
              {n}
            </button>
          ))
        ) : (
          <span className="dim">血浆站有人在岗后才能购买</span>
        )}
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
        <button className="primary" disabled={valid.length === 0} onClick={() => startRun(valid, diff, bagCount)}>
          出征 ▶{bagCount > 0 ? `（花费 ${bagCount * BAL.bloodBagPrice} 金）` : ''}
        </button>
      </div>
    </div>
  );
}
