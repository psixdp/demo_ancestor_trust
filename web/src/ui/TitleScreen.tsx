import { useRef, useState } from 'react';
import { AUTO_SLOT, SLOTS, slotInfo } from '../core/meta/save';
import { useGame } from '../store/gameStore';

export function TitleScreen() {
  const { newGame, loadSlot, importJson, toast } = useGame();
  const [seed, setSeed] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const slots = [AUTO_SLOT, ...SLOTS].map((s) => ({ s, info: slotInfo(s) }));

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    if (!importJson(await f.text())) toast('存档文件无效', false);
  };

  return (
    <div className="title-screen">
      <h1>真祖信托</h1>
      <div className="dim">Ancestral Trust · 原型 v0.1</div>
      <div className="panel col" style={{ width: 420 }}>
        <div className="row">
          <input placeholder="随机种子（留空随机）" value={seed} onChange={(e) => setSeed(e.target.value)} className="grow" />
          <button className="primary" onClick={() => newGame(seed ? Number(seed) >>> 0 : undefined)}>
            新的家族
          </button>
        </div>
        {slots.map(({ s, info }) => (
          <div className="row" key={s}>
            <span style={{ width: 70 }}>{s === AUTO_SLOT ? '自动存档' : `存档 ${s}`}</span>
            <span className="grow dim">{info ? `第 ${info.month} 月 · ${info.gold} 金 · ${new Date(info.savedAt).toLocaleString()}` : '空'}</span>
            <button disabled={!info} onClick={() => loadSlot(s)}>
              读取
            </button>
          </div>
        ))}
        <div className="row">
          <button onClick={() => fileRef.current?.click()}>导入 JSON 存档</button>
          <input ref={fileRef} type="file" accept=".json" style={{ display: 'none' }} onChange={(e) => onFile(e.target.files?.[0])} />
        </div>
      </div>
      <div className="dim" style={{ maxWidth: 520, textAlign: 'center', lineHeight: 1.7 }}>
        你是一位以企业家身份隐居于现代都市的真祖。培育子嗣、带他们下地下城、在肉体衰朽之前夺舍最合适的继承人——
        <br />
        同时，别让他们发现“父亲从不吃晚饭”。
      </div>
    </div>
  );
}
