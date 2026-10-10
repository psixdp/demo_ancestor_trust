import type { Intent, Personality } from '../core/types';

export const BARKS: Record<Personality, Partial<Record<Intent, string[]>>> = {
  zealot: {
    guard: ['父亲大人，请退后！', '有我在，谁也别想靠近！', '为了家族！'],
    attack: ['以血月之名！', '净化异端！'],
    break: ['我来撕开他们的防线！', '父亲，机会给您！'],
    retreat: ['……暂且后退。'],
    regroup: ['我这就回到您身边！'],
    advance: ['跟上父亲！'],
    defend: ['坚守阵地！'],
  },
  paranoid: {
    retreat: ['我可不想死在这种地方。', '先保住命再说。', '这差事不值得拼命。'],
    attack: ['趁现在。', '捡个便宜。'],
    break: ['破开了，剩下的您来吧。'],
    guard: ['……就这一次。'],
    regroup: ['靠近点总没错。'],
    advance: ['我在后面看着。'],
    defend: ['别指望我冲在前面。'],
  },
  docile: {
    attack: ['收到指令。', '执行。'],
    break: ['破甲作业中。'],
    guard: ['护卫位置就绪。'],
    retreat: ['按规程撤离。'],
    regroup: ['归队。'],
    advance: ['前进。'],
    defend: ['防御姿态。'],
  },
};

export const SLACK_BARKS = ['……这真的值得吗？', '我为什么要为他卖命？', '（假装没听见命令）'];
export const INTERCEPT_BARKS = ['为了家族！', '父亲小心！', '冲我来！'];

export const FIRST_NAMES = [
  '艾德里安', '薇拉', '卢卡', '赛勒斯', '莉莉丝', '奥古斯特', '卡米拉', '瓦伦丁', '伊莎贝拉', '达米安',
  '塞拉菲娜', '维克多', '露西安', '玛格丽特', '塞巴斯蒂安', '奥菲莉亚', '加百列', '罗莎琳', '西奥多', '艾琳',
  '尼古拉', '克洛伊', '马库斯', '维奥莱特', '亚历克斯', '诺拉', '雷米', '黛安娜', '费利克斯', '索菲亚',
];

export const PARTNER_NAMES: Record<'labor' | 'dwarf' | 'elf', string[]> = {
  labor: ['临时工 A-07', '派遣员 汤姆', '合同工 玛丽', '零工 杰克', '外包 苏珊', '日结 鲍勃', '实习生 艾米', '劳务 本'],
  dwarf: ['铁砧·格罗姆', '锤石·布伦希尔德', '深炉·索林娜', '铜须·杜林'],
  elf: ['星露·艾拉瑞', '月影·瑟兰迪', '晨辉·菲奥娜', '银叶·伊瑟琳'],
};
