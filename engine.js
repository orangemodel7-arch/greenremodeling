/* =====================================================================
 * 그린리모델링 손익 계산 엔진 (engine.js)
 * ---------------------------------------------------------------------
 * 화면(app.js)과 분리된 순수 계산 모듈. 모든 가정값은 CONFIG 한 곳에 모음.
 *
 * [계산 흐름]
 *  A. 현재 에너지 : 예측 전력(kWh)·가스(MJ)를 난방/냉방/기타로 분해 → 용도별 단가로 비용 산출
 *  B. 절감 효과   : 패키지별 "용도별 절감률"(학술 절감 상수 × 설문 상태보정) 적용
 *  C. 공사비      : 기하학 물량 × 공사비 DB(자재비 + 표준시장단가 노무비)
 *  D. 금융        : 대출(한도 내) + 정부 이자지원(성능개선 20%↑ 대상, 30%↑ +1%p)
 *                   → 월 상환액, 정부 이자지원 총액, 건축주 부담 이자
 *  F. 회수기간    : 할인율 2% DCF, 건축주 총부담(C + 부담이자)을 절감액으로 회수하는 시점
 *
 * [학술 절감 상수 → 3개 패키지 매핑]  (포함관계: 실속 ⊂ 스마트 ⊂ 종합)
 *  실속형 = 설문상 취약한 외피 공종 1개
 *           · 창호 교체  → S1 가스(난방) 11%   (임서진·조경주, 2026)
 *           · 단열 보강  → S3 난방 33%         (유영서 외, 2025)
 *  스마트형 = 외피 전면(단열 + 방위별 맞춤 고효율 창호)
 *           · 난방 → S4 난방 67.5%             (전지수 외, 2026: 단열+창호 최고등급)
 *           · 냉방 → S2 18.9%                  (허태식, 2026: 방위별 창호 최적화)
 *             ※ S2는 일사 차폐가 핵심이므로 S4와 중복되지 않도록 냉방에만 적용
 *  종합형 = 외피 전면 + 고효율 설비(EHP/콘덴싱 보일러)
 *           · 전체 → S5 전체 40%               (칸(KHARN), 2025)
 *           · 단, 종합형은 스마트형 공사를 모두 포함하므로
 *             용도별로 max(S5, 스마트형 절감률)을 적용(포함관계 보정)
 *  ※ 상수는 논문이 측정한 에너지 범위(난방/냉방/전체)에만 적용한다.
 * ===================================================================== */

const CONFIG = {
    // --- 에너지 요금 단가 (가정값: 발표 전 최신 요금표로 확인·교체) ---
    tariff: {
        // 비주거 전기: 용도별 평균 단가(원/kWh) — 한전 전력통계(EPSIS) 용도별 판매단가로 교체 권장
        elecFlat: { '상업용': 175, '산업용': 180 },
        // 주거 전기: 주택용 저압 누진 3단계 전력량요금(기타계절, 원/kWh) — 세대당 월평균 사용량에 적용
        elecResTiers: [ { upTo: 200, price: 120.0 }, { upTo: 400, price: 214.6 }, { upTo: Infinity, price: 307.3 } ],
        // 도시가스(원/MJ): 주거=주택난방용, 상업=업무난방용, 산업=산업용 — 광주 도시가스 요금표로 교체 권장
        gas: { '주거용': 22.0, '상업용': 23.0, '산업용': 21.0 }
    },

    // --- 전기 사용량의 용도 구성비 (가정값: 에너지총조사 등으로 교체 권장) ---
    //  가스 난방 건물은 전기 난방분 0으로 처리 (난방은 가스가 담당)
    elecEndUse: {
        '주거용': { heat: 0.15, cool: 0.10 },
        '상업용': { heat: 0.20, cool: 0.20 },
        '산업용': { heat: 0.10, cool: 0.10 }
    },
    gasHeatedThreshold: 0.30,   // 최종에너지 중 가스 비중 30% 이상이면 '가스 난방 건물'

    // --- 1차에너지 환산계수 (건축물의 에너지절약설계기준) ---
    primaryFactor: { elec: 2.75, gas: 1.1 },
    // --- 온실가스 배출계수 ---
    co2: { elecKgPerKwh: 0.4781, gasKgPerMj: 0.0561 },

    // --- 학술 절감 상수 ---
    evidence: {
        S1: { rate: 0.11,  scope: 'heat',  label: '고효율 창호 교체 · 가스(난방) 11%', src: '임서진·조경주(2026)' },
        S2: { rate: 0.189, scope: 'cool',  label: '방위별 맞춤 창호 · 18.9% (냉방에 적용)', src: '허태식(2026)' },
        S3: { rate: 0.33,  scope: 'heat',  label: '외벽·내벽 단열 보강 · 난방 33%', src: '유영서 외(2025)' },
        S4: { rate: 0.675, scope: 'heat',  label: '단열+창호 최고등급 · 난방 67.5%', src: '전지수 외(2026)' },
        S5: { rate: 0.40,  scope: 'all',   label: '창호+단열+설비 · 전체 40%', src: '칸(KHARN)(2025)' }
    },

    // --- 설문 상태보정: 논문 실증 대상은 노후 부위 → 이미 양호한 부위는 효과를 감쇄 (가정값) ---
    //  부위 평균점수 s(1=불량 ~ 3=양호) → 보정계수 f = 1 - 0.15 × (s - 1)  (1.00 ~ 0.70)
    conditionSlope: 0.15,

    // --- 공사비 DB (제안서 표와 동일) ---
    cost: {
        windowPerM2: 280000,          // PVC 이중창 자재비 (나라장터 관급자재)
        windowPerUnit: 103673,        // 창호 설치 노무비 /개소 (표준시장단가)
        m2PerWindowUnit: 3,           // 1개소 = 약 3㎡ (가정)
        insulPerM2: 25000 + 15016,    // PF보드 100T 자재비 + 노무비
        hvacRes: 850000 + 150000,     // 1등급 콘덴싱 보일러 /대
        hvacCom: 2800000 + 450000,    // 1등급 멀티 인버터 EHP /대
        m2PerHvacUnit: 120            // 설비 1대당 담당 면적 (가정)
    },

    // --- 정부 이자지원 (국토교통부 2026년 민간건축물 그린리모델링 이자지원사업) ---
    finance: {
        defaultBankRate: 0.05,        // 은행 약정금리 기본값 (사용자 입력)
        eligibleMinSaving: 0.20,      // 에너지 성능개선 비율 20% 이상 → 이자지원 대상
        bonusMinSaving: 0.30,         // 30% 이상 → 추가 1%p
        baseSupport: 0.045,           // 기본 이자지원율 4.5%p
        bonusSupport: 0.010,          // 추가 1%p (최대 5.5%p)
        limit: { '단독': 100000000, '공동_세대당': 30000000, '비주거': 20000000000 },
        months: { '주거': 60, '비주거': 120 }
    },

    discountRate: 0.02,
    maxPaybackYears: 20,          // 추천 기준: 창호·설비 기대수명 내 회수 (가정)

    // 월별 배분 가중치 (난방도일·냉방도일 패턴 가정)
    monthly: {
        heat: [0.26, 0.22, 0.12, 0.03, 0, 0, 0, 0, 0, 0.03, 0.12, 0.22],
        cool: [0, 0, 0, 0, 0.02, 0.15, 0.32, 0.36, 0.15, 0, 0, 0]
    }
};

/* ---------------- 유틸 ---------------- */
function conditionFactor(avgScore) {
    return 1 - CONFIG.conditionSlope * (avgScore - 1);
}
function avg(arr) { return arr.reduce((a, b) => a + b, 0) / arr.length; }

/* ---------------- 설문 → 부위별 상태 ---------------- */
// answers: { q1..q6 : 1~3 } (응답 없으면 2=보통으로 간주)
function diagnoseParts(answers) {
    const s = k => (answers && answers[k]) ? answers[k] : 2;
    const parts = {
        window: { name: '창호·기밀', score: avg([s('q1'), s('q3')]) },
        wall:   { name: '벽체 단열', score: s('q2') },
        solar:  { name: '일사·차열', score: s('q4') },
        equip:  { name: '냉난방 설비', score: avg([s('q5'), s('q6')]) }
    };
    Object.values(parts).forEach(p => { p.f = conditionFactor(p.score); p.weak = p.score <= 2; });
    parts.equip.veryOld = s('q6') === 1;   // 설비 15년 이상
    return parts;
}

/* ---------------- A. 현재 에너지 분해 & 비용 ---------------- */
function resElecCost(annualKwh, households) {
    const hh = Math.max(1, households || 1);
    let monthly = annualKwh / 12 / hh, cost = 0, prev = 0;
    for (const t of CONFIG.tariff.elecResTiers) {
        const q = Math.max(0, Math.min(monthly, t.upTo) - prev);
        cost += q * t.price;
        prev = t.upTo;
        if (monthly <= t.upTo) break;
    }
    return cost * 12 * hh;
}
function elecCost(kwh, usage, households) {
    return usage === '주거용' ? resElecCost(kwh, households) : kwh * CONFIG.tariff.elecFlat[usage];
}
function gasCost(mj, usage) { return mj * CONFIG.tariff.gas[usage]; }

function decomposeEnergy(elecKwh, gasMj, usage) {
    const gasKwh = gasMj / 3.6;
    const gasShare = (elecKwh + gasKwh) > 0 ? gasKwh / (elecKwh + gasKwh) : 0;
    const gasHeated = gasShare >= CONFIG.gasHeatedThreshold;
    const eu = CONFIG.elecEndUse[usage];
    const elecHeat = gasHeated ? 0 : elecKwh * eu.heat;
    const elecCool = elecKwh * eu.cool;
    return {
        gasShare, gasHeated,
        elec: { heat: elecHeat, cool: elecCool, base: elecKwh - elecHeat - elecCool, total: elecKwh },
        gas:  { heat: gasMj, total: gasMj }   // 가스는 난방(급탕 포함)으로 간주
    };
}

/* ---------------- B. 패키지 절감률 ---------------- */
function packageRates(parts) {
    const E = CONFIG.evidence;
    const fEnv = avg([parts.window.f, parts.wall.f]);
    const fAll = avg([parts.window.f, parts.wall.f, parts.solar.f, parts.equip.f]);

    const smart = { heat: E.S4.rate * fEnv, cool: E.S2.rate * parts.solar.f, base: 0 };
    const s5 = E.S5.rate * fAll;
    return {
        econWindow: { heat: E.S1.rate * parts.window.f, cool: 0, base: 0 },
        econWall:   { heat: E.S3.rate * parts.wall.f,   cool: 0, base: 0 },
        smart,
        // 포함관계 보정: 종합형 ≥ 스마트형 (용도별 max)
        total: { heat: Math.max(s5, smart.heat), cool: Math.max(s5, smart.cool), base: s5 }
    };
}

function applySavings(bldg, energy, rates) {
    const { usage, households } = bldg;
    const after = {
        elec: energy.elec.heat * (1 - rates.heat) + energy.elec.cool * (1 - rates.cool) + energy.elec.base * (1 - rates.base),
        gas: energy.gas.heat * (1 - rates.heat)
    };
    const costBefore = elecCost(energy.elec.total, usage, households) + gasCost(energy.gas.total, usage);
    const costAfter = elecCost(after.elec, usage, households) + gasCost(after.gas, usage);
    const PF = CONFIG.primaryFactor;
    const primBefore = energy.elec.total * PF.elec + (energy.gas.total / 3.6) * PF.gas;
    const primAfter = after.elec * PF.elec + (after.gas / 3.6) * PF.gas;
    const savedElec = energy.elec.total - after.elec, savedGas = energy.gas.total - after.gas;
    return {
        costBefore, costAfter,
        annualSaving: costBefore - costAfter,
        costSavingRate: costBefore > 0 ? (costBefore - costAfter) / costBefore : 0,
        primarySavingRate: primBefore > 0 ? (primBefore - primAfter) / primBefore : 0, // 성능개선 비율(추정)
        savedElecKwh: savedElec, savedGasMj: savedGas,
        co2Kg: savedElec * CONFIG.co2.elecKgPerKwh + savedGas * CONFIG.co2.gasKgPerMj
    };
}

/* ---------------- C. 기하학 물량 & 공사비 ---------------- */
function geometry(usage, area, floors) {
    const A = area / floors;           // 바닥면적
    let W, insul, win;
    if (usage === '주거용') {           // 평면비 1:2, 층고 3.0m
        W = 18 * Math.sqrt(A / 2) * floors; insul = W * 0.15; win = W * 0.30;   // 북향 외벽 15%
    } else if (usage === '상업용') {    // 평면비 1:1, 층고 4.0m
        W = 16 * Math.sqrt(A) * floors;     insul = W * 0.40; win = W * 0.60;
    } else {                            // 산업용: 평면비 1:1, 층고 6.0m
        W = 24 * Math.sqrt(A) * floors;     insul = W * 0.90; win = W * 0.10;
    }
    return { floorArea: A, wallArea: W, insulWall: insul, roofArea: A, insulTotal: insul + A,
             windowArea: win, windowUnits: Math.ceil(win / CONFIG.cost.m2PerWindowUnit) };
}

function workCosts(usage, area, geo) {
    const c = CONFIG.cost;
    const hvacUnit = usage === '주거용' ? c.hvacRes : c.hvacCom;
    const hvacCount = Math.max(1, Math.ceil(area / c.m2PerHvacUnit));
    return {
        window: { cost: geo.windowArea * c.windowPerM2 + geo.windowUnits * c.windowPerUnit,
                  basis: `PVC 이중창 ${Math.round(geo.windowArea).toLocaleString()}㎡ × 28만 원 + ${geo.windowUnits.toLocaleString()}개소 × 103,673원` },
        insul:  { cost: geo.insulTotal * c.insulPerM2,
                  basis: `PF보드 ${Math.round(geo.insulTotal).toLocaleString()}㎡(외벽 ${Math.round(geo.insulWall).toLocaleString()} + 옥상 ${Math.round(geo.roofArea).toLocaleString()}) × 40,016원` },
        hvac:   { cost: hvacCount * hvacUnit,
                  basis: `${usage === '주거용' ? '콘덴싱 보일러' : '인버터 EHP'} ${hvacCount}대 × ${hvacUnit.toLocaleString()}원` }
    };
}

/* ---------------- D. 금융 (대출 + 이자지원) ---------------- */
function financePlan(C, primarySavingRate, bldg, bankRate) {
    const F = CONFIG.finance;
    const isRes = bldg.usage === '주거용';
    const limit = isRes ? (bldg.households > 1 ? F.limit['공동_세대당'] * bldg.households : F.limit['단독'])
                        : F.limit['비주거'];
    const n = isRes ? F.months['주거'] : F.months['비주거'];

    const eligible = primarySavingRate >= F.eligibleMinSaving;
    const bonus = primarySavingRate >= F.bonusMinSaving;
    const support = eligible ? F.baseSupport + (bonus ? F.bonusSupport : 0) : 0;
    const supportApplied = Math.min(support, bankRate);          // 지원율이 약정금리보다 크면 약정금리까지만
    const userRate = Math.max(0, bankRate - support);            // 건축주 실부담 금리 (0% 하한)

    const P = Math.min(C, limit);        // 대출 원금
    const equity = C - P;                // 한도 초과분 = 자기자금
    const pmt = (rate, principal) => {
        const i = rate / 12;
        return i === 0 ? principal / n : principal * i * Math.pow(1 + i, n) / (Math.pow(1 + i, n) - 1);
    };
    const monthlyPayment = pmt(userRate, P);          // 이자지원 후 월 상환액
    const monthlyNoSupport = pmt(bankRate, P);        // 이자지원 없을 때 월 상환액

    // 원리금균등 상환 스케줄: 매월 잔액 × 지원율/12 = 정부가 대신 내는 이자
    let bal = P, govSupport = 0, userInterest = 0;
    for (let t = 0; t < n; t++) {
        const intUser = bal * userRate / 12;
        govSupport += bal * supportApplied / 12;
        userInterest += intUser;
        bal -= (monthlyPayment - intUser);
    }
    return { eligible, bonus, support, userRate, bankRate, limit, months: n, loan: P, equity,
             monthlyPayment, monthlyNoSupport, govSupport, userInterest };
}

/* ---------------- F. 회수기간 (DCF, 할인율 2%) ---------------- */
// Σ_{k=1..t} B/(1+r)^k ≥ K  →  t = -ln(1 - rK/B) / ln(1+r)
function discountedPayback(K, B, r = CONFIG.discountRate) {
    if (B <= 0 || K * r >= B) return Infinity;
    return -Math.log(1 - (K * r) / B) / Math.log(1 + r);
}

/* ---------------- 전체 실행 ---------------- */
// bldg = { usage, area, floors, households, elecKwh, gasMj }
function runEngine(bldg, answers, bankRate = CONFIG.finance.defaultBankRate) {
    const parts = diagnoseParts(answers);
    const energy = decomposeEnergy(bldg.elecKwh, bldg.gasMj, bldg.usage);
    const geo = geometry(bldg.usage, bldg.area, bldg.floors);
    const work = workCosts(bldg.usage, bldg.area, geo);
    const R = packageRates(parts);
    const E = CONFIG.evidence;

    const build = (key, name, desc, scope, rates, items, evidence) => {
        const costs = { window: 0, insul: 0, hvac: 0 };
        items.forEach(k => { costs[k] = work[k].cost; });
        const C = costs.window + costs.insul + costs.hvac;
        const sav = applySavings(bldg, energy, rates);
        const fin = financePlan(C, sav.primarySavingRate, bldg, bankRate);
        const ownerTotal = C + fin.userInterest;              // 건축주 총부담 (정부 이자지원은 이미 제외)
        return { key, name, desc, scope, rates, items, evidence, costs,
                 basis: { window: items.includes('window') ? work.window.basis : '해당 없음',
                          insul: items.includes('insul') ? work.insul.basis : '해당 없음',
                          hvac: items.includes('hvac') ? work.hvac.basis : '해당 없음' },
                 totalCost: C, ...sav, finance: fin, ownerTotal,
                 payback: discountedPayback(ownerTotal, sav.annualSaving) };
    };

    // 실속형: 취약 부위(점수 ≤ 2) 중 회수기간이 가장 짧은 단일 공종 (취약 부위가 없으면 두 후보 모두 비교)
    const econCands = [
        build('econ', '실속형', '취약 부위 단일 보강 (최소 공사)', '창호 교체', R.econWindow, ['window'], [E.S1]),
        build('econ', '실속형', '취약 부위 단일 보강 (최소 공사)', '단열 보강', R.econWall, ['insul'], [E.S3])
    ];
    const weakIdx = [parts.window.weak, parts.wall.weak];
    let pool = econCands.filter((_, i) => weakIdx[i]);
    if (pool.length === 0) pool = econCands;
    const better = (a, b) => (b.payback < a.payback || (b.payback === a.payback && b.totalCost < a.totalCost)) ? b : a;
    const econ = pool.reduce(better);
    econ.target = econ.scope === '창호 교체' ? parts.window.name : parts.wall.name;

    const smart = build('smart', '스마트형', '외피 전면 개선 (단열 + 방위별 창호)', '단열 + 창호', R.smart,
                        ['window', 'insul'], [E.S4, E.S2]);
    const total = build('total', '종합형', '외피 + 고효율 설비 (액티브 포함)', '단열 + 창호 + 설비', R.total,
                        ['window', 'insul', 'hvac'], [E.S5, E.S4, E.S2]);
    const packages = [econ, smart, total];

    // AI 추천 (기대수명 20년 내 회수 가능한 패키지만 대상)
    //   ① 설비 15년 이상 노후 & 종합형 회수 가능 → 종합형
    //   ② 이자지원 대상(성능개선 20%↑) 중 회수기간 최단
    //   ③ 그 외 회수기간 최단      ④ 모두 20년 초과면 추천 없음
    let rec = null, reason = '';
    const ok = p => p.payback <= CONFIG.maxPaybackYears;
    const feasible = packages.filter(ok);
    const eligible = feasible.filter(p => p.finance.eligible);
    if (parts.equip.veryOld && ok(total)) {
        rec = total; reason = '설비 15년 이상 노후 → 설비 교체 포함';
    } else if (eligible.length) {
        rec = eligible.reduce(better); reason = '이자지원 대상 중 회수기간 최단';
    } else if (feasible.length) {
        rec = feasible.reduce(better); reason = '회수기간 최단';
    }
    packages.forEach(p => { p.isRecommended = p === rec; p.recommendReason = p === rec ? reason : ''; });

    return { parts, energy, geo, packages, recommended: rec };
}

/* 월별 요금 곡선 (만 원): 난방·냉방·기타를 각각 배분 후 패키지 절감률 적용 */
function monthlyCurves(bldg, energy, rates) {
    const M = CONFIG.monthly;
    const before = [], after = [];
    const eP = (kwh) => elecCost(kwh, bldg.usage, bldg.households) / Math.max(kwh, 1e-9); // 평균 단가
    const priceE = energy.elec.total > 0 ? eP(energy.elec.total) : 0;
    const priceG = CONFIG.tariff.gas[bldg.usage];
    for (let m = 0; m < 12; m++) {
        const heatE = energy.elec.heat * M.heat[m], coolE = energy.elec.cool * M.cool[m], baseE = energy.elec.base / 12;
        const heatG = energy.gas.heat * M.heat[m];
        before.push((heatE + coolE + baseE) * priceE + heatG * priceG);
        after.push((heatE * (1 - rates.heat) + coolE * (1 - rates.cool) + baseE * (1 - rates.base)) * priceE
                   + heatG * (1 - rates.heat) * priceG);
    }
    const toMan = v => Math.round(v / 10000 * 10) / 10;
    return { before: before.map(toMan), after: after.map(toMan) };
}

if (typeof module !== 'undefined') {
    module.exports = { CONFIG, runEngine, monthlyCurves, discountedPayback, financePlan, resElecCost };
}
