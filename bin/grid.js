#!/usr/bin/env node
// grid-ruler 的确定性换算入口。
//
// 用途：把"大一点/靠近一点"这种口头表达，换成确定的 px；把任意值吸附到 8 的倍数。
// 尺子只有一把：与本脚本同目录的 scale.json——它跟着脚本一起分发，
// 扩展也从它生成，不各写一份。
//
// 用法：
//   node bin/grid.js scale
//   node bin/grid.js snap 20 13 4.5
//   node bin/grid.js nudge --from 24 --to 大一点
//   node bin/grid.js nudge --from 48 --to 靠近一点
//   node bin/grid.js check src/app.css
'use strict';
const fs = require('fs');
const path = require('path');

// 尺子缺失时给一句人话，而不是把 ENOENT 堆栈甩给用户（单独分发技能时最容易踩）
const SCALE_PATH = path.join(__dirname, 'scale.json');
if (!fs.existsSync(SCALE_PATH)) {
  console.error(JSON.stringify({
    ok: false,
    error: '找不到尺子文件 ' + SCALE_PATH + '；scale.json 必须与 grid.js 同目录分发（它定义了基准与档位，缺了就不算数）'
  }));
  process.exit(1);
}
const SCALE = JSON.parse(fs.readFileSync(SCALE_PATH, 'utf8'));
const STEP = SCALE.base;
const STEPS = SCALE.steps;
const ROLE_OF = {};
for (const [n, role] of Object.entries(SCALE.role)) ROLE_OF[Number(n)] = role;

function nearestStep(value) {
  let best = STEPS[0];
  for (const s of STEPS) if (Math.abs(s - value) < Math.abs(best - value)) best = s;
  return best;
}
function roleName(value) {
  if (ROLE_OF[value]) return ROLE_OF[value];
  if (value % 128 === 0) return 'major';
  if (value % 32 === 0) return 'mid';
  if (value % 8 === 0) return 'fine';
  return 'off-grid';
}
function snap(value) {
  if (!Number.isFinite(value)) throw new Error('不是数字：' + value);
  const target = nearestStep(value);
  return {
    value, snapped: target, delta: Number((target - value).toFixed(2)),
    aligned: value % STEP === 0, role: roleName(target)
  };
}
// 把当前值按口头表达换算成确定值，并给出本次档位可选的其它确定值。
function nudge(from, phrase) {
  const key = SCALE.aliases[phrase] || phrase;
  const spec = SCALE.nudge[key];
  if (!spec) throw new Error('不认识的表达：' + phrase + '（可用：' + Object.keys(SCALE.aliases).join('、') + '）');
  const target = nearestStep(from + spec.delta);
  const r = snap(target);
  return {
    phrase, from, key, delta: spec.delta, value: target,
    add: Number((target - from).toFixed(2)),
    steps: Math.round((target - from) / STEP), role: r.role,
    // 候选吸附到尺子后可能撞车（-4 与 -8 都落到同一个档），去重再给，别报重复值糊弄人
    candidates: [...new Set(spec.candidates.map(d => nearestStep(from + d)))]
  };
}

const args = process.argv.slice(2);
const cmd = args[0];
const flag = name => { const i = args.indexOf('--' + name); return i < 0 ? null : args[i + 1]; };
const bare = args.slice(1).filter(a => !a.startsWith('--') && !/^-?\d/.test(a) ? true : false);
const json = args.includes('--json');

function out(human, machine) {
  if (json) console.log(JSON.stringify(machine, null, 2));
  else console.log(human);
}

try {
  if (cmd === 'scale') {
    const rows = STEPS.map(s => ({ px: s, steps: s / STEP, role: roleName(s) }));
    out([
      '基准 ' + STEP + 'px｜档位 ' + STEPS.join(' / '),
      '标准线：8 细 / 32 中 / 128 大',
      '含义：' + Object.entries(SCALE.lines).map(([k, v]) => k + '=' + v).join('；')
    ].join('\n'), { base: STEP, unit: SCALE.unit, steps: rows, lines: SCALE.lines });
  } else if (cmd === 'snap') {
    const values = args.slice(1).filter(a => !a.startsWith('--')).map(Number).filter(Number.isFinite);
    if (!values.length) throw new Error('用法：node bin/grid.js snap 20 13');
    const results = values.map(snap);
    out(results.map(r => `${r.value} -> ${r.snapped}px（${r.delta >= 0 ? '+' : ''}${r.delta}${r.aligned ? '，已对齐' : ''}）`).join('\n'), results);
  } else if (cmd === 'nudge') {
    const from = Number(flag('from'));
    const to = flag('to');
    if (!Number.isFinite(from) || !to) throw new Error('用法：node bin/grid.js nudge --from 24 --to 大一点');
    const r = nudge(from, to);
    out([
      `「${r.phrase}」：${r.from}px -> ${r.value}px（${r.add >= 0 ? '+' : ''}${r.add}，即 ${r.steps >= 0 ? '+' : ''}${r.steps} 个 ${STEP} 的档）`,
      `别的可选：${r.candidates.join(' / ')}px`
    ].join('\n'), r);
  } else if (cmd === 'check') {
    const files = args.slice(1).filter(a => !a.startsWith('--'));
    if (!files.length) throw new Error('用法：node bin/grid.js check <文件...>');
    // 只看间距类属性，避免把字号/行高/动画时长也当成间距
    const prop = /(?:^|[;{\s])(?:margin|padding|gap|row-gap|column-gap|inset|top|right|bottom|left|width|height|min-width|min-height|max-width|max-height)(?:-[a-z]+)?\s*:\s*([^;{}]+)/g;
    const px = /(-?\d+(?:\.\d+)?)px/g;
    const findings = [];
    for (const f of files) {
      if (!fs.existsSync(f)) { findings.push({ file: f, error: '文件不存在' }); continue; }
      fs.readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
        let m; prop.lastIndex = 0;
        while ((m = prop.exec(line))) {
          let n; px.lastIndex = 0;
          while ((n = px.exec(m[1]))) {
            const v = Number(n[1]);
            if (v === 0) continue;
            const r = snap(v);
            findings.push({ file: f, line: i + 1, property: m[0].split(':')[0].replace(/^[;{\s]+/, '').trim(),
              value: v, snapped: r.snapped, delta: r.delta, aligned: r.aligned });
          }
        }
      });
    }
    const off = findings.filter(x => x.aligned === false);
    out([
      `${findings.length} 个间距值，${off.length} 个不在 ${STEP} 的倍数上`,
      ...off.slice(0, 25).map(x => `  ${x.file}:${x.line} ${x.property}: ${x.value}px -> ${x.snapped}px（${x.delta >= 0 ? '+' : ''}${x.delta}）`)
    ].join('\n'), { files: files.length, values: findings.length, offGrid: off.length, findings, offGridList: off });
  } else {
    console.log([
      'grid-ruler 尺子（基准 ' + STEP + 'px）',
      '  node bin/grid.js scale                      打印档位表',
      '  node bin/grid.js snap 20 13                 吸附到最近的档位',
      '  node bin/grid.js nudge --from 24 --to 大一点  口头表达 -> 确定 px',
      '  node bin/grid.js check src/app.css          检查间距是否在尺子上',
      '加 --json 输出机器可读结果。'
    ].join('\n'));
    process.exitCode = cmd ? 1 : 0;
  }
} catch (e) {
  console.error(JSON.stringify({ ok: false, error: e.message }));
  process.exitCode = 1;
}
