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

        const ROBOFLOW_API_KEY = process.env.ROBOFLOW_API_KEY;
        const ROBOFLOW_ENDPOINT = process.env.ROBOFLOW_ENDPOINT;

        if (!ROBOFLOW_API_KEY || !ROBOFLOW_ENDPOINT) {
            return res.status(500).json({ 
                message: 'Vercel 환경변수(ROBOFLOW_API_KEY 또는 ROBOFLOW_ENDPOINT)가 설정되지 않았습니다.' 
            });
        }

        // Base64 텍스트 부분만 정제
        const base64Data = image.includes(',') ? image.split(',')[1] : image;

        // URL 정리 및 ?api_key= 결합
        const cleanEndpoint = ROBOFLOW_ENDPOINT.replace(/\/$/, "");
        const separator = cleanEndpoint.includes('?') ? '&' : '?';
        const targetUrl = `${cleanEndpoint}${separator}api_key=${ROBOFLOW_API_KEY}`;

        // Roboflow Serverless Workflow 표준 페이로드 구조 생성
        const payload = {
            inputs: {
                image: {
                    type: "base64",
                    value: base64Data
                }
            }
        };

        const response = await fetch(targetUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
        });

        const rawText = await response.text();

        if (!response.ok) {
            console.error("Roboflow API 오류 응답:", rawText);
            return res.status(response.status).json({ 
                message: `Roboflow API 호출 실패 (${response.status})`, 
                details: rawText 
            });
        }

        let data;
        try {
            data = JSON.parse(rawText);
        } catch (e) {
            return res.status(500).json({ message: 'Roboflow 응답을 파싱할 수 없습니다.', raw: rawText });
        }

        return res.status(200).json(data);

    } catch (error) {
        console.error("서버 내부 예외 오류:", error);
        return res.status(500).json({ message: '서버 내부 오류가 발생했습니다.', error: error.toString() });
    }
}