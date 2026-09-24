import os
import json
import pandas as pd
import joblib
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS

app = Flask(__name__, static_folder='.', static_url_path='')
CORS(app)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_PATH = os.path.join(BASE_DIR, 'model_data', 'gwangju_building_energy.csv')
ELEC_MODEL_PATH = os.path.join(BASE_DIR, 'model_data', 'elec_eui_model.pkl')
GAS_MODEL_PATH = os.path.join(BASE_DIR, 'model_data', 'gas_eui_model.pkl')

# 데이터 로드
try:
    df = pd.read_csv(DATA_PATH)
    elec_model_data = joblib.load(ELEC_MODEL_PATH)
    gas_model_data = joblib.load(GAS_MODEL_PATH)
    elec_model = elec_model_data['model']
    gas_model = gas_model_data['model']
    features = elec_model_data['features']
    print("Data and model loaded successfully")
except Exception as e:
    print(f"Data load error: {e}")

@app.route('/')
def index():
    return send_from_directory('.', 'index.html')

@app.route('/api/search', methods=['GET'])
def search_building():
    address = request.args.get('address', '').strip()
    if not address:
        return jsonify({"error": "주소를 입력해주세요."}), 400
        
    # 주소로 건물 검색 (부분 일치)
    matched = df[df['대지위치'].str.contains(address, na=False, case=False)]
    if matched.empty:
        return jsonify({"error": f"'{address}'에 해당하는 건물을 찾을 수 없습니다."}), 404
        
    building = matched.iloc[0]
    usage = building['주용도']
    
    # 모델 입력을 위한 Feature 데이터 준비
    input_data = {
        '연식': building['연식'],
        '연면적(㎡)': building['연면적(㎡)'],
        '세대수': building['세대수']
    }
    
    # 주용도 원핫인코딩 (학습할 때 사용한 feature 구조 맞추기)
    for f in features:
        if f.startswith('주용도_'):
            input_data[f] = 1 if f == f'주용도_{usage}' else 0
            
    input_df = pd.DataFrame([input_data])[features]
    
    # EUI 예측
    try:
        predicted_elec_eui = float(elec_model.predict(input_df)[0])
        predicted_gas_eui = float(gas_model.predict(input_df)[0])
    except Exception as e:
        print(e)
        predicted_elec_eui = 50.0
        predicted_gas_eui = 300.0
    
    predicted_elec_eui = max(0, predicted_elec_eui)
    predicted_gas_eui = max(0, predicted_gas_eui)
    
    area = float(building['연면적(㎡)'])
    pred_elec_kwh = predicted_elec_eui * area
    pred_gas_mj = predicted_gas_eui * area
    
    # 사용 용도 분류 매핑 (UI용)
    ui_usage = "상업용"
    if "주택" in usage:
        ui_usage = "주거용"
    elif "공장" in usage or "창고" in usage:
        ui_usage = "산업용"
        
    return jsonify({
        "address": str(building['대지위치']),
        "buildingName": str(building['건물명']) if pd.notna(building['건물명']) else "-",
        "usage_raw": usage,
        "usage_ui": ui_usage,
        "year": int(building['연식']),
        "area": area,
        "pred_elec_kwh": pred_elec_kwh,
        "pred_gas_mj": pred_gas_mj
    })

if __name__ == '__main__':
    app.run(port=5000, debug=True)
