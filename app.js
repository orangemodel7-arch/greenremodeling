// --- Survey Data ---
const surveyQuestions = [
    {
        id: "q1",
        title: "Q1. 창호의 재질과 색은 어떤 형태인가요?",
        options: [
            { text: "① 은색/알루미늄 프레임 + 홑겹 유리", score: 1 },
            { text: "② 검은색/목재 프레임 + 유리", score: 1 },
            { text: "③ 흰색/플라스틱(PVC) 프레임 + 유리", score: 2 },
            { text: "④ 녹색/청색 유리가 적용된 이중/삼중 샤시", score: 3 }
        ]
    },
    {
        id: "q2",
        title: "Q2. 겨울철 유리창/모서리에 물방울이나 곰팡이가 생기나요?",
        options: [
            { text: "① 물방울이 줄줄 흐르고 곰팡이가 자주 생김", score: 1 },
            { text: "② 모서리나 구석 일부에만 살짝 축축해짐", score: 2 },
            { text: "③ 결로는 없으나 벽면이 얼음처럼 차가움", score: 2 },
            { text: "④ 결로나 곰팡이가 거의 없이 항상 보송함", score: 3 }
        ]
    },
    {
        id: "q3",
        title: "Q3. 창문이나 벽 틈새로 찬바람(외풍)이 느껴지나요?",
        options: [
            { text: "① 촛불이 흔들릴 정도로 찬바람이 강하게 들어옴", score: 1 },
            { text: "② 바람은 아니지만 서늘한 기운이 확 느껴짐", score: 2 },
            { text: "③ 환기할 때 외에는 찬바람이 거의 느껴지지 않음", score: 3 }
        ]
    },
    {
        id: "q4",
        title: "Q4. 여름철 최상층이나 직사광선이 드는 방이 찜통인가요?",
        options: [
            { text: "① 에어컨을 강하게 틀어도 좀처럼 시원해지지 않음", score: 1 },
            { text: "② 오후만 되면 유독 덥고 눈이 부신 방이 있음", score: 2 },
            { text: "③ 에어컨을 가동하면 어느 정도 시원해짐", score: 3 },
            { text: "④ 한여름 낮에도 실내가 쾌적하게 유지됨", score: 3 }
        ]
    },
    {
        id: "q5",
        title: "Q5. 겨울철 난방기를 켰을 때 실내 온도는 어떻게 변하나요?",
        options: [
            { text: "① 계속 틀어도 금방 식고 가스비/전기료 폭탄이 나옴", score: 1 },
            { text: "② 꺼두면 금방 서늘해져서 온도를 계속 높여야 함", score: 2 },
            { text: "③ 난방기를 틀면 어느 정도 온도가 잘 유지됨", score: 3 },
            { text: "④ 적은 가동으로도 실내가 오랫동안 따뜻하게 유지됨", score: 3 }
        ]
    },
    {
        id: "q6",
        title: "Q6. 현재 냉·난방 기기를 설치한 지 얼마나 되었나요?",
        options: [
            { text: "① 15년 이상 지났거나 아주 오래됨", score: 1 },
            { text: "② 10년 ~ 15년 정도 됨", score: 2 },
            { text: "③ 5년 ~ 10년 정도 됨", score: 2 },
            { text: "④ 5년 미만으로 비교적 최근에 설치함", score: 3 }
        ]
    }
];

let currentSurveyIndex = 0;
let surveyAnswers = {};

// --- Navigation ---
async function searchBuildingAndNext() {
    const address = document.getElementById('address-input').value;
    const statusText = document.getElementById('search-status');
    statusText.innerText = "데이터 조회 및 EUI 예측 중...";
    
    if (!address) {
        alert("주소를 입력해주세요.");
        statusText.innerText = "공공 데이터 연동 대기 중...";
        return;
    }
    
    try {
        const res = await fetch('/api/search?address=' + encodeURIComponent(address.trim()));
        const ctype = res.headers.get('content-type') || '';
        if (!ctype.includes('application/json')) throw new Error('서버 응답이 JSON이 아님 (status ' + res.status + ')');
        const data = await res.json();
        
        if (!res.ok) {
            alert(data.error || "검색 실패");
            statusText.innerText = "공공 데이터 연동 대기 중...";
            return;
        }
        
        // Update DOM
        document.getElementById('val-address').innerText = data.address;
        document.querySelector('#screen-status .badge').innerText = data.year + ' 년';
        document.getElementById('input-usage').value = data.usage_ui;
        document.getElementById('input-area').value = Math.round(data.area);
        // 건축물대장 지상층수가 있으면 자동 입력 (사용자 수정 가능), 없으면 1층
        document.getElementById('input-floors').value = (data.floors && data.floors > 0) ? data.floors : 1;
        
        const elecRaw = parseFloat(data.pred_elec_kwh);
        const gasRaw  = parseFloat(data.pred_gas_mj);
        const bElec = Number.isFinite(elecRaw) ? elecRaw : data.area * 50;
        const bGas  = Number.isFinite(gasRaw)  ? gasRaw  : 0;

        document.getElementById('val-elec').innerText = Math.round(bElec).toLocaleString() + ' kWh';
        document.getElementById('val-gas').innerText =
            bGas > 0 ? Math.round(bGas).toLocaleString() + ' MJ' : '가스 미사용 (0 MJ)';
        
        // EUI (연면적당 연간 사용량) 표시
        const euiEl = document.getElementById('val-eui');
        if (euiEl && data.area > 0) {
            euiEl.innerText = `전기 EUI ${Math.round(bElec / data.area).toLocaleString()} kWh/㎡·년` +
                (bGas > 0 ? ` · 가스 EUI ${Math.round(bGas / data.area).toLocaleString()} MJ/㎡·년` : '');
        }

        // Store
        simData.currentElecKwh = bElec;
        simData.currentGasMj = bGas;
        simData.households = parseInt(data.households) || 0;
        
        statusText.innerText = "공공 데이터 연동 대기 중...";
        nextScreen('screen-status');
    } catch (e) {
        console.error("Error in searchBuildingAndNext:", e);
        // 서버 응답 실패(무료 서버 절전 해제 중 등) 시 임시 데이터로 진행하지 않고 재시도를 안내
        alert("서버를 준비하는 중입니다. 약 30초 후 다시 [검색]을 눌러주세요.");
        statusText.innerText = "서버 준비 중... 잠시 후 다시 검색해주세요.";
    }
}

let screenHistory = ['screen-intro'];
let map = null;
let marker = null;

function initMap() {
    if (!map) {
        map = L.map('map').setView([35.1765, 126.8687], 14);
        L.tileLayer('https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
            attribution: '© Google Maps'
        }).addTo(map);

        const redIcon = L.icon({
            iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
            shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
            iconSize: [25, 41],
            iconAnchor: [12, 41],
            popupAnchor: [1, -34],
            shadowSize: [41, 41]
        });
        marker = L.marker([35.1765, 126.8687], {icon: redIcon}).addTo(map);
        
        map.on('click', function(e) {
            marker.setLatLng(e.latlng);
            // 지도 클릭은 위치 확인용이며, 주소 입력칸은 사용자가 직접 입력한 값을 유지함
        });
    } else {
        setTimeout(() => map.invalidateSize(), 100);
    }
}

async function searchAddressMap() {
    const address = document.getElementById('address-input').value;
    if (!address) return;
    try {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}`);
        const data = await res.json();
        if (data && data.length > 0) {
            const lat = parseFloat(data[0].lat);
            const lon = parseFloat(data[0].lon);
            map.setView([lat, lon], 17);
            marker.setLatLng([lat, lon]);
        }
    } catch(e) {
        console.error("Geocoding error", e);
    }
}

function nextScreen(targetId) {
    if (screenHistory[screenHistory.length - 1] !== targetId) {
        screenHistory.push(targetId);
    }
    showScreen(targetId);
}

function goBack() {
    let currentScreen = screenHistory[screenHistory.length - 1];
    if (currentScreen === 'screen-survey' && currentSurveyIndex > 0) {
        currentSurveyIndex--;
        document.getElementById('survey-progress').style.width = `${((currentSurveyIndex + 1) / 6) * 100}%`;
        renderSurvey();
        return;
    }
    if (screenHistory.length > 1) {
        screenHistory.pop();
        let prev = screenHistory[screenHistory.length - 1];
        showScreen(prev);
    }
}

function showScreen(targetId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(targetId).classList.add('active');

    if (targetId === 'screen-address') {
        // 화면 전환 애니메이션(0.4s)이 끝난 후 지도를 렌더링해야 지도가 깨지지 않습니다.
        setTimeout(() => {
            initMap();
            if (map) map.invalidateSize();
        }, 450);
    } else if (targetId === 'screen-survey') {
        renderSurvey();
    } else if (targetId === 'screen-packages') {
        runEngines();
    } else if (targetId === 'screen-energy-analysis') {
        renderEnergyChart();
    } else if (targetId === 'screen-roi') {
        renderRoiChart();
    }
}

function resetApp() {
    currentSurveyIndex = 0;
    surveyAnswers = {};
    document.getElementById('survey-progress').style.width = '16.6%';
    screenHistory = ['screen-intro'];
    showScreen('screen-intro');
}

// --- Survey Logic ---
function renderSurvey() {
    const container = document.getElementById('survey-container');
    const q = surveyQuestions[currentSurveyIndex];
    document.getElementById('survey-counter').innerText = currentSurveyIndex + 1;
    
    let html = `<h3>${q.title}</h3><div style="margin-top:15px;">`;
    q.options.forEach((opt, idx) => {
        const isSelected = surveyAnswers[q.id] === opt.score;
        html += `<div class="survey-option ${isSelected ? 'selected' : ''}" onclick="selectOption('${q.id}', ${opt.score}, this)">${opt.text}</div>`;
    });
    html += `</div>`;
    container.innerHTML = html;
}

function selectOption(qId, score, element) {
    surveyAnswers[qId] = score;
    const options = document.querySelectorAll('.survey-option');
    options.forEach(opt => opt.classList.remove('selected'));
    element.classList.add('selected');
}

function handleSurveyNext() {
    const qId = surveyQuestions[currentSurveyIndex].id;
    if (!surveyAnswers[qId]) {
        alert('항목을 선택해주세요.');
        return;
    }
    
    if (currentSurveyIndex < surveyQuestions.length - 1) {
        currentSurveyIndex++;
        document.getElementById('survey-progress').style.width = `${((currentSurveyIndex + 1) / 6) * 100}%`;
        renderSurvey();
    } else {
        nextScreen('screen-packages');
    }
}

// --- Global Data Store ---
let simData = {
    currentElecKwh: null,
    currentGasMj: null,
    households: 0,
    bldg: null,
    energy: null,
    pkg: null
};

let engineResult = null;
let calculatedPackages = [];
let selectedPackageIndex = 1;

const won = v => Math.round(v).toLocaleString() + ' 원';
const man = v => Math.round(v / 10000).toLocaleString() + '만 원';
const pct = v => (v * 100).toFixed(1) + '%';
const yrs = v => isFinite(v) ? v.toFixed(1) + '년' : '회수 불가';

function currentBankRate() {
    const el = document.getElementById('input-bank-rate');
    const v = el ? parseFloat(el.value) : NaN;
    return Number.isFinite(v) && v >= 0 ? v / 100 : CONFIG.finance.defaultBankRate;
}

// --- Engine Logic (계산은 engine.js) ---
function runEngines() {
    const usage = document.getElementById('input-usage').value;
    const area = parseFloat(document.getElementById('input-area').value);
    const floors = Math.max(1, parseInt(document.getElementById('input-floors').value) || 1);

    const bldg = {
        usage, area, floors,
        households: simData.households || 0,
        elecKwh: simData.currentElecKwh ?? area * 50,
        gasMj: simData.currentGasMj ?? 0
    };
    engineResult = runEngine(bldg, surveyAnswers, currentBankRate());
    simData.bldg = bldg;
    simData.energy = engineResult.energy;
    calculatedPackages = engineResult.packages;
    renderPackageCards();
}

function supportBadge(fin) {
    if (!fin.eligible) return '<span class="badge gray" style="font-size:11px;">이자지원 미대상 (20% 미만)</span>';
    return `<span class="badge green" style="font-size:11px;">이자지원 ${(fin.support * 100).toFixed(1)}%p${fin.bonus ? ' (30%↑ 추가)' : ''}</span>`;
}

function renderPackageCards() {
    const container = document.getElementById('packages-container');
    if (!container) return;

    const d = engineResult.parts;
    const partLine = [d.window, d.wall, d.solar, d.equip]
        .map(p => `${p.name} ${p.weak ? '<b style="color:#d84c4c;">취약</b>' : '양호'}`).join(' · ');
    const heatType = engineResult.energy.gasHeated ? '가스 난방 건물' : '전기 냉난방 건물';

    let html = `<div style="font-size:12px; color:#666; line-height:1.6; margin-bottom:4px;">
        설문 진단: ${partLine}<br>에너지 특성: ${heatType}</div>`;
    if (!engineResult.recommended) {
        html += `<div style="font-size:12px; color:#d84c4c; margin-bottom:4px;">현재 에너지 사용량에 비해 공사비가 커서 ${CONFIG.maxPaybackYears}년 안에 회수되는 패키지가 없습니다. 부분 보강을 검토하거나 그린리모델링 컨설팅 지원사업(무상 현장진단)을 신청해 보세요.</div>`;
    }

    calculatedPackages.forEach((pkg, idx) => {
        const borderStyle = pkg.isRecommended ? 'border: 2px solid #1a4d41;' : 'border: 1px solid #ddd;';
        const monthlySave = pkg.annualSaving / 12;
        html += `
        <div class="data-card" style="cursor:pointer; position:relative; ${borderStyle} transition: all 0.2s;" onclick="selectPackage(${idx})">
            ${pkg.isRecommended ? `<div class="badge green" style="position:absolute; top:-10px; right:15px; z-index:10; font-size:11px; padding:4px 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">AI 추천✨ ${pkg.recommendReason}</div>` : ''}
            <h3 style="margin:0 0 3px 0; color:#1a4d41; font-size:18px;">${pkg.name} <span style="font-size:12px; color:#888; font-weight:400;">${pkg.scope}</span></h3>
            <p style="font-size:12px; color:#666; margin:0 0 4px 0;">${pkg.desc}${pkg.target ? ` · 진단 대상: ${pkg.target}` : ''}</p>
            <p style="font-size:11px; color:#999; margin:0 0 10px 0;">근거: ${pkg.evidence.map(e => e.src).join(', ')}</p>
            <div class="data-row" style="padding:6px 0;"><span>총 예상 공사비</span><strong style="color:#1a4d41;">${man(pkg.totalCost)}</strong></div>
            <div class="data-row" style="padding:6px 0;"><span>연간 절감액 (절감률)</span><strong>${man(pkg.annualSaving)} (${pct(pkg.primarySavingRate)})</strong></div>
            <div class="data-row" style="padding:6px 0;"><span>월 절감액 vs 월 상환액</span><strong>${man(monthlySave)} / ${man(pkg.finance.monthlyPayment)}</strong></div>
            <div class="data-row" style="padding:6px 0;"><span>정부 지원</span>${supportBadge(pkg.finance)}</div>
            <div style="display:flex; justify-content:space-between; font-size:14px; color:#f39c12; font-weight:bold; margin-top:6px;">
                <span>투자 회수 기간</span><span>${yrs(pkg.payback)}</span>
            </div>
        </div>`;
    });
    container.innerHTML = html;
}

function selectPackage(idx) {
    selectedPackageIndex = idx;
    const pkg = calculatedPackages[idx];
    simData.pkg = pkg;

    document.getElementById('package-name').innerText = `${pkg.name} 리모델링 패키지 (${pkg.scope})`;
    document.getElementById('cost-window').innerText = won(pkg.costs.window);
    document.getElementById('cost-insul').innerText = won(pkg.costs.insul);
    document.getElementById('cost-hvac').innerText = won(pkg.costs.hvac);
    document.getElementById('cost-total').innerText = won(pkg.totalCost);
    document.getElementById('label-insul').innerText = simData.bldg.usage === '주거용' ? '단열 보강 (북측 외벽·옥상)' : '단열 보강 (외벽·옥상)';
    document.getElementById('label-hvac').innerText = simData.bldg.usage === '주거용' ? '설비 교체 (콘덴싱 보일러)' : '설비 교체 (인버터 EHP)';

    document.getElementById('basis-window').innerText = pkg.basis.window;
    document.getElementById('basis-insul').innerText = pkg.basis.insul;
    document.getElementById('basis-hvac').innerText = pkg.basis.hvac;

    nextScreen('screen-cost');
}

// --- Charts ---
let eChart, rChart;

function renderEnergyChart() {
    const pkg = simData.pkg;
    document.getElementById('banner-saving-text').innerText = `연간 약 ${Math.round(pkg.annualSaving / 10000).toLocaleString()}만 원 절감!`;
    document.getElementById('stat-saving-rate').innerText = pct(pkg.primarySavingRate);
    document.getElementById('stat-saving-amount').innerText = won(pkg.annualSaving);

    const r = pkg.rates;
    const rateTxt = [`난방 ${pct(r.heat)}`, `냉방 ${pct(r.cool)}`, `기타 ${pct(r.base)}`].join(' · ');
    document.getElementById('saving-breakdown').innerText =
        `적용 절감률(학술 상수 × 설문 보정): ${rateTxt}\n근거: ${pkg.evidence.map(e => e.label + ' — ' + e.src).join(' / ')}`;

    const ctx = document.getElementById('energyLineChart').getContext('2d');
    if (eChart) eChart.destroy();

    const months = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'];
    const curves = monthlyCurves(simData.bldg, simData.energy, pkg.rates);

    eChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: months,
            datasets: [
                { label: '현재 예상 요금 (만 원)', data: curves.before, borderColor: '#a0d6c9', borderWidth: 2, tension: 0.4, fill: false },
                { label: '리모델링 후 (만 원)', data: curves.after, borderColor: '#1a4d41', borderWidth: 3, tension: 0.4, fill: true, backgroundColor: 'rgba(26, 77, 65, 0.1)' }
            ]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'top' } }, scales: { y: { beginAtZero: true } } }
    });
}

function renderRoiChart() {
    const pkg = simData.pkg;
    const fin = pkg.finance;

    document.getElementById('roi-cost').innerText = won(pkg.totalCost);
    document.getElementById('roi-saving').innerText = won(pkg.annualSaving);
    document.getElementById('roi-payback').innerText = isFinite(pkg.payback) ? pkg.payback.toFixed(1) + ' 년' : '회수 불가';

    // 금융(이자지원) 상세
    const finRows = [
        ['대출 원금 (한도 내)', won(fin.loan) + (fin.equity > 0 ? ` · 자기자금 ${man(fin.equity)}` : '')],
        ['은행 약정금리', pct(fin.bankRate)],
        ['정부 이자지원율', fin.eligible ? `${(fin.support * 100).toFixed(1)}%p` : '미대상 (성능개선 20% 미만)'],
        ['건축주 실부담 금리', pct(fin.userRate)],
        [`월 상환액 (${fin.months}개월 원리금균등)`, `${won(fin.monthlyPayment)}`],
        ['└ 이자지원 없을 때', won(fin.monthlyNoSupport)],
        ['월 절감액', won(pkg.annualSaving / 12)],
        ['정부 이자지원 총액 (D)', won(fin.govSupport)],
        ['건축주 부담 이자 총액', won(fin.userInterest)],
        ['건축주 총부담 (공사비+부담이자)', won(pkg.ownerTotal)]
    ];
    document.getElementById('finance-rows').innerHTML =
        finRows.map(([k, v]) => `<div class="data-row"><span>${k}</span><span>${v}</span></div>`).join('');
    const net = pkg.annualSaving / 12 - fin.monthlyPayment;
    document.getElementById('finance-summary').innerText = net >= 0
        ? `상환 기간 동안 매달 약 ${man(net)}의 여유가 생깁니다 (월 절감액 > 월 상환액).`
        : `상환 기간 동안 매달 약 ${man(-net)}을 추가로 부담합니다 (월 절감액 < 월 상환액).`;

    // 성능 및 환경 가치
    document.getElementById('detail-eui').innerText = pct(pkg.primarySavingRate);
    document.getElementById('detail-co2').innerText = Math.round(pkg.co2Kg).toLocaleString() + ' kgCO₂';
    let afterGrade = '부분 개선';
    if (pkg.primarySavingRate >= 0.30) afterGrade = '대폭 개선';
    else if (pkg.primarySavingRate >= 0.20) afterGrade = '상당 개선';
    document.getElementById('grade-after').innerText = afterGrade;

    // 누적 할인 절감액 vs 건축주 총부담
    const ctx = document.getElementById('roiLineChart').getContext('2d');
    if (rChart) rChart.destroy();
    const horizon = Math.max(10, Math.min(30, isFinite(pkg.payback) ? Math.ceil(pkg.payback) + 2 : 10));
    const years = Array.from({ length: horizon + 1 }, (_, i) => i);
    const costLine = years.map(() => Math.round(pkg.ownerTotal));
    const savingLine = years.map(y => {
        let cum = 0;
        for (let i = 1; i <= y; i++) cum += pkg.annualSaving / Math.pow(1 + CONFIG.discountRate, i);
        return Math.round(cum);
    });

    rChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: years.map(y => y + '년'),
            datasets: [
                { label: '누적 절감액 (할인율 2%)', data: savingLine, borderColor: '#1a4d41', borderWidth: 3, tension: 0, fill: true, backgroundColor: 'rgba(26, 77, 65, 0.1)' },
                { label: '건축주 총부담', data: costLine, borderColor: '#a0d6c9', borderWidth: 2, borderDash: [5, 5], tension: 0, fill: false }
            ]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'top' } } }
    });
}
