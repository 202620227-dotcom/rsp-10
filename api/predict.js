// api/predict.js
export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'POST 요청만 허용됩니다.' });
    }

    try {
        const { image } = req.body;
        if (!image) {
            return res.status(400).json({ message: '이미지 데이터가 전달되지 않았습니다.' });
        }

        let api_key = process.env.ROBOFLOW_API_KEY || '';
        let endpoint = process.env.ROBOFLOW_ENDPOINT || '';

        if (!api_key || !endpoint) {
            return res.status(500).json({ 
                message: 'Vercel 환경변수(ROBOFLOW_API_KEY 또는 ROBOFLOW_ENDPOINT)가 설정되지 않았습니다.' 
            });
        }

        // 1. URL 정제 (?api_key= 중복 및 끝 슬래시 제거)
        const cleanEndpoint = endpoint.split('?')[0].replace(/\/$/, "");
        
        // Base64 순수 텍스트 데이터만 추출
        const base64Data = image.includes(',') ? image.split(',')[1] : image;

        // 2. Roboflow Workflow 규격별 페이로드 형태 후보군
        const candidatePayloads = [
            // 형태 1: 표준 Serverless Workflow 객체
            { inputs: { image: { type: "base64", value: base64Data } } },
            // 형태 2: 입력 키가 images인 경우
            { inputs: { images: { type: "base64", value: base64Data } } },
            // 형태 3: 단순 문자열 키-값 구조
            { inputs: { image: base64Data } },
            // 형태 4: 루트 레벨 전달 구조
            { image: { type: "base64", value: base64Data } }
        ];

        let lastResponseText = "";
        let lastStatus = 422;

        // 3. 순차적 호출 시도 (422 오류 자동 극복)
        for (const payload of candidatePayloads) {
            const targetUrl = `${cleanEndpoint}?api_key=${api_key}`;
            
            const response = await fetch(targetUrl, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${api_key}`
                },
                body: JSON.stringify(payload)
            });

            const responseText = await response.text();
            lastStatus = response.status;
            lastResponseText = responseText;

            if (response.ok) {
                try {
                    const data = JSON.parse(responseText);
                    return res.status(200).json(data);
                } catch (e) {
                    return res.status(500).json({ message: 'JSON 파싱 실패', raw: responseText });
                }
            }
        }

        // 모든 시도가 실패한 경우 Roboflow의 실제 상세 오류 문구 반환
        console.error("Roboflow 최종 실패 응답:", lastResponseText);
        return res.status(lastStatus).json({
            message: `Roboflow API 호출 실패 (${lastStatus})`,
            details: lastResponseText
        });

    } catch (error) {
        console.error("서버 내부 오류:", error);
        return res.status(500).json({ 
            message: '서버 내부 오류가 발생했습니다.', 
            error: error.toString() 
        });
    }
}