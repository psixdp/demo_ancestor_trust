import { useState } from 'react';
import { LOCUS_DEFAULT } from '../../config/alleles';
import { BAL } from '../../config/balance';
import { CLASS_LIST, TIER_NAMES } from '../../config/classes';
import { MEMORY_LIST } from '../../config/memories';
import { deriveStats } from '../../core/character';
import { makeGenome } from '../../core/genetics';
import {
  DEFAULT_TEMPLATE_ID,
  STAT_FIELDS,
  buildCharacter,
  createCharacter,
  defaultTemplate,
  deleteTemplate,
  loadTemplates,
  newTemplateId,
  saveTemplate,
  type CharacterTemplate,
} from '../../core/meta/characterCreator';
import { LOCI, type Genome, type LocusId } from '../../core/types';
import { useGame } from '../../store/gameStore';
import { GenomeEditor, PassiveTag, SkillTag, TraitTag, personalityName, pct } from '../common';

const TRAIT_OPTIONS = MEMORY_LIST.filter((m) => m.kind === 'passive' && m.source !== 'shadow');
const SHADOW_OPTIONS = MEMORY_LIST.filter((m) => m.source === 'shadow');

function defaultGenome(): Genome {
  return makeGenome(Object.fromEntries(LOCI.map((l) => [l, [LOCUS_DEFAULT[l], LOCUS_DEFAULT[l]]])) as Record<LocusId, [string, string]>);
}

export function CharacterCreatorPage() {
  const { game, act, toast } = useGame();
  const [templates, setTemplates] = useState<CharacterTemplate[]>(loadTemplates);
  const [draft, setDraft] = useState<CharacterTemplate>(defaultTemplate);
  const [name, setName] = useState('');
  const [ageMonths, setAge] = useState(BAL.adultAge);
  const [devotion, setDevotion] = useState(60);
  const [suspicion, setSuspicion] = useState(10);
  const [stress, setStress] = useState(0);
  const [genome, setGenome] = useState<Genome>(defaultGenome);
  const [classId, setClassId] = useState<string | null>(null);
  const [traits, setTraits] = useState<string[]>([]);
  const [shadows, setShadows] = useState<string[]>([]);
  if (!game) return null;

  const isDefault = draft.id === DEFAULT_TEMPLATE_ID;
  const saved = isDefault ? defaultTemplate() : templates.find((t) => t.id === draft.id);
  const dirty = !isDefault && JSON.stringify(saved) !== JSON.stringify(draft);
  const all = [defaultTemplate(), ...templates];

  const spec = { name, template: draft, genome, classId, traits, shadows, ageMonths, devotion, suspicion, stress };
  const preview = buildCharacter(game, spec);
  const st = deriveStats(preview, game.soul);

  const pickTemplate = (id: string) => {
    const t = all.find((x) => x.id === id);
    if (t) setDraft(structuredClone(t));
  };
  const setStat = (k: keyof CharacterTemplate['stats'], v: number) => setDraft({ ...draft, stats: { ...draft.stats, [k]: v } });
  const toggle = (list: string[], set: (v: string[]) => void, id: string, cap = Infinity) => {
    if (list.includes(id)) set(list.filter((x) => x !== id));
    else if (list.length < cap) set([...list, id]);
  };

  return (
    <div className="col">
      <h2>角色创建器</h2>
      <div className="dim">
        模板 = 七项基础属性，保存在本机，所有存档共用。用自定义模板创建的角色只在自己身上生效：其子代出生、或被夺舍成为族长时，都回到默认模板。
      </div>

      <div className="panel col">
        <h4>① 基础属性模板</h4>
        <div className="row">
          {all.map((t) => (
            <button key={t.id} className={`small ${draft.id === t.id ? 'active' : ''}`} onClick={() => pickTemplate(t.id)}>
              {t.name}
            </button>
          ))}
          <span className="grow" />
          <button
            className="small"
            onClick={() => setDraft({ id: newTemplateId(), name: `${draft.name} 副本`, stats: { ...draft.stats } })}
          >
            以当前为底新建
          </button>
        </div>
        <div className="row">
          <label>
            名称{' '}
            <input value={draft.name} disabled={isDefault} onChange={(e) => setDraft({ ...draft, name: e.target.value })} style={{ width: 160 }} />
          </label>
          {STAT_FIELDS.map((f) => (
            <label key={f.key}>
              {f.label}{' '}
              <input
                type="number"
                step={f.step}
                value={draft.stats[f.key]}
                disabled={isDefault}
                style={{ width: 64 }}
                onChange={(e) => setStat(f.key, Number(e.target.value))}
              />
            </label>
          ))}
        </div>
        <div className="row">
          {isDefault ? (
            <span className="dim">默认模板只读（即 BAL.baseStats）；点“以当前为底新建”来编辑一个副本。</span>
          ) : (
            <>
              <span className={dirty || !saved ? 'warn' : 'good'}>{!saved ? '新模板，尚未保存' : dirty ? '有未保存的修改' : '已保存'}</span>
              <span className="grow" />
              <button
                className="small primary"
                disabled={!draft.name.trim()}
                onClick={() => {
                  setTemplates(saveTemplate({ ...draft, name: draft.name.trim() }));
                  toast(`模板【${draft.name.trim()}】已保存`);
                }}
              >
                保存模板
              </button>
              <button
                className="small"
                disabled={!saved}
                onClick={() => {
                  if (!confirm(`删除模板【${draft.name}】？已用它创建的角色不受影响。`)) return;
                  setTemplates(deleteTemplate(draft.id));
                  setDraft(defaultTemplate());
                }}
              >
                删除模板
              </button>
            </>
          )}
        </div>
      </div>

      <div className="panel col">
        <h4>② 角色配置</h4>
        <div className="row">
          <label>
            姓名 <input value={name} placeholder="无名氏" onChange={(e) => setName(e.target.value)} style={{ width: 120 }} />
          </label>
          <label>
            年龄(月) <input type="number" min={BAL.adultAge} value={ageMonths} style={{ width: 60 }} onChange={(e) => setAge(Number(e.target.value))} />
          </label>
          <label>
            狂信 <input type="number" value={devotion} style={{ width: 56 }} onChange={(e) => setDevotion(Number(e.target.value))} />
          </label>
          <label>
            疑心 <input type="number" value={suspicion} style={{ width: 56 }} onChange={(e) => setSuspicion(Number(e.target.value))} />
          </label>
          <label>
            应激 <input type="number" value={stress} style={{ width: 56 }} onChange={(e) => setStress(Number(e.target.value))} />
          </label>
          <label>
            职业{' '}
            <select value={classId ?? ''} onChange={(e) => setClassId(e.target.value || null)}>
              <option value="">无职业</option>
              {CLASS_LIST.map((c) => (
                <option key={c.id} value={c.id}>
                  {TIER_NAMES[c.tier]}·{c.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="row" style={{ alignItems: 'flex-start' }}>
          <div>
            <div className="dim">基因型</div>
            <GenomeEditor
              genome={genome}
              onChange={(l, i, id, d) => {
                const g2 = structuredClone(genome);
                g2[l][i] = { id, dormant: d };
                setGenome(g2);
              }}
            />
          </div>
          <div className="col grow" style={{ minWidth: 320 }}>
            <div>
              <span className="dim">
                后天特性（{traits.length}/{BAL.childTraitCap}）
              </span>
              <div className="row" style={{ gap: 4 }}>
                {TRAIT_OPTIONS.map((m) => (
                  <button
                    key={m.id}
                    className={`small ${traits.includes(m.id) ? 'active' : ''}`}
                    disabled={!traits.includes(m.id) && traits.length >= BAL.childTraitCap}
                    title={m.desc}
                    onClick={() => toggle(traits, setTraits, m.id, BAL.childTraitCap)}
                  >
                    {m.name}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <span className="dim">心理阴影</span>
              <div className="row" style={{ gap: 4 }}>
                {SHADOW_OPTIONS.map((m) => (
                  <button key={m.id} className={`small ${shadows.includes(m.id) ? 'active' : ''}`} title={m.desc} onClick={() => toggle(shadows, setShadows, m.id)}>
                    {m.name}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="panel col">
        <h4>③ 预览</h4>
        <div className="row">
          <b className="gold">{preview.name}</b>
          <span className="tag">{personalityName(genome)}</span>
          <span className="dim">模板：{draft.name}</span>
        </div>
        <div className="dim" style={{ fontSize: 12 }}>
          HP {st.hp} · ATK {st.atk} · DEF {st.def} · ARM {st.arm} · SPD {st.spd} · MOV {st.mov} · EVA {pct(st.eva)} · 记忆槽 {st.slots}
          {st.delayResist ? ' · 抗推迟' : ''}
        </div>
        <div className="row" style={{ gap: 2 }}>
          主动：
          <SkillTag id="basic" />
          {st.skills.map((s) => (
            <SkillTag key={s} id={s} />
          ))}
          <span style={{ width: 12 }} />
          被动：
          {st.passives.map((p) => (
            <PassiveTag key={p} id={p} />
          ))}
          {traits.map((t) => (
            <TraitTag key={t} id={t} />
          ))}
          {shadows.map((t) => (
            <TraitTag key={t} id={t} kind="shadow" />
          ))}
        </div>
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          {dirty && <span className="warn">模板有未保存的修改，将按当前数值创建</span>}
          <button className="primary" onClick={() => act((g) => createCharacter(g, spec))}>
            创建并加入当前存档
          </button>
        </div>
      </div>
    </div>
  );
}
