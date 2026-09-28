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
    statusText.innerText = "실제 데이터셋 기반 조회 중...";
    
    if (!address) {
        alert("주소를 입력해주세요.");
        statusText.innerText = "공공 데이터 연동 대기 중...";
        return;
    }
    
    try {
        // Flask 서버 없이 프론트엔드에서 직접 CSV(실제 데이터셋)를 로드하여 분석
        const res = await fetch('model_data/gwangju_building_energy.csv');
        if (!res.ok) throw new Error("CSV 데이터를 불러올 수 없습니다.");
        const text = await res.text();
        
        const lines = text.split(/\r?\n/);
        let matchedRow = null;
        
        // 주소의 공백을 제거하여 부분 일치율을 높임
        const searchAddr = address.replace(/\s/g, '');
        
        // CSV 파싱 (헤더 건너뛰고 첫 번째 매칭되는 건물 탐색)
        for (let i = 1; i < lines.length; i++) {
            const row = lines[i].split(',');
            if (row.length < 11) continue;
            
            const rowAddr = (row[2] || '').replace(/\s/g, '');
            if (rowAddr.includes(searchAddr)) {
                matchedRow = row;
                break;
            }
        }
        
        if (!matchedRow) {
            alert(`'${address}'에 해당하는 건물을 실제 데이터셋에서 찾을 수 없습니다.`);
            statusText.innerText = "공공 데이터 연동 대기 중...";
            return;
        }
        
        // 인덱스 -> 2: 대지위치, 4: 주용도, 7: 연식, 8: 연면적, 9: 전기(kWh), 10: 가스(MJ)
        const bAddress = matchedRow[2];
        const bUsage = matchedRow[4];
        const bYear = parseInt(matchedRow[7]) || 30;
        const bArea = parseFloat(matchedRow[8]) || 84;
        const elecRaw = parseFloat(matchedRow[9]);
        const gasRaw  = parseFloat(matchedRow[10]);
        const bElec = Number.isFinite(elecRaw) ? elecRaw : bArea * 50;
        const bGas  = Number.isFinite(gasRaw)  ? gasRaw  : 0;
        
        let uiUsage = "상업용";
        if (bUsage.includes("주택")) uiUsage = "주거용";
        else if (bUsage.includes("공장") || bUsage.includes("창고")) uiUsage = "산업용";
        
        document.getElementById('val-address').innerText = bAddress;
        document.querySelector('#screen-status .badge').innerText = bYear + ' 년';
        document.getElementById('input-usage').value = uiUsage;
        document.getElementById('input-area').value = Math.round(bArea);
        
        document.getElementById('val-elec').innerText = Math.round(bElec).toLocaleString() + ' kWh';
        document.getElementById('val-gas').innerText =
            bGas > 0 ? Math.round(bGas).toLocaleString() + ' MJ' : '가스 미사용 (0 MJ)';
        
        simData.currentElecKwh = bElec;
        simData.currentGasMj = bGas;
        
        statusText.innerText = "공공 데이터 연동 대기 중...";
        nextScreen('screen-status');
    } catch (e) {
        console.error("데이터셋 로드 에러:", e);
        alert("실제 데이터셋(CSV)을 읽어오는 데 실패했습니다.");
        statusText.innerText = "공공 데이터 연동 대기 중...";
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
            fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${e.latlng.lat}&lon=${e.latlng.lng}`)
                .then(res => res.json())
                .then(data => {
                    if(data && data.display_name) {
                        document.getElementById('address-input').value = data.display_name;
                    }
                });
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
    totalCost: 0,
    annualSaving: 0,
    payback: 0,
    beforeCost: 0,
    afterCost: 0,
    savingRate: 0
};

let calculatedPackages = [];
let selectedPackageIndex = 1;

// --- Engine Logic ---
function runEngines() {
    // 1. Get Inputs
    const usage = document.getElementById('input-usage').value;
    const area = parseFloat(document.getElementById('input-area').value);
    const floors = parseInt(document.getElementById('input-floors').value);

    // 2. Geometry Engine
    const A = area / floors;
    let W = 0, insulArea = 0, windowArea = 0, roofArea = A;

    if (usage === '주거용') {
        W = 18 * Math.sqrt(A / 2) * floors;
        insulArea = W * 0.15; // 핀포인트 북측 단열
        windowArea = W * 0.30;
    } else if (usage === '상업용') {
        W = 16 * Math.sqrt(A) * floors;
        insulArea = W * 0.40; // 내단열
        windowArea = W * 0.60;
    } else {
        W = 24 * Math.sqrt(A) * floors;
        insulArea = W * 0.90; // 내단열
        windowArea = W * 0.10;
    }

    const windowCount = Math.ceil(windowArea / 3);
    const totalInsulArea = insulArea + roofArea;
    const hvacCount = Math.max(1, Math.ceil(area / 120));
    
    const currentElecKwh = simData.currentElecKwh ?? (area * 50);
    const currentGasMj   = simData.currentGasMj   ?? (area * 300);
    const elecCost = currentElecKwh * 150;
    const gasCost = currentGasMj * 20;
    const currentTotalCost = elecCost + gasCost;

    const baseHvacPrice = (usage === '주거용') ? (850000 + 150000) : (2800000 + 450000);

    // 3. AI Survey Recommendation Logic
    let totalScore = Object.values(surveyAnswers).reduce((a, b) => a + b, 0);
    let recommendedIdx = 1; // Default Smart
    if (totalScore <= 10) recommendedIdx = 2; // Bad state -> Comprehensive
    else if (totalScore >= 16) recommendedIdx = 0; // Good state -> Economy

    // 4. Calculate 3 Packages independently
    calculatedPackages = [
        {
            name: "실속형",
            desc: "가성비 보완 시공 (최단기 회수)",
            savingRate: 0.15,
            costWindow: windowArea * 50000,
            basisWindow: `기밀 보강 및 단열 필름: ${Math.round(windowArea)}㎡ × 50,000원`,
            costInsul: (totalInsulArea * 0.2) * 40000,
            basisInsul: `취약부 부분 단열: ${Math.round(totalInsulArea * 0.2)}㎡ × 40,000원`,
            costHvac: 0,
            basisHvac: `설비 교체 없음`,
            isRecommended: recommendedIdx === 0
        },
        {
            name: "스마트형",
            desc: "정부지원 타겟 전면 교체 (표준)",
            savingRate: 0.35,
            costWindow: (windowArea * 280000) + (windowCount * 103673),
            basisWindow: `고효율 이중창: ${Math.round(windowArea)}㎡ × 28만 + ${windowCount}개소 시공비`,
            costInsul: totalInsulArea * 40016,
            basisInsul: `전체 단열재 보강: ${Math.round(totalInsulArea)}㎡ × 40,016원`,
            costHvac: hvacCount * baseHvacPrice,
            basisHvac: `고효율 설비 교체: ${hvacCount}대 × ${baseHvacPrice.toLocaleString()}원`,
            isRecommended: recommendedIdx === 1
        },
        {
            name: "종합형",
            desc: "프리미엄 제로에너지화 (자산가치 극대화)",
            savingRate: 0.60,
            costWindow: (windowArea * 500000) + (windowCount * 103673),
            basisWindow: `방위 맞춤 삼중창: ${Math.round(windowArea)}㎡ × 50만 + ${windowCount}개소 시공비`,
            costInsul: totalInsulArea * 80000,
            basisInsul: `프리미엄 외단열: ${Math.round(totalInsulArea)}㎡ × 80,000원`,
            costHvac: (hvacCount * baseHvacPrice) + 5000000,
            basisHvac: `고효율 설비 + 환기/태양광: 설비 + 5,000,000원 추가`,
            isRecommended: recommendedIdx === 2
        }
    ];

    // Calc totals and payback for each
    calculatedPackages.forEach(pkg => {
        pkg.totalCost = pkg.costWindow + pkg.costInsul + pkg.costHvac;
        pkg.annualSaving = currentTotalCost * pkg.savingRate;
        const r = 0.02; // 2% discount rate for payback
        if (pkg.totalCost * r < pkg.annualSaving) {
            pkg.payback = -Math.log(1 - (pkg.totalCost * r) / pkg.annualSaving) / Math.log(1 + r);
        } else {
            pkg.payback = 999;
        }
    });

    renderPackageCards();
}

function renderPackageCards() {
    const container = document.getElementById('packages-container');
    if (!container) return;
    
    let html = '';
    calculatedPackages.forEach((pkg, idx) => {
        const paybackText = pkg.payback > 100 ? '회수 불가' : (pkg.payback.toFixed(1) + '년');
        const borderStyle = pkg.isRecommended ? 'border: 2px solid #1a4d41;' : 'border: 1px solid #ddd;';
        
        html += `
        <div class="data-card" style="cursor:pointer; position:relative; ${borderStyle} transition: all 0.2s;" onclick="selectPackage(${idx})">
            ${pkg.isRecommended ? '<div class="badge green" style="position:absolute; top:-10px; right:15px; z-index:10; font-size:11px; padding:4px 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">AI 추천✨</div>' : ''}
            <h3 style="margin:0 0 5px 0; color:#1a4d41; font-size:18px;">${pkg.name}</h3>
            <p style="font-size:12px; color:#666; margin:0 0 15px 0;">${pkg.desc}</p>
            <div style="display:flex; justify-content:space-between; font-size:14px; margin-bottom:8px;">
                <span>총 예상 공사비</span><strong style="color:#1a4d41;">${Math.round(pkg.totalCost / 10000).toLocaleString()}만 원</strong>
            </div>
            <div style="display:flex; justify-content:space-between; font-size:14px; margin-bottom:8px;">
                <span>연간 절감액</span><strong>${Math.round(pkg.annualSaving / 10000).toLocaleString()}만 원</strong>
            </div>
            <div style="display:flex; justify-content:space-between; font-size:14px; color:#f39c12; font-weight:bold;">
                <span>투자 회수 기간</span><span>${paybackText}</span>
            </div>
        </div>
        `;
    });
    container.innerHTML = html;
}

function selectPackage(idx) {
    selectedPackageIndex = idx;
    const pkg = calculatedPackages[idx];
    
    // Apply selected package to simData for downstream charts
    const currentElecKwh = simData.currentElecKwh || 0; 
    const currentGasMj = simData.currentGasMj || 0;
    const currentTotalCost = (currentElecKwh * 150) + (currentGasMj * 20);

    simData.beforeCost = currentTotalCost;
    simData.afterCost = currentTotalCost - pkg.annualSaving;
    simData.annualSaving = pkg.annualSaving;
    simData.totalCost = pkg.totalCost;
    simData.savingRate = pkg.savingRate;
    simData.payback = pkg.payback;

    // Update Screen 5 DOM (Cost details)
    document.getElementById('package-name').innerText = `${pkg.name} 리모델링 패키지`;
    document.getElementById('cost-window').innerText = Math.round(pkg.costWindow).toLocaleString() + ' 원';
    document.getElementById('cost-insul').innerText = Math.round(pkg.costInsul).toLocaleString() + ' 원';
    document.getElementById('cost-hvac').innerText = Math.round(pkg.costHvac).toLocaleString() + ' 원';
    document.getElementById('cost-total').innerText = Math.round(pkg.totalCost).toLocaleString() + ' 원';
    
    document.getElementById('basis-window').innerText = pkg.basisWindow;
    document.getElementById('basis-insul').innerText = pkg.basisInsul;
    document.getElementById('basis-hvac').innerText = pkg.basisHvac;

    nextScreen('screen-cost');
}

// --- Charts ---
let eChart, rChart;

function renderEnergyChart() {
    document.getElementById('banner-saving-text').innerText = `연간 약 ${Math.round(simData.annualSaving / 10000).toLocaleString()}만 원 절감!`;
    document.getElementById('stat-saving-rate').innerText = (simData.savingRate * 100).toFixed(1) + '%';
    document.getElementById('stat-saving-amount').innerText = Math.round(simData.annualSaving).toLocaleString() + ' 원';

    const ctx = document.getElementById('energyLineChart').getContext('2d');
    if(eChart) eChart.destroy();

    // Mock monthly curve
    const months = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'];
    const curveBefore = [150, 130, 100, 80, 90, 140, 200, 210, 120, 90, 110, 160];
    const curveAfter = curveBefore.map(v => v * (1 - simData.savingRate));

    eChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: months,
            datasets: [
                {
                    label: '현재 예상 요금',
                    data: curveBefore,
                    borderColor: '#a0d6c9',
                    borderWidth: 2,
                    tension: 0.4,
                    fill: false
                },
                {
                    label: '리모델링 후',
                    data: curveAfter,
                    borderColor: '#1a4d41',
                    borderWidth: 3,
                    tension: 0.4,
                    fill: true,
                    backgroundColor: 'rgba(26, 77, 65, 0.1)'
                }
            ]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { position: 'top' } },
            scales: { y: { beginAtZero: true } }
        }
    });
}

function renderRoiChart() {
    // 2% 현금흐름법 투자회수기간 산출
    const r = 0.02;
    let C = simData.totalCost;
    let S = simData.annualSaving;
    
    if (C * r < S) {
        simData.payback = -Math.log(1 - (C * r) / S) / Math.log(1 + r);
    } else {
        simData.payback = 999;
    }

    document.getElementById('roi-cost').innerText = Math.round(simData.totalCost).toLocaleString() + ' 원';
    document.getElementById('roi-saving').innerText = Math.round(simData.annualSaving).toLocaleString() + ' 원';
    document.getElementById('roi-payback').innerText = simData.payback > 100 ? '회수 불가' : (simData.payback.toFixed(1) + ' 년');
    
    // Details
    document.getElementById('detail-eui').innerText = (simData.savingRate * 100).toFixed(1) + ' %';
    document.getElementById('detail-co2').innerText = Math.round(simData.annualSaving * 0.05).toLocaleString() + ' kgCO₂';
    
    let afterGrade = "B등급";
    if(simData.savingRate > 0.5) afterGrade = "1++등급";
    else if(simData.savingRate > 0.3) afterGrade = "A등급";
    document.getElementById('grade-after').innerText = afterGrade;

    const ctx = document.getElementById('roiLineChart').getContext('2d');
    if(rChart) rChart.destroy();

    const years = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const costLine = years.map(() => simData.totalCost);
    const savingLine = years.map(y => {
        let cumSaving = 0;
        for(let i=1; i<=y; i++) {
            cumSaving += simData.annualSaving / Math.pow(1 + 0.02, i);
        }
        return Math.round(cumSaving);
    });

    rChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: years.map(y => y+'년'),
            datasets: [
                {
                    label: '누적 절감액',
                    data: savingLine,
                    borderColor: '#1a4d41',
                    borderWidth: 3,
                    tension: 0,
                    fill: true,
                    backgroundColor: 'rgba(26, 77, 65, 0.1)'
                },
                {
                    label: '총 투자 비용',
                    data: costLine,
                    borderColor: '#a0d6c9',
                    borderWidth: 2,
                    borderDash: [5, 5],
                    tension: 0,
                    fill: false
                }
            ]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { position: 'top' } }
        }
    });
}
