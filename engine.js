/* =====================================================================
 * 그린리모델링 손익 계산 엔진 (engine.js)
 * ---------------------------------------------------------------------
 * 화면(app.js)과 분리된 순수 계산 모듈. 모든 가정값은 CONFIG 한 곳에 모음.
 *
 * [계산 흐름]
 *  1. 설문 진단 : 6문항 → 3개 공종(창호·단열·설비) 취약도 점수 → 취약 순위
 *  2. 패키지 구성: 실속형 = 1순위 공종 / 스마트형 = 1·2순위 / 종합형 = 3개 전부
 *                 (단가는 모든 패키지가 같은 공사비 DB를 쓰고, 담는 공종만 다름)
 *  3. 현재 에너지: 예측 전력(kWh)·가스(MJ)를 난방/냉방/기타로 분해 → 용도별 단가로 비용 산출
 *  4. 절감 효과  : 담긴 공종 조합에 맞는 학술 절감 상수 × 설문 상태보정
 *  5. 공사비     : 기하학 물량 × 공사비 DB(자재비 + 표준시장단가 노무비)
 *  6. 금융       : 대출(한도 내) + 정부 이자지원(성능개선 20%↑ 대상, 30%↑ +1%p)
 *  7. 회수기간   : 할인율 2% DCF, 건축주 총부담(C + 부담이자)을 절감액으로 회수하는 시점
 *  8. AI 추천    : 기대수명 20년 동안의 순이익(NPV)이 가장 큰 패키지
 *
 * [공종 조합 → 절감 상수]
 *  창호만        : 난방 S1 11% + 냉방 S2 18.9%     (임서진·조경주 2026 / 허태식 2026)
 *  단열만        : 난방 S3 33%                     (유영서 외 2025)
 *  창호 + 단열   : 난방 S4 67.5% + 냉방 S2 18.9%   (전지수 외 2026 / 허태식 2026)
 *  설비          : 기존 → 1등급 효율 개선분 (1 - 기존효율/신규효율), 기존 효율은 Q6 연식으로 추정
 *  여러 공종     : 용도별 잔여율을 곱해 결합  1 - (1-외피)(1-설비)  → 중복 계산 방지
 *  3개 공종 전부 : 위 결합값과 S5 전체 40%(칸 KHARN 2025) 중 큰 값
 * ===================================================================== */

const CONFIG = {
    // --- 에너지 요금 단가 (가정값: 발표 전 최신 요금표로 확인·교체) ---
    tariff: {
        elecFlat: { '상업용': 175, '산업용': 180 },          // 비주거 전기 평균 단가(원/kWh)
        elecResTiers: [ { upTo: 200, price: 120.0 }, { upTo: 400, price: 214.6 }, { upTo: Infinity, price: 307.3 } ], // 주택용 누진
        gas: { '주거용': 22.0, '상업용': 23.0, '산업용': 21.0 } // 주택난방용 / 업무난방용 / 산업용 (원/MJ)
    },

    // --- 전기 사용량의 용도 구성비 (가정값) — 가스 난방 건물은 전기 난방분 0 ---
    elecEndUse: {
        '주거용': { heat: 0.15, cool: 0.10 },
        '상업용': { heat: 0.20, cool: 0.20 },
        '산업용': { heat: 0.10, cool: 0.10 }
    },
    gasHeatedThreshold: 0.30,   // 최종에너지 중 가스 비중 30% 이상이면 '가스 난방 건물'

    primaryFactor: { elec: 2.75, gas: 1.1 },            // 1차에너지 환산계수 (에너지절약설계기준)
    co2: { elecKgPerKwh: 0.4781, gasKgPerMj: 0.0561 },  // 온실가스 배출계수

    // --- 학술 절감 상수 ---
    evidence: {
        S1: { rate: 0.11,  label: '고효율 창호 · 가스(난방) 11%', src: '임서진·조경주(2026)' },
        S2: { rate: 0.189, label: '방위별 맞춤 창호 · 18.9% (냉방에 적용)', src: '허태식(2026)' },
        S3: { rate: 0.33,  label: '단열 보강 · 난방 33%', src: '유영서 외(2025)' },
        S4: { rate: 0.675, label: '단열+창호 · 난방 67.5%', src: '전지수 외(2026)' },
        S5: { rate: 0.40,  label: '창호+단열+설비 · 전체 40%', src: '칸(KHARN)(2025)' }
    },

    // --- 설비 효율 (신규 = 공사비 DB 1등급 기준, 기존 = Q6 연식 점수별 가정값) ---
    equipment: {
        newCop: 4.2, newBoilerEff: 0.92,
        oldByScore: { 1: { cop: 2.5, eff: 0.80 }, 2: { cop: 3.2, eff: 0.85 }, 3: { cop: 4.0, eff: 0.90 } }
    },

    // --- 설문 상태보정: 논문 실증 대상은 노후 부위 → 이미 양호한 공종은 효과를 감쇄 (가정값) ---
    //  공종 평균점수 s(1=불량 ~ 3=양호) → f = 1 - 0.15 × (s - 1)  (1.00 ~ 0.70)
    conditionSlope: 0.15,

    // --- 공사비 DB (제안서 표와 동일, 모든 패키지 공통) ---
    cost: {
        windowPerM2: 280000,          // PVC 이중창 자재비 (나라장터 관급자재)
        windowPerUnit: 103673,        // 창호 설치 노무비 /개소 (표준시장단가)
        m2PerWindowUnit: 3,           // 1개소 = 약 3㎡ (가정)
        insulPerM2: 25000 + 15016,    // PF보드 100T 자재비 + 노무비
        boiler: 850000 + 150000,      // 1등급 콘덴싱 보일러 /대 (가스 난방 건물)
        ehp: 2800000 + 450000,        // 1등급 멀티 인버터 EHP /대 (전기 냉난방 건물)
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
    maxPaybackYears: 20,          // 추천 기준 기간: 창호·설비 기대수명 (가정)

    // 월별 배분 가중치 (난방도일·냉방도일 패턴 가정)
    monthly: {
        heat: [0.26, 0.22, 0.12, 0.03, 0, 0, 0, 0, 0, 0.03, 0.12, 0.22],
        cool: [0, 0, 0, 0, 0.02, 0.15, 0.32, 0.36, 0.15, 0, 0, 0]
    }
};

const TRADE_NAMES = { window: '창호', insul: '단열', hvac: '설비' };

/* ---------------- 유틸 ---------------- */
const conditionFactor = s => 1 - CONFIG.conditionSlope * (s - 1);
const avg = arr => arr.reduce((a, b) => a + b, 0) / arr.length;
const combine = (...rates) => 1 - rates.reduce((rem, r) => rem * (1 - r), 1);   // 잔여율 곱으로 결합

/* ---------------- 1. 설문 → 공종별 취약도 ---------------- */
// answers: { q1..q6 : 1~3 } (응답 없으면 2=보통)
//  창호 = Q1 창호 재질 + Q3 외풍(기밀) / 단열 = Q2 결로·곰팡이 + Q4 옥상·외벽 차열 / 설비 = Q5 난방 성능 + Q6 설비 연식
function diagnoseTrades(answers) {
    const s = k => (answers && answers[k]) ? answers[k] : 2;
    const t = {
        window: { key: 'window', name: '창호', questions: 'Q1·Q3', score: avg([s('q1'), s('q3')]) },
        insul:  { key: 'insul',  name: '단열', questions: 'Q2·Q4', score: avg([s('q2'), s('q4')]) },
        hvac:   { key: 'hvac',   name: '설비', questions: 'Q5·Q6', score: avg([s('q5'), s('q6')]), ageScore: s('q6') }
    };
    Object.values(t).forEach(x => { x.f = conditionFactor(x.score); });
    return t;
}

/* ---------------- 3. 현재 에너지 분해 & 비용 ---------------- */
function resElecCost(annualKwh, households) {
    const hh = Math.max(1, households || 1);
    let monthly = annualKwh / 12 / hh, cost = 0, prev = 0;
    for (const t of CONFIG.tariff.elecResTiers) {
        cost += Math.max(0, Math.min(monthly, t.upTo) - prev) * t.price;
        prev = t.upTo;
        if (monthly <= t.upTo) break;
    }
    return cost * 12 * hh;
}
const elecCost = (kwh, usage, hh) => usage === '주거용' ? resElecCost(kwh, hh) : kwh * CONFIG.tariff.elecFlat[usage];
const gasCost = (mj, usage) => mj * CONFIG.tariff.gas[usage];

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

/* ---------------- 4. 공종 조합 → 용도별 절감률 ---------------- */
// 반환: { heatElec, heatGas, cool, base, evidence[] }
function comboRates(set, trades, energy) {
    const E = CONFIG.evidence, Q = CONFIG.equipment;
    const hasW = set.includes('window'), hasI = set.includes('insul'), hasH = set.includes('hvac');
    const ev = [];

    // 외피(창호·단열) 난방 절감
    let envHeat = 0;
    if (hasW && hasI) { envHeat = E.S4.rate * avg([trades.window.f, trades.insul.f]); ev.push(E.S4); }
    else if (hasW)    { envHeat = E.S1.rate * trades.window.f; ev.push(E.S1); }
    else if (hasI)    { envHeat = E.S3.rate * trades.insul.f; ev.push(E.S3); }
    // 창호의 일사 차폐 → 냉방 절감
    const winCool = hasW ? E.S2.rate * trades.window.f : 0;
    if (hasW) ev.push(E.S2);

    // 설비 교체: 기존 효율 → 1등급 효율 (가스 난방 건물 = 콘덴싱 보일러, 전기 냉난방 건물 = EHP)
    let eqElec = 0, eqGas = 0;
    if (hasH) {
        const old = Q.oldByScore[trades.hvac.ageScore] || Q.oldByScore[2];
        if (energy.gasHeated) eqGas = 1 - old.eff / Q.newBoilerEff;
        else eqElec = 1 - old.cop / Q.newCop;
        ev.push({ label: energy.gasHeated
                    ? `콘덴싱 보일러 · 효율 ${Math.round(old.eff * 100)}%→92% (난방 ${(eqGas * 100).toFixed(1)}%)`
                    : `인버터 EHP · COP ${old.cop}→4.2 (냉난방 ${(eqElec * 100).toFixed(1)}%)`,
                  src: '에너지소비효율등급 1등급 기준' });
    }

    const rates = {
        heatElec: combine(envHeat, eqElec),
        heatGas:  combine(envHeat, eqGas),
        cool:     combine(winCool, eqElec),
        base:     0
    };
    return { rates, evidence: ev };
}

function applySavings(bldg, energy, r) {
    const { usage, households } = bldg;
    const after = {
        elec: energy.elec.heat * (1 - r.heatElec) + energy.elec.cool * (1 - r.cool) + energy.elec.base * (1 - r.base),
        gas: energy.gas.heat * (1 - r.heatGas)
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
        primarySavingRate: primBefore > 0 ? (primBefore - primAfter) / primBefore : 0, // 성능개선 비율(추정)
        savedElecKwh: savedElec, savedGasMj: savedGas,
        co2Kg: savedElec * CONFIG.co2.elecKgPerKwh + savedGas * CONFIG.co2.gasKgPerMj
    };
}

/* ---------------- 5. 기하학 물량 & 공사비 ---------------- */
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

function tradeCosts(bldg, geo, energy) {
    const c = CONFIG.cost;
    const useBoiler = energy.gasHeated;
    const unit = useBoiler ? c.boiler : c.ehp;
    const hvacCount = Math.max(1, Math.ceil(bldg.area / c.m2PerHvacUnit));
    return {
        window: { cost: geo.windowArea * c.windowPerM2 + geo.windowUnits * c.windowPerUnit,
                  basis: `PVC 이중창 ${Math.round(geo.windowArea).toLocaleString()}㎡ × 28만 원 + ${geo.windowUnits.toLocaleString()}개소 × 103,673원` },
        insul:  { cost: geo.insulTotal * c.insulPerM2,
                  basis: `PF보드 ${Math.round(geo.insulTotal).toLocaleString()}㎡(외벽 ${Math.round(geo.insulWall).toLocaleString()} + 옥상 ${Math.round(geo.roofArea).toLocaleString()}) × 40,016원` },
        hvac:   { cost: hvacCount * unit, label: useBoiler ? '콘덴싱 보일러' : '인버터 EHP',
                  basis: `${useBoiler ? '콘덴싱 보일러' : '인버터 EHP'} ${hvacCount}대 × ${unit.toLocaleString()}원` }
    };
}

/* ---------------- 6. 금융 (대출 + 이자지원) ---------------- */
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
    const monthlyPayment = pmt(userRate, P);
    const monthlyNoSupport = pmt(bankRate, P);

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

/* ---------------- 7. 회수기간 (DCF, 할인율 2%) ---------------- */
// Σ_{k=1..t} B/(1+r)^k ≥ K  →  t = -ln(1 - rK/B) / ln(1+r)
function discountedPayback(K, B, r = CONFIG.discountRate) {
    if (B <= 0 || K * r >= B) return Infinity;
    return -Math.log(1 - (K * r) / B) / Math.log(1 + r);
}

/* ---------------- 전체 실행 ---------------- */
// bldg = { usage, area, floors, households, elecKwh, gasMj }
function runEngine(bldg, answers, bankRate = CONFIG.finance.defaultBankRate) {
    const trades = diagnoseTrades(answers);
    const energy = decomposeEnergy(bldg.elecKwh, bldg.gasMj, bldg.usage);
    const geo = geometry(bldg.usage, bldg.area, bldg.floors);
    const tc = tradeCosts(bldg, geo, energy);

    // 공종 조합 하나를 평가
    const evaluate = (set) => {
        const C = set.reduce((sum, k) => sum + tc[k].cost, 0);
        let { rates, evidence } = comboRates(set, trades, energy);
        let sav = applySavings(bldg, energy, rates);
        if (set.length === 3) {   // 3개 공종 전부 → S5 전체 40%와 비교해 큰 값
            const s5 = CONFIG.evidence.S5.rate * avg([trades.window.f, trades.insul.f, trades.hvac.f]);
            const r5 = { heatElec: s5, heatGas: s5, cool: s5, base: s5 };
            const sav5 = applySavings(bldg, energy, r5);
            if (sav5.annualSaving > sav.annualSaving) { rates = r5; sav = sav5; }
            evidence = [CONFIG.evidence.S5, ...evidence];
        }
        const fin = financePlan(C, sav.primarySavingRate, bldg, bankRate);
        const ownerTotal = C + fin.userInterest;       // 건축주 총부담 (정부 이자지원은 이미 제외)
        const costs = { window: 0, insul: 0, hvac: 0 };
        set.forEach(k => { costs[k] = tc[k].cost; });
        return { set, scope: set.map(k => TRADE_NAMES[k]).join(' + '), rates, evidence, costs,
                 basis: { window: set.includes('window') ? tc.window.basis : '해당 없음',
                          insul: set.includes('insul') ? tc.insul.basis : '해당 없음',
                          hvac: set.includes('hvac') ? tc.hvac.basis : '해당 없음' },
                 hvacLabel: tc.hvac.label,
                 totalCost: C, ...sav, finance: fin, ownerTotal,
                 payback: discountedPayback(ownerTotal, sav.annualSaving) };
    };

    // 취약 순위: 점수 낮은 순 → 동점이면 단일 공종 회수기간 짧은 순 → 그래도 같으면 공사비 적은 순
    const single = {};
    ['window', 'insul', 'hvac'].forEach(k => { single[k] = evaluate([k]); });
    const ranking = ['window', 'insul', 'hvac'].sort((a, b) =>
        (trades[a].score - trades[b].score) ||
        (single[a].payback - single[b].payback) ||
        (single[a].totalCost - single[b].totalCost));

    const mk = (pkgKey, name, desc, set) => Object.assign(evaluate(set), { key: pkgKey, name, desc });
    const packages = [
        mk('econ',  '실속형',   '취약 1순위 공종만 보강',        ranking.slice(0, 1)),
        mk('smart', '스마트형', '취약 1·2순위 공종 보강',        ranking.slice(0, 2)),
        mk('total', '종합형',   '창호·단열·설비 전 공종 개선',   ranking.slice(0, 3))
    ];

    // AI 추천: 기대수명(20년) 동안의 순이익(NPV)이 가장 큰 패키지
    //   NPV = Σ_{t=1..20} B/(1+r)^t − (공사비 + 건축주 부담 이자)   → 모두 0 이하면 추천 없음
    const life = CONFIG.maxPaybackYears, r = CONFIG.discountRate;
    const annuity = (1 - Math.pow(1 + r, -life)) / r;
    packages.forEach(p => { p.npv = p.annualSaving * annuity - p.ownerTotal; });
    const best = packages.reduce((a, b) => (b.npv > a.npv ? b : a));
    const rec = best.npv > 0 ? best : null;
    packages.forEach(p => { p.isRecommended = p === rec; p.recommendReason = p === rec ? `${life}년 순이익 최대` : ''; });

    return { trades, ranking, energy, geo, packages, recommended: rec };
}

/* 월별 요금 곡선 (만 원): 난방·냉방·기타를 각각 배분 후 패키지 절감률 적용 */
function monthlyCurves(bldg, energy, r) {
    const M = CONFIG.monthly;
    const before = [], after = [];
    const priceE = energy.elec.total > 0 ? elecCost(energy.elec.total, bldg.usage, bldg.households) / energy.elec.total : 0;
    const priceG = CONFIG.tariff.gas[bldg.usage];
    for (let m = 0; m < 12; m++) {
        const heatE = energy.elec.heat * M.heat[m], coolE = energy.elec.cool * M.cool[m], baseE = energy.elec.base / 12;
        const heatG = energy.gas.heat * M.heat[m];
        before.push((heatE + coolE + baseE) * priceE + heatG * priceG);
        after.push((heatE * (1 - r.heatElec) + coolE * (1 - r.cool) + baseE * (1 - r.base)) * priceE
                   + heatG * (1 - r.heatGas) * priceG);
    }
    const toMan = v => Math.round(v / 10000 * 10) / 10;
    return { before: before.map(toMan), after: after.map(toMan) };
}

if (typeof module !== 'undefined') {
    module.exports = { CONFIG, runEngine, monthlyCurves, discountedPayback, financePlan, resElecCost };
}
