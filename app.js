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
    
    try {
        const res = await fetch('/api/search?address=' + encodeURIComponent(address));
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
        
        document.getElementById('val-elec').innerText = Math.round(data.pred_elec_kwh).toLocaleString() + ' kWh';
        document.getElementById('val-gas').innerText = Math.round(data.pred_gas_mj).toLocaleString() + ' MJ';
        
        // Store
        simData.currentElecKwh = data.pred_elec_kwh;
        simData.currentGasMj = data.pred_gas_mj;
        
        statusText.innerText = "공공 데이터 연동 대기 중...";
        nextScreen('screen-status');
    } catch (e) {
        console.error("Error in searchBuildingAndNext:", e);
        
        // 서버 연결 실패 시 임시(Dummy) 데이터로 진행하도록 폴백(Fallback) 구현
        const dummyData = {
            address: address || "임시 주소 (서버 연결 실패)",
            year: 30,
            usage_ui: "주거용",
            area: 84,
            pred_elec_kwh: 4200,
            pred_gas_mj: 25200
        };
        
        document.getElementById('val-address').innerText = dummyData.address;
        document.querySelector('#screen-status .badge').innerText = dummyData.year + ' 년';
        document.getElementById('input-usage').value = dummyData.usage_ui;
        document.getElementById('input-area').value = Math.round(dummyData.area);
        
        document.getElementById('val-elec').innerText = Math.round(dummyData.pred_elec_kwh).toLocaleString() + ' kWh';
        document.getElementById('val-gas').innerText = Math.round(dummyData.pred_gas_mj).toLocaleString() + ' MJ';
        
        simData.currentElecKwh = dummyData.pred_elec_kwh;
        simData.currentGasMj = dummyData.pred_gas_mj;
        
        statusText.innerText = "공공 데이터 연동 대기 중...";
        alert("Flask 서버가 꺼져 있어 임시(Dummy) 데이터로 분석을 진행합니다.");
        nextScreen('screen-status');
    }
}

let screenHistory = ['screen-intro'];
let map = null;
let marker = null;

function initMap() {
    if (!map) {
        map = L.map('map').setView([35.1768, 126.9058], 14);
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
        marker = L.marker([35.1768, 126.9058], {icon: redIcon}).addTo(map);
        
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
    } else if (targetId === 'screen-cost') {
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
        nextScreen('screen-cost');
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

    // 3. Survey Score -> Package Selection
    let totalScore = Object.values(surveyAnswers).reduce((a, b) => a + b, 0);
    // Score range: 6 to 18
    let pkg = "실속형";
    let savingRate = 0.11;
    if (totalScore <= 10) {
        pkg = "완결형"; // Bad state -> Needs premium
        savingRate = 0.675;
    } else if (totalScore <= 15) {
        pkg = "스마트형";
        savingRate = 0.35;
    }

    // 4. Cost Engine
    // Use predicted EUI Energy (Electric + Gas) from ML Model
    const currentElecKwh = simData.currentElecKwh || (area * 50); 
    const currentGasMj = simData.currentGasMj || (area * 300);
    const elecCost = currentElecKwh * 150; // 150 won/kWh
    const gasCost = currentGasMj * 20;     // 20 won/MJ
    const currentTotalCost = elecCost + gasCost;
    const annualSaving = currentTotalCost * savingRate;

    // Unit prices (Updated with real standards)
    // 창호: 재료비 280,000원/㎡ + 시공비 103,673원/개소 (평균 3㎡당 1개소로 가정)
    const windowCount = Math.ceil(windowArea / 3);
    const costWindow = (windowArea * 280000) + (windowCount * 103673);
    
    // 단열: 재료비 25,000원/㎡ + 시공비 15,016원/㎡
    const costInsul = (insulArea + roofArea) * (25000 + 15016);
    
    // 설비: 주거용 보일러(850k + 150k) vs 상업용 EHP(2.8M + 450k)
    // 건물 규모(120㎡당 1대 기준)에 비례하여 대수 산정
    const hvacCount = Math.max(1, Math.ceil(area / 120));
    const hvacCost = (usage === '주거용') 
        ? hvacCount * (850000 + 150000) 
        : hvacCount * (2800000 + 450000);

    const totalCost = costWindow + costInsul + hvacCost;
    
    // Govt Support (Interest subsidy) -> Mocked as a pure discount for visual simplicity here, though formula implies interest deduction
    const govSupport = totalCost * 0.10; // 10% support assumed over 5 years

    // Save globally
    simData.beforeCost = currentTotalCost;
    simData.afterCost = currentTotalCost - annualSaving;
    simData.annualSaving = annualSaving;
    simData.totalCost = totalCost;
    simData.savingRate = savingRate;
    simData.payback = totalCost / annualSaving;

    // Update DOM
    document.getElementById('package-name').innerText = `${pkg} 리모델링 패키지`;
    document.getElementById('cost-window').innerText = Math.round(costWindow).toLocaleString() + ' 원';
    document.getElementById('cost-insul').innerText = Math.round(costInsul).toLocaleString() + ' 원';
    document.getElementById('cost-hvac').innerText = Math.round(hvacCost).toLocaleString() + ' 원';
    document.getElementById('cost-total').innerText = Math.round(totalCost).toLocaleString() + ' 원';
    if(document.getElementById('cost-support')) {
        document.getElementById('cost-support').innerText = '-' + Math.round(govSupport).toLocaleString() + ' 원';
    }

    // 산출근거 표시
    const hvacPrice = (usage === '주거용') ? (850000 + 150000) : (2800000 + 450000);
    document.getElementById('basis-window').innerText = `산출근거: ${Math.round(windowArea)}㎡ × 280,000원 + ${windowCount}개소 × 103,673원`;
    document.getElementById('basis-insul').innerText = `산출근거: ${Math.round(insulArea + roofArea)}㎡ × 40,016원`;
    document.getElementById('basis-hvac').innerText = `산출근거: ${hvacCount}대 × ${hvacPrice.toLocaleString()}원`;
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
